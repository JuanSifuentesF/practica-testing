import "server-only";

import OpenAI from "openai";

export type LlmProvider = "gemini" | "openai";

export interface ModelRuntime {
  provider: LlmProvider;
  model: string;
  client: OpenAI;
  timeoutMs: number;
}

const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai";

export const MODEL_ALLOWLIST = {
  gemini: [
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite",
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
  ],
  openai: ["gpt-4o-mini"],
} as const satisfies Record<LlmProvider, readonly string[]>;

export function isAllowedModel(provider: LlmProvider, model: string): boolean {
  return MODEL_ALLOWLIST[provider].some((candidate) => candidate === model);
}

export function getModelCandidates(
  provider: LlmProvider,
  firstModel: string,
): string[] {
  const models = MODEL_ALLOWLIST[provider];
  const startIndex = models.findIndex((candidate) => candidate === firstModel);
  return startIndex === -1 ? [] : models.slice(startIndex);
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
  maxRetries = 0,
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

export function isModelAvailabilityError(error: unknown): boolean {
  if (isModelTimeout(error)) return true;
  if (error instanceof OpenAI.APIConnectionError) return true;

  if (
    error instanceof Error &&
    (error.name === "APIConnectionError" ||
      error.name === "APIConnectionTimeoutError")
  ) {
    return true;
  }

  if (error instanceof OpenAI.APIError) {
    return (
      error.status === 404 ||
      error.status === 408 ||
      error.status === 409 ||
      error.status === 429 ||
      (typeof error.status === "number" && error.status >= 500)
    );
  }

  return false;
}
