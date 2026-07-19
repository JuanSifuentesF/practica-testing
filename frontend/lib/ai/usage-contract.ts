// frontend/lib/ai/usage-contract.ts
import type {
  AiFeature,
  AiUsageEventRow,
  AiUsageMode,
  AiUsageStatus,
  GetAiUsageSummaryRowDB,
  UserAiSettingsRow,
} from "@/types";
import {
  isPlainObject,
  isUserAiSettingsRow,
  parseAiProvider,
  parseAiUsageMode,
} from "./settings-contract";

export const AI_USAGE_FEATURES = [
  "plan",
  "theory",
  "quiz",
  "evaluate",
  "practice_generate",
  "practice_evaluate",
] as const satisfies readonly AiFeature[];

export type AiUsageDisplayStatus = "success" | "blocked" | "pending" | "error";

export type AiQuotaLevel = "normal" | "warning" | "reached";

export interface UsageCounter {
  requests: number;
  tokens: number;
}

export interface UsageMeter {
  used: number;
  limit: number;
  percentage: number;
  level: AiQuotaLevel;
}

export interface AiUsageDisplayEvent {
  id: string;
  occurredAt: string;
  feature: AiFeature;
  mode: AiUsageMode;
  status: AiUsageDisplayStatus;
  requestUnits: number;
  totalTokens: number;
}

