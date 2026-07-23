import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  createProviderRuntime,
  isAllowedModel,
  MODEL_ALLOWLIST,
  type ModelRuntime,
} from "@/lib/ai/model-cascade";

import type {
  AiProvider,
  AiQuotaBlockReason,
  AiRuntimeReady,
  AiRuntimeRequest,
  AiRuntimeResult,
  AiUsageMode,
  AiUsageSummary,
  ProviderUsage,
} from "@/types/ai";

import { createDefaultAiSettings } from "./settings-contract";

type ReadyRuntime = AiRuntimeReady & { runtime: ModelRuntime };
// El cliente OpenAI no forma parte del DTO serializable de types/ai.ts.
// Solo aparece en esta extensión server-only.
export type ResolvedAiRuntime =
  | Exclude<AiRuntimeResult, AiRuntimeReady>
  | ReadyRuntime;

export interface RecordAiUsageInput {
  eventId: string;
  userId: string;
  feature: AiRuntimeRequest["feature"];
  mode: "demo" | "managed" | "byok";
  provider: AiProvider | null;
  model: string | null;
  status: "success" | "error";
  errorCode?: string;
  providerUsage?: ProviderUsage;
  fallbackPromptTokens: number;
  fallbackCompletionTokens: number;
}

type ResolveAiRuntimeRequest = AiRuntimeRequest & {
  modelOverride?: string;
};

const EMPTY_USAGE: AiUsageSummary = {
  daily_requests: 0,
  daily_tokens: 0,
  monthly_requests: 0,
  monthly_tokens: 0,
};

function estimatePromptTokens(text: string): number {
  // Estimación deliberadamente conservadora para reservar antes
  // de que el proveedor entregue usage real.
  return Math.max(1, Math.ceil(text.length / 3));
}

function isValidRequest(request: AiRuntimeRequest): boolean {
  // Este guard valida datos de runtime; un cast TypeScript no bastaría.
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      request.eventId,
    ) &&
    request.promptText.length > 0 &&
    Number.isInteger(request.maxCompletionTokens) &&
    request.maxCompletionTokens > 0 &&
    Number.isInteger(request.timeoutMs) &&
    request.timeoutMs > 0
  );
}

function usageFromRow(row: {
  daily_requests: number;
  daily_tokens: number;
  monthly_requests: number;
  monthly_tokens: number;
}): AiUsageSummary {
  return {
    daily_requests: Number(row.daily_requests),
    daily_tokens: Number(row.daily_tokens),
    monthly_requests: Number(row.monthly_requests),
    monthly_tokens: Number(row.monthly_tokens),
  };
}

function isQuotaBlockReason(value: string | null): value is AiQuotaBlockReason {
  return (
    value === "DAILY_REQUEST_LIMIT" ||
    value === "MONTHLY_REQUEST_LIMIT" ||
    value === "DAILY_TOKEN_LIMIT" ||
    value === "MONTHLY_TOKEN_LIMIT"
  );
}

function providerKey(provider: AiProvider): string | undefined {
  return provider === "gemini"
    ? process.env.GEMINI_API_KEY
    : process.env.OPENAI_API_KEY;
}

export type AiRuntimeInspectionReason =
  | "BYOK_KEY_REQUIRED"
  | "PROVIDER_CONFIGURATION_ERROR"
  | "SETTINGS_READ_FAILED";

export type AiRuntimeInspectionResult =
  | { status: "demo"; mode: "demo" }
  | {
      status: "configured";
      mode: "managed" | "byok";
      provider: AiProvider;
      model: string;
      modelWasDefaulted: boolean;
    }
  | {
      status: "unavailable";
      mode: AiUsageMode;
      reason: AiRuntimeInspectionReason;
    };

export interface AiRuntimeInspectionRequest {
  userId: string;
  byokApiKey?: string;
}

