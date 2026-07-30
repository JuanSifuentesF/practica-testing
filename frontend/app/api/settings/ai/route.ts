// frontend/app/api/settings/ai/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  AI_PROVIDERS,
  AI_USAGE_MODES,
  createDefaultAiSettings,
  isPlainObject,
  parseAiProvider,
  parseAiUsageMode,
  type AiSettingsPreferencesUpdate,
} from "@/lib/ai/settings-contract";
import { isAllowedModel } from "@/lib/ai/model-cascade";
import type { UserAiSettingsUpdateDB } from "@/types";

const SETTINGS_COLUMNS =
  "user_id, mode, provider, model_name, daily_request_limit, monthly_request_limit, daily_token_limit, monthly_token_limit, updated_at";

function invalidJson(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return invalidJson("NO_SESSION", 401);

  const { data, error } = await supabase
    .from("user_ai_settings")
    .select(SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return invalidJson("SETTINGS_READ_FAILED", 500);

  // Leer no crea una fila ni eleva una cuota: devuelve el mismo contrato que
  // la base asignaría en una inserción posterior.
  return NextResponse.json({
    data: data ?? createDefaultAiSettings(user.id),
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return invalidJson("NO_SESSION", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJson("INVALID_JSON");
  }

  if (!isPlainObject(body)) return invalidJson("INVALID_BODY");

  // Rechazar campos silenciosamente ignorados hace visible un contrato roto.
  for (const key of Object.keys(body)) {
    if (key !== "mode" && key !== "provider" && key !== "model_name") {
      return invalidJson("UNKNOWN_FIELD");
    }
  }

  const { data: existingSettings } = await supabase
    .from("user_ai_settings")
    .select("provider")
    .eq("user_id", user.id)
    .maybeSingle();

  const currentProvider = existingSettings?.provider || "gemini";

  const update: AiSettingsPreferencesUpdate = {};
  if (Object.prototype.hasOwnProperty.call(body, "mode")) {
    const mode = parseAiUsageMode(body.mode);
    if (!mode) {
      return NextResponse.json(
        { error: "INVALID_MODE", allowed: AI_USAGE_MODES },
        { status: 400 },
      );
    }
    update.mode = mode;
  }

  if (Object.prototype.hasOwnProperty.call(body, "provider")) {
    const provider = parseAiProvider(body.provider);
    if (!provider) {
      return NextResponse.json(
        { error: "INVALID_PROVIDER", allowed: AI_PROVIDERS },
        { status: 400 },
      );
    }
    update.provider = provider;
  }

  if (Object.prototype.hasOwnProperty.call(body, "model_name")) {
    const modelName = body["model_name"];
    if (modelName !== null) {
      if (typeof modelName !== "string") {
        return invalidJson("INVALID_MODEL");
      }
      const provider = update.provider || currentProvider;
      if (!isAllowedModel(provider, modelName)) {
        return invalidJson("INVALID_MODEL");
      }
    }
    update.model_name = modelName;
  }

  if (Object.keys(update).length === 0)
    return invalidJson("NO_FIELDS_TO_UPDATE");

  const storageUpdate: UserAiSettingsUpdateDB = {};
  if (update.mode !== undefined) storageUpdate.mode = update.mode;
  if (update.provider !== undefined) storageUpdate.provider = update.provider;
  if (Object.prototype.hasOwnProperty.call(body, "model_name")) {
    storageUpdate.model_name = body["model_name"] as string | null;
  } else if (update.provider !== undefined) {
    storageUpdate.model_name = null;
  }

  const updateExisting = () =>
    supabase
      .from("user_ai_settings")
      .update(storageUpdate)
      .eq("user_id", user.id)
      .select(SETTINGS_COLUMNS)
      .maybeSingle();

  // Primer intento: no hace SELECT previo ni intenta escribir columnas de cuota.
  const updated = await updateExisting();
  if (updated.error) return invalidJson("SETTINGS_UPDATE_FAILED", 500);
  if (updated.data) return NextResponse.json({ data: updated.data });

  const defaults = createDefaultAiSettings(user.id);
  const inserted = await supabase
    .from("user_ai_settings")
    .insert({
      user_id: user.id,
      mode: storageUpdate.mode ?? defaults.mode,
      provider: storageUpdate.provider ?? defaults.provider,
      model_name: null,
    })
    .select(SETTINGS_COLUMNS)
    .maybeSingle();

  if (!inserted.error && inserted.data) {
    return NextResponse.json({ data: inserted.data });
  }

  if (inserted.error?.code !== "23505") {
    return invalidJson("SETTINGS_INSERT_FAILED", 500);
  }

  // Otra request creó la fila entre UPDATE e INSERT. Reintentar UPDATE una vez
  // implementa last-write-wins sin un SELECT + INSERT vulnerable a la carrera.
  const retried = await updateExisting();
  if (retried.error) return invalidJson("SETTINGS_UPDATE_FAILED", 500);
  if (retried.data) return NextResponse.json({ data: retried.data });

  return invalidJson("SETTINGS_WRITE_CONFLICT", 409);
}
