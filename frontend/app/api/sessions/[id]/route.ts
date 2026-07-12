// ─────────────────────────────────────────────────────────────────
// app/api/sessions/[id]/route.ts
// Route Handler: retorna los datos completos de UNA sesión específica,
// enriquecida con contexto del plan y tópicos.
//
// Método: GET
// Auth: Requiere sesión válida (cookie JWT de Supabase)
// Params: id — UUID de la sesión
//
// Response (200): { session: SessionWithContext }
// Response (401): { error: "No autenticado" }
// Response (400): { error: "session_id es requerido" }
// Response (404): { error: "Sesión no encontrada" }
// Response (500): { error: "Error interno del servidor" }
//
// SEGURIDAD:
//   - RLS en la tabla sessions filtra por user_id automáticamente
//   - Verificación adicional con getUser() como defensa en profundidad
//   - El usuario solo puede ver sus propias sesiones
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SessionRow, StudyPlanRow } from "@/types";
import { enrichSession } from "../next/route";

// Forzar Node.js runtime (mismo razonamiento que /api/sessions/next)
export const runtime = "nodejs";

// ─── Validación de UUID ──────────────────────────────────────────
// Regex para validar formato UUID v4. Previene inyección de
// valores malformados en la query a Supabase.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ═══════════════════════════════════════════════════════════
    // PASO 1: Extraer y validar el parámetro id
    // ═══════════════════════════════════════════════════════════
    // En Next.js 15+, params es una Promise que debemos awaitar.
    const { id: sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id es requerido" },
        { status: 400 },
      );
    }

    // Validar formato UUID para prevenir queries con valores basura
    if (!UUID_REGEX.test(sessionId)) {
      return NextResponse.json(
        { error: "session_id debe ser un UUID válido" },
        { status: 400 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 2: Autenticación
    // ═══════════════════════════════════════════════════════════
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 3: Buscar la sesión por ID
    // ═══════════════════════════════════════════════════════════
    // RLS filtra automáticamente por user_id, así que si la sesión
    // pertenece a otro usuario, Supabase retornará null.
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle<SessionRow>();

    if (sessionError) {
      console.error("[sessions/[id]] Error al buscar sesión:", sessionError);
      return NextResponse.json(
        { error: "Error al buscar la sesión" },
        { status: 500 },
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Sesión no encontrada. Verifica el ID o vuelve a /plan para seleccionar una sesión.",
        },
        { status: 404 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 4: Obtener el plan de estudio asociado
    // ═══════════════════════════════════════════════════════════
    // Necesitamos los datos del plan para construir el PlanContext
    // y para obtener el document_id (topics_json).
    const { data: plan, error: planError } = await supabase
      .from("study_plans")
      .select("id, document_id, objective_days, start_date, estimated_end_date")
      .eq("id", session.study_plan_id)
      .eq("user_id", user.id)
      .maybeSingle<
        Pick<
          StudyPlanRow,
          | "id"
          | "document_id"
          | "objective_days"
          | "start_date"
          | "estimated_end_date"
        >
      >();

    if (planError || !plan) {
      console.error("[sessions/[id]] Error al buscar plan:", planError);
      return NextResponse.json(
        { error: "No se encontró el plan de estudio asociado a esta sesión" },
        { status: 404 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 5: Enriquecer y retornar
    // ═══════════════════════════════════════════════════════════
    // Reutilizamos enrichSession de /api/sessions/next.
    // DRY: una sola función para enriquecer sesiones, usada
    // por ambos endpoints.
    const enrichedSession = await enrichSession(
      supabase,
      session,
      plan,
      user.id,
    );

    return NextResponse.json({ session: enrichedSession });
  } catch (error) {
    console.error("[sessions/[id]] Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
