import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error("Faltan variables server-only");

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `ai02-${randomUUID()}@example.invalid`;
const password = `${randomUUID()}Aa1!`;
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (created.error || !created.data.user) throw new Error("No se creó fixture");

const userId = created.data.user.id;
const args = (eventId) => ({
  p_user_id: userId,
  p_event_id: eventId,
  p_feature: "theory",
  p_provider: "gemini",
  p_model_name: "gemini-3.5-flash",
  p_reserved_prompt_tokens: 10,
  p_reserved_completion_tokens: 10,
});

try {
  // Límite 1: dos reservas distintas simultáneas deben producir
  // exactamente una reserva y un bloqueo.
  const settings = await admin.from("user_ai_settings").insert({
    user_id: userId,
    mode: "managed",
    provider: "gemini",
    model_name: "gemini-3.5-flash",
    daily_request_limit: 1,
    monthly_request_limit: 1,
    daily_token_limit: 100,
    monthly_token_limit: 100,
  });
  if (settings.error) throw new Error("No se creó settings fixture");

  const concurrent = await Promise.all([
    admin.rpc("reserve_ai_quota", args(randomUUID())),
    admin.rpc("reserve_ai_quota", args(randomUUID())),
  ]);
  const outcomes = concurrent
    .map((result) => result.data?.[0]?.reservation_outcome)
    .sort();
  if (outcomes.join(",") !== "blocked,reserved") {
    throw new Error(`Concurrencia falló: ${outcomes.join(",")}`);
  }

  await admin.from("ai_usage_events").delete().eq("user_id", userId);
  // Mismo eventId: debe existir una sola fila y el segundo resultado
  // debe ser duplicate, incluso si ambas llamadas parten juntas.
  const stableEventId = randomUUID();
  const repeated = await Promise.all([
    admin.rpc("reserve_ai_quota", args(stableEventId)),
    admin.rpc("reserve_ai_quota", args(stableEventId)),
  ]);
  const repeatedOutcomes = repeated
    .map((result) => result.data?.[0]?.reservation_outcome)
    .sort();
  if (repeatedOutcomes.join(",") !== "duplicate,reserved") {
    throw new Error(`Idempotencia falló: ${repeatedOutcomes.join(",")}`);
  }

  console.log("PASS AI-02: concurrencia e idempotencia");
} finally {
  // auth.users -> settings/events usan ON DELETE CASCADE.
  await admin.auth.admin.deleteUser(userId);
}
