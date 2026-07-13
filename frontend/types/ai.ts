// El dominio reutiliza los unions del schema en vez de declarar
// una segunda lista de modos/proveedores que pueda divergir.
import type {
  AiFeatureDB,
  AiProviderDB,
  AiUsageModeDB,
  AiUsageStatusDB,
  Database,
} from "./database";

export type AiUsageMode = AiUsageModeDB;
export type AiProvider = AiProviderDB;
export type AiFeature = AiFeatureDB;
export type AiUsageStatus = AiUsageStatusDB;

export type UserAiSettingsRow =
  Database["public"]["Tables"]["user_ai_settings"]["Row"];
export type AiUsageEventRow =
  Database["public"]["Tables"]["ai_usage_events"]["Row"];

export type AiQuotaBlockReason =
  | "DAILY_REQUEST_LIMIT"
  | "MONTHLY_REQUEST_LIMIT"
  | "DAILY_TOKEN_LIMIT"
  | "MONTHLY_TOKEN_LIMIT";

export interface AiUsageSummary {
  daily_requests: number;
  daily_tokens: number;
  monthly_requests: number;
  monthly_tokens: number;
}

export interface AiRuntimeRequest {
  // userId proviene exclusivamente de supabase.auth.getUser().
  userId: string;
  // eventId se genera una vez y se conserva durante reintentos.
  eventId: string;
  feature: AiFeature;
  promptText: string;
  maxCompletionTokens: number;
  timeoutMs: number;
  byokApiKey?: string;
}

interface AiRuntimeBase {
  eventId: string;
  settings: UserAiSettingsRow;
}

export interface AiRuntimeDemo extends AiRuntimeBase {
  status: "demo";
  mode: "demo";
}

export interface AiRuntimeBlocked extends AiRuntimeBase {
  status: "blocked";
  mode: "managed";
  reason: AiQuotaBlockReason;
  usage: AiUsageSummary;
}

export interface AiRuntimeDuplicate extends AiRuntimeBase {
  status: "duplicate";
  mode: "managed";
}

export interface AiRuntimeUnavailable extends AiRuntimeBase {
  status: "unavailable";
  mode: AiUsageMode;
  reason:
    | "BYOK_KEY_REQUIRED"
    | "PROVIDER_CONFIGURATION_ERROR"
    | "QUOTA_SERVICE_UNAVAILABLE"
    | "INVALID_RUNTIME_REQUEST";
}

export interface AiRuntimeReady extends AiRuntimeBase {
  status: "ready";
  mode: "managed" | "byok";
  provider: AiProvider;
  model: string;
  modelWasDefaulted: boolean;
  estimatedPromptTokens: number;
  maxCompletionTokens: number;
  usage: AiUsageSummary;
}

export type AiRuntimeResult =
  | AiRuntimeDemo
  | AiRuntimeBlocked
  | AiRuntimeDuplicate
  | AiRuntimeUnavailable
  | AiRuntimeReady;

export interface ProviderUsage {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
}
