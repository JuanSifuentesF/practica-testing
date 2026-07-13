// frontend/scripts/verify-ai03-settings.mjs
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceRole) {
  throw new Error("Faltan variables necesarias para el fixture AI-03");
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const userClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `ai03-${randomUUID()}@example.invalid`;
const password = `${randomUUID()}Aa1!`;
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (created.error || !created.data.user) {
  throw new Error("No se pudo crear el usuario fixture AI-03");
}

const userId = created.data.user.id;

try {
  const signedIn = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signedIn.error) throw new Error("No se pudo autenticar el fixture AI-03");

  // El payload inseguro de la primera redacción intenta escribir cuotas y debe
  // ser rechazado por los GRANTs de columna, aunque coincida con los defaults.
  const forbidden = await userClient.from("user_ai_settings").upsert(
    {
      user_id: userId,
      mode: "managed",
      provider: "gemini",
      model_name: null,
      daily_request_limit: 999,
      monthly_request_limit: 999,
      daily_token_limit: 999_999,
      monthly_token_limit: 999_999,
    },
    { onConflict: "user_id" },
  );
  if (forbidden.error?.code !== "42501") {
    throw new Error("El fixture esperaba rechazo 42501 por columnas de cuota");
  }

  const beforeInsert = await userClient
    .from("user_ai_settings")
    .update({ mode: "managed" })
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (beforeInsert.error || beforeInsert.data !== null) {
    throw new Error(
      "UPDATE sobre fila ausente no tuvo el comportamiento esperado",
    );
  }

  const initialPreferences = {
    user_id: userId,
    mode: "managed",
    provider: "gemini",
    model_name: null,
  };
  const concurrentInserts = await Promise.all([
    userClient.from("user_ai_settings").insert(initialPreferences),
    userClient.from("user_ai_settings").insert(initialPreferences),
  ]);
  const successes = concurrentInserts.filter((result) => !result.error).length;
  const conflicts = concurrentInserts.filter(
    (result) => result.error?.code === "23505",
  ).length;
  if (successes !== 1 || conflicts !== 1) {
    throw new Error("La carrera de primera inserción no produjo éxito + 23505");
  }

  const persisted = await userClient
    .from("user_ai_settings")
    .select(
      "mode, provider, daily_request_limit, monthly_request_limit, daily_token_limit, monthly_token_limit",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (
    persisted.error ||
    !persisted.data ||
    persisted.data.daily_request_limit !== 20 ||
    persisted.data.monthly_request_limit !== 300 ||
    persisted.data.daily_token_limit !== 50_000 ||
    persisted.data.monthly_token_limit !== 500_000
  ) {
    throw new Error("La inserción limitada no conservó los defaults de cuota");
  }

  const retriedUpdate = await userClient
    .from("user_ai_settings")
    .update({ provider: "openai", model_name: null })
    .eq("user_id", userId)
    .select("mode, provider")
    .maybeSingle();
  if (
    retriedUpdate.error ||
    retriedUpdate.data?.mode !== "managed" ||
    retriedUpdate.data.provider !== "openai"
  ) {
    throw new Error(
      "El retry UPDATE no persistió solo preferencias permitidas",
    );
  }

  console.log("PASS AI-03: permisos por columna + update/insert limitado");
} finally {
  await userClient.auth.signOut();
  await admin.auth.admin.deleteUser(userId);
}
