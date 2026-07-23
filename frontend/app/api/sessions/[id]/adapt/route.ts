import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readAdaptResponse } from "@/lib/sessions/adaptation-contract";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function databaseError(message: string) {
  if (message.includes("ADAPT_SESSION_NOT_FOUND")) {
    return NextResponse.json(
      { error: "Sesión no encontrada o no pertenece al usuario." },
      { status: 404 },
    );
  }

  if (
    message.includes("ADAPT_SESSION_NOT_COMPLETED") ||
    message.includes("ADAPT_ACTION_SCORE_MISMATCH") ||
    message.includes("ADAPT_PLAN_NOT_FOUND") ||
    message.includes("ADAPT_TOPICS_REQUIRED")
  ) {
    return NextResponse.json(
      { error: "La sesión no tiene un resultado válido para adaptar el plan." },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { error: "Error al adaptar el plan de estudio." },
    { status: 500 },
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id: sessionId } = await params;
    if (!sessionId || !UUID_REGEX.test(sessionId)) {
      return NextResponse.json(
        { error: "ID de sesión inválido. Debe ser un UUID válido." },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.rpc(
      "apply_session_adaptation_v2",
      {
        p_user_id: user.id,
        p_session_id: sessionId,
      },
    );

    if (error) {
      console.error("[adapt] Error en adaptación atómica:", error);
      return databaseError(error.message);
    }

    const response = readAdaptResponse(data);
    if (!response) {
      console.error("[adapt] RPC retornó un contrato inválido.");
      return NextResponse.json(
        { error: "La adaptación guardada tiene un formato inválido." },
        { status: 500 },
      );
    }

    return NextResponse.json(response, { status: 200 });
  } catch {
    console.error("[adapt] Error inesperado.");
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
