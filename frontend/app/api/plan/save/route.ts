// ─────────────────────────────────────────────────────────────────
// app/api/plan/save/route.ts
// Route Handler: persiste el plan generado por /api/plan/generate
// en las tablas study_plans, sessions y topic_progress de Supabase.
//
// Método: POST
// Content-Type: application/json
// Body:
//   {
//     document_id: string,
//     plan: GeneratedPlan,       // El plan completo retornado por UP-04
//     config: {
//       objective_days: number,
//       morning_time: string,    // "HH:MM"
//       night_time: string       // "HH:MM"
//     }
//   }
//
// Response (201): { plan_id: string, sessions_created: number, topics_created: number, start_date, estimated_end_date }
// Response (401): { error: "No autenticado" }
// Response (400): { error: "Body inválido" }
// Response (403): { error: "No tienes permisos" }
// Response (404): { error: "Documento no encontrado" }
// Response (409): { error: "Ya existe un plan activo para este documento" }
// Response (500): { error: "Error interno del servidor" }
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  TopicsJson,
  TopicEntry,
  StudyPlanInsert,
  SessionInsert,
  TopicProgressInsert,
  SessionType,
  MethodUsed,
} from "@/types";

// ─── Forzar Node.js runtime ──────────────────────────────────────
// Las operaciones de base de datos requieren Node.js, no Edge.
export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────────

// ─── Tipo de sesión en el plan generado por la IA (UP-04) ────────
// Coincide con el tipo PlanSession de /api/plan/generate/route.ts.
interface PlanSession {
  day_number: number;
  session_type: "morning" | "night";
  topic_codes: string[];
  method: "theory" | "examples" | "analogies";
  estimated_duration_minutes: number;
  difficulty: "easy" | "medium" | "hard";
  title: string;
}

// ─── Tipo del plan generado completo ─────────────────────────────
interface GeneratedPlan {
  sessions: PlanSession[];
  total_sessions: number;
  total_days: number;
  topics_per_level: {
    K1: number;
    K2: number;
    K3: number;
  };
  plan_summary: string;
  coverage: {
    total_topics: number;
    covered_topic_codes: string[];
    omitted_topic_codes: string[];
  };
}

// ─── Tipo del body esperado ──────────────────────────────────────
interface SavePlanBody {
  document_id: string;
  plan: GeneratedPlan;
  config: {
    objective_days: number;
    morning_time: string;
    night_time: string;
  };
}

// ─── Constantes de validación ────────────────────────────────────
const MIN_DAYS = 1;
const MAX_DAYS = 30;

