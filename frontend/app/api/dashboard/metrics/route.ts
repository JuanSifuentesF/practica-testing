// ─────────────────────────────────────────────────────────────────
// app/api/dashboard/metrics/route.ts
// Route Handler: retorna TODAS las métricas del dashboard en un
// solo JSON. Diseñado para ser consumido por los componentes
// del Bloque F (DA-02 a DA-05).
//
// Método:   GET
// Auth:     Requiere sesión válida (cookie JWT de Supabase)
//
// Response (200): { metrics: DashboardMetrics }
//   → Cuando hay un plan activo con datos
//
// Response (200): { metrics: null, message: "..." }
//   → Cuando el usuario no tiene plan activo
//
// Response (401): { error: "No autenticado" }
// Response (500): { error: "Error interno del servidor" }
//
// ESTRATEGIA DE QUERIES:
//   Ejecutamos consultas SEPARADAS a Supabase porque la definición
//   de tipos tiene Relationships: [] (no se pueden hacer JOINs con
//   tipos inferidos). Cada query retorna su propio tipo (SessionRow,
//   TopicProgressRow, StudyPlanRow) con autocompletado completo.
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SessionRow, TopicProgressRow, StudyPlanRow } from "@/types";
import type {
  DashboardMetrics,
  SessionScore,
  TopicHeatmapItem,
  TopicStatusCount,
  TimeComparison,
} from "@/types/dashboard";
import {
  assertPracticeStatsFixtures,
  buildPracticeStats,
  isPracticeExerciseMetric,
  isPracticeSubmissionMetric,
  type PracticeSubmissionMetric,
} from "@/lib/dashboard/practice-stats";

// ─── Forzar Node.js runtime ─────────────────────────────────────
// El Edge Runtime podría funcionar, pero Node.js es más predecible
// para múltiples queries a Supabase con manejo de cookies.
export const runtime = "nodejs";

// ─── Revalidación ───────────────────────────────────────────────
// Las métricas del dashboard cambian con cada sesión completada.
// revalidate = 0 asegura que SIEMPRE obtenemos datos frescos.
// En el futuro, podríamos usar ISR con revalidación temporal.
export const revalidate = 0;

if (process.env.NODE_ENV === "development") {
  assertPracticeStatsFixtures();
}

// =================================================================
// Handler principal: GET /api/dashboard/metrics
// =================================================================

