// frontend/app/api/settings/ai/usage/route.ts
import { NextResponse } from "next/server";
import {
  assertAiUsageContractFixtures,
  buildAiUsageReport,
} from "@/lib/ai/usage-contract";
import { createDefaultAiSettings } from "@/lib/ai/settings-contract";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 0;

const SETTINGS_COLUMNS =
  "user_id, mode, provider, model_name, daily_request_limit, monthly_request_limit, daily_token_limit, monthly_token_limit, updated_at";
const EVENT_COLUMNS =
  "id, user_id, feature, mode, provider, model_name, prompt_tokens, completion_tokens, total_tokens, request_units, status, error_code, created_at";

// El reporte depende de la identidad de la cookie. Un CDN o el navegador no
// debe reutilizar una respuesta de una persona para otra.
const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
};

function usageError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: PRIVATE_NO_STORE_HEADERS },
  );
}

if (process.env.NODE_ENV !== "production") {
  // Fixtures puros: no abren red ni escriben la base. Si el contrato cambia
  // accidentalmente, falla antes de entregar un DTO falso al navegador.
  assertAiUsageContractFixtures();
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return usageError("NO_SESSION", 401);

  // Las tres lecturas son independientes y ocurren en paralelo. La RPC no
  // acepta user_id: auth.uid() y RLS preservan el ownership en PostgreSQL.
  const [settingsResult, summaryResult, eventsResult] = await Promise.all([
    supabase
      .from("user_ai_settings")
      .select(SETTINGS_COLUMNS)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("get_ai_usage_summary").maybeSingle(),
    supabase
      .from("ai_usage_events")
      .select(EVENT_COLUMNS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (settingsResult.error || summaryResult.error || eventsResult.error) {
    // No usar defaults cuando una lectura real falló. Eso enseñaría 0 y
    // ocultaría una caída de DB, una política RLS rota o un contrato inválido.
    return usageError("USAGE_READ_FAILED", 500);
  }

  const settings = settingsResult.data ?? createDefaultAiSettings(user.id);
  const summary = summaryResult.data;
  const events = eventsResult.data ?? [];

  // `null` en summary es imposible para la función SQL de esta guía. Es una
  // incompatibilidad, no un reporte vacío legítimo.
  if (summary === null) return usageError("USAGE_DATA_INCOMPATIBLE", 409);

  try {
    return NextResponse.json(
      { data: buildAiUsageReport(settings, summary, events) },
      { headers: PRIVATE_NO_STORE_HEADERS },
    );
  } catch {
    // Los guards del contrato separan una respuesta legacy/corrupta de la
    // ausencia normal de eventos. Nunca se maquilla como cuota disponible.
    return usageError("USAGE_DATA_INCOMPATIBLE", 409);
  }
}
