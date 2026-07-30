"use client";

import React from "react";
import {
  AI_PROVIDER_REGISTRY,
  getDefaultModelForProvider,
} from "@/lib/ai/provider-registry";
import type { LlmProvider } from "@/lib/ai/model-cascade";

interface ProviderModelSelectorProps {
  readonly selectedProvider: LlmProvider;
  readonly selectedModel: string;
  readonly disabled?: boolean;
  readonly onSelectionChange: (provider: LlmProvider, modelId: string) => void;
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

export function ProviderModelSelector({
  selectedProvider,
  selectedModel,
  disabled = false,
  onSelectionChange,
}: ProviderModelSelectorProps) {
  const activeProviderDescriptor =
    AI_PROVIDER_REGISTRY[selectedProvider] ?? AI_PROVIDER_REGISTRY.gemini;

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as LlmProvider;
    const defaultModel = getDefaultModelForProvider(newProvider);
    onSelectionChange(newProvider, defaultModel);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectionChange(selectedProvider, e.target.value);
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="ai-provider-select" className="text-sm font-medium text-foreground">
          Proveedor de IA
        </label>
        <select
          id="ai-provider-select"
          value={selectedProvider}
          onChange={handleProviderChange}
          disabled={disabled}
          className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground focus:border-cyan-500 focus:outline-none disabled:opacity-50"
        >
          {Object.values(AI_PROVIDER_REGISTRY).map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="ai-model-select" className="text-sm font-medium text-foreground">
          Modelo Preferido
        </label>
        <select
          id="ai-model-select"
          value={selectedModel}
          onChange={handleModelChange}
          disabled={disabled}
          className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground focus:border-cyan-500 focus:outline-none disabled:opacity-50"
        >
          {activeProviderDescriptor.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} (Contexto: {formatContextWindow(model.contextWindow)})
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        {activeProviderDescriptor.description} La clave API vive únicamente en memoria durante tu sesión.
      </p>
    </div>
  );
}
