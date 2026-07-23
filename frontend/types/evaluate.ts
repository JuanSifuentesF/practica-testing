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
import type { AdaptResponse } from "./adapt";

// ──────────────────────────────────────────────────────────────
// Request: Lo que el frontend envía al POST /evaluate
// ──────────────────────────────────────────────────────────────

/**
 * Una respuesta individual del usuario.
 *
 * Solo contiene una selección. La pregunta, solución y explicación se
 * recuperan del snapshot privado persistido por el servidor.
 */
export interface UserAnswer {
  /** Índice de la pregunta en el quiz (0-based) */
  question_id: number;
  /** Respuesta seleccionada por el usuario: "a", "b", "c", o "d" */
  user_answer: AnswerOption;
}

/**
 * Body del POST /api/sessions/[id]/evaluate.
 *
 * El frontend envía TODAS las respuestas de una sola vez.
 * No se permite envío parcial — esto se valida en el servidor.
 */
export interface EvaluateRequest {
  /** Snapshot privado que el servidor debe evaluar */
  attempt_id: string;
  /** Array completo de respuestas del usuario (una por pregunta) */
  answers: UserAnswer[];
}

/** Detalle autoritativo liberado solo después de finalizar el intento. */
export interface QuestionResult {
  question_id: number;
  question: string;
  options: OptionsJson;
  user_answer: AnswerOption;
  correct: AnswerOption;
  is_correct: boolean;
  explanation: string;
  topic_code: string;
  level_k: LevelK;
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

  /** Preguntas corregidas contra el snapshot privado del servidor */
  question_results: QuestionResult[];

  // ─── Metadatos ────────────────────────────────────────────
  /** Timestamp ISO de la evaluación */
  evaluated_at: string;
}

/** Respuesta HTTP: evaluación y adaptación confirmadas en una transacción. */
export interface EvaluateWithAdaptationResponse extends EvaluateResponse {
  adaptation: AdaptResponse;
}
