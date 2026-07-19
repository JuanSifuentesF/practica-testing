// frontend/scripts/verify-ai04-usage.mjs
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRole) {
  throw new Error("Faltan variables necesarias para el fixture AI-04");
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const owner = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const otherUser = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonymous = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ownerEmail = `ai04-owner-${randomUUID()}@example.invalid`;
const otherEmail = `ai04-other-${randomUUID()}@example.invalid`;
const ownerPassword = `${randomUUID()}Aa1!`;
const otherPassword = `${randomUUID()}Aa1!`;

async function createFixtureUser(email, password) {
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error || !result.data.user) {
    throw new Error("No se pudo crear un usuario fixture AI-04");
  }
  return result.data.user.id;
}

const ownerId = await createFixtureUser(ownerEmail, ownerPassword);
let otherId = null;

try {
  otherId = await createFixtureUser(otherEmail, otherPassword);

  const [ownerSignIn, otherSignIn] = await Promise.all([
    owner.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    }),
    otherUser.auth.signInWithPassword({
      email: otherEmail,
      password: otherPassword,
    }),
  ]);
  if (ownerSignIn.error || otherSignIn.error) {
    throw new Error("No se pudo autenticar los fixtures AI-04");
  }

  const settings = await admin.from("user_ai_settings").insert({
    user_id: ownerId,
    mode: "managed",
    provider: "gemini",
    model_name: "gemini-3.5-flash",
    daily_request_limit: 2,
    monthly_request_limit: 2,
    daily_token_limit: 100,
    monthly_token_limit: 100,
  });
  if (settings.error) throw new Error("No se creó settings fixture AI-04");

  // 50 unidades BYOK hacen visible el defecto histórico: con la versión
  // anterior la reserva Managed se bloquearía aunque su cuota esté vacía.
  const byokEvent = await admin.from("ai_usage_events").insert({
    id: randomUUID(),
    user_id: ownerId,
    feature: "theory",
    mode: "byok",
    provider: "gemini",
    model_name: "gemini-3.5-flash",
    prompt_tokens: 200,
    completion_tokens: 300,
    total_tokens: 500,
    request_units: 50,
    status: "success",
    error_code: null,
  });
  if (byokEvent.error) throw new Error("No se creó evento BYOK fixture");

  const reserveArgs = (eventId) => ({
    p_user_id: ownerId,
    p_event_id: eventId,
    p_feature: "theory",
    p_provider: "gemini",
    p_model_name: "gemini-3.5-flash",
    p_reserved_prompt_tokens: 10,
    p_reserved_completion_tokens: 10,
  });

  const finalizedEventId = randomUUID();
  const reserve = await admin.rpc(
    "reserve_ai_quota",
    reserveArgs(finalizedEventId),
  );
  if (reserve.error || reserve.data?.[0]?.reservation_outcome !== "reserved") {
    throw new Error("BYOK consumió cuota Managed o la reserva falló");
  }

  // Dos finalizaciones idénticas concurrentes producen finalized + duplicate;
  // ningún UPDATE directo puede intercalarse con la siguiente reserva.
  const finalizationArgs = {
    p_user_id: ownerId,
    p_event_id: finalizedEventId,
    p_prompt_tokens: 6,
    p_completion_tokens: 7,
    p_status: "success",
    p_error_code: null,
  };
  const finalizations = await Promise.all([
    admin.rpc("finalize_managed_ai_usage", finalizationArgs),
    admin.rpc("finalize_managed_ai_usage", finalizationArgs),
  ]);
  const finalizationOutcomes = finalizations
    .map((result) => result.data?.[0]?.finalization_outcome)
    .sort()
    .join(",");
  if (finalizationOutcomes !== "duplicate,finalized") {
    throw new Error("La finalización no fue idempotente y serializada");
  }

  const conflict = await admin.rpc("finalize_managed_ai_usage", {
    ...finalizationArgs,
    p_prompt_tokens: 7,
  });
  if (conflict.error?.code !== "22023") {
    throw new Error("Una finalización conflictiva pudo reescribir el evento");
  }

  // Dejar una segunda reserva pendiente prueba que el resumen diferencia
  // finalizaciones reales de marcadores QUOTA_RESERVED.
  const pendingReservation = await admin.rpc(
    "reserve_ai_quota",
    reserveArgs(randomUUID()),
  );
  if (
    pendingReservation.error ||
    pendingReservation.data?.[0]?.reservation_outcome !== "reserved"
  ) {
    throw new Error("No se pudo crear la reserva pendiente fixture");
  }

  const summary = await owner.rpc("get_ai_usage_summary").maybeSingle();
  if (summary.error || !summary.data) {
    throw new Error("El usuario no pudo leer su resumen AI-04");
  }

  function aggregate(events) {
    return events.reduce(
      (totals, event) => {
        totals.activityRequests += event.request_units;
        totals.activityTokens += event.total_tokens;
        if (event.mode === "managed") {
          totals.quotaRequests += event.request_units;
          totals.quotaTokens += event.total_tokens;
        }
        if (event.status === "blocked_quota") totals.blocked += 1;
        if (
          event.mode === "managed" &&
          event.status === "error" &&
          event.error_code === "QUOTA_RESERVED"
        ) {
          totals.pending += 1;
        }
        return totals;
      },
      {
        activityRequests: 0,
        activityTokens: 0,
        quotaRequests: 0,
        quotaTokens: 0,
        blocked: 0,
        pending: 0,
      },
    );
  }

  async function eventsFrom(start) {
    const result = await admin
      .from("ai_usage_events")
      .select("mode, status, error_code, request_units, total_tokens")
      .eq("user_id", ownerId)
      .gte("created_at", start);
    if (result.error || !result.data) {
      throw new Error("No se pudo leer los eventos fixture para comparar RPC");
    }
    return aggregate(result.data);
  }

  // Derivar expectativas desde las mismas fronteras UTC de la RPC evita que
  // el fixture sea frágil si se ejecuta exactamente durante un cambio de día.
  const [today, month] = await Promise.all([
    eventsFrom(summary.data.day_start),
    eventsFrom(summary.data.month_start),
  ]);
  if (
    summary.data.activity_daily_requests !== today.activityRequests ||
    summary.data.activity_daily_tokens !== today.activityTokens ||
    summary.data.activity_monthly_requests !== month.activityRequests ||
    summary.data.activity_monthly_tokens !== month.activityTokens ||
    summary.data.quota_daily_requests !== today.quotaRequests ||
    summary.data.quota_daily_tokens !== today.quotaTokens ||
    summary.data.quota_monthly_requests !== month.quotaRequests ||
    summary.data.quota_monthly_tokens !== month.quotaTokens ||
    summary.data.blocked_daily_events !== today.blocked ||
    summary.data.blocked_monthly_events !== month.blocked ||
    summary.data.pending_finalizations !== month.pending
  ) {
    throw new Error("El resumen no separó actividad de cuota Managed");
  }

  // RLS: el segundo usuario puede consultar la tabla, pero no la fila ajena.
  const crossUserRead = await otherUser
    .from("ai_usage_events")
    .select("id")
    .eq("user_id", ownerId);
  if (crossUserRead.error || crossUserRead.data?.length !== 0) {
    throw new Error("RLS permitió leer eventos de otro usuario");
  }

  // `authenticated` sí puede ejecutar el resumen; `anon` no.
  const anonymousSummary = await anonymous.rpc("get_ai_usage_summary");
  if (anonymousSummary.error?.code !== "42501") {
    throw new Error("La RPC de resumen quedó expuesta a anon");
  }

  const clientReserve = await owner.rpc("reserve_ai_quota", {
    p_user_id: ownerId,
    p_event_id: randomUUID(),
    p_feature: "theory",
    p_provider: "gemini",
    p_model_name: "gemini-3.5-flash",
    p_reserved_prompt_tokens: 1,
    p_reserved_completion_tokens: 1,
  });
  if (clientReserve.error?.code !== "42501") {
    throw new Error("reserve_ai_quota quedó expuesta al cliente autenticado");
  }

  const clientFinalization = await owner.rpc(
    "finalize_managed_ai_usage",
    finalizationArgs,
  );
  if (clientFinalization.error?.code !== "42501") {
    throw new Error(
      "finalize_managed_ai_usage quedó expuesta al cliente autenticado",
    );
  }

  console.log("PASS AI-04: cuota Managed, finalización, resumen UTC y RLS");
} finally {
  await owner.auth.signOut();
  await otherUser.auth.signOut();
  if (otherId) await admin.auth.admin.deleteUser(otherId);
  await admin.auth.admin.deleteUser(ownerId);
}
