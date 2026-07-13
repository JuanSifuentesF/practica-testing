import OpenAI from "openai";

export type LlmProvider = "gemini" | "openai";

export interface ModelRuntime {
  provider: LlmProvider;
  model: string;
  client: OpenAI;
  timeoutMs: number;
}

interface CreateModelRuntimesOptions {
  timeoutMs: number;
  geminiModels?: Array<string | undefined>;
  openaiModels?: Array<string | undefined>;
  providers?: LlmProvider[];
  maxRetries?: number;
}

const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai";

const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
] as const;

const DEFAULT_OPENAI_MODELS = ["gpt-4o-mini"] as const;

function uniqueModelNames(models: Array<string | undefined>): string[] {
  return [
    ...new Set(
      models
        .map((model) => model?.trim())
        .filter((model): model is string => Boolean(model)),
    ),
  ];
}

export function createModelRuntimes({
  timeoutMs,
  geminiModels = [],
  openaiModels = [],
  providers = ["gemini", "openai"],
  maxRetries = 1,
}: CreateModelRuntimesOptions): ModelRuntime[] {
  const runtimes: ModelRuntime[] = [];

  if (providers.includes("gemini")) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const client = new OpenAI({
        apiKey: geminiKey,
        baseURL: process.env.GEMINI_OPENAI_BASE_URL || GEMINI_OPENAI_BASE_URL,
        timeout: timeoutMs + 15_000,
        maxRetries,
      });

      for (const model of uniqueModelNames([
        ...geminiModels,
        ...DEFAULT_GEMINI_MODELS,
      ])) {
        runtimes.push({ provider: "gemini", model, client, timeoutMs });
      }
    }
  }

  if (providers.includes("openai")) {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const client = new OpenAI({
        apiKey: openaiKey,
        timeout: timeoutMs + 15_000,
        maxRetries,
      });

      for (const model of uniqueModelNames([
        ...openaiModels,
        ...DEFAULT_OPENAI_MODELS,
      ])) {
        runtimes.push({ provider: "openai", model, client, timeoutMs });
      }
    }
  }

  return runtimes;
}

export function isModelTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "APIUserAbortError")
  );
}

export function getModelErrorStatus(error: unknown): number | "unknown" {
  return error instanceof OpenAI.APIError ? error.status : "unknown";
}