// ─── Type guard para validar objetos ─────────────────────────────
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ─── Parser y validador del body ─────────────────────────────────
// Separamos la validación en una función pura para mantener el
// Route Handler limpio y facilitar testing futuro.
function parseBody(value: unknown): SavePlanBody | null {
  if (!isRecord(value)) return null;

  const { document_id, plan, config } = value;

  // ── Validar document_id ─────────────────────────────────────
  if (typeof document_id !== "string" || document_id.length === 0) return null;

  // ── Validar plan ────────────────────────────────────────────
  if (!isRecord(plan)) return null;
  const planObj = plan as unknown as GeneratedPlan;

  if (!Array.isArray(planObj.sessions) || planObj.sessions.length === 0) {
    return null;
  }

  // Verificar que cada sesión tiene los campos mínimos
  for (const session of planObj.sessions) {
    if (typeof session.day_number !== "number") return null;
    if (!["morning", "night"].includes(session.session_type)) return null;
    if (!Array.isArray(session.topic_codes)) return null;
  }

  // ── Validar config ──────────────────────────────────────────
  if (!isRecord(config)) return null;

  const { objective_days, morning_time, night_time } = config;

  if (
    typeof objective_days !== "number" ||
    objective_days < MIN_DAYS ||
    objective_days > MAX_DAYS
  ) {
    return null;
  }

  if (typeof morning_time !== "string" || !/^\d{2}:\d{2}$/.test(morning_time)) {
    return null;
  }

  if (typeof night_time !== "string" || !/^\d{2}:\d{2}$/.test(night_time)) {
    return null;
  }

  return {
    document_id,
    plan: planObj,
    config: {
      objective_days: objective_days as number,
      morning_time: morning_time as string,
      night_time: night_time as string,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS DE TRANSFORMACIÓN
// ─────────────────────────────────────────────────────────────────

/**
 * Calcula fechas del plan en el servidor.
 *
 * No confiamos en start_date / estimated_end_date enviados desde el
 * navegador porque son datos derivables y podrían ser manipulados.
 */
function calculatePlanDates(objectiveDays: number) {
  const today = new Date();
  const startDate = today.toISOString().split("T")[0];

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + objectiveDays - 1);

  return {
    start_date: startDate,
    estimated_end_date: endDate.toISOString().split("T")[0],
  };
}

/**
 * Revalida el plan generado contra los tópicos reales del documento.
 *
 * Aunque /api/plan/generate ya validó el plan en UP-04, /api/plan/save
 * recibe datos desde el navegador. Por seguridad, aquí repetimos las
 * reglas críticas antes de persistir en Supabase.
 */
function validatePlanAgainstTopics(
  plan: GeneratedPlan,
  topicsJson: TopicsJson,
  expectedDays: number,
): string[] {
  const errors: string[] = [];
  const originalCodes = new Set(Object.keys(topicsJson));
  const expectedSessions = expectedDays * 2;

  if (!Array.isArray(plan.sessions)) {
    return ["El plan no contiene sessions válido."];
  }

  if (plan.sessions.length !== expectedSessions) {
    errors.push(
      `El plan contiene ${plan.sessions.length} sesiones, pero se esperaban ${expectedSessions}.`,
    );
  }

  if (plan.total_sessions !== expectedSessions) {
    errors.push(
      `total_sessions debe ser ${expectedSessions}, pero llegó ${plan.total_sessions}.`,
    );
  }

  if (plan.total_days !== expectedDays) {
    errors.push(
      `total_days debe ser ${expectedDays}, pero llegó ${plan.total_days}.`,
    );
  }

  if (!plan.coverage || typeof plan.coverage !== "object") {
    errors.push("El plan no contiene coverage válido.");
    return errors;
  }

  if (plan.coverage.total_topics !== originalCodes.size) {
    errors.push(
      `coverage.total_topics debe ser ${originalCodes.size}, pero llegó ${plan.coverage.total_topics}.`,
    );
  }

  const allTopicCodes: string[] = [];

  for (let index = 0; index < plan.sessions.length; index++) {
    const session = plan.sessions[index];

    if (typeof session.day_number !== "number" || session.day_number < 1) {
      errors.push(`Sesión ${index + 1}: day_number inválido.`);
    }

    if (!["morning", "night"].includes(session.session_type)) {
      errors.push(`Sesión ${index + 1}: session_type inválido.`);
    }

    if (
      !Array.isArray(session.topic_codes) ||
      session.topic_codes.length === 0
    ) {
      errors.push(`Sesión ${index + 1}: topic_codes vacío o inválido.`);
      continue;
    }

    for (const code of session.topic_codes) {
      allTopicCodes.push(code);
      if (!originalCodes.has(code)) {
        errors.push(`Sesión ${index + 1}: topic_code inexistente: ${code}.`);
      }
    }
  }

  const codeSet = new Set<string>();
  const duplicates = new Set<string>();

  for (const code of allTopicCodes) {
    if (codeSet.has(code)) duplicates.add(code);
    codeSet.add(code);
  }

  if (duplicates.size > 0) {
    errors.push(`Tópicos duplicados: ${Array.from(duplicates).join(", ")}.`);
  }

  const omittedCodes = new Set(plan.coverage.omitted_topic_codes || []);
  const coveredCodes = new Set(plan.coverage.covered_topic_codes || []);

  const missingTopics = Array.from(originalCodes).filter(
    (code) => !codeSet.has(code) && !omittedCodes.has(code),
  );

  if (missingTopics.length > 0) {
    errors.push(`Tópicos omitidos sin declarar: ${missingTopics.join(", ")}.`);
  }

  const usedButNotCovered = Array.from(codeSet).filter(
    (code) => !coveredCodes.has(code),
  );

  if (usedButNotCovered.length > 0) {
    errors.push(
      `Tópicos usados pero ausentes en coverage.covered_topic_codes: ${usedButNotCovered.join(", ")}.`,
    );
  }

  const maxDayInPlan = Math.max(
    ...plan.sessions.map((session) => session.day_number),
  );
  if (maxDayInPlan > expectedDays) {
    errors.push(
      `El plan tiene sesiones hasta el día ${maxDayInPlan}, pero el objetivo es ${expectedDays}.`,
    );
  }

  return errors;
}

/**
 * Calcula la hora programada (scheduled_at) de una sesión.
 *
 * Combina la fecha del día (start_date + day_number - 1) con la
 * hora de la sesión (morning_time o night_time).
 *
 * @param startDate    - Fecha de inicio del plan ("YYYY-MM-DD")
 * @param dayNumber    - Número del día dentro del plan (1-based)
 * @param sessionType  - "morning" o "night"
 * @param morningTime  - Hora de la sesión matutina ("HH:MM")
 * @param nightTime    - Hora de la sesión nocturna ("HH:MM")
 * @returns ISO string con fecha y hora (e.g., "2026-06-28T06:00:00")
 */
function calculateScheduledAt(
  startDate: string,
  dayNumber: number,
  sessionType: "morning" | "night",
  morningTime: string,
  nightTime: string,
): string {
  // Crear la fecha del día correspondiente
  const date = new Date(startDate + "T00:00:00");
  date.setDate(date.getDate() + dayNumber - 1);

  // Elegir la hora según el tipo de sesión
  const time = sessionType === "morning" ? morningTime : nightTime;
  const [hours, minutes] = time.split(":").map(Number);

  date.setHours(hours, minutes, 0, 0);

  return date.toISOString();
}

/**
 * Transforma las sesiones del plan generado por la IA en objetos
 * listos para INSERT en la tabla `sessions` de Supabase.
 *
 * Cada sesión del plan de la IA se mapea a un SessionInsert con:
 * - study_plan_id: el ID del plan recién creado
 * - user_id: el ID del usuario autenticado
 * - topic_codes: array de códigos de tópicos
 * - session_type: "morning" o "night" (cast a SessionType)
 * - day_number: número del día
 * - scheduled_at: fecha+hora calculada
 * - duration_minutes: duración estimada (default 90)
 * - method_used: "theory" (cast a MethodUsed)
 * - status: "pending"
 */
function buildSessionInserts(
  planSessions: PlanSession[],
  planId: string,
  userId: string,
  startDate: string,
  morningTime: string,
  nightTime: string,
): SessionInsert[] {
  return planSessions.map((session) => ({
    study_plan_id: planId,
    user_id: userId,
    topic_codes: session.topic_codes,
    session_type: session.session_type as SessionType,
    day_number: session.day_number,
    scheduled_at: calculateScheduledAt(
      startDate,
      session.day_number,
      session.session_type,
      morningTime,
      nightTime,
    ),
    duration_minutes: session.estimated_duration_minutes || 90,
    method_used: (session.method || "theory") as MethodUsed,
    status: "pending" as const,
    attempt_number: 1,
  }));
}

/**
 * Construye los registros de topic_progress para TODOS los tópicos reales
 * del documento.
 *
 * Cada tópico ISTQB (ej. FL-1.1.1) obtiene un registro con:
 * - status: 'pending' (aún no estudiado)
 * - attempts: 0
 * - best_score: 0
 * - last_score: 0
 * - level_k y topic_name extraídos de topics_json
 *
 * No usamos coverage.covered_topic_codes como fuente de verdad porque
 * viene del plan generado y podría estar incompleto o manipulado.
 * La fuente canónica es documents.topics_json.
 */
function buildTopicProgressInserts(
  topicsJson: TopicsJson,
  planId: string,
  userId: string,
): TopicProgressInsert[] {
  return Object.keys(topicsJson)
    .sort()
    .map((code) => {
      const topic: TopicEntry = topicsJson[code];

      return {
        user_id: userId,
        study_plan_id: planId,
        topic_code: code,
        topic_name: topic.name || null,
        level_k: topic.level_k || null,
        attempts: 0,
        best_score: 0,
        last_score: 0,
        status: "pending" as const,
      };
    });
}

// ─────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ═══════════════════════════════════════════════════════════
    // FASE 1: AUTENTICACIÓN
    // ═══════════════════════════════════════════════════════════

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado. Por favor inicia sesión." },
        { status: 401 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 2: PARSING Y VALIDACIÓN DEL BODY
    // ═══════════════════════════════════════════════════════════

    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Body inválido. Se espera JSON." },
        { status: 400 },
      );
    }

    const body = parseBody(rawBody);

    if (!body) {
      return NextResponse.json(
        {
          error: "Body inválido. Esperado: { document_id, plan, config }.",
        },
        { status: 400 },
      );
    }

    const { document_id, plan, config } = body;

    console.log(
      `[Plan/Save] Guardando plan para documento ${document_id}: ` +
        `${plan.sessions.length} sesiones, ` +
        `${plan.coverage.total_topics} tópicos, ` +
        `${config.objective_days} días`,
    );

    // ═══════════════════════════════════════════════════════════
    // FASE 3: OWNERSHIP CHECK
    // Verificar que el documento pertenece al usuario autenticado.
    // ═══════════════════════════════════════════════════════════

    const adminClient = createAdminClient();

    const { data: document, error: docError } = await adminClient
      .from("documents")
      .select("id, user_id, topics_json")
      .eq("id", document_id)
      .single();

    if (docError || !document) {
      console.error("[Plan/Save] Documento no encontrado:", docError);
      return NextResponse.json(
        { error: "Documento no encontrado." },
        { status: 404 },
      );
    }

    if (document.user_id !== user.id) {
      console.warn(
        `[Plan/Save] ⚠️ Usuario ${user.id} intentó guardar plan para documento de ${document.user_id}`,
      );
      return NextResponse.json(
        { error: "No tienes permisos para acceder a este documento." },
        { status: 403 },
      );
    }

    // ── Verificar topics_json para construir topic_progress ────
    const topicsJson = document.topics_json as TopicsJson | null;

    if (!topicsJson || Object.keys(topicsJson).length === 0) {
      return NextResponse.json(
        {
          error:
            "El documento no tiene tópicos extraídos. " +
            "Primero completa la extracción (UP-03).",
        },
        { status: 400 },
      );
    }

    // ── Revalidar el plan contra los tópicos reales ───────────
    const validationErrors = validatePlanAgainstTopics(
      plan,
      topicsJson,
      config.objective_days,
    );

    if (validationErrors.length > 0) {
      console.error("[Plan/Save] Plan inválido:", validationErrors);
      return NextResponse.json(
        {
          error:
            "El plan recibido no cumple con los requisitos: " +
            validationErrors.join("; "),
        },
        { status: 400 },
      );
    }

    // ── Calcular fechas en servidor ───────────────────────────
    const { start_date, estimated_end_date } = calculatePlanDates(
      config.objective_days,
    );

    // ═══════════════════════════════════════════════════════════
    // FASE 3.5: VERIFICAR DUPLICADOS
    // Evitar crear múltiples planes activos para el mismo documento.
    // ═══════════════════════════════════════════════════════════

    const { data: existingPlan } = await adminClient
      .from("study_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("document_id", document_id)
      .eq("status", "active")
      .maybeSingle();

    if (existingPlan) {
      console.warn(
        `[Plan/Save] Ya existe un plan activo (${existingPlan.id}) para documento ${document_id}`,
      );
      return NextResponse.json(
        {
          error:
            "Ya existe un plan de estudio activo para este documento. " +
            "Complétalo o abandónalo antes de crear uno nuevo.",
          existing_plan_id: existingPlan.id,
        },
        { status: 409 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 4: INSERT study_plans
    // Crear el registro maestro del plan de estudio.
    // ═══════════════════════════════════════════════════════════

    const studyPlanInsert: StudyPlanInsert = {
      user_id: user.id,
      document_id,
      objective_days: config.objective_days,
      start_date,
      estimated_end_date,
      plan_json: plan as unknown as Record<string, unknown>,
      status: "active",
    };

    const { data: createdPlan, error: planError } = await adminClient
      .from("study_plans")
      .insert(studyPlanInsert)
      .select("id")
      .single();

    if (planError || !createdPlan) {
      console.error("[Plan/Save] Error al insertar study_plan:", planError);
      return NextResponse.json(
        {
          error:
            "Error al guardar el plan de estudio. " +
            (planError?.message || "Error desconocido."),
        },
        { status: 500 },
      );
    }

    const planId = createdPlan.id;
    console.log(`[Plan/Save] ✅ study_plans insertado: ${planId}`);

    // ═══════════════════════════════════════════════════════════
    // FASE 5: INSERT sessions (batch)
    // Crear las 14 sesiones del plan.
    // ═══════════════════════════════════════════════════════════

    const sessionInserts = buildSessionInserts(
      plan.sessions,
      planId,
      user.id,
      start_date,
      config.morning_time,
      config.night_time,
    );

    const { data: createdSessions, error: sessionsError } = await adminClient
      .from("sessions")
      .insert(sessionInserts)
      .select("id");

    if (sessionsError) {
      console.error("[Plan/Save] Error al insertar sessions:", sessionsError);

      // ── Rollback manual: eliminar el plan que ya se insertó ──
      // Supabase no tiene transacciones nativas en el SDK,
      // así que hacemos rollback manual eliminando el plan.
      // ON DELETE CASCADE en sessions borrará las sesiones parciales.
      await adminClient.from("study_plans").delete().eq("id", planId);

      console.log(`[Plan/Save] 🔄 Rollback: plan ${planId} eliminado`);

      return NextResponse.json(
        {
          error:
            "Error al guardar las sesiones del plan. " +
            "La operación se revirtió. " +
            (sessionsError.message || "Error desconocido."),
        },
        { status: 500 },
      );
    }

    const sessionsCreated = createdSessions?.length || 0;
    console.log(`[Plan/Save] ✅ sessions insertadas: ${sessionsCreated}`);

    // ═══════════════════════════════════════════════════════════
    // FASE 6: INSERT topic_progress (batch)
    // Crear un registro de progreso por cada tópico.
    // ═══════════════════════════════════════════════════════════

    const topicProgressInserts = buildTopicProgressInserts(
      topicsJson,
      planId,
      user.id,
    );

    const { data: createdTopics, error: topicsError } = await adminClient
      .from("topic_progress")
      .insert(topicProgressInserts)
      .select("id");

    if (topicsError) {
      console.error(
        "[Plan/Save] Error al insertar topic_progress:",
        topicsError,
      );

      // ── Rollback manual: eliminar plan + sessions ──────────
      // ON DELETE CASCADE se encarga de eliminar sessions también.
      await adminClient.from("study_plans").delete().eq("id", planId);

      console.log(
        `[Plan/Save] 🔄 Rollback: plan ${planId} + sessions eliminados`,
      );

      return NextResponse.json(
        {
          error:
            "Error al guardar el progreso de tópicos. " +
            "La operación se revirtió. " +
            (topicsError.message || "Error desconocido."),
        },
        { status: 500 },
      );
    }

    const topicsCreated = createdTopics?.length || 0;
    console.log(`[Plan/Save] ✅ topic_progress insertados: ${topicsCreated}`);

    // ═══════════════════════════════════════════════════════════
    // FASE 7: RESPUESTA EXITOSA
    // ═══════════════════════════════════════════════════════════

    console.log(
      `[Plan/Save] ✅ Plan persistido exitosamente: ` +
        `plan_id=${planId}, ` +
        `${sessionsCreated} sesiones, ` +
        `${topicsCreated} tópicos`,
    );

    return NextResponse.json(
      {
        plan_id: planId,
        sessions_created: sessionsCreated,
        topics_created: topicsCreated,
        start_date,
        estimated_end_date,
      },
      { status: 201 },
    );
  } catch (error) {
    // ─── Error no controlado ──────────────────────────────────
    console.error("[Plan/Save] Error no controlado:", error);

    return NextResponse.json(
      {
        error: "Error interno del servidor. Por favor intenta de nuevo.",
      },
      { status: 500 },
    );
  }
}