export async function GET() {
  try {
    // ─── 1. AUTENTICACIÓN ──────────────────────────────────────
    // Crear cliente Supabase con las cookies de la petición.
    // createClient() lee las cookies del request para obtener
    // el JWT del usuario autenticado.
    const supabase = await createClient();

    // Verificar identidad con getUser() (NO getSession()).
    // getUser() valida el JWT contra el servidor de Supabase Auth,
    // mientras que getSession() solo lo decodifica localmente.
    // En endpoints que retornan datos sensibles, SIEMPRE usar getUser().
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Si no hay usuario autenticado, retornar 401.
    // Esto ocurre cuando:
    //   - La cookie de sesión expiró y no se pudo refrescar
    //   - El usuario nunca hizo login
    //   - La cookie fue eliminada manualmente
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // ─── 2. QUERY 1: Buscar el plan activo ─────────────────────
    // Un usuario solo puede tener UN plan activo a la vez.
    // Buscamos el primer (y único) plan con status = 'active'.
    //
    // ¿Por qué .limit(1).maybeSingle()?
    //   - .limit(1) → eficiencia: no traer múltiples filas
    //   - .maybeSingle() → retorna null (no error) si no hay plan
    //     A diferencia de .single() que lanza error si no hay filas.
    const { data: activePlan, error: planError } = await supabase
      .from("study_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Si hubo un error real de Supabase (no simplemente "no hay plan"),
    // retornamos 500 con el mensaje del error para debugging.
    if (planError) {
      console.error("[DA-01] Error buscando plan activo:", planError.message);
      return NextResponse.json(
        { error: "Error al buscar el plan de estudio" },
        { status: 500 },
      );
    }

    // Si no hay plan activo, retornamos una respuesta especial.
    // El frontend mostrará un estado vacío con call-to-action:
    // "Aún no tienes un plan activo. Ve a 'Mi Plan' para crear uno."
    if (!activePlan) {
      return NextResponse.json(
        {
          metrics: null,
          message:
            "No tienes un plan de estudio activo. Crea uno desde 'Mi Plan'.",
        },
        { status: 200 },
      );
    }

    // TypeScript ahora sabe que activePlan es StudyPlanRow (no null).
    // Lo tiparemos explícitamente para mayor claridad.
    const plan: StudyPlanRow = activePlan;

    // ─── 3. QUERY 2: Sesiones completadas del plan ─────────────
    // Traemos SOLO las sesiones con status = 'completed' porque:
    //   - Las sesiones pending/active/skipped no tienen score
    //   - La gráfica de scores solo muestra sesiones evaluadas
    //   - Ordenamos por day_number para que la gráfica sea cronológica
    //
    // NOTA: También necesitamos el TOTAL de sesiones (incluidas las
    // pendientes) para calcular completed_sessions / total_sessions.
    // Lo hacemos con una segunda query más abajo.

    const { data: completedSessions, error: sessionsError } = await supabase
      .from("sessions")
      .select("*")
      .eq("study_plan_id", plan.id)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("day_number", { ascending: true });

    if (sessionsError) {
      console.error(
        "[DA-01] Error obteniendo sesiones:",
        sessionsError.message,
      );
      return NextResponse.json(
        { error: "Error al obtener las sesiones" },
        { status: 500 },
      );
    }

    // Query adicional: contar TODAS las sesiones del plan (sin filtro de status).
    // Usamos select('id', { count: 'exact', head: true }) para obtener
    // solo el conteo sin descargar las filas completas.
    const { count: totalSessionsCount, error: countError } = await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("study_plan_id", plan.id)
      .eq("user_id", user.id);

    if (countError) {
      console.error("[DA-01] Error contando sesiones:", countError.message);
      // No es crítico — usamos un fallback
    }

    // ─── 4. QUERY 3: Progreso de tópicos del plan ──────────────
    // Traemos TODOS los registros de topic_progress para este plan.
    // Cada fila tiene un status: pending, in_progress, mastered, failed.
    // Los contaremos en el servidor para generar TopicStatusCount.

    const { data: topicProgressData, error: topicError } = await supabase
      .from("topic_progress")
      .select("*")
      .eq("study_plan_id", plan.id)
      .eq("user_id", user.id);

    if (topicError) {
      console.error("[DA-01] Error obteniendo progreso:", topicError.message);
      return NextResponse.json(
        { error: "Error al obtener el progreso de tópicos" },
        { status: 500 },
      );
    }

    const { data: practiceExercisesData, error: practiceExercisesError } =
      await supabase
        .from("practice_exercises")
        .select("id, exercise_type")
        .eq("user_id", user.id)
        .eq("document_id", plan.document_id);

    if (practiceExercisesError) {
      console.error("[PL-13] Error obteniendo ejercicios:", practiceExercisesError.message);
      return NextResponse.json({ error: "Error al obtener ejercicios de práctica" }, { status: 500 });
    }

    const rawExercises = practiceExercisesData ?? [];
    const practiceExercises = rawExercises.filter(isPracticeExerciseMetric);
    if (practiceExercises.length !== rawExercises.length) {
      return NextResponse.json({ error: "Los ejercicios almacenados tienen un contrato inválido" }, { status: 500 });
    }

    const exerciseIds = practiceExercises.map((exercise) => exercise.id);
    let practiceSubmissions: PracticeSubmissionMetric[] = [];

    if (exerciseIds.length > 0) {
      const { data: practiceSubmissionsData, error: practiceSubmissionsError } =
        await supabase
          .from("practice_submissions")
          .select("exercise_id, score_percent")
          .eq("user_id", user.id)
          .in("exercise_id", exerciseIds);

      if (practiceSubmissionsError) {
        console.error("[PL-13] Error obteniendo submissions:", practiceSubmissionsError.message);
        return NextResponse.json({ error: "Error al obtener entregas de práctica" }, { status: 500 });
      }

      const rawSubmissions = practiceSubmissionsData ?? [];
      practiceSubmissions = rawSubmissions.filter(isPracticeSubmissionMetric);
      if (practiceSubmissions.length !== rawSubmissions.length) {
        return NextResponse.json({ error: "Las entregas almacenadas tienen un contrato inválido" }, { status: 500 });
      }
    }

    // ─── 5. CONSTRUIR LAS MÉTRICAS ────────────────────────────

    // Asegurar que los arrays nunca sean null (Supabase puede retornar null
    // si no hay filas, aunque normalmente retorna [])
    const sessions: SessionRow[] = completedSessions ?? [];
    const topicProgress: TopicProgressRow[] = topicProgressData ?? [];

    // 5a. Construir scores_by_session (para la gráfica de líneas)
    const scoresBySession: SessionScore[] = sessions.map((session) => ({
      session_id: session.id,
      day_number: session.day_number,
      session_type: session.session_type,
      // Defensivo: si score_percent es null en una sesión "completed",
      // algo extraño pasó. Usamos 0 como fallback seguro.
      score_percent: session.score_percent ?? 0,
      action_taken: session.action_taken,
      // Defensivo: completed_at debería existir en sesiones completadas,
      // pero por seguridad usamos la fecha de creación como fallback.
      completed_at: session.completed_at ?? session.created_at,
      topic_codes: session.topic_codes ?? [],
    }));

    // 5b. Construir topic_status (conteo por estado)
    const topicStatus: TopicStatusCount = buildTopicStatusCount(topicProgress);

    // 5c. Construir time_comparison (tiempo real vs estimado)
    const timeComparison: TimeComparison[] = sessions.map((session) => ({
      session_id: session.id,
      day_number: session.day_number,
      session_type: session.session_type,
      estimated_minutes: session.duration_minutes,
      // Calcular minutos reales entre started_at y completed_at.
      // Si alguno de los dos es null, actual_minutes será null.
      actual_minutes: calculateActualMinutes(
        session.started_at,
        session.completed_at,
      ),
    }));

    // 5d. Construir topic_progress para el heatmap (DA-03)
    // No retornamos TopicProgressRow completo para no exponer IDs internos
    // como user_id o study_plan_id. El dashboard solo necesita datos visuales.
    const topicHeatmap: TopicHeatmapItem[] = topicProgress.map((topic) => ({
      topic_code: topic.topic_code,
      topic_name: topic.topic_name,
      level_k: topic.level_k,
      attempts: topic.attempts,
      best_score: topic.best_score,
      last_score: topic.last_score,
      status: topic.status,
      mastered_at: topic.mastered_at,
      updated_at: topic.updated_at,
    }));

    // 5d. Calcular métricas derivadas
    const completedCount = sessions.length;
    const totalSessions = totalSessionsCount ?? sessions.length;
    const completionPercent = calculateCompletionPercent(topicStatus);
    const currentStreak = calculateCurrentStreak(sessions);

    const practiceStats = buildPracticeStats(practiceExercises, practiceSubmissions);

    // ─── 6. ENSAMBLAR Y RETORNAR EL JSON ──────────────────────

    const metrics: DashboardMetrics = {
      // Datos de series
      scores_by_session: scoresBySession,
      time_comparison: timeComparison,
      topic_progress: topicHeatmap,

      // Datos agregados
      topic_status: topicStatus,
      practice_stats: practiceStats,

      // Datos del plan
      estimated_end_date: plan.estimated_end_date,
      start_date: plan.start_date,
      objective_days: plan.objective_days,
      plan_status: plan.status,

      // Métricas derivadas
      completion_percent: completionPercent,
      total_sessions: totalSessions,
      completed_sessions: completedCount,
      current_streak: currentStreak,
    };

    // Retornar con status 200 y el wrapper { metrics: ... }
    return NextResponse.json({ metrics }, { status: 200 });
  } catch (error) {
    // ─── Catch-all para errores inesperados ─────────────────
    // En producción, logueamos el error completo pero retornamos
    // un mensaje genérico al cliente (no exponer detalles internos).
    console.error(
      "[DA-01] Error inesperado:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}

// =================================================================
// FUNCIONES AUXILIARES (privadas al módulo)
// =================================================================

/**
 * Cuenta los tópicos por cada estado (pending, in_progress, mastered, failed).
 *
 * ESTRATEGIA: Iteramos UNA sola vez sobre el array usando reduce().
 * Esto es O(n) — mucho mejor que hacer 4 filter() separados que
 * serían O(4n).
 *
 * @param topicProgress - Array de filas de topic_progress
 * @returns Objeto con conteos por estado + total
 */
function buildTopicStatusCount(
  topicProgress: TopicProgressRow[],
): TopicStatusCount {
  // Valor inicial: todos los contadores en 0
  const counts = topicProgress.reduce(
    (acc, topic) => {
      // Defensivo: si el status es un valor inesperado,
      // lo contamos como 'pending' para no perderlo.
      switch (topic.status) {
        case "pending":
          acc.pending++;
          break;
        case "in_progress":
          acc.in_progress++;
          break;
        case "mastered":
          acc.mastered++;
          break;
        case "failed":
          acc.failed++;
          break;
        default:
          // Status desconocido → contar como pending
          acc.pending++;
      }
      return acc;
    },
    { pending: 0, in_progress: 0, mastered: 0, failed: 0 },
  );

  return {
    ...counts,
    // total = suma de todos los estados.
    // Usamos topicProgress.length directamente, que es más fiable
    // que sumar los contadores (evita bugs de double-counting).
    total: topicProgress.length,
  };
}

/**
 * Calcula el porcentaje de avance del plan usando tópicos dominados.
 *
 * Fórmula:
 *   mastered / total * 100
 *
 * @param topicStatus - Conteo agregado de tópicos por estado
 * @returns Porcentaje redondeado a 2 decimales (0-100)
 */
function calculateCompletionPercent(topicStatus: TopicStatusCount): number {
  if (topicStatus.total === 0) {
    return 0;
  }

  return Math.round((topicStatus.mastered / topicStatus.total) * 10000) / 100;
}

/**
 * Calcula los minutos reales invertidos en una sesión.
 *
 * @param startedAt - ISO timestamp de inicio (puede ser null)
 * @param completedAt - ISO timestamp de finalización (puede ser null)
 * @returns Minutos reales (redondeados) o null si faltan datos
 *
 * MANEJO DEFENSIVO:
 *   - Si alguno de los timestamps es null → retorna null
 *   - Si la diferencia es negativa (dato corrupto) → retorna null
 *   - Si la diferencia es 0 → retorna 1 (mínimo 1 minuto)
 */
function calculateActualMinutes(
  startedAt: string | null,
  completedAt: string | null,
): number | null {
  // Si falta alguno de los timestamps, no podemos calcular
  if (!startedAt || !completedAt) {
    return null;
  }

  // Parsear las fechas ISO a objetos Date
  const start = new Date(startedAt);
  const end = new Date(completedAt);

  // Calcular diferencia en milisegundos → convertir a minutos
  const diffMs = end.getTime() - start.getTime();

  // Validar que la diferencia sea positiva (datos consistentes)
  if (diffMs < 0) {
    // completed_at es ANTERIOR a started_at — dato corrupto
    // Retornar null en lugar de un número negativo
    return null;
  }

  // Convertir ms → minutos y redondear.
  // Math.max(1, ...) asegura mínimo 1 minuto (evitar "0 min").
  const minutes = Math.round(diffMs / (1000 * 60));
  return Math.max(1, minutes);
}

/**
 * Calcula la racha actual de días consecutivos con sesiones completadas.
 *
 * ALGORITMO:
 *   1. Extraer las fechas únicas de completed_at (solo la parte de fecha,
 *      ignorando la hora).
 *   2. Obtener la fecha de hoy.
 *   3. Verificar si hoy tiene al menos 1 sesión completada.
 *      Si no → la racha es 0 (se rompió).
 *   4. Contar hacia atrás: ¿ayer tuvo sesión? ¿anteayer? etc.
 *      La racha se rompe en el primer día sin sesión.
 *
 * NOTA: Usamos day_number en lugar de fechas calendario cuando las
 * sesiones no tienen completed_at fiable. Pero como filtramos por
 * status = 'completed', siempre deberían tener completed_at.
 *
 * @param sessions - Sesiones completadas, ordenadas por day_number ASC
 * @returns Número de días consecutivos con sesiones (0 si no hay racha)
 */
function calculateCurrentStreak(sessions: SessionRow[]): number {
  // Si no hay sesiones completadas, la racha es 0
  if (sessions.length === 0) {
    return 0;
  }

  // Extraer las fechas únicas de sesiones completadas.
  // Usamos un Set para eliminar duplicados (un día puede tener
  // morning + night, pero cuenta como 1 día en la racha).
  const completedDates = new Set<string>();

  for (const session of sessions) {
    if (session.completed_at) {
      // Extraer solo la parte de fecha (YYYY-MM-DD) del timestamp ISO.
      // "2026-06-28T14:30:00.000Z" → "2026-06-28"
      const dateOnly = session.completed_at.split("T")[0];
      if (dateOnly) {
        completedDates.add(dateOnly);
      }
    }
  }

  // Si no hay fechas válidas, la racha es 0
  if (completedDates.size === 0) {
    return 0;
  }

  // Empezar desde hoy y contar hacia atrás
  let streak = 0;
  const today = new Date();

  // Intentamos como máximo 365 días hacia atrás (safety limit)
  for (let daysBack = 0; daysBack < 365; daysBack++) {
    // Crear la fecha para "hoy - daysBack días"
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - daysBack);

    // Formatear como YYYY-MM-DD para comparar con el Set
    const dateStr = checkDate.toISOString().split("T")[0];

    if (dateStr && completedDates.has(dateStr)) {
      // Este día tiene sesión completada → incrementar racha
      streak++;
    } else {
      // Este día NO tiene sesión → la racha se rompe.
      // EXCEPCIÓN: si es el primer día (hoy) y no tiene sesión,
      // aún podríamos contar la racha de ayer hacia atrás.
      // Pero por simplicidad y claridad, si hoy no tiene sesión,
      // la racha es 0.
      break;
    }
  }

  return streak;
}
