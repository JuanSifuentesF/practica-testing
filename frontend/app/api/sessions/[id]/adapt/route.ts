// ─────────────────────────────────────────────────────────────────
// app/api/sessions/[id]/adapt/route.ts
// Route Handler: ejecuta la lógica adaptativa tras la evaluación.
//
// Método: POST
// Auth:   Requiere sesión válida (cookie JWT de Supabase)
// Params: id — UUID de la sesión YA EVALUADA (status=completed)
// Body:   { next_method }
//
// Response (200): AdaptResponse
// Response (400): { error: "Descripción del problema" }
// Response (401): { error: "No autenticado" }
// Response (404): { error: "Sesión no encontrada" }
// Response (409): { error: "La sesión aún no ha sido evaluada" }
// Response (500): { error: "Error interno del servidor" }
//
// FLUJO:
//   1. Autenticar usuario
//   2. Validar UUID de la sesión
//   3. Cargar sesión y verificar que está completed
//   4. Cargar el plan asociado (query separada — Relationships: [])
//   5. Leer action, score y topic_codes desde sessions (fuente de verdad)
//   6. Validar body mínimo (solo next_method)
//   7. Según action:
//      ADVANCE     → upsert topic_progress a 'mastered'
//      REINFORCE   → upsert topic_progress a 'in_progress', crear sesión reinforcement
//      RESTRUCTURE → upsert topic_progress a 'failed', crear 2 sesiones, extender plan
//   8. Retornar AdaptResponse
//
// IDEMPOTENCIA:
//   Sin añadir columnas nuevas, detectamos si topic_progress ya fue actualizado
//   después de completed_at y si las sesiones de refuerzo esperadas ya existen.
//   Esto evita duplicados accidentales por doble click, refresh o retry.
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionTaken,
  MethodUsed,
  SessionInsert,
  TopicProgressStatus,
} from "@/types";
import type { AdaptRequest, AdaptResponse } from "@/types/adapt";

// ─── Forzar Node.js runtime ─────────────────────────────────────
export const runtime = "nodejs";

// ─── Constantes ──────────────────────────────────────────────────
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_ACTIONS: ActionTaken[] = ["advance", "reinforce", "restructure"];
const VALID_METHODS: MethodUsed[] = ["theory", "examples", "analogies"];

// Días que se extiende el plan al restructure
const RESTRUCTURE_EXTENSION_DAYS = 2;
const RESTRUCTURE_SESSION_COUNT = 2;

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/**
 * Suma N días a una fecha en formato ISO (YYYY-MM-DD).
 * No usa librerías externas — aritmética pura de Date.
 */
function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  // Formatear como YYYY-MM-DD
  return date.toISOString().split("T")[0];
}

/**
 * Compara arrays de tópicos sin depender del orden.
 * Útil para detectar refuerzos ya creados para el mismo grupo de tópicos.
 */
function sameTopicSet(
  left: string[] | null | undefined,
  right: string[],
): boolean {
  if (!left || left.length !== right.length) return false;
  const leftSet = new Set(left);
  return right.every((topicCode) => leftSet.has(topicCode));
}

