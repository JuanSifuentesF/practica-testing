// ============================================================
// lib/prompts/quiz.ts — Prompt Builder para generación de quiz
// ============================================================
// Construye los prompts (system + user) para la generación de
// preguntas de quiz estilo ISTQB Foundation Level.
//
// FORMATO DEL EXAMEN ISTQB:
//   - 40 preguntas en el examen real (nosotros generamos 10-12)
//   - 4 opciones (A/B/C/D), una sola correcta
//   - K1: recordar definiciones y listas
//   - K2: entender y distinguir conceptos
//   - K3: aplicar conocimientos en escenarios
//
// REGLA: Los prompts están en ESPAÑOL porque el usuario
// estudia en español y las preguntas se renderizan tal cual.
// ============================================================

import type { SessionTopic } from "@/types/sessions";
import type { LevelK } from "@/types";

// ──────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────

/** Número máximo de caracteres del texto del syllabus por tópico */
const MAX_SYLLABUS_TEXT_CHARS = 1500;

/** Instrucciones por nivel K */
const LEVEL_K_INSTRUCTIONS: Record<LevelK, string> = {
  K1: `PREGUNTAS K1 (Recordar):
- Preguntar por definiciones exactas del ISTQB Glossary
- "¿Cuál de las siguientes es la definición correcta de...?"
- "¿Cuál de los siguientes términos describe...?"
- Los distractores deben ser definiciones de OTROS términos del ISTQB que suenan similares
- NO preguntar por escenarios de aplicación — eso es K3`,

  K2: `PREGUNTAS K2 (Entender):
- Preguntar por la diferencia entre dos conceptos relacionados
- "¿Cuál es la diferencia PRINCIPAL entre X e Y?"
- "¿Por qué es importante hacer X antes que Y?"
- "¿Cuál de las siguientes afirmaciones sobre X es CORRECTA?"
- Los distractores deben ser afirmaciones que confunden dos conceptos o invierten causa-efecto
- Los distractores NO deben ser obviamente falsos`,

  K3: `PREGUNTAS K3 (Aplicar):
- SIEMPRE incluir un escenario de 2-4 oraciones antes de la pregunta
- "Dado el siguiente escenario: [escenario]. ¿Qué técnica de testing es más apropiada?"
- "Un equipo está probando [descripción]. ¿Cuáles son los valores de frontera correctos?"
- El escenario debe ser realista y específico (no genérico)
- Los distractores deben ser técnicas o valores que un estudiante mal preparado elegiría`,
};

/**
 * Distribuye 10-12 preguntas totales entre los tópicos de la sesión.
 *
 * Ejemplos:
 *   - 1 tópico  → 10 preguntas
 *   - 3 tópicos → 4 + 3 + 3 = 10 preguntas
 *   - 5 tópicos → 2 por tópico = 10 preguntas
 *   - 7 tópicos → algunos con 2 y otros con 1 = 12 preguntas
 */
function calculateQuestionDistribution(
  topics: SessionTopic[],
  questionsPerTopic?: number,
): Map<string, number> {
  if (questionsPerTopic) {
    return new Map(topics.map((topic) => [topic.code, questionsPerTopic]));
  }

  const totalTopics = Math.max(1, topics.length);
  const targetTotal = Math.min(12, Math.max(10, totalTopics * 2));
  const baseCount = Math.floor(targetTotal / totalTopics);
  const remainder = targetTotal % totalTopics;

  return new Map(
    topics.map((topic, index) => [
      topic.code,
      baseCount + (index < remainder ? 1 : 0),
    ]),
  );
}

// ──────────────────────────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────────────────────────

/**
 * Construye el system prompt para la generación de quiz.
 *
 * El system prompt define:
 *   1. Rol del asistente (examinador ISTQB)
 *   2. Reglas estrictas del formato de preguntas
 *   3. Schema JSON exacto de la salida esperada
 *   4. Instrucciones para crear distractores plausibles
 */
