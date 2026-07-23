// ============================================================
// lib/prompts/evaluate.ts — Prompt Builder para evaluación
// ============================================================
// Construye los prompts (system + user) para que el LLM analice
// las respuestas del estudiante y genere feedback cualitativo.
//
// IMPORTANTE: El score numérico NO lo calcula el LLM.
// El LLM solo analiza patrones de error y genera feedback.
//
// ¿POR QUÉ USAR UN LLM PARA EVALUAR?
//   El score es determinístico (comparación directa), pero el
//   valor pedagógico está en el análisis:
//     - ¿Qué conceptos confunde el estudiante?
//     - ¿Hay un patrón en los errores?
//     - ¿Qué método de estudio funcionaría mejor?
//   Estas preguntas requieren comprensión de lenguaje natural.
// ============================================================

import type {
  AnswerOption,
  LevelK,
  MethodUsed,
  OptionsJson,
} from "@/types";

/** Contexto privado construido desde el snapshot; nunca viene del navegador. */
export interface EvaluationAnswerContext {
  question_id: number;
  user_answer: AnswerOption;
  question: string;
  options: OptionsJson;
  correct: AnswerOption;
  explanation: string;
  topic_code: string;
  topic_name: string;
  level_k: LevelK;
}

// ──────────────────────────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────────────────────────

/**
 * Construye el system prompt para la evaluación del quiz.
 *
 * Define el rol del LLM como evaluador pedagógico y especifica
 * el formato JSON exacto de la respuesta esperada.
 */
export function buildEvaluateSystemPrompt(): string {
  return `Eres un evaluador pedagógico experto en el ISTQB Foundation Level (CTFL v4.0).
Tu tarea es analizar las respuestas de un estudiante a un quiz de práctica y proporcionar retroalimentación educativa.

Todo el contenido DEBE estar en **español**.

## TU ROL

NO calculas el score — eso ya lo hace el servidor.
Tu trabajo es:
1. Identificar PATRONES de error (no listar cada error individual)
2. Determinar la ACCIÓN recomendada basada en el score que te proporcionan
3. Escribir un mensaje de FEEDBACK motivador y constructivo
4. Recomendar el MÉTODO de estudio más efectivo para el siguiente intento

## FORMATO DE SALIDA

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura EXACTA:

{
  "error_patterns": [
    {
      "pattern": "Descripción del patrón de error",
      "frequency": "alta",
      "suggestion": "Sugerencia específica para corregirlo"
    }
  ],
  "feedback_message": "Mensaje motivador y constructivo para el estudiante (2-4 oraciones)",
  "next_method": "theory",
  "reinforcement_minutes": 15
}

## REGLAS PARA error_patterns

1. Identifica entre 1 y 5 patrones de error (NO uno por pregunta fallada)
2. Agrupa errores similares en un solo patrón
3. "frequency" puede ser: "alta" (3+ errores del mismo tipo), "media" (2 errores), "baja" (1 error)
4. La "suggestion" debe ser accionable y específica — no genérica
5. Si el estudiante NO tuvo errores (score 100%), retorna un array vacío []

## REGLAS PARA feedback_message

1. SIEMPRE empezar con el resultado positivo (qué hizo bien)
2. Si score >= 70%: tono celebratorio, mencionar que avanza al siguiente tópico
3. Si score 50-69%: tono de apoyo, mencionar que con un refuerzo corto lo logrará
4. Si score < 50%: tono constructivo sin ser condescendiente, enfocarse en oportunidades de mejora
5. Máximo 4 oraciones. NO usar emojis.

## REGLAS PARA next_method

Recomendar basado en el método actual y los patrones de error:
- Si el método actual fue "theory" y falló → sugerir "examples" (casos prácticos pueden ayudar)
- Si el método actual fue "examples" y falló → sugerir "analogies" (diferentes perspectivas)
- Si el método actual fue "analogies" y falló → sugerir "theory" (volver a los fundamentos)
- Si aprobó (score >= 70%) → mantener el método actual

## REGLAS PARA reinforcement_minutes

- score >= 70% → 0 (no necesita refuerzo)
- score 50-69% → 15 (refuerzo ligero)
- score < 50% → 30 (refuerzo intensivo)

## RESTRICCIONES CRÍTICAS

1. **JSON puro**: NO incluyas texto antes ni después del JSON. NO uses bloques de código markdown.
2. **Español**: TODO el contenido debe estar en español.
3. **No inventar datos**: Solo analiza las respuestas que se te proporcionan.
4. **Consistencia con el score**: Tu feedback_message debe reflejar el score real.`;
}

// ──────────────────────────────────────────────────────────────
// User Prompt
// ──────────────────────────────────────────────────────────────

/**
 * Construye el user prompt con los datos específicos de la evaluación.
 *
 * @param answers - Array de respuestas del usuario con datos de las preguntas
 * @param score - Score calculado determinísticamente (0-100)
 * @param correctCount - Cantidad de respuestas correctas
 * @param totalQuestions - Total de preguntas
 * @param currentMethod - Método de enseñanza usado en esta sesión
 * @param attemptNumber - Número de intento (1 = primer intento)
 */
export function buildEvaluateUserPrompt(
  answers: EvaluationAnswerContext[],
  score: number,
  correctCount: number,
  totalQuestions: number,
  currentMethod: MethodUsed,
  attemptNumber: number,
): string {
  // ─── Construir resumen de respuestas ──────────────────────
  const answersDetail = answers
    .map((a, i) => {
      const isCorrect = a.user_answer === a.correct;
      const mark = isCorrect ? "✅ CORRECTA" : "❌ INCORRECTA";

      // Solo incluir detalle completo para las incorrectas
      // (las correctas no necesitan análisis)
      if (isCorrect) {
        return `${i + 1}. [${mark}] ${a.topic_code} (${a.level_k}) — Pregunta respondida correctamente`;
      }

      return `${i + 1}. [${mark}] ${a.topic_code} (${a.level_k})
   Pregunta: ${a.question.slice(0, 200)}...
   Respondió: "${a.user_answer}" — ${a.options[a.user_answer]}
   Correcta: "${a.correct}" — ${a.options[a.correct]}
   Explicación: ${a.explanation}`;
    })
    .join("\n\n");

  return `## RESULTADO DEL QUIZ

- **Score:** ${score}% (${correctCount} de ${totalQuestions} correctas)
- **Método de estudio actual:** ${currentMethod}
- **Número de intento:** ${attemptNumber}

## DETALLE DE RESPUESTAS

${answersDetail}

## INSTRUCCIÓN

Analiza las respuestas incorrectas, identifica patrones de error, y genera el JSON de feedback.
Si todas las respuestas son correctas, retorna un feedback celebratorio con error_patterns vacío.`;
}