// ──────────────────────────────────────────────────────────────
// POST /api/sessions/[id]/adapt
// ──────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ═════════════════════════════════════════════════════════
    // 1. AUTENTICACIÓN
    // ═════════════════════════════════════════════════════════
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // ═════════════════════════════════════════════════════════
    // 2. VALIDAR UUID
    // ═════════════════════════════════════════════════════════
    const { id: sessionId } = await params;

    if (!sessionId || !UUID_REGEX.test(sessionId)) {
      return NextResponse.json(
        { error: "ID de sesión inválido. Debe ser un UUID válido." },
        { status: 400 },
      );
    }

    // ═════════════════════════════════════════════════════════
    // 3. CARGAR Y VALIDAR SESIÓN
    // ═════════════════════════════════════════════════════════
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Sesión no encontrada o no pertenece al usuario." },
        { status: 404 },
      );
    }

    // La adaptación solo puede ejecutarse sobre sesiones completadas.
    // Si el status no es 'completed', el cliente llamó en el orden incorrecto.
    if (session.status !== "completed") {
      return NextResponse.json(
        {
          error:
            "La sesión aún no ha sido evaluada. Llama a /evaluate primero.",
        },
        { status: 409 },
      );
    }

    // ═════════════════════════════════════════════════════════
    // 4. CARGAR PLAN ASOCIADO
    // ═════════════════════════════════════════════════════════
    // Query separada porque Relationships: [] en database.ts —
    // no se puede hacer join encadenado de forma segura.
    const { data: plan, error: planError } = await supabase
      .from("study_plans")
      .select("id, estimated_end_date, objective_days")
      .eq("id", session.study_plan_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "No se encontró el plan asociado a esta sesión." },
        { status: 404 },
      );
    }

    // ═════════════════════════════════════════════════════════
    // 5. LEER FUENTE DE VERDAD DESDE LA SESIÓN
    // ═════════════════════════════════════════════════════════

    const action = session.action_taken;
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: "La sesión completada no tiene action_taken válido." },
        { status: 409 },
      );
    }

    const score = Number(session.score_percent);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return NextResponse.json(
        { error: "La sesión completada no tiene score_percent válido." },
        { status: 409 },
      );
    }

    const topicCodes = session.topic_codes;
    if (
      !Array.isArray(topicCodes) ||
      topicCodes.length === 0 ||
      topicCodes.some((topicCode) => typeof topicCode !== "string")
    ) {
      return NextResponse.json(
        { error: "La sesión no tiene topic_codes válidos." },
        { status: 409 },
      );
    }

    // ═════════════════════════════════════════════════════════
    // 6. VALIDAR BODY MÍNIMO
    // ═════════════════════════════════════════════════════════
    let body: Partial<AdaptRequest> = {};
    try {
      const rawBody = await request.text();
      body = rawBody ? (JSON.parse(rawBody) as Partial<AdaptRequest>) : {};
    } catch {
      return NextResponse.json(
        { error: "Body inválido. Se esperaba JSON." },
        { status: 400 },
      );
    }

    const nextMethod = body.next_method ?? session.method_used;
    if (!VALID_METHODS.includes(nextMethod)) {
      return NextResponse.json(
        {
          error: `next_method inválido. Debe ser: ${VALID_METHODS.join(", ")}. Recibido: "${body.next_method}"`,
        },
        { status: 400 },
      );
    }

    // ═════════════════════════════════════════════════════════
    // 7. LÓGICA ADAPTATIVA
    // ═════════════════════════════════════════════════════════

    const reinforcementSessionIds: string[] = [];
    let newEstimatedEndDate: string | null = null;
    let adaptMessage = "";

    // ─── Determinar status de topic_progress según acción ───
    const topicStatus: Record<ActionTaken, TopicProgressStatus> = {
      advance: "mastered",
      reinforce: "in_progress",
      restructure: "failed",
    };
    const newTopicStatus = topicStatus[action];

    const now = new Date().toISOString();
    const completedAt = session.completed_at ?? session.created_at;

    // ─── 7a. Leer progreso existente para no pisar attempts/best_score ───
    const { data: existingProgress, error: progressError } = await supabase
      .from("topic_progress")
      .select(
        "topic_code, attempts, best_score, last_score, status, updated_at",
      )
      .eq("user_id", user.id)
      .eq("study_plan_id", plan.id)
      .in("topic_code", topicCodes);

    if (progressError) {
      console.error("[adapt] Error leyendo topic_progress:", progressError);
      return NextResponse.json(
        { error: "Error al leer el progreso actual de los tópicos." },
        { status: 500 },
      );
    }

    const progressByTopic = new Map(
      (existingProgress ?? []).map((progress) => [
        progress.topic_code,
        progress,
      ]),
    );

    const completedAtMs = Date.parse(completedAt);
    const progressAlreadyUpdated =
      topicCodes.length > 0 &&
      topicCodes.every((topicCode) => {
        const progress = progressByTopic.get(topicCode);
        if (!progress) return false;

        const updatedAtMs = Date.parse(String(progress.updated_at));
        return (
          progress.status === newTopicStatus &&
          Number(progress.last_score) === score &&
          Number.isFinite(updatedAtMs) &&
          Number.isFinite(completedAtMs) &&
          updatedAtMs >= completedAtMs
        );
      });

    // ─── 7b. Detectar refuerzos ya creados para evitar duplicados ───
    const requiredReinforcements =
      action === "advance"
        ? 0
        : action === "reinforce"
          ? 1
          : RESTRUCTURE_SESSION_COUNT;

    let existingReinforcements: { id: string; topic_codes: string[] | null }[] =
      [];

    if (requiredReinforcements > 0) {
      const { data: candidates, error: existingSessionError } = await supabase
        .from("sessions")
        .select("id, topic_codes, attempt_number, created_at")
        .eq("study_plan_id", plan.id)
        .eq("user_id", user.id)
        .eq("session_type", "reinforcement")
        .gte("attempt_number", (session.attempt_number || 1) + 1)
        .gte("created_at", completedAt)
        .order("attempt_number", { ascending: true });

      if (existingSessionError) {
        console.error(
          "[adapt] Error buscando refuerzos existentes:",
          existingSessionError,
        );
        return NextResponse.json(
          { error: "Error al verificar sesiones de refuerzo existentes." },
          { status: 500 },
        );
      }

      existingReinforcements = (candidates ?? [])
        .filter((candidate) => sameTopicSet(candidate.topic_codes, topicCodes))
        .slice(0, requiredReinforcements)
        .map((candidate) => ({
          id: candidate.id,
          topic_codes: candidate.topic_codes,
        }));
    }

    const alreadyHasRequiredReinforcements =
      existingReinforcements.length >= requiredReinforcements;

    if (progressAlreadyUpdated && alreadyHasRequiredReinforcements) {
      const response: AdaptResponse = {
        action,
        reinforcement_session_ids: existingReinforcements.map(
          (sessionRow) => sessionRow.id,
        ),
        new_estimated_end_date:
          action === "restructure" ? plan.estimated_end_date : null,
        already_processed: true,
        message: "La adaptación ya había sido aplicada previamente.",
      };

      console.log(`[adapt] Idempotente: sesión ${sessionId} ya procesada`);
      return NextResponse.json(response, { status: 200 });
    }

    // ─── 7c. UPSERT topic_progress ──────────────────────────
    // Se actualiza cada tópico de la sesión.
    // onConflict: "user_id,study_plan_id,topic_code" garantiza
    // que si la fila existe → actualiza; si no → inserta.

    const topicUpserts = topicCodes.map((topicCode) => {
      const previous = progressByTopic.get(topicCode);
      const previousAttempts = Number(previous?.attempts ?? 0);
      const previousBestScore = Number(previous?.best_score ?? 0);

      return {
        user_id: user.id,
        study_plan_id: plan.id,
        topic_code: topicCode,
        status: newTopicStatus,
        last_score: score,
        best_score: Math.max(previousBestScore, score),
        attempts: progressAlreadyUpdated
          ? previousAttempts
          : previousAttempts + 1,
        mastered_at: action === "advance" ? now : null,
        updated_at: now,
      };
    });

    const { error: upsertError } = await supabase
      .from("topic_progress")
      .upsert(topicUpserts, {
        onConflict: "user_id,study_plan_id,topic_code",
      });

    if (upsertError) {
      console.error("[adapt] Error en upsert de topic_progress:", upsertError);
      return NextResponse.json(
        { error: "Error al actualizar el progreso de los tópicos." },
        { status: 500 },
      );
    }

    console.log(
      `[adapt] topic_progress actualizado: ${topicCodes.length} tópicos → ${newTopicStatus}`,
    );

    // ─── 7d. Obtener el day_number máximo del plan ──────────
    // Necesario para saber dónde insertar las sesiones de refuerzo.
    // Query separada — no se puede inferir por join.
    let maxDayNumber = session.day_number; // Mínimo seguro

    if (action === "reinforce" || action === "restructure") {
      const { data: allSessions, error: dayError } = await supabase
        .from("sessions")
        .select("day_number")
        .eq("study_plan_id", plan.id)
        .eq("user_id", user.id);

      if (dayError) {
        console.error("[adapt] Error calculando max day_number:", dayError);
        return NextResponse.json(
          { error: "Error al calcular la posición de los refuerzos." },
          { status: 500 },
        );
      }

      if (allSessions && allSessions.length > 0) {
        maxDayNumber = Math.max(...allSessions.map((s) => s.day_number));
      }
    }

    // ─── 7e. Lógica por acción ──────────────────────────────

    if (action === "advance") {
      // ── ADVANCE ─────────────────────────────────────────
      // topic_progress ya actualizado a 'mastered'.
      // No se crean sesiones ni se modifica el plan.
      adaptMessage =
        `¡Excelente! Dominas los tópicos de esta sesión. ` +
        `El plan continúa sin cambios.`;

      console.log(`[adapt] ADVANCE: plan sin cambios para sesión ${sessionId}`);
    } else if (action === "reinforce") {
      // ── REINFORCE ────────────────────────────────────────
      // Crear UNA sesión de refuerzo el día siguiente al último.
      for (const existing of existingReinforcements) {
        reinforcementSessionIds.push(existing.id);
      }

      if (reinforcementSessionIds.length === 0) {
        const reinforceDay = maxDayNumber + 1;

        const reinforcementSession: SessionInsert = {
          study_plan_id: plan.id,
          user_id: user.id,
          topic_codes: topicCodes,
          session_type: "reinforcement",
          day_number: reinforceDay,
          duration_minutes: 15, // Refuerzo ligero — 15 min según roadmap
          method_used: nextMethod,
          attempt_number: (session.attempt_number || 1) + 1,
          status: "pending",
        };

        const { data: newSession, error: insertError } = await supabase
          .from("sessions")
          .insert(reinforcementSession)
          .select("id")
          .single();

        if (insertError || !newSession) {
          console.error(
            "[adapt] Error creando sesión de refuerzo:",
            insertError,
          );
          return NextResponse.json(
            { error: "Error al crear la sesión de refuerzo." },
            { status: 500 },
          );
        }

        reinforcementSessionIds.push(newSession.id);

        console.log(
          `[adapt] REINFORCE: sesión creada id=${newSession.id} day=${reinforceDay}`,
        );
      }

      adaptMessage =
        `Se ha agendado una sesión de refuerzo de 15 minutos ` +
        `con método ${nextMethod}.`;
    } else {
      // ── RESTRUCTURE ──────────────────────────────────────
      // Crear DOS sesiones de refuerzo en días consecutivos.
      for (const existing of existingReinforcements) {
        reinforcementSessionIds.push(existing.id);
      }

      const sessionsToCreate =
        RESTRUCTURE_SESSION_COUNT - reinforcementSessionIds.length;

      if (sessionsToCreate > 0) {
        const restructureSessions: SessionInsert[] = Array.from(
          { length: sessionsToCreate },
          (_, index) => {
            const ordinal = reinforcementSessionIds.length + index + 1;

            return {
              study_plan_id: plan.id,
              user_id: user.id,
              topic_codes: topicCodes,
              session_type: "reinforcement",
              day_number: maxDayNumber + index + 1,
              duration_minutes: 30,
              method_used: nextMethod,
              attempt_number: (session.attempt_number || 1) + ordinal,
              status: "pending",
            } satisfies SessionInsert;
          },
        );

        const { data: newSessions, error: insertError } = await supabase
          .from("sessions")
          .insert(restructureSessions)
          .select("id");

        if (insertError || !newSessions) {
          console.error(
            "[adapt] Error creando sesiones de reestructuración:",
            insertError,
          );
          return NextResponse.json(
            { error: "Error al crear las sesiones de reestructuración." },
            { status: 500 },
          );
        }

        for (const s of newSessions) {
          reinforcementSessionIds.push(s.id);
        }
      }

      // Extender el estimated_end_date del plan
      newEstimatedEndDate = addDays(
        plan.estimated_end_date,
        RESTRUCTURE_EXTENSION_DAYS,
      );

      const { error: planUpdateError } = await supabase
        .from("study_plans")
        .update({
          estimated_end_date: newEstimatedEndDate,
          updated_at: now,
        })
        .eq("id", plan.id)
        .eq("user_id", user.id);

      if (planUpdateError) {
        // No fallamos — las sesiones ya se crearon.
        // El plan puede ser corregido manualmente si es necesario.
        console.error(
          "[adapt] Error actualizando estimated_end_date:",
          planUpdateError,
        );
      } else {
        console.log(
          `[adapt] study_plans actualizado: estimated_end_date=${newEstimatedEndDate}`,
        );
      }

      adaptMessage =
        `El plan ha sido reestructurado. Se han agendado ` +
        `${reinforcementSessionIds.length} sesiones de refuerzo intensivo ` +
        `con método ${nextMethod}. ` +
        `La fecha estimada de examen se ha extendido al ${newEstimatedEndDate}.`;

      console.log(
        `[adapt] RESTRUCTURE: ${reinforcementSessionIds.length} sesiones listas, end_date=${newEstimatedEndDate}`,
      );
    }

    // ═════════════════════════════════════════════════════════
    // 8. RETORNAR RESPUESTA
    // ═════════════════════════════════════════════════════════
    const response: AdaptResponse = {
      action,
      reinforcement_session_ids: reinforcementSessionIds,
      new_estimated_end_date: newEstimatedEndDate,
      already_processed: false,
      message: adaptMessage,
    };

    console.log(
      `[adapt] Completado: action=${action}, message="${adaptMessage}"`,
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[adapt] Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
