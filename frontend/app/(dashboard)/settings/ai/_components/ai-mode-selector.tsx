// frontend/app/(dashboard)/settings/ai/_components/ai-mode-selector.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseAiUsageMode } from "@/lib/ai/settings-contract";
import type { AiUsageMode } from "@/types";

interface AiModeSelectorProps {
  mode: AiUsageMode;
  isSaving: boolean;
  onModeChange: (mode: AiUsageMode) => void;
}

const MODE_OPTIONS: ReadonlyArray<{
  value: AiUsageMode;
  label: string;
  description: string;
}> = [
  {
    value: "demo",
    label: "Demo",
    description: "Explora el flujo educativo sin llamadas externas ni costo.",
  },
  {
    value: "managed",
    label: "Managed",
    description: "El servidor usa su key y aplica las cuotas de AI-01/AI-02.",
  },
  {
    value: "byok",
    label: "BYOK",
    description:
      "Aporta una key temporal que no se persiste en ningún storage.",
  },
];

export function AiModeSelector({
  mode,
  isSaving,
  onModeChange,
}: AiModeSelectorProps) {
  function handleChange(value: string) {
    const nextMode = parseAiUsageMode(value);
    if (nextMode) onModeChange(nextMode);
  }

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader>
        <CardTitle className="text-lg text-slate-100">Modo de IA</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={mode}
          onValueChange={handleChange}
          disabled={isSaving}
          className="space-y-3"
        >
          {MODE_OPTIONS.map((option) => {
            const selected = mode === option.value;
            return (
              <div
                key={option.value}
                className={
                  selected
                    ? "flex items-start gap-3 rounded-lg border border-emerald-700 bg-emerald-950/30 p-4"
                    : "flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4 hover:border-slate-700"
                }
              >
                <RadioGroupItem
                  value={option.value}
                  id={`mode-${option.value}`}
                  className="mt-1 border-slate-600 text-emerald-400"
                />
                <Label
                  htmlFor={`mode-${option.value}`}
                  className="cursor-pointer"
                >
                  <span className="font-medium text-slate-100">
                    {option.label}
                  </span>
                  <p className="mt-1 text-sm text-slate-400">
                    {option.description}
                  </p>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
