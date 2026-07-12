// ============================================================
// types/evaluate.ts — Tipos para la evaluación del quiz
// ============================================================
// Define el contrato entre QuizCard y POST /api/sessions/[id]/evaluate.
//
// FLUJO DE DATOS:
//   QuizCard construye EvaluateRequest con los datos del quiz.
//   El Route Handler responde con EvaluateResponse.
//
// SCORE: Se calcula determinísticamente en el servidor.
//   score = (respuestas_correctas / total) × 100
//   NO depende del LLM — el LLM solo aporta análisis cualitativo.
//
// ACCIÓN: La decide el servidor basándose en el score:
//   score >= 70% → "advance"
//   score 50-69% → "reinforce"
//   score < 50%  → "restructure"
// ============================================================

import type {
  AnswerOption,
  LevelK,
  ActionTaken,
  OptionsJson,
} from "./database";

// ──────────────────────────────────────────────────────────────
// Request: Lo que el frontend envía al POST /evaluate
// ──────────────────────────────────────────────────────────────

/**
 * Una respuesta individual del usuario.
 *
 * Contiene tanto los datos de la pregunta (para persistir en `answers`)
 * como la respuesta del usuario. Esto evita que el servidor tenga que
 * re-generar o buscar el quiz — el cliente envía todo lo necesario.
 */
export interface UserAnswer {
  /** Índice de la pregunta en el quiz (0-based) */
  question_id: number;
  /** Respuesta seleccionada por el usuario: "a", "b", "c", o "d" */
  user_answer: AnswerOption;
  /** Texto completo del enunciado de la pregunta */
  question_text: string;
  /** Las 4 opciones de respuesta */
  options: OptionsJson;
  /** La respuesta correcta según el LLM que generó el quiz */
  correct: AnswerOption;
  /** Explicación de por qué la correcta es correcta */
  explanation: string;
  /** Código del tópico ISTQB (ej. "FL-1.1.1") */
  topic_code: string;
  /** Nivel K de la pregunta */
  level_k: LevelK;
}

/**
 * Body del POST /api/sessions/[id]/evaluate.
 *
 * El frontend envía TODAS las respuestas de una sola vez.
 * No se permite envío parcial — esto se valida en el servidor.
 */
export interface EvaluateRequest {
  /** Array completo de respuestas del usuario (una por pregunta) */
  answers: UserAnswer[];
}

// ──────────────────────────────────────────────────────────────
// Response: Lo que el servidor retorna después de evaluar
// ──────────────────────────────────────────────────────────────

/** Tópico que el estudiante falló en el quiz */
export interface FailedTopic {
  /** Código del tópico (ej. "FL-1.1.1") */
  topic_code: string;
  /** Nombre descriptivo del tópico */
  topic_name: string;
  /** Preguntas falladas en este tópico */
  questions_failed: number;
  /** Total de preguntas de este tópico en el quiz */
  questions_total: number;
}

/** Patrón de error identificado por el LLM */
export interface ErrorPattern {
  /** Descripción del patrón (ej. "Confusión entre pruebas estáticas y dinámicas") */
  pattern: string;
  /** Frecuencia estimada: "alta", "media", "baja" */
  frequency: "alta" | "media" | "baja";
  /** Sugerencia de corrección */
  suggestion: string;
}

/**
 * Respuesta completa de la evaluación.
 *
 * Combina datos determinísticos (score, correct_count) con
 * análisis cualitativo del LLM (feedback, error_patterns).
 */
export interface EvaluateResponse {
  // ─── Datos determinísticos (calculados en servidor) ────────
  /** Score como porcentaje entero (0-100) */
  score: number;
  /** Cantidad de respuestas correctas */
  correct_count: number;
  /** Total de preguntas evaluadas */
  total_questions: number;
  /** Acción del sistema adaptativo: advance | reinforce | restructure */
  action: ActionTaken;

  // ─── Análisis cualitativo (generado por LLM) ──────────────
  /** Tópicos donde el estudiante falló */
  failed_topics: FailedTopic[];
  /** Patrones de error identificados por el LLM */
  error_patterns: ErrorPattern[];
  /** Mensaje de feedback personalizado del LLM (texto natural) */
  feedback_message: string;
  /** Método recomendado para la próxima sesión */
  next_method: "theory" | "examples" | "analogies";
  /** Minutos de refuerzo recomendados (0 si advance) */
  reinforcement_minutes: number;

  // ─── Metadatos ────────────────────────────────────────────
  /** Timestamp ISO de la evaluación */
  evaluated_at: string;
}