export interface AiUsageReport {
  generatedAt: string;
  timezone: "UTC";
  period: {
    dayStartsAt: string;
    monthStartsAt: string;
  };
  activity: {
    today: UsageCounter;
    month: UsageCounter;
    blockedToday: number;
    blockedMonth: number;
    pendingFinalizations: number;
  };
  quota: {
    scope: "managed";
    enforcementActive: boolean;
    daily: {
      requests: UsageMeter;
      tokens: UsageMeter;
    };
    month: {
      requests: UsageMeter;
      tokens: UsageMeter;
    };
  };
  lastEvents: AiUsageDisplayEvent[];
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function isBoundedNonEmptyString(
  value: unknown,
  maxLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function parseAiFeature(value: unknown): AiFeature | null {
  switch (value) {
    case "plan":
    case "theory":
    case "quiz":
    case "evaluate":
    case "practice_generate":
    case "practice_evaluate":
      return value;
    default:
      return null;
  }
}

function parseAiUsageStatus(value: unknown): AiUsageStatus | null {
  switch (value) {
    case "success":
    case "blocked_quota":
    case "error":
      return value;
    default:
      return null;
  }
}

/**
 * Comprueba una fila antes de agregarla o serializarla. Los tipos generados
 * describen la intención de la base; este guard protege ante datos legacy,
 * respuestas incompletas o cambios de schema todavía no reflejados en el cliente.
 */
export function isAiUsageEventRow(value: unknown): value is AiUsageEventRow {
  if (!isPlainObject(value)) return false;

  const feature = parseAiFeature(value.feature);
  const mode = parseAiUsageMode(value.mode);
  const status = parseAiUsageStatus(value.status);

  if (
    !isBoundedNonEmptyString(value.id, 100) ||
    !isBoundedNonEmptyString(value.user_id, 100) ||
    feature === null ||
    mode === null ||
    status === null ||
    !isNonNegativeSafeInteger(value.prompt_tokens) ||
    !isNonNegativeSafeInteger(value.completion_tokens) ||
    !isNonNegativeSafeInteger(value.total_tokens) ||
    !isNonNegativeSafeInteger(value.request_units) ||
    !isIsoTimestamp(value.created_at) ||
    value.total_tokens !== value.prompt_tokens + value.completion_tokens
  ) {
    return false;
  }

  if (mode === "demo") {
    if (value.provider !== null || value.model_name !== null) return false;
  } else if (
    parseAiProvider(value.provider) === null ||
    !isBoundedNonEmptyString(value.model_name, 100)
  ) {
    return false;
  }

  if (status === "success") return value.error_code === null;

  if (!isBoundedNonEmptyString(value.error_code, 100)) return false;

  if (status === "blocked_quota") {
    return (
      mode === "managed" &&
      value.request_units === 0 &&
      value.total_tokens === 0
    );
  }

  // El marcador transitorio solo lo crea reserve_ai_quota: conserva una
  // unidad y tokens reservados. Un dato legacy con el mismo texto no puede
  // disfrazarse de una reserva pendiente.
  if (value.error_code === "QUOTA_RESERVED") {
    return (
      mode === "managed" && value.request_units === 1 && value.total_tokens > 0
    );
  }

  return true;
}

function hasGetAiUsageSummaryScalars(
  value: Record<string, unknown>,
): value is Record<string, unknown> & GetAiUsageSummaryRowDB {
  return (
    isIsoTimestamp(value.observed_at) &&
    isIsoTimestamp(value.day_start) &&
    isIsoTimestamp(value.month_start) &&
    isNonNegativeSafeInteger(value.activity_daily_requests) &&
    isNonNegativeSafeInteger(value.activity_daily_tokens) &&
    isNonNegativeSafeInteger(value.activity_monthly_requests) &&
    isNonNegativeSafeInteger(value.activity_monthly_tokens) &&
    isNonNegativeSafeInteger(value.quota_daily_requests) &&
    isNonNegativeSafeInteger(value.quota_daily_tokens) &&
    isNonNegativeSafeInteger(value.quota_monthly_requests) &&
    isNonNegativeSafeInteger(value.quota_monthly_tokens) &&
    isNonNegativeSafeInteger(value.blocked_daily_events) &&
    isNonNegativeSafeInteger(value.blocked_monthly_events) &&
    isNonNegativeSafeInteger(value.pending_finalizations)
  );
}

export function isGetAiUsageSummaryRow(
  value: unknown,
): value is GetAiUsageSummaryRowDB {
  if (!isPlainObject(value) || !hasGetAiUsageSummaryScalars(value)) {
    return false;
  }

  // La RPC nunca debe devolver una cuota mayor que la actividad que la
  // contiene, ni un subtotal diario mayor que su total mensual.
  return (
    value.activity_daily_requests <= value.activity_monthly_requests &&
    value.activity_daily_tokens <= value.activity_monthly_tokens &&
    value.quota_daily_requests <= value.quota_monthly_requests &&
    value.quota_daily_tokens <= value.quota_monthly_tokens &&
    value.quota_daily_requests <= value.activity_daily_requests &&
    value.quota_daily_tokens <= value.activity_daily_tokens &&
    value.quota_monthly_requests <= value.activity_monthly_requests &&
    value.quota_monthly_tokens <= value.activity_monthly_tokens &&
    value.blocked_daily_events <= value.blocked_monthly_events &&
    value.pending_finalizations <= value.quota_monthly_requests
  );
}

function createMeter(used: number, limit: number): UsageMeter {
  // Un límite 0 significa que la siguiente llamada Managed quedará bloqueada,
  // incluso cuando el uso acumulado todavía sea 0.
  const percentage =
    limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const level: AiQuotaLevel =
    percentage >= 100 ? "reached" : percentage >= 80 ? "warning" : "normal";

  return { used, limit, percentage, level };
}

function toDisplayStatus(event: AiUsageEventRow): AiUsageDisplayStatus {
  if (event.status === "success") return "success";
  if (event.status === "blocked_quota") return "blocked";

  // Es una reserva Managed ya contada, no un error de proveedor que deba
  // mostrarse con el código interno QUOTA_RESERVED.
  return event.error_code === "QUOTA_RESERVED" ? "pending" : "error";
}

function toDisplayEvent(event: AiUsageEventRow): AiUsageDisplayEvent {
  return {
    id: event.id,
    occurredAt: event.created_at,
    feature: event.feature,
    mode: event.mode,
    status: toDisplayStatus(event),
    requestUnits: event.request_units,
    totalTokens: event.total_tokens,
  };
}

/**
 * Construye el DTO público. Los totales de actividad incluyen eventos BYOK
 * para auditoría; los medidores de cuota usan exclusivamente columnas quota_*
 * de la RPC, que representan el presupuesto Managed.
 */
export function buildAiUsageReport(
  settings: unknown,
  summary: unknown,
  events: readonly unknown[],
): AiUsageReport {
  if (!isUserAiSettingsRow(settings)) {
    throw new Error("AI_USAGE_SETTINGS_CONTRACT_INVALID");
  }
  if (!isGetAiUsageSummaryRow(summary)) {
    throw new Error("AI_USAGE_SUMMARY_CONTRACT_INVALID");
  }

  const normalizedEvents = events.map((event) => {
    if (!isAiUsageEventRow(event)) {
      throw new Error("AI_USAGE_EVENT_CONTRACT_INVALID");
    }
    return toDisplayEvent(event);
  });

  return {
    generatedAt: summary.observed_at,
    timezone: "UTC",
    period: {
      dayStartsAt: summary.day_start,
      monthStartsAt: summary.month_start,
    },
    activity: {
      today: {
        requests: summary.activity_daily_requests,
        tokens: summary.activity_daily_tokens,
      },
      month: {
        requests: summary.activity_monthly_requests,
        tokens: summary.activity_monthly_tokens,
      },
      blockedToday: summary.blocked_daily_events,
      blockedMonth: summary.blocked_monthly_events,
      pendingFinalizations: summary.pending_finalizations,
    },
    quota: {
      scope: "managed",
      enforcementActive: settings.mode === "managed",
      daily: {
        requests: createMeter(
          summary.quota_daily_requests,
          settings.daily_request_limit,
        ),
        tokens: createMeter(
          summary.quota_daily_tokens,
          settings.daily_token_limit,
        ),
      },
      month: {
        requests: createMeter(
          summary.quota_monthly_requests,
          settings.monthly_request_limit,
        ),
        tokens: createMeter(
          summary.quota_monthly_tokens,
          settings.monthly_token_limit,
        ),
      },
    },
    lastEvents: normalizedEvents,
  };
}

function isUsageCounter(value: unknown): value is UsageCounter {
  return (
    isPlainObject(value) &&
    isNonNegativeSafeInteger(value.requests) &&
    isNonNegativeSafeInteger(value.tokens)
  );
}

function isUsageMeter(value: unknown): value is UsageMeter {
  if (!isPlainObject(value)) return false;

  if (
    !isNonNegativeSafeInteger(value.used) ||
    !isNonNegativeSafeInteger(value.limit) ||
    !isNonNegativeSafeInteger(value.percentage) ||
    value.percentage > 100 ||
    (value.level !== "normal" &&
      value.level !== "warning" &&
      value.level !== "reached")
  ) {
    return false;
  }

  const expected = createMeter(value.used, value.limit);
  return (
    value.percentage === expected.percentage && value.level === expected.level
  );
}

function isDisplayEvent(value: unknown): value is AiUsageDisplayEvent {
  if (!isPlainObject(value)) return false;

  const status = value.status;
  return (
    isBoundedNonEmptyString(value.id, 100) &&
    isIsoTimestamp(value.occurredAt) &&
    parseAiFeature(value.feature) !== null &&
    parseAiUsageMode(value.mode) !== null &&
    (status === "success" ||
      status === "blocked" ||
      status === "pending" ||
      status === "error") &&
    isNonNegativeSafeInteger(value.requestUnits) &&
    isNonNegativeSafeInteger(value.totalTokens)
  );
}

/** Cliente: no confiar en que fetch() devolvió el JSON prometido. */
export function isAiUsageReport(value: unknown): value is AiUsageReport {
  if (!isPlainObject(value)) return false;
  if (
    !isIsoTimestamp(value.generatedAt) ||
    value.timezone !== "UTC" ||
    !isPlainObject(value.period) ||
    !isIsoTimestamp(value.period.dayStartsAt) ||
    !isIsoTimestamp(value.period.monthStartsAt) ||
    !isPlainObject(value.activity) ||
    !isUsageCounter(value.activity.today) ||
    !isUsageCounter(value.activity.month) ||
    !isNonNegativeSafeInteger(value.activity.blockedToday) ||
    !isNonNegativeSafeInteger(value.activity.blockedMonth) ||
    !isNonNegativeSafeInteger(value.activity.pendingFinalizations) ||
    !isPlainObject(value.quota) ||
    value.quota.scope !== "managed" ||
    typeof value.quota.enforcementActive !== "boolean" ||
    !isPlainObject(value.quota.daily) ||
    !isPlainObject(value.quota.month) ||
    !isUsageMeter(value.quota.daily.requests) ||
    !isUsageMeter(value.quota.daily.tokens) ||
    !isUsageMeter(value.quota.month.requests) ||
    !isUsageMeter(value.quota.month.tokens) ||
    !Array.isArray(value.lastEvents) ||
    value.lastEvents.length > 20
  ) {
    return false;
  }

  return value.lastEvents.every(isDisplayEvent);
}

export function isAiUsageApiResponse(
  value: unknown,
): value is { data: AiUsageReport } {
  return isPlainObject(value) && isAiUsageReport(value.data);
}

/** Fixtures deterministas para desarrollo y para la compilación del contrato. */
export function assertAiUsageContractFixtures() {
  const settings: UserAiSettingsRow = {
    user_id: "00000000-0000-4000-8000-000000000001",
    mode: "managed",
    provider: "gemini",
    model_name: null,
    daily_request_limit: 2,
    monthly_request_limit: 10,
    daily_token_limit: 100,
    monthly_token_limit: 1_000,
    updated_at: "2026-07-13T00:00:00.000Z",
  };

  const summary: GetAiUsageSummaryRowDB = {
    observed_at: "2026-07-13T12:00:00.000Z",
    day_start: "2026-07-13T00:00:00.000Z",
    month_start: "2026-07-01T00:00:00.000Z",
    activity_daily_requests: 8,
    activity_daily_tokens: 70,
    activity_monthly_requests: 8,
    activity_monthly_tokens: 70,
    quota_daily_requests: 2,
    quota_daily_tokens: 20,
    quota_monthly_requests: 2,
    quota_monthly_tokens: 20,
    blocked_daily_events: 1,
    blocked_monthly_events: 1,
    pending_finalizations: 1,
  };

  const pendingReservation: AiUsageEventRow = {
    id: "00000000-0000-4000-8000-000000000002",
    user_id: settings.user_id,
    feature: "theory",
    mode: "managed",
    provider: "gemini",
    model_name: "gemini-3.5-flash",
    prompt_tokens: 10,
    completion_tokens: 10,
    total_tokens: 20,
    request_units: 1,
    status: "error",
    error_code: "QUOTA_RESERVED",
    created_at: "2026-07-13T11:59:00.000Z",
  };

  if (!isAiUsageEventRow(pendingReservation)) {
    throw new Error("Fixture AI-04 válido fue rechazado");
  }

  const { total_tokens: ignoredTotalTokens, ...legacyWithoutTotal } =
    pendingReservation;
  void ignoredTotalTokens;
  if (isAiUsageEventRow(legacyWithoutTotal)) {
    throw new Error("Fixture AI-04 legacy sin total_tokens fue aceptado");
  }

  if (isAiUsageEventRow({ ...pendingReservation, feature: "inventada" })) {
    throw new Error("Fixture AI-04 con discriminante inválido fue aceptado");
  }

  if (
    isGetAiUsageSummaryRow({
      ...summary,
      quota_daily_requests: summary.activity_daily_requests + 1,
    })
  ) {
    throw new Error("Fixture AI-04 aceptó resumen contradictorio");
  }

  const providerFailure: AiUsageEventRow = {
    ...pendingReservation,
    id: "00000000-0000-4000-8000-000000000003",
    error_code: "PROVIDER_TIMEOUT",
  };
  const report = buildAiUsageReport(settings, summary, [
    pendingReservation,
    providerFailure,
  ]);
  const [firstEvent, secondEvent] = report.lastEvents;
  if (
    !firstEvent ||
    firstEvent.status !== "pending" ||
    !secondEvent ||
    secondEvent.status !== "error" ||
    report.quota.daily.requests.level !== "reached"
  ) {
    throw new Error(
      "Fixture AI-04 no normalizó reserva o límite correctamente",
    );
  }

  const zeroLimitReport = buildAiUsageReport(
    { ...settings, daily_request_limit: 0 },
    summary,
    [],
  );
  if (zeroLimitReport.quota.daily.requests.level !== "reached") {
    throw new Error("Fixture AI-04 no trató límite cero como bloqueo");
  }

  if (
    isAiUsageApiResponse({
      data: { ...report, lastEvents: [{ ...firstEvent, status: "unknown" }] },
    })
  ) {
    throw new Error("Fixture AI-04 aceptó discriminante de respuesta inválido");
  }
}
