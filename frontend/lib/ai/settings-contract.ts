// frontend/lib/ai/settings-contract.ts
import type { AiProvider, AiUsageMode, UserAiSettingsRow } from "@/types";

// La base de datos continúa siendo la autoridad. Estas constantes solo
// reflejan sus CHECK constraints para rechazar temprano datos del navegador.
export const AI_USAGE_MODES = [
  "demo",
  "managed",
  "byok",
] as const satisfies readonly AiUsageMode[];
export const AI_PROVIDERS = [
  "gemini",
  "openai",
] as const satisfies readonly AiProvider[];

type AiSettingsDefaults = Pick<
  UserAiSettingsRow,
  | "mode"
  | "provider"
  | "model_name"
  | "daily_request_limit"
  | "monthly_request_limit"
  | "daily_token_limit"
  | "monthly_token_limit"
>;

// `Pick` es intencional. UserAiSettingsRow tiene un index signature generado
// por la base de datos; Omit sobre ese tipo pierde las claves concretas.
export const AI_SETTINGS_DEFAULTS = {
  mode: "demo",
  provider: "gemini",
  model_name: null,
  daily_request_limit: 2_000_000_000,
  monthly_request_limit: 2_000_000_000,
  daily_token_limit: 2_000_000_000,
  monthly_token_limit: 2_000_000_000,
} satisfies AiSettingsDefaults;

export interface AiSettingsPreferencesUpdate {
  mode?: AiUsageMode;
  provider?: AiProvider;
  model_name?: string | null;
}

export function createDefaultAiSettings(userId: string): UserAiSettingsRow {
  return {
    user_id: userId,
    ...AI_SETTINGS_DEFAULTS,
    updated_at: new Date().toISOString(),
  };
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAiUsageMode(value: unknown): AiUsageMode | null {
  switch (value) {
    case "demo":
    case "managed":
    case "byok":
      return value;
    default:
      return null;
  }
}

export function parseAiProvider(value: unknown): AiProvider | null {
  switch (value) {
    case "gemini":
    case "openai":
      return value;
    default:
      return null;
  }
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function isUserAiSettingsRow(
  value: unknown,
): value is UserAiSettingsRow {
  if (!isPlainObject(value)) return false;

  return (
    typeof value.user_id === "string" &&
    parseAiUsageMode(value.mode) !== null &&
    parseAiProvider(value.provider) !== null &&
    (value.model_name === null || typeof value.model_name === "string") &&
    isNonNegativeInteger(value.daily_request_limit) &&
    isNonNegativeInteger(value.monthly_request_limit) &&
    isNonNegativeInteger(value.daily_token_limit) &&
    isNonNegativeInteger(value.monthly_token_limit) &&
    typeof value.updated_at === "string"
  );
}

export function isAiSettingsApiResponse(
  value: unknown,
): value is { data: UserAiSettingsRow } {
  return isPlainObject(value) && isUserAiSettingsRow(value.data);
}

export function getApiErrorCode(value: unknown): string | null {
  return isPlainObject(value) && typeof value.error === "string"
    ? value.error
    : null;
}
