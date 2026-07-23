import type { AiQuotaBlockReason } from "@/types/ai";

export const BYOK_API_KEY_HEADER = "x-ai-byok-key";
export const MAX_BYOK_API_KEY_LENGTH = 512;

const STATIC_AI_FEATURE_PATHS = new Set([
  "/api/plan/generate",
  "/api/practice/generate",
  "/api/practice/evaluate",
]);

const SESSION_AI_FEATURE_PATH =
  /^\/api\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(theory|quiz|evaluate)$/i;

export function isAiFeaturePath(pathname: string): boolean {
  return (
    STATIC_AI_FEATURE_PATHS.has(pathname) ||
    SESSION_AI_FEATURE_PATH.test(pathname)
  );
}

export type AiPublicErrorCode =
  | "AI_BYOK_KEY_INVALID"
  | "AI_BYOK_KEY_REQUIRED"
  | "AI_CONFIGURATION_UNAVAILABLE"
  | "AI_DEMO_FIXTURE_INVALID"
  | "AI_INVALID_RESPONSE"
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_QUOTA_DAILY_REQUEST"
  | "AI_QUOTA_DAILY_TOKEN"
  | "AI_QUOTA_MONTHLY_REQUEST"
  | "AI_QUOTA_MONTHLY_TOKEN"
  | "AI_QUOTA_UNAVAILABLE"
  | "AI_REQUEST_DUPLICATE"
  | "AI_RUNTIME_INVALID"
  | "AI_USAGE_UNAVAILABLE";

export interface AiPublicError {
  error: string;
  code: AiPublicErrorCode;
  reason?: AiQuotaBlockReason;
}
