// frontend/app/(dashboard)/settings/ai/_components/ai-mode-selector.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <Card className="border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Modo de Consumo de IA
        </CardTitle>
        <CardDescription>
          Selecciona cómo se aprovisionarán las llamadas a los modelos de lenguaje.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <RadioGroup
          value={mode}
          onValueChange={handleChange}
          disabled={isSaving}
          className="grid gap-3 md:grid-cols-3"
        >
          {MODE_OPTIONS.map((option) => {
            const isSelected = mode === option.value;
            return (
              <div
                key={option.value}
                className={
                  isSelected
                    ? "flex items-start gap-3 rounded-lg border-2 border-emerald-500 bg-emerald-500/10 p-4 text-left transition-all cursor-pointer dark:bg-emerald-500/10 light:bg-emerald-50"
                    : "flex items-start gap-3 rounded-lg border border-border bg-card p-4 hover:border-slate-400 transition-all cursor-pointer"
                }
              >
                <RadioGroupItem
                  value={option.value}
                  id={`mode-${option.value}`}
                  className="mt-1"
                />
                <Label
                  htmlFor={`mode-${option.value}`}
                  className="cursor-pointer"
                >
                  <span className="font-medium text-foreground">
                    {option.label}
                  </span>
                  <p className="mt-1 text-sm text-muted-foreground">
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
