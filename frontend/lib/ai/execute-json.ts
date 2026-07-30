import "server-only";

import OpenAI from "openai";
import {
  BYOK_API_KEY_HEADER,
  MAX_BYOK_API_KEY_LENGTH,
  type AiPublicError,
  type AiPublicErrorCode,
} from "@/lib/ai/http-contract";
import {
  getModelCandidates,
  isModelAvailabilityError,
  isModelTimeout,
} from "@/lib/ai/model-cascade";
import {
  recordAiUsage,
  resolveAiRuntime,
  type RecordAiUsageInput,
  type ResolvedAiRuntime,
} from "@/lib/ai/runtime";
import type { AiFeature, AiProvider, AiQuotaBlockReason } from "@/types/ai";

type CompletionParams =
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

export type AiCompletionTuning = Partial<
  Pick<CompletionParams, "reasoning_effort" | "response_format" | "temperature">
>;

export interface ExecuteAiJsonOptions<T> {
  request: Request;
  userId: string;
  feature: AiFeature;
  systemPrompt: string;
  userPrompts: readonly string[];
  maxCompletionTokensPerAttempt: number;
  timeoutMs: number;
  parse: (rawText: string) => T | null;
  createDemoRaw: () => string;
  tuning?: (provider: AiProvider) => AiCompletionTuning;
}

export type AiExecutionResult<T> =
  | {
      ok: true;
      value: T;
      mode: "demo" | "managed" | "byok";
      provider: AiProvider | null;
      model: string | null;
      tokensUsed: number;
    }
  | AiExecutionFailure;

interface AiExecutionFailure {
  ok: false;
  status: number;
  body: AiPublicError;
}

interface ByokHeaderSuccess {
  ok: true;
  value?: string;
}

type ByokHeaderResult = ByokHeaderSuccess | AiExecutionFailure;

const QUOTA_FAILURES: Record<
  AiQuotaBlockReason,
  { code: AiPublicErrorCode; error: string }
> = {
  DAILY_REQUEST_LIMIT: {
    code: "AI_QUOTA_DAILY_REQUEST",
    error: "Alcanzaste el límite diario de solicitudes Managed.",
  },
  MONTHLY_REQUEST_LIMIT: {
    code: "AI_QUOTA_MONTHLY_REQUEST",
    error: "Alcanzaste el límite mensual de solicitudes Managed.",
  },
  DAILY_TOKEN_LIMIT: {
    code: "AI_QUOTA_DAILY_TOKEN",
    error: "Alcanzaste el límite diario de tokens Managed.",
  },
  MONTHLY_TOKEN_LIMIT: {
    code: "AI_QUOTA_MONTHLY_TOKEN",
    error: "Alcanzaste el límite mensual de tokens Managed.",
  },
};

function failure(
  status: number,
  code: AiPublicErrorCode,
  error: string,
  reason?: AiQuotaBlockReason,
): AiExecutionFailure {
  return {
    ok: false,
    status,
    body: {
      error,
      code,
      ...(reason ? { reason } : {}),
    },
  };
}

function readByokHeader(request: Request): ByokHeaderResult {
  const rawValue = request.headers.get(BYOK_API_KEY_HEADER);
  if (rawValue === null) return { ok: true };

  const value = rawValue.trim();
  if (
    value.length === 0 ||
    value.length > MAX_BYOK_API_KEY_LENGTH ||
    /[\r\n]/.test(value)
  ) {
    return failure(
      400,
      "AI_BYOK_KEY_INVALID",
      "La API key temporal tiene un formato inválido.",
    );
  }

  return { ok: true, value };
}

function estimateTokens(text: string): number {
  return text.length === 0 ? 0 : Math.max(1, Math.ceil(text.length / 3));
}

