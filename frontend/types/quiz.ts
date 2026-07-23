// ============================================================
// types/quiz.ts — Tipos para el quiz generado por IA
// ============================================================
// Estos tipos definen el contrato PUBLICO que recibe el navegador.
// La respuesta correcta y la explicación viven solo en el snapshot
// privado del servidor y aparecen después de finalizar la evaluación.
//
// DISEÑO:
//   - Cada pregunta tiene exactamente 4 opciones (a, b, c, d)
//   - Solo una respuesta es correcta
//   - Cada pregunta lleva una explicación (para el FeedbackPanel de SE-08)
//   - Cada pregunta está ligada a un topic_code y level_k
//
// RELACIÓN CON database.ts:
//   - AnswerOption ("a" | "b" | "c" | "d") ya existe en database.ts
//   - OptionsJson (Record<AnswerOption, string>) ya existe en database.ts
//   - Reutilizamos esos tipos para mantener consistencia con la DB
// ============================================================

import type { OptionsJson, LevelK } from "./database";
import type { EvaluateResponse } from "./evaluate";
import type { AdaptResponse } from "./adapt";

// ──────────────────────────────────────────────────────────────
// Pregunta individual del quiz
// ──────────────────────────────────────────────────────────────

/**
 * Proyección pública de una pregunta generada por el LLM.
 *
 * El formato sigue el estilo del examen ISTQB Foundation Level:
 *   - Un "stem" (enunciado) que puede incluir un escenario (K3)
 *   - Exactamente 4 opciones (a, b, c, d)
 * La respuesta correcta y la explicación se omiten por diseño. Ocultarlas
 * solo en React no sería suficiente porque seguirían visibles en DevTools.
 */
export interface QuizQuestion {
  /** Identificador único dentro del quiz (0-indexed, generado por la API) */
  question_id: number;
  /** Enunciado de la pregunta (puede incluir un escenario para K3) */
  question: string;
  /** Las 4 opciones de respuesta: { a: "...", b: "...", c: "...", d: "..." } */
  options: OptionsJson;
  /** Código del tópico ISTQB al que pertenece esta pregunta (ej. "FL-1.1.1") */
  topic_code: string;
  /** Nivel K de la pregunta: K1, K2, o K3 */
  level_k: LevelK;
}

// ──────────────────────────────────────────────────────────────
// Contenido completo del quiz
// ──────────────────────────────────────────────────────────────

/**
 * Quiz completo generado para una sesión de estudio.
 *
 * Contiene la proyección pública y el identificador del snapshot durable.
 */
export interface QuizContent {
  /** Identificador opaco del snapshot privado persistido en PostgreSQL */
  attempt_id: string;
  /** Array de preguntas del quiz (10-12 preguntas típicamente) */
  questions: QuizQuestion[];
  /** Total de preguntas generadas */
  total_questions: number;
  /** Timestamp ISO de cuándo se generó el quiz */
  generated_at: string;
  /** Proveedor LLM que generó el quiz */
  model_provider: string;
  /** Modelo específico usado */
  model_name: string;
}

// ──────────────────────────────────────────────────────────────
// Tipos de la API Response
// ──────────────────────────────────────────────────────────────

/** Response exitoso de POST /api/sessions/[id]/quiz */
export interface QuizResponse {
  /** Contenido del quiz generado */
  quiz: QuizContent;
  /** true si se retornó quiz previamente generado (cache) */
  cached: boolean;
  /** Resultado durable disponible al recargar una sesión ya evaluada */
  evaluation: EvaluateResponse | null;
  /** Adaptación durable asociada a una evaluación completada */
  adaptation: AdaptResponse | null;
}
