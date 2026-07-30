export type LlmProvider = "gemini" | "openai";

export interface AiModelDescriptor {
  readonly id: string;
  readonly name: string;
  readonly provider: LlmProvider;
  readonly contextWindow: number;
  readonly supportsStructuredOutput: boolean;
  readonly isDefault: boolean;
}

export interface AiProviderDescriptor {
  readonly id: LlmProvider;
  readonly name: string;
  readonly description: string;
  readonly models: readonly AiModelDescriptor[];
}

export const AI_PROVIDER_REGISTRY: Record<LlmProvider, AiProviderDescriptor> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    description: "Modelos de alta velocidad y razonamiento multimodal de Google DeepMind.",
    models: [
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        provider: "gemini",
        contextWindow: 1048576,
        supportsStructuredOutput: true,
        isDefault: true,
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        provider: "gemini",
        contextWindow: 2097152,
        supportsStructuredOutput: true,
        isDefault: false,
      },
      {
        id: "gemini-3.5-flash",
        name: "Gemini 3.5 Flash",
        provider: "gemini",
        contextWindow: 1048576,
        supportsStructuredOutput: true,
        isDefault: false,
      },
      {
        id: "gemini-3.1-pro-preview",
        name: "Gemini 3.1 Pro Preview",
        provider: "gemini",
        contextWindow: 2097152,
        supportsStructuredOutput: true,
        isDefault: false,
      },
      {
        id: "gemini-3.1-flash-lite",
        name: "Gemini 3.1 Flash Lite",
        provider: "gemini",
        contextWindow: 1048576,
        supportsStructuredOutput: true,
        isDefault: false,
      },
      {
        id: "gemini-3-pro-preview",
        name: "Gemini 3 Pro Preview",
        provider: "gemini",
        contextWindow: 2097152,
        supportsStructuredOutput: true,
        isDefault: false,
      },
      {
        id: "gemini-3-flash-preview",
        name: "Gemini 3 Flash Preview",
        provider: "gemini",
        contextWindow: 1048576,
        supportsStructuredOutput: true,
        isDefault: false,
      },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "Modelos GPT de propósito general para generación estructurada.",
    models: [
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        provider: "openai",
        contextWindow: 128000,
        supportsStructuredOutput: true,
        isDefault: true,
      },
    ],
  },
};

export function validateModelAllowlist(provider: string, modelId: string): boolean {
  if (provider !== "gemini" && provider !== "openai") {
    return false;
  }
  const providerDescriptor = AI_PROVIDER_REGISTRY[provider as LlmProvider];
  if (!providerDescriptor) {
    return false;
  }
  return providerDescriptor.models.some((candidate) => candidate.id === modelId);
}

export function getDefaultModelForProvider(provider: LlmProvider): string {
  const descriptor = AI_PROVIDER_REGISTRY[provider];
  const defaultModel = descriptor.models.find((m) => m.isDefault);
  return defaultModel ? defaultModel.id : descriptor.models[0].id;
}
