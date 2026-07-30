import os
import re

directory = '.'

files = [
    'dashboard-summary-cards.tsx',
    'practice-progress-card.tsx',
    'score-chart.tsx',
    'time-comparison-chart.tsx',
    'topic-heatmap.tsx'
]

replacements = [
    (r'\btext-white\b', 'text-foreground'),
    (r'\btext-slate-200\b', 'text-foreground'),
    (r'\btext-slate-300\b', 'text-foreground'),
    (r'\btext-slate-400\b', 'text-muted-foreground'),
    (r'\btext-slate-500\b', 'text-muted-foreground'),
    (r'\btext-slate-600\b', 'text-muted-foreground'),
    (r'\btext-slate-100\b', 'text-foreground'),
    (r'\bbg-slate-900/50\b', 'bg-card'),
    (r'\bbg-slate-900/30\b', 'bg-card'),
    (r'\bbg-slate-900\b', 'bg-card'),
    (r'\bbg-slate-800/50\b', 'bg-muted'),
    (r'\bbg-slate-800/30\b', 'bg-muted/50'),
    (r'\bbg-slate-800\b', 'bg-muted'),
    (r'\bbg-slate-700\b', 'bg-muted'),
    (r'\bbg-slate-950/40\b', 'bg-card'),
    (r'\bbg-slate-950/60\b', 'bg-card'),
    (r'\bbg-slate-950/30\b', 'bg-muted/30'),
    (r'\bbg-slate-950/35\b', 'bg-card'),
    (r'\bbg-slate-950/95\b', 'bg-card/95'),
    (r'\bbg-slate-950/70\b', 'bg-muted/70'),
    (r'\bborder-slate-800\b', 'border-border'),
    (r'\bborder-slate-700\b', 'border-border'),
    (r'\bborder-slate-700/50\b', 'border-border/50'),
    (r'\bborder-slate-600\b', 'border-border'),
    (r'\bdivide-slate-800\b', 'divide-border'),
]

for filename in files:
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We shouldn't replace text-white on emerald-600 or inside conditional buttons, wait. 
    # Let's inspect the files for those exceptions before blindly replacing.
    # Actually, in the files, the buttons don't have text-white except the badge `bg-white/10 text-white` in summary cards.
    # I already did dashboard-summary-cards and practice-progress manually, mostly.
    
    # Let's just do the ones I missed or replace everything systematically
    
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    # Put back specific text-white that I want to preserve
    # Example: bg-white/10 px-3 py-1 text-xs font-bold text-foreground -> text-white
    content = content.replace('bg-white/10 px-3 py-1 text-xs font-bold text-foreground', 'bg-white/10 px-3 py-1 text-xs font-bold text-white')
    content = content.replace('text-foreground on buttons', 'text-white on buttons') # just an example if needed
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")
