// frontend/app/(dashboard)/settings/ai/_components/provider-selector.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseAiProvider } from "@/lib/ai/settings-contract";
import type { AiProvider, AiUsageMode } from "@/types";

interface ProviderSelectorProps {
  mode: AiUsageMode;
  provider: AiProvider;
  isSaving: boolean;
  onProviderChange: (provider: AiProvider) => void;
}

const PROVIDERS: ReadonlyArray<{
  value: AiProvider;
  label: string;
  description: string;
}> = [
  {
    value: "gemini",
    label: "Google Gemini",
    description:
      "El runtime aplicará exclusivamente modelos permitidos para Gemini.",
  },
  {
    value: "openai",
    label: "OpenAI",
    description:
      "El runtime aplicará exclusivamente modelos permitidos para OpenAI.",
  },
];

export function ProviderSelector({
  mode,
  provider,
  isSaving,
  onProviderChange,
}: ProviderSelectorProps) {
  if (mode === "demo") return null;

  function handleChange(value: string) {
    const nextProvider = parseAiProvider(value);
    if (nextProvider) onProviderChange(nextProvider);
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">
          Proveedor de IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <RadioGroup
          value={provider}
          onValueChange={handleChange}
          disabled={isSaving}
          className="space-y-3"
        >
          {PROVIDERS.map((option) => {
            const selected = provider === option.value;
            return (
              <div
                key={option.value}
                className={
                  selected
                    ? "flex items-start gap-3 rounded-lg border border-emerald-700 bg-emerald-950/30 p-4"
                    : "flex items-start gap-3 rounded-lg border border-border bg-card p-4 hover:border-border"
                }
              >
                <RadioGroupItem
                  value={option.value}
                  id={`provider-${option.value}`}
                  className="mt-1 border-border text-emerald-400"
                />
                <Label
                  htmlFor={`provider-${option.value}`}
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
        <p className="text-xs text-muted-foreground">
          El modelo se resuelve en el servidor mediante la allowlist de AI-02;
          no se guarda un nombre de modelo libre desde esta pantalla.
        </p>
      </CardContent>
    </Card>
  );
}
