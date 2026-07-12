// ─────────────────────────────────────────────────────────────────
// app/api/sessions/next/route.ts
// Route Handler: retorna la PRÓXIMA sesión de estudio que el usuario
// debe completar, según las reglas de prioridad del sistema adaptativo.
//
// Método: GET
// Auth: Requiere sesión válida (cookie JWT de Supabase)
//
// Response (200): { session: SessionWithContext }
//   → Cuando hay una sesión pendiente
//
// Response (200): { session: null, message: "...", plan_completed: true }
//   → Cuando no hay sesiones pendientes (plan completado)
//
// Response (401): { error: "No autenticado" }
// Response (404): { error: "No tienes un plan de estudio activo" }
// Response (500): { error: "Error interno del servidor" }
//
// Reglas de prioridad:
//   1. Sesiones de REFUERZO (reinforcement) pendientes → primero
//   2. Sesiones regulares pendientes → por day_number ASC
//   3. Dentro del mismo día: morning antes que night
//   4. Si no hay pendientes → plan completado
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  SessionRow,
  StudyPlanRow,
  TopicsJson,
  TopicProgressRow,
} from "@/types";
import type {
  SessionWithContext,
  SessionTopic,
  PlanContext,
} from "@/types/sessions";

// ─── Forzar Node.js runtime ─────────────────────────────────────
// Los Route Handlers de sesiones acceden a cookies y Supabase.
// Edge Runtime podría funcionar, pero Node.js es más predecible
// para operaciones con múltiples queries a Supabase.
export const runtime = "nodejs";

// ─── Orden de sesión dentro de un mismo día ──────────────────────
// Regla validada:
//   1. Las sesiones reinforcement pendientes van primero globalmente.
//   2. Las sesiones regulares se ordenan por day_number ASC.
//   3. Dentro del mismo día: morning antes que night, mock_exam al final.
//
// Importante: NO ordenamos todas las morning antes que todas las night,
// porque eso saltaría Día 1 noche y pasaría incorrectamente a Día 2 mañana.
type SortableSession = Pick<SessionRow, "id" | "day_number" | "session_type">;

const SAME_DAY_SESSION_ORDER: Record<string, number> = {
  morning: 1,
  night: 2,
  mock_exam: 3,
  reinforcement: 4,
};

function compareSessionsForStudyOrder(
  a: SortableSession,
  b: SortableSession,
): number {
  const aIsReinforcement = a.session_type === "reinforcement";
  const bIsReinforcement = b.session_type === "reinforcement";

  if (aIsReinforcement !== bIsReinforcement) {
    return aIsReinforcement ? -1 : 1;
  }

  if (a.day_number !== b.day_number) {
    return a.day_number - b.day_number;
  }

  return (
    (SAME_DAY_SESSION_ORDER[a.session_type] ?? 99) -
    (SAME_DAY_SESSION_ORDER[b.session_type] ?? 99)
  );
}