export async function inspectAiRuntimeConfiguration(
  request: AiRuntimeInspectionRequest,
): Promise<AiRuntimeInspectionResult> {
  const fallbackSettings = createDefaultAiSettings(request.userId);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_ai_settings")
      .select("*")
      .eq("user_id", request.userId)
      .maybeSingle();

    const settings = data ?? fallbackSettings;
    if (error) {
      return {
        status: "unavailable",
        mode: settings.mode,
        reason: "SETTINGS_READ_FAILED",
      };
    }

    if (settings.mode === "demo") {
      return { status: "demo", mode: "demo" };
    }

    const provider = settings.provider;
    const requestedModel = settings.model_name?.trim();
    const model =
      requestedModel && isAllowedModel(provider, requestedModel)
        ? requestedModel
        : MODEL_ALLOWLIST[provider][0];
    const modelWasDefaulted = model !== requestedModel;
    const key =
      settings.mode === "byok"
        ? request.byokApiKey?.trim()
        : providerKey(provider);

    if (!key) {
      return {
        status: "unavailable",
        mode: settings.mode,
        reason:
          settings.mode === "byok"
            ? "BYOK_KEY_REQUIRED"
            : "PROVIDER_CONFIGURATION_ERROR",
      };
    }

    return {
      status: "configured",
      mode: settings.mode,
      provider,
      model,
      modelWasDefaulted,
    };
  } catch {
    return {
      status: "unavailable",
      mode: fallbackSettings.mode,
      reason: "SETTINGS_READ_FAILED",
    };
  }
}

/**
 * Adaptador tipado de la RPC. Mantenerlo separado permite probar la
 * reserva sin construir un cliente ni llamar a un proveedor externo.
 */
async function reserveAiQuota(
  admin: ReturnType<typeof createAdminClient>,
  request: AiRuntimeRequest,
  provider: AiProvider,
  model: string,
  estimatedPromptTokens: number,
) {
  return admin.rpc("reserve_ai_quota", {
    p_user_id: request.userId,
    p_event_id: request.eventId,
    p_feature: request.feature,
    p_provider: provider,
    p_model_name: model,
    p_reserved_prompt_tokens: estimatedPromptTokens,
    p_reserved_completion_tokens: request.maxCompletionTokens,
  });
}

export async function resolveAiRuntime(
  request: ResolveAiRuntimeRequest,
): Promise<ResolvedAiRuntime> {
  // El admin client es válido aquí porque el Route Handler ya autenticó
  // y userId proviene de getUser(), nunca del body sin verificar.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_ai_settings")
    .select("*")
    .eq("user_id", request.userId)
    .maybeSingle();

  const settings = data ?? createDefaultAiSettings(request.userId);

  // Fail-closed: una caída de settings/cuota nunca se interpreta como
  // "usuario sin consumo" ni autoriza una llamada managed.
  if (error || !isValidRequest(request)) {
    return {
      status: "unavailable",
      mode: settings.mode,
      reason: error ? "QUOTA_SERVICE_UNAVAILABLE" : "INVALID_RUNTIME_REQUEST",
      eventId: request.eventId,
      settings,
    };
  }

  if (settings.mode === "demo") {
    // Demo termina aquí: no lee keys, no reserva y no crea cliente.
    return { status: "demo", mode: "demo", eventId: request.eventId, settings };
  }

  const provider = settings.provider;
  const requestedModel = settings.model_name?.trim();
  const configuredModel =
    requestedModel && isAllowedModel(provider, requestedModel)
      ? requestedModel
      : MODEL_ALLOWLIST[provider][0];
  const model = request.modelOverride?.trim() || configuredModel;
  if (!isAllowedModel(provider, model)) {
    return {
      status: "unavailable",
      mode: settings.mode,
      reason: "PROVIDER_CONFIGURATION_ERROR",
      eventId: request.eventId,
      settings,
    };
  }
  const modelWasDefaulted = model !== requestedModel;
  const estimatedPromptTokens = estimatePromptTokens(request.promptText);

  const key =
    settings.mode === "byok"
      ? request.byokApiKey?.trim()
      : providerKey(provider);

  if (!key) {
    return {
      status: "unavailable",
      mode: settings.mode,
      reason:
        settings.mode === "byok"
          ? "BYOK_KEY_REQUIRED"
          : "PROVIDER_CONFIGURATION_ERROR",
      eventId: request.eventId,
      settings,
    };
  }

  let providerRuntime: ModelRuntime;
  try {
    providerRuntime = createProviderRuntime({
      provider,
      model,
      apiKey: key,
      timeoutMs: request.timeoutMs,
      maxRetries: 0,
    });
  } catch {
    return {
      status: "unavailable",
      mode: settings.mode,
      reason: "PROVIDER_CONFIGURATION_ERROR",
      eventId: request.eventId,
      settings,
    };
  }

  let usage = EMPTY_USAGE;

  if (settings.mode === "managed") {
    // Único punto autorizado para reservar costos de la plataforma.
    const reservation = await reserveAiQuota(
      admin,
      request,
      provider,
      model,
      estimatedPromptTokens,
    );

    const row = reservation.data?.[0];
    if (reservation.error || !row) {
      return {
        status: "unavailable",
        mode: "managed",
        reason: "QUOTA_SERVICE_UNAVAILABLE",
        eventId: request.eventId,
        settings,
      };
    }

    usage = usageFromRow(row);

    if (
      row.reservation_outcome === "blocked" &&
      isQuotaBlockReason(row.block_reason)
    ) {
      return {
        status: "blocked",
        mode: "managed",
        reason: row.block_reason,
        eventId: request.eventId,
        settings,
        usage,
      };
    }

    if (row.reservation_outcome === "duplicate") {
      // Un reintento con el mismo eventId nunca repite la llamada externa.
      return {
        status: "duplicate",
        mode: "managed",
        eventId: request.eventId,
        settings,
      };
    }
  }

  // La key se entrega directamente al SDK y no se copia al resultado.
  return {
    status: "ready",
    mode: settings.mode,
    provider,
    model,
    modelWasDefaulted,
    estimatedPromptTokens,
    maxCompletionTokens: request.maxCompletionTokens,
    eventId: request.eventId,
    settings,
    usage,
    runtime: providerRuntime,
  };
}

