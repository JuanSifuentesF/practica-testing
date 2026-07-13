import "server-only";

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

// Allowlist canonica. Una preferencia guardada en DB no es una
// autorizacion: solo estos identificadores pueden llegar al SDK.
export const MODEL_ALLOWLIST = {
  gemini: [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ],
  openai: ["gpt-4o-mini"],
} as const satisfies Record<LlmProvider, readonly string[]>;

export function isAllowedModel(
  provider: LlmProvider,
  model: string,
): boolean {
  return MODEL_ALLOWLIST[provider].some((candidate) => candidate === model);
}

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
        ...MODEL_ALLOWLIST.gemini,
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
        ...MODEL_ALLOWLIST.openai,
      ])) {
        runtimes.push({ provider: "openai", model, client, timeoutMs });
      }
    }
  }

  return runtimes;
}

interface CreateProviderRuntimeOptions {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries?: number;
}

export function createProviderRuntime({
  provider,
  model,
  apiKey,
  timeoutMs,
  maxRetries = 1,
}: CreateProviderRuntimeOptions): ModelRuntime {
  if (!isAllowedModel(provider, model)) {
    throw new Error("AI_MODEL_NOT_ALLOWED");
  }

  const client = new OpenAI({
    apiKey,
    baseURL:
      provider === "gemini"
        ? process.env.GEMINI_OPENAI_BASE_URL || GEMINI_OPENAI_BASE_URL
        : undefined,
    timeout: timeoutMs + 15_000,
    maxRetries,
  });

  return { provider, model, client, timeoutMs };
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