export async function GET() {
  try {
    // ═══════════════════════════════════════════════════════════
    // PASO 1: Autenticación
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
    // PASO 2: Obtener el plan activo del usuario
    // ═══════════════════════════════════════════════════════════
    // Un usuario puede tener múltiples planes (si genera uno nuevo),
    // pero solo uno debería estar en status 'active'.
    // Tomamos el más reciente por si hay algún caso edge.
    const { data: activePlan, error: planError } = await supabase
      .from("study_plans")
      .select(
        "id, document_id, objective_days, start_date, estimated_end_date, status",
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<
        Pick<
          StudyPlanRow,
          | "id"
          | "document_id"
          | "objective_days"
          | "start_date"
          | "estimated_end_date"
          | "status"
        >
      >();

    if (planError) {
      console.error("[sessions/next] Error al buscar plan activo:", planError);
      return NextResponse.json(
        { error: "Error al buscar plan de estudio" },
        { status: 500 },
      );
    }

    if (!activePlan) {
      return NextResponse.json(
        {
          error:
            "No tienes un plan de estudio activo. Ve a /setup para crear uno.",
        },
        { status: 404 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 3: Buscar sesiones pendientes con prioridad
    // ═══════════════════════════════════════════════════════════
    // Traemos TODAS las sesiones pendientes del plan y las
    // ordenamos en la aplicación para aplicar la regla correcta:
    // reinforcement primero; luego día ascendente; luego mañana/noche.
    //
    // ¿Por qué no ORDER BY en la query?
    // Porque el orden de prioridad por session_type (reinforcement
    // antes que morning) no es un ordenamiento natural de la
    // columna. Necesitaríamos un CASE WHEN en SQL, que Supabase
    // client no soporta directamente. Es más claro y mantenible
    // hacerlo en TypeScript.
    const { data: pendingSessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("*")
      .eq("study_plan_id", activePlan.id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("day_number", { ascending: true });

    if (sessionsError) {
      console.error("[sessions/next] Error al buscar sesiones:", sessionsError);
      return NextResponse.json(
        { error: "Error al buscar sesiones pendientes" },
        { status: 500 },
      );
    }

    // ─── Caso: plan completado ────────────────────────────────
    if (!pendingSessions || pendingSessions.length === 0) {
      return NextResponse.json({
        session: null,
        message:
          "¡Felicidades! Has completado todas las sesiones de tu plan de estudio.",
        plan_completed: true,
      });
    }

    // ─── Aplicar prioridad ────────────────────────────────────
    // Ordenar por:
    //   1. reinforcement antes que todo
    //   2. day_number ASC
    //   3. morning antes que night dentro del mismo día
    const sortedSessions = [...pendingSessions].sort(
      compareSessionsForStudyOrder,
    );

    const nextSession = sortedSessions[0] as SessionRow;

    // ═══════════════════════════════════════════════════════════
    // PASO 4: Enriquecer la sesión con contexto
    // ═══════════════════════════════════════════════════════════
    const enrichedSession = await enrichSession(
      supabase,
      nextSession,
      activePlan,
      user.id,
    );

    return NextResponse.json({ session: enrichedSession });
  } catch (error) {
    console.error("[sessions/next] Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// FUNCIÓN AUXILIAR: Enriquecer sesión con contexto
// ─────────────────────────────────────────────────────────────────
// Esta función se reutiliza tanto en /api/sessions/next como en
// /api/sessions/[id]. Transforma una SessionRow cruda en una
// SessionWithContext con toda la información que el frontend necesita.
// ─────────────────────────────────────────────────────────────────

export async function enrichSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  session: SessionRow,
  plan: Pick<
    StudyPlanRow,
    | "id"
    | "document_id"
    | "objective_days"
    | "start_date"
    | "estimated_end_date"
  >,
  userId: string,
): Promise<SessionWithContext> {
  // ─── 4a. Obtener topics_json del documento ──────────────────
  // Los tópicos del syllabus están almacenados como JSONB en la
  // tabla documents. Necesitamos el nombre, nivel K, y texto de
  // cada tópico para mostrar en la UI de la sesión.
  const { data: document } = await supabase
    .from("documents")
    .select("topics_json")
    .eq("id", plan.document_id)
    .eq("user_id", userId)
    .maybeSingle();

  const topicsJson: TopicsJson = document?.topics_json || {};

  // ─── 4b. Obtener progreso de los tópicos de esta sesión ─────
  // Consultamos topic_progress para saber el estado actual de
  // cada tópico: ¿ya fue estudiado? ¿cuántos intentos? ¿mejor score?
  const { data: progressRows } = await supabase
    .from("topic_progress")
    .select("topic_code, status, attempts, best_score, level_k")
    .eq("study_plan_id", plan.id)
    .eq("user_id", userId)
    .in("topic_code", session.topic_codes || []);

  // Indexar por topic_code para lookup O(1)
  const progressMap = new Map<
    string,
    Pick<TopicProgressRow, "status" | "attempts" | "best_score" | "level_k">
  >();
  if (progressRows) {
    for (const row of progressRows) {
      progressMap.set(row.topic_code, row);
    }
  }

  // ─── 4c. Construir el array de SessionTopic ─────────────────
  const topics: SessionTopic[] = (session.topic_codes || []).map(
    (code: string) => {
      const topicData = topicsJson[code];
      const progress = progressMap.get(code);

      return {
        code,
        name: topicData?.name || code, // Fallback al código si no hay nombre
        level_k: topicData?.level_k || progress?.level_k || "K1",
        syllabus_text: topicData?.text || "",
        progress_status: progress?.status || "pending",
        attempts: progress?.attempts || 0,
        best_score: progress?.best_score || 0,
      };
    },
  );

  // ─── 4d. Calcular estadísticas del plan ─────────────────────
  // Contamos las sesiones totales y completadas para mostrar
  // progreso como "Sesión 3 de 14".
  const { count: totalSessions } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("study_plan_id", plan.id);

  const { count: completedSessions } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("study_plan_id", plan.id)
    .eq("status", "completed");

  // ─── 4e. Calcular session_number (posición ordinal real) ─────
  // No usamos "sesiones completadas + 1" porque /api/sessions/[id]
  // puede pedir una sesión específica que no sea la próxima pendiente.
  // Calculamos la posición real dentro del plan ordenado.
  const { data: planSessionsForOrder } = await supabase
    .from("sessions")
    .select("id, day_number, session_type")
    .eq("study_plan_id", plan.id)
    .eq("user_id", userId);

  const orderedSessions = (
    (planSessionsForOrder || []) as SortableSession[]
  ).sort(compareSessionsForStudyOrder);

  const sessionIndex = orderedSessions.findIndex(
    (item) => item.id === session.id,
  );
  const sessionNumber = sessionIndex >= 0 ? sessionIndex + 1 : 1;

  // ─── 4f. Construir el PlanContext ───────────────────────────
  const planContext: PlanContext = {
    plan_id: plan.id,
    objective_days: plan.objective_days,
    start_date: plan.start_date,
    estimated_end_date: plan.estimated_end_date,
    total_sessions: totalSessions || 0,
    completed_sessions: completedSessions || 0,
  };

  // ─── 4g. Retornar la sesión enriquecida ─────────────────────
  return {
    // Datos de la tabla sessions
    id: session.id,
    session_type: session.session_type,
    day_number: session.day_number,
    duration_minutes: session.duration_minutes,
    method_used: session.method_used,
    status: session.status,
    attempt_number: session.attempt_number,
    scheduled_at: session.scheduled_at,
    started_at: session.started_at,
    completed_at: session.completed_at,
    score_percent: session.score_percent,
    action_taken: session.action_taken,
    theory_content: session.theory_content,

    // Datos enriquecidos
    topics,
    plan_context: planContext,
    session_number: sessionNumber,
  };
}