export function buildQuizSystemPrompt(): string {
  return `Eres un examinador certificado del ISTQB Foundation Level (CTFL v4.0).
Tu tarea es generar preguntas de examen de práctica de alta calidad.

Todo el contenido DEBE estar en **español**.

## FORMATO DEL EXAMEN ISTQB

Cada pregunta tiene:
- Un **stem** (enunciado): claro, preciso, sin ambigüedades
- Exactamente **4 opciones** (a, b, c, d): solo UNA es correcta
- Una **explicación**: por qué la correcta es correcta Y por qué las demás están mal

## REGLAS PARA CREAR PREGUNTAS DE CALIDAD

1. **Una sola respuesta correcta**: NUNCA debe haber ambigüedad. Si un experto ISTQB leyera la pregunta, debería marcar la misma respuesta sin dudar.

2. **Distractores plausibles**: Los distractores (opciones incorrectas) deben ser:
   - Términos REALES del ISTQB, pero aplicados en el contexto equivocado
   - Afirmaciones que son "casi correctas" pero tienen un detalle mal
   - Respuestas que un estudiante que NO estudió bien elegiría
   - NUNCA opciones absurdas o que no tengan relación con el tema

3. **Variación de la respuesta correcta**: La respuesta correcta DEBE variar entre a, b, c, y d.
   - NO pongas la correcta siempre en "c" ni en la misma posición
   - Distribución ideal: ~25% en cada opción

4. **Longitud de opciones**: Las 4 opciones deben tener longitud SIMILAR.
   - Si la correcta es larga, haz los distractores también largos
   - Evita que la correcta sea notoriamente más detallada que las demás

5. **Sin pistas gramaticales**: El stem no debe dar pistas sobre la respuesta.
   - No uses "un/una" que solo concuerde con una opción
   - No uses "siempre" o "nunca" en los distractores (red flag de examen)

## FORMATO DE SALIDA

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura EXACTA:

{
  "questions": [
    {
      "question": "Texto del enunciado de la pregunta",
      "options": {
        "a": "Primera opción",
        "b": "Segunda opción",
        "c": "Tercera opción",
        "d": "Cuarta opción"
      },
      "correct": "b",
      "explanation": "Explicación concisa de por qué la opción correcta es válida según el syllabus ISTQB y la clave del concepto.",
      "topic_code": "FL-1.1.1",
      "level_k": "K2"
    }
  ]
}

## RESTRICCIONES CRÍTICAS

1. **JSON puro**: NO incluyas texto antes ni después del JSON. NO uses bloques de código markdown.
2. **Español**: TODO el contenido debe estar en español.
3. **topic_code exacto**: Usa ÚNICAMENTE los topic_codes que se proporcionan. NO inventes códigos.
4. **level_k exacto**: Cada pregunta debe tener el level_k correcto del tópico al que pertenece.
5. **correct válido**: SOLO los valores "a", "b", "c", o "d" son válidos para el campo correct.
6. **4 opciones exactas**: Cada pregunta DEBE tener exactamente 4 opciones: a, b, c, y d.
7. **Explicación concisa**: La explicación debe ser directa y concisa (máximo 40 palabras) justificando por qué la opción correcta es válida según el syllabus ISTQB.`;
}

// ──────────────────────────────────────────────────────────────
// User Prompt
// ──────────────────────────────────────────────────────────────

/**
 * Construye el user prompt con los datos específicos de la sesión.
 *
 * @param topics - Array de tópicos de la sesión con texto del syllabus
 * @param dayNumber - Número de día en el plan
 * @param sessionType - Tipo de sesión (morning/night/reinforcement)
 * @param attemptNumber - Número de intento (1 = primer intento)
 * @param questionsPerTopic - Cantidad de preguntas por tópico (default varía por cantidad de tópicos)
 */
export function buildQuizUserPrompt(
  topics: SessionTopic[],
  dayNumber: number,
  sessionType: string,
  attemptNumber: number,
  questionsPerTopic?: number,
): string {
  // ─── Calcular distribución de preguntas ────────────────────
  // Objetivo: generar 10-12 preguntas totales, no 10-12 por tópico.
  // Esto evita que una sesión con 5 tópicos genere 15+ preguntas.
  const totalTopics = topics.length;
  const questionDistribution = calculateQuestionDistribution(
    topics,
    questionsPerTopic,
  );
  const totalQuestions = Array.from(questionDistribution.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  // ─── Construir la lista de tópicos ────────────────────────
  const topicsList = topics
    .map((t) => {
      const questionCount = questionDistribution.get(t.code) || 1;
      const syllabusPreview = t.syllabus_text
        ? t.syllabus_text.slice(0, MAX_SYLLABUS_TEXT_CHARS)
        : "(sin texto del syllabus disponible)";

      // Instrucciones específicas del nivel K
      const kInstructions = LEVEL_K_INSTRUCTIONS[t.level_k as LevelK] || "";

      return `### ${t.code} — ${t.name} [${t.level_k}]
Generar **${questionCount} pregunta${questionCount > 1 ? "s" : ""}** para este tópico.

${kInstructions}

Estado del estudiante: ${t.progress_status} | Intentos previos: ${t.attempts} | Mejor score: ${t.best_score}%

Texto del syllabus:
${syllabusPreview}`;
    })
    .join("\n\n---\n\n");

  // ─── Contexto de refuerzo (si es un re-intento) ──────────
  const reinforcementContext =
    attemptNumber > 1
      ? `\n\n## ⚠️ CONTEXTO DE REFUERZO
Este es el intento #${attemptNumber} del estudiante en estos tópicos.
- Genera preguntas DIFERENTES a las que se habrían generado antes
- Enfócate en los aspectos que suelen causar más confusión
- Aumenta ligeramente la dificultad de los distractores
- Para K3, usa escenarios DIFERENTES a los anteriores\n`
      : "";

  return `## CONTEXTO DE LA SESIÓN

- **Día del plan:** ${dayNumber}
- **Tipo de sesión:** ${sessionType}
- **Número de intento:** ${attemptNumber}
- **Total de tópicos:** ${totalTopics}
- **Total de preguntas esperadas:** ${totalQuestions}
${reinforcementContext}
## TÓPICOS PARA EL QUIZ

${topicsList}

## INSTRUCCIÓN

Genera exactamente **${totalQuestions} preguntas** siguiendo la cantidad indicada en cada tópico.
Asegúrate de que la respuesta correcta varíe entre a, b, c y d.
Responde SOLO con el JSON.`;
}
