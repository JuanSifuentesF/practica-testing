// ============================================================
// types/sessions.ts — Tipos para la API de sesiones de estudio
// ============================================================
// Estos tipos definen la respuesta ENRIQUECIDA que los Route
// Handlers /api/sessions/next y /api/sessions/[id] retornan.
//
// ¿Por qué no usamos SessionRow directamente?
//   SessionRow es la fila CRUDA de la tabla sessions.
//   Pero el frontend necesita CONTEXTO adicional:
//     - El nombre y nivel K de cada tópico (viene de documents.topics_json)
//     - El nombre del plan (viene de study_plans)
//     - La posición de la sesión en el plan (calculado)
//     - El progreso actual del tópico (viene de topic_progress)
//
//   Enviar todo esto en una sola respuesta evita que el frontend
//   haga múltiples roundtrips al servidor.
// ============================================================

import type {
  SessionType,
  SessionStatus,
  MethodUsed,
  ActionTaken,
  LevelK,
  TopicProgressStatus,
} from "./database";

// ──────────────────────────────────────────────────────────────
// Información enriquecida de un tópico dentro de una sesión
// ──────────────────────────────────────────────────────────────

/** Tópico con contexto extraído de documents.topics_json y topic_progress */
export interface SessionTopic {
  /** Código del tópico, ej. "FL-1.1.1" */
  code: string;
  /** Nombre descriptivo del tópico (del topics_json) */
  name: string;
  /** Nivel K del ISTQB: K1, K2, o K3 */
  level_k: LevelK;
  /** Texto del syllabus para este tópico (del topics_json) */
  syllabus_text: string;
  /** Estado actual del progreso del estudiante en este tópico */
  progress_status: TopicProgressStatus;
  /** Número de intentos previos en este tópico */
  attempts: number;
  /** Mejor score obtenido (0-100) */
  best_score: number;
}

// ──────────────────────────────────────────────────────────────
// Contexto del plan de estudio
// ──────────────────────────────────────────────────────────────

/** Metadatos del plan necesarios para mostrar contexto en la sesión */
export interface PlanContext {
  /** ID del plan de estudio */
  plan_id: string;
  /** Número total de días del plan */
  objective_days: number;
  /** Fecha de inicio del plan (ISO date) */
  start_date: string;
  /** Fecha estimada de finalización (ISO date) */
  estimated_end_date: string;
  /** Total de sesiones en el plan */
  total_sessions: number;
  /** Número de sesiones completadas hasta ahora */
  completed_sessions: number;
}

// ──────────────────────────────────────────────────────────────
// Respuesta principal: Sesión con todo su contexto
// ──────────────────────────────────────────────────────────────

/** Respuesta completa de GET /api/sessions/next y GET /api/sessions/[id] */
export interface SessionWithContext {
  // ─── Datos de la sesión (de la tabla sessions) ─────────────
  /** UUID de la sesión */
  id: string;
  /** Tipo de sesión: morning, night, reinforcement, mock_exam */
  session_type: SessionType;
  /** Número de día en el plan (1-based) */
  day_number: number;
  /** Duración en minutos (default 90) */
  duration_minutes: number;
  /** Método de enseñanza: theory, examples, analogies */
  method_used: MethodUsed;
  /** Estado actual: pending, active, completed, skipped */
  status: SessionStatus;
  /** Número de intento (1 = primer intento) */
  attempt_number: number;
  /** Hora programada (ISO string o null) */
  scheduled_at: string | null;
  /** Hora de inicio real (ISO string o null) */
  started_at: string | null;
  /** Hora de finalización (ISO string o null) */
  completed_at: string | null;
  /** Score del quiz (0-100 o null si no evaluada) */
  score_percent: number | null;
  /** Acción tomada por el sistema adaptativo (null si no evaluada) */
  action_taken: ActionTaken | null;
  /** Contenido teórico generado (null hasta SE-02) */
  theory_content: string | null;

  // ─── Datos enriquecidos (calculados por la API) ────────────
  /** Tópicos con contexto completo (nombre, nivel K, texto, progreso) */
  topics: SessionTopic[];
  /** Contexto del plan de estudio */
  plan_context: PlanContext;
  /** Posición ordinal de esta sesión (ej. "Sesión 3 de 14") */
  session_number: number;
}

// ──────────────────────────────────────────────────────────────
// Respuesta de la API cuando no hay sesiones pendientes
// ──────────────────────────────────────────────────────────────

/** GET /api/sessions/next cuando el plan está completado */
export interface NoSessionResponse {
  /** null indica que no hay más sesiones pendientes */
  session: null;
  /** Mensaje descriptivo para el frontend */
  message: string;
  /** Indica si el plan está completado */
  plan_completed: boolean;
}

// ──────────────────────────────────────────────────────────────
// Union type para el response de la API
// ──────────────────────────────────────────────────────────────

/** Response exitoso de GET /api/sessions/next */
export type NextSessionResponse =
  | { session: SessionWithContext }
  | NoSessionResponse;

/** Response exitoso de GET /api/sessions/[id] */
export type SessionByIdResponse = { session: SessionWithContext };
