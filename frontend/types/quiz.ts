// ============================================================
// types/quiz.ts — Tipos para el quiz generado por IA
// ============================================================
// Estos tipos definen la estructura del JSON que el LLM retorna
// cuando genera preguntas de quiz estilo ISTQB.
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

import type { AnswerOption, OptionsJson, LevelK } from "./database";

// ──────────────────────────────────────────────────────────────
// Pregunta individual del quiz
// ──────────────────────────────────────────────────────────────

/**
 * Una pregunta de quiz generada por el LLM.
 *
 * El formato sigue el estilo del examen ISTQB Foundation Level:
 *   - Un "stem" (enunciado) que puede incluir un escenario (K3)
 *   - Exactamente 4 opciones (a, b, c, d)
 *   - Una sola respuesta correcta
 *   - Una explicación de por qué la respuesta es correcta
 *
 * La explicación NO se muestra durante el quiz (SE-05).
 * Solo se muestra en el FeedbackPanel (SE-08) después de la evaluación.
 */
export interface QuizQuestion {
  /** Identificador único dentro del quiz (0-indexed, generado por la API) */
  question_id: number;
  /** Enunciado de la pregunta (puede incluir un escenario para K3) */
  question: string;
  /** Las 4 opciones de respuesta: { a: "...", b: "...", c: "...", d: "..." } */
  options: OptionsJson;
  /** La respuesta correcta: "a", "b", "c", o "d" */
  correct: AnswerOption;
  /** Explicación de por qué la respuesta correcta es correcta */
  explanation: string;
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
 * Contiene las preguntas + metadatos de generación.
 * Este tipo se almacena temporalmente en el estado del cliente (SE-05)
 * y NO se persiste como `quiz_content` en la DB. En SE-06 se guardará
 * un snapshot de cada pregunta junto con la respuesta del usuario en `answers`.
 */
export interface QuizContent {
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
}