function nonNegativeInteger(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function normalizeUsage(input: RecordAiUsageInput) {
  // No confiar en total_tokens del proveedor: se deriva siempre de
  // prompt + completion para cumplir el CHECK de AI-01.
  const prompt =
    nonNegativeInteger(input.providerUsage?.prompt_tokens) ??
    input.fallbackPromptTokens;
  const completion =
    nonNegativeInteger(input.providerUsage?.completion_tokens) ??
    input.fallbackCompletionTokens;

  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: prompt + completion,
  };
}

export async function recordAiUsage(input: RecordAiUsageInput): Promise<void> {
  const normalizedErrorCode = input.errorCode?.trim();
  if (
    input.status === "error" &&
    (!normalizedErrorCode || normalizedErrorCode.length > 100)
  ) {
    throw new Error("AI_USAGE_ERROR_CODE_REQUIRED");
  }

  const hasExternalProvider = input.provider !== null && input.model !== null;
  if (
    input.fallbackPromptTokens < 0 ||
    input.fallbackCompletionTokens < 0 ||
    (input.mode === "demo" && hasExternalProvider) ||
    (input.mode !== "demo" && !hasExternalProvider)
  ) {
    throw new Error("AI_USAGE_INVALID_INPUT");
  }

  const tokens = normalizeUsage(input);
  if (input.mode === "demo" && tokens.total_tokens !== 0) {
    throw new Error("AI_USAGE_INVALID_INPUT");
  }

  const admin = createAdminClient();
  const values = {
    ...tokens,
    request_units: input.mode === "demo" ? 0 : 1,
    status: input.status,
    error_code: input.status === "success" ? null : normalizedErrorCode,
  } as const;

  if (input.mode === "managed") {
    // La RPC comparte el advisory lock con reserve_ai_quota. Acepta un reintento
    // idéntico como duplicate, pero nunca deja que otro payload reescriba el log.
    const finalized = await admin.rpc("finalize_managed_ai_usage", {
      p_user_id: input.userId,
      p_event_id: input.eventId,
      p_prompt_tokens: tokens.prompt_tokens,
      p_completion_tokens: tokens.completion_tokens,
      p_status: input.status,
      p_error_code:
        input.status === "success" ? null : (normalizedErrorCode ?? null),
    });
    const row = finalized.data?.[0];

    if (
      finalized.error ||
      !row ||
      (row.finalization_outcome !== "finalized" &&
        row.finalization_outcome !== "duplicate")
    ) {
      throw new Error("AI_USAGE_FINALIZATION_FAILED");
    }
    return;
  }

  // Demo y BYOK no necesitan reserva managed. La PK vuelve el INSERT
  // idempotente y el conflicto se acepta solo si conserva identidad.
  const inserted = await admin.from("ai_usage_events").insert({
    id: input.eventId,
    user_id: input.userId,
    feature: input.feature,
    mode: input.mode,
    provider: input.provider,
    model_name: input.model,
    ...values,
  });

  if (inserted.error?.code === "23505") {
    const existing = await admin
      .from("ai_usage_events")
      .select("user_id, feature, mode")
      .eq("id", input.eventId)
      .maybeSingle();

    const sameEvent =
      existing.data?.user_id === input.userId &&
      existing.data.feature === input.feature &&
      existing.data.mode === input.mode;

    if (!existing.error && sameEvent) return;
  }

  if (inserted.error) throw new Error("AI_USAGE_INSERT_FAILED");
}
