import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  throw new Error("Faltan variables server-only");
}

const admin = createClient(url, serviceRole, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const features = [
  "plan",
  "theory",
  "quiz",
  "evaluate",
  "practice_generate",
  "practice_evaluate",
];

const email = "ai05-" + randomUUID() + "@example.invalid";
const password = randomUUID() + "Aa1!";
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (created.error || !created.data.user) {
  throw new Error("No se creo el usuario fixture");
}

const userId = created.data.user.id;

try {
  const settings = await admin.from("user_ai_settings").insert({
    user_id: userId,
    mode: "managed",
    provider: "gemini",
    model_name: "gemini-3.5-flash",
    daily_request_limit: 20,
    monthly_request_limit: 20,
    daily_token_limit: 1_000,
    monthly_token_limit: 1_000,
  });
  if (settings.error) {
    throw new Error("No se creo settings fixture");
  }

  for (const feature of features) {
    const eventId = randomUUID();
    const reservation = await admin.rpc("reserve_ai_quota", {
      p_user_id: userId,
      p_event_id: eventId,
      p_feature: feature,
      p_provider: "gemini",
      p_model_name: "gemini-3.5-flash",
      p_reserved_prompt_tokens: 2,
      p_reserved_completion_tokens: 3,
    });

    if (
      reservation.error ||
      reservation.data?.[0]?.reservation_outcome !== "reserved"
    ) {
      throw new Error("No se reservo feature " + feature);
    }

    const finalization = await admin.rpc("finalize_managed_ai_usage", {
      p_user_id: userId,
      p_event_id: eventId,
      p_prompt_tokens: 1,
      p_completion_tokens: 2,
      p_status: "success",
      p_error_code: null,
    });

    if (
      finalization.error ||
      finalization.data?.[0]?.finalization_outcome !== "finalized"
    ) {
      throw new Error("No se finalizo feature " + feature);
    }
  }

  const candidateLedgerFixtures = [
    {
      id: randomUUID(),
      model: "gemini-3.5-flash",
      status: "error",
      errorCode: "AI_PROVIDER_UNAVAILABLE",
    },
    {
      id: randomUUID(),
      model: "gemini-3.1-pro-preview",
      status: "success",
      errorCode: null,
    },
  ];

  for (const attempt of candidateLedgerFixtures) {
    const reservation = await admin.rpc("reserve_ai_quota", {
      p_user_id: userId,
      p_event_id: attempt.id,
      p_feature: "plan",
      p_provider: "gemini",
      p_model_name: attempt.model,
      p_reserved_prompt_tokens: 2,
      p_reserved_completion_tokens: 3,
    });
    if (
      reservation.error ||
      reservation.data?.[0]?.reservation_outcome !== "reserved"
    ) {
      throw new Error("No se reservó un evento candidato");
    }

    const finalization = await admin.rpc("finalize_managed_ai_usage", {
      p_user_id: userId,
      p_event_id: attempt.id,
      p_prompt_tokens: 1,
      p_completion_tokens: attempt.status === "success" ? 2 : 0,
      p_status: attempt.status,
      p_error_code: attempt.errorCode,
    });
    if (
      finalization.error ||
      finalization.data?.[0]?.finalization_outcome !== "finalized"
    ) {
      throw new Error("No se finalizó un evento candidato");
    }
  }

  const events = await admin
    .from("ai_usage_events")
    .select(
      "id, feature, mode, model_name, status, error_code, prompt_tokens, completion_tokens, total_tokens, request_units",
    )
    .eq("user_id", userId)
    .order("feature");

  if (
    events.error ||
    events.data?.length !== features.length + candidateLedgerFixtures.length
  ) {
    throw new Error("La cantidad de eventos AI-05 es incorrecta");
  }

  const candidateIds = new Set(
    candidateLedgerFixtures.map((attempt) => attempt.id),
  );
  const featureEvents = events.data.filter((event) => !candidateIds.has(event.id));

  const actualFeatures = featureEvents
    .map((event) => event.feature)
    .sort()
    .join(",");
  const expectedFeatures = [...features].sort().join(",");
  if (actualFeatures !== expectedFeatures) {
    throw new Error("Faltan features en la auditoria");
  }

  const invalidEvent = featureEvents.find(
    (event) =>
      event.mode !== "managed" ||
      event.status !== "success" ||
      event.error_code !== null ||
      event.prompt_tokens !== 1 ||
      event.completion_tokens !== 2 ||
      event.total_tokens !== 3 ||
      event.request_units !== 1,
  );
  if (invalidEvent) {
    throw new Error("Un evento finalizado no cumple el contrato");
  }

  for (const attempt of candidateLedgerFixtures) {
    const event = events.data.find((candidate) => candidate.id === attempt.id);
    const expectedCompletionTokens = attempt.status === "success" ? 2 : 0;
    if (
      !event ||
      event.model_name !== attempt.model ||
      event.status !== attempt.status ||
      event.error_code !== attempt.errorCode ||
      event.prompt_tokens !== 1 ||
      event.completion_tokens !== expectedCompletionTokens ||
      event.total_tokens !== 1 + expectedCompletionTokens ||
      event.request_units !== 1
    ) {
      throw new Error("La auditoría del evento candidato es incorrecta");
    }
  }

  const pending = await admin
    .from("ai_usage_events")
    .select("id")
    .eq("user_id", userId)
    .eq("error_code", "QUOTA_RESERVED");
  if (pending.error || pending.data?.length !== 0) {
    throw new Error("Quedo una reserva pendiente en el fixture");
  }

  const invalidFeature = await admin.from("ai_usage_events").insert({
    id: randomUUID(),
    user_id: userId,
    feature: "feature_invalida",
    mode: "demo",
    provider: null,
    model_name: null,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    request_units: 0,
    status: "error",
    error_code: "AI_FIXTURE_INVALID",
  });
  if (invalidFeature.error?.code !== "23514") {
    throw new Error("El CHECK acepto una feature desconocida");
  }

  console.log("PASS AI-05 DB: seis features y dos eventos candidatos auditados");
} finally {
  await admin.auth.admin.deleteUser(userId);
}
