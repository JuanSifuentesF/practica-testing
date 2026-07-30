// frontend/app/(dashboard)/settings/ai/_components/model-selector.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AI_PROVIDER_REGISTRY } from "@/lib/ai/provider-registry";
import type { AiProvider, AiUsageMode } from "@/types";

interface ModelSelectorProps {
  readonly mode: AiUsageMode;
  readonly selectedProvider: AiProvider;
  readonly selectedModel: string | null;
  readonly isSaving: boolean;
  readonly onSelectionChange: (provider: AiProvider, modelName: string | null) => void;
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) {
    return `${Math.round(tokens / 1000000)}M`;
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}k`;
  }
  return `${tokens}`;
}

export function ModelSelector({
  mode,
  selectedProvider,
  selectedModel,
  isSaving,
  onSelectionChange,
}: ModelSelectorProps) {
  if (mode === "demo") return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const [provider, modelName] = value.split(":");
    onSelectionChange(provider as AiProvider, modelName === "auto" ? null : modelName);
  }

  // El valor actual en el select se codifica como "proveedor:modelo" o "proveedor:auto"
  const currentValue = `${selectedProvider}:${selectedModel ?? "auto"}`;

  return (
    <Card className="border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Modelo y Proveedor de IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Elige el proveedor y el modelo específico que deseas usar para procesar las solicitudes de teoría y prácticas.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="model-select" className="text-sm font-medium text-foreground">
            Modelo de generación
          </Label>
          <div className="relative">
            <select
              id="model-select"
              value={currentValue}
              onChange={handleChange}
              disabled={isSaving}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 appearance-none cursor-pointer"
            >
              {/* Grupo Google Gemini */}
              <optgroup label="Google Gemini">
                <option value="gemini:auto">
                  Gemini Automático / Default seguro (Recomendado)
                </option>
                {AI_PROVIDER_REGISTRY.gemini.models.map((model) => (
                  <option key={`gemini-${model.id}`} value={`gemini:${model.id}`}>
                    {model.name} (Contexto: {formatContextWindow(model.contextWindow)})
                  </option>
                ))}
              </optgroup>

              {/* Grupo OpenAI */}
              <optgroup label="OpenAI">
                <option value="openai:auto">
                  OpenAI Automático / Default seguro (Recomendado)
                </option>
                {AI_PROVIDER_REGISTRY.openai.models.map((model) => (
                  <option key={`openai-${model.id}`} value={`openai:${model.id}`}>
                    {model.name} (Contexto: {formatContextWindow(model.contextWindow)})
                  </option>
                ))}
              </optgroup>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