function validUsage(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

async function recordOrFail(
  input: RecordAiUsageInput,
): Promise<AiExecutionFailure | null> {
  try {
    await recordAiUsage(input);
    return null;
  } catch {
    return failure(
      503,
      "AI_USAGE_UNAVAILABLE",
      "No se pudo cerrar la auditoría de esta operación de IA.",
    );
  }
}

function unavailableFailure(
  reason:
    | "BYOK_KEY_REQUIRED"
    | "PROVIDER_CONFIGURATION_ERROR"
    | "QUOTA_SERVICE_UNAVAILABLE"
    | "INVALID_RUNTIME_REQUEST",
): AiExecutionFailure {
  switch (reason) {
    case "BYOK_KEY_REQUIRED":
      return failure(
        400,
        "AI_BYOK_KEY_REQUIRED",
        "Configura una API key temporal para usar el modo BYOK.",
      );
    case "PROVIDER_CONFIGURATION_ERROR":
      return failure(
        503,
        "AI_CONFIGURATION_UNAVAILABLE",
        "El proveedor configurado no está disponible.",
      );
    case "QUOTA_SERVICE_UNAVAILABLE":
      return failure(
        503,
        "AI_QUOTA_UNAVAILABLE",
        "No se pudo verificar la cuota de IA. Intenta de nuevo.",
      );
    case "INVALID_RUNTIME_REQUEST":
      return failure(
        500,
        "AI_RUNTIME_INVALID",
        "La operación de IA no pudo prepararse.",
      );
  }
}

function resolvedRuntimeFailure(
  resolved: ResolvedAiRuntime,
): AiExecutionFailure | null {
  if (resolved.status === "blocked") {
    const quota = QUOTA_FAILURES[resolved.reason];
    return failure(429, quota.code, quota.error, resolved.reason);
  }

  if (resolved.status === "duplicate") {
    return failure(
      409,
      "AI_REQUEST_DUPLICATE",
      "Esta operación de IA ya fue procesada.",
    );
  }

  return resolved.status === "unavailable"
    ? unavailableFailure(resolved.reason)
    : null;
}

export async function executeAiJson<T>(
  options: ExecuteAiJsonOptions<T>,
): Promise<AiExecutionResult<T>> {
  if (
    options.userPrompts.length === 0 ||
    options.userPrompts.length > 2 ||
    !Number.isInteger(options.maxCompletionTokensPerAttempt) ||
    options.maxCompletionTokensPerAttempt <= 0
  ) {
    return failure(
      500,
      "AI_RUNTIME_INVALID",
      "La operación de IA no pudo prepararse.",
    );
  }

  const byok = readByokHeader(options.request);
  if (!byok.ok) return byok;

  const reservationPrompt = options.userPrompts
    .map((userPrompt) => options.systemPrompt + "\n" + userPrompt)
    .join("\n");
  const reservationCompletionTokens =
    options.maxCompletionTokensPerAttempt * options.userPrompts.length;

  const runtimeRequest = {
    userId: options.userId,
    feature: options.feature,
    promptText: reservationPrompt,
    maxCompletionTokens: reservationCompletionTokens,
    timeoutMs: options.timeoutMs,
    byokApiKey: byok.value,
  } as const;

  let resolved: ResolvedAiRuntime;
  try {
    resolved = await resolveAiRuntime({
      ...runtimeRequest,
      eventId: crypto.randomUUID(),
    });
  } catch {
    return failure(
      503,
      "AI_QUOTA_UNAVAILABLE",
      "No se pudo preparar la operación de IA. Intenta de nuevo.",
    );
  }

  const initialFailure = resolvedRuntimeFailure(resolved);
  if (initialFailure) return initialFailure;

  if (resolved.status === "demo") {
    let value: T | null = null;
    try {
      value = options.parse(options.createDemoRaw());
    } catch {
      value = null;
    }

    if (value === null) {
      const usageFailure = await recordOrFail({
        eventId: resolved.eventId,
        userId: options.userId,
        feature: options.feature,
        mode: "demo",
        provider: null,
        model: null,
        status: "error",
        errorCode: "AI_DEMO_FIXTURE_INVALID",
        fallbackPromptTokens: 0,
        fallbackCompletionTokens: 0,
      });
      if (usageFailure) return usageFailure;

      return failure(
        500,
        "AI_DEMO_FIXTURE_INVALID",
        "El fixture educativo de Demo no cumple el contrato.",
      );
    }

    const usageFailure = await recordOrFail({
      eventId: resolved.eventId,
      userId: options.userId,
      feature: options.feature,
      mode: "demo",
      provider: null,
      model: null,
      status: "success",
      fallbackPromptTokens: 0,
      fallbackCompletionTokens: 0,
    });
    if (usageFailure) return usageFailure;

    return {
      ok: true,
      value,
      mode: "demo",
      provider: null,
      model: null,
      tokensUsed: 0,
    };
  }

  if (resolved.status !== "ready") {
    return failure(
      500,
      "AI_RUNTIME_INVALID",
      "La operación de IA no pudo prepararse.",
    );
  }

  const modelCandidates = getModelCandidates(resolved.provider, resolved.model);
  if (modelCandidates.length === 0) {
    return unavailableFailure("PROVIDER_CONFIGURATION_ERROR");
  }

  let activeRuntime = resolved;
  let previousModelTokens = 0;

  for (
    let modelIndex = 0;
    modelIndex < modelCandidates.length;
    modelIndex += 1
  ) {
    if (modelIndex > 0) {
      let nextRuntime: ResolvedAiRuntime;
      try {
        nextRuntime = await resolveAiRuntime({
          ...runtimeRequest,
          eventId: crypto.randomUUID(),
          modelOverride: modelCandidates[modelIndex],
        });
      } catch {
        return failure(
          503,
          "AI_QUOTA_UNAVAILABLE",
          "No se pudo preparar la operación de IA. Intenta de nuevo.",
        );
      }

      const fallbackRuntimeFailure = resolvedRuntimeFailure(nextRuntime);
      if (fallbackRuntimeFailure) return fallbackRuntimeFailure;
      if (nextRuntime.status !== "ready") {
        return failure(
          500,
          "AI_RUNTIME_INVALID",
          "La operación de IA no pudo prepararse.",
        );
      }
      activeRuntime = nextRuntime;
    }

    let promptTokens = 0;
    let completionTokens = 0;
    let tryNextModel = false;

    for (
      let attemptIndex = 0;
      attemptIndex < options.userPrompts.length;
      attemptIndex += 1
    ) {
      const userPrompt = options.userPrompts[attemptIndex];
      const fallbackPromptTokens = estimateTokens(
        options.systemPrompt + "\n" + userPrompt,
      );
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

      try {
        const params: CompletionParams = {
          model: activeRuntime.model,
          messages: [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: options.maxCompletionTokensPerAttempt,
          response_format: { type: "json_object" },
          ...(options.tuning?.(activeRuntime.provider) ?? {}),
        };

        const completion =
          await activeRuntime.runtime.client.chat.completions.create(params, {
            signal: controller.signal,
          });
        const rawText = completion.choices[0]?.message?.content ?? "";
        console.log("[executeAiJson] Raw LLM text:", rawText);

        promptTokens +=
          validUsage(completion.usage?.prompt_tokens) ?? fallbackPromptTokens;
        completionTokens +=
          validUsage(completion.usage?.completion_tokens) ??
          estimateTokens(rawText);

        let value: T | null = null;
        try {
          value = rawText.length > 0 ? options.parse(rawText) : null;
          if (value === null) {
            console.warn("[executeAiJson] parse() returned null for rawText.");
          }
        } catch (e) {
          console.error("[executeAiJson] parse() threw error:", e);
          value = null;
        }

        if (value !== null) {
          const usageFailure = await recordOrFail({
            eventId: activeRuntime.eventId,
            userId: options.userId,
            feature: options.feature,
            mode: activeRuntime.mode,
            provider: activeRuntime.provider,
            model: activeRuntime.model,
            status: "success",
            providerUsage: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
            },
            fallbackPromptTokens: promptTokens,
            fallbackCompletionTokens: completionTokens,
          });
          if (usageFailure) return usageFailure;

          return {
            ok: true,
            value,
            mode: activeRuntime.mode,
            provider: activeRuntime.provider,
            model: activeRuntime.model,
            tokensUsed:
              previousModelTokens + promptTokens + completionTokens,
          };
        }
      } catch (caught) {
        promptTokens += fallbackPromptTokens;
        const timedOut = controller.signal.aborted || isModelTimeout(caught);
        const internalCode = timedOut
          ? "AI_PROVIDER_TIMEOUT"
          : "AI_PROVIDER_UNAVAILABLE";
        const usageFailure = await recordOrFail({
          eventId: activeRuntime.eventId,
          userId: options.userId,
          feature: options.feature,
          mode: activeRuntime.mode,
          provider: activeRuntime.provider,
          model: activeRuntime.model,
          status: "error",
          errorCode: internalCode,
          providerUsage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
          },
          fallbackPromptTokens: promptTokens,
          fallbackCompletionTokens: completionTokens,
        });
        if (usageFailure) return usageFailure;

        previousModelTokens += promptTokens + completionTokens;
        tryNextModel =
          isModelAvailabilityError(caught) &&
          modelIndex + 1 < modelCandidates.length;

        if (!tryNextModel) {
          return timedOut
            ? failure(
                504,
                "AI_PROVIDER_TIMEOUT",
                "El proveedor de IA no respondió a tiempo.",
              )
            : failure(
                502,
                "AI_PROVIDER_UNAVAILABLE",
                "El proveedor de IA no pudo completar la solicitud.",
              );
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (tryNextModel) break;
    }

    if (tryNextModel) continue;

    const usageFailure = await recordOrFail({
      eventId: activeRuntime.eventId,
      userId: options.userId,
      feature: options.feature,
      mode: activeRuntime.mode,
      provider: activeRuntime.provider,
      model: activeRuntime.model,
      status: "error",
      errorCode: "AI_INVALID_RESPONSE",
      providerUsage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      },
      fallbackPromptTokens: promptTokens,
      fallbackCompletionTokens: completionTokens,
    });
    if (usageFailure) return usageFailure;

    return failure(
      502,
      "AI_INVALID_RESPONSE",
      "El proveedor devolvió una respuesta incompatible.",
    );
  }

  return failure(
    502,
    "AI_PROVIDER_UNAVAILABLE",
    "El proveedor de IA no pudo completar la solicitud.",
  );
}
