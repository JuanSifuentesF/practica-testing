// ============================================================
// lib/prompts/theory.ts — Prompt Builder para contenido teórico
// ============================================================
// Construye los prompts (system + user) para la generación de
// contenido teórico ISTQB adaptado al método de enseñanza.
//
// Tres métodos, tres estilos radicalmente diferentes:
//   - theory    → Definiciones formales, estándares, principios
//   - examples  → Casos reales, bugs famosos, escenarios prácticos
//   - analogies → Metáforas cotidianas, comparaciones simples
//
// REGLA: Los prompts SIEMPRE están en español porque el usuario
// estudia en español y el contenido se renderiza tal cual.
// ============================================================

import type { SessionTopic } from "@/types/sessions";
import type { MethodUsed } from "@/types";

// ──────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────

/** Número máximo de caracteres del texto del syllabus por tópico */
const MAX_SYLLABUS_TEXT_CHARS = 6000;

/** Descripciones del método para inyectar en el prompt */
const METHOD_DESCRIPTIONS: Record<MethodUsed, string> = {
  theory: `MÉTODO: TEORÍA FORMAL
- Usa el fragmento proporcionado del syllabus CTFL v4.0 como fuente primaria
- No inventes definiciones, reglas, cifras ni referencias normativas
- Menciona un estándar solo cuando aparezca en el fragmento proporcionado
- Explica principios fundamentales con rigor académico
- Usa lenguaje técnico apropiado, explicando cada término la primera vez
- Los key_concepts deben tener definiciones formales y completas
- Los examples deben ser breves y formales (1-2 por tópico)
- El tono es profesoral y preciso, como un libro de texto de ingeniería de software`,

  examples: `MÉTODO: EJEMPLOS PRÁCTICOS
- Usa casos REALES y conocidos del mundo del testing de software
- Incluye bugs famosos cuando sea relevante (Therac-25, Ariane 5, Knight Capital, etc.)
- Describe escenarios de proyectos reales donde el concepto aplica
- Los key_concepts deben incluir un ejemplo concreto junto a cada definición
- Genera 3-5 examples detallados por tópico con escenarios completos
- Incluye qué herramientas o técnicas se usarían en cada escenario
- El tono es práctico y orientado a la acción, como un mentor senior en una empresa de software`,

  analogies: `MÉTODO: ANALOGÍAS Y METÁFORAS
- Usa comparaciones con la vida cotidiana (cocinar, construir una casa, ir al médico, etc.)
- Cada concepto debe tener al menos UNA analogía memorable
- Los key_concepts deben comenzar con "Es como..." o una comparación directa
- Los examples pueden ser analogías extendidas (ej. "El testing es como un control de calidad en una fábrica de coches...")
- Conecta cada concepto abstracto con algo que el estudiante ya conoce
- Usa humor y creatividad cuando sea apropiado
- El tono es conversacional y accesible, como un amigo que te explica algo complejo`,
};

/** Instrucciones específicas de cantidad según el método */
const METHOD_QUANTITY_HINTS: Record<MethodUsed, string> = {
  theory: `- key_concepts: 4-7 conceptos con definiciones formales completas
- examples: 1-2 ejemplos breves y formales
- connections: 2-3 conexiones con otros tópicos`,

  examples: `- key_concepts: 3-5 conceptos, cada uno con un ejemplo práctico en el campo 'example'
- examples: 3-5 casos reales detallados con escenarios completos
- connections: 1-2 conexiones con otros tópicos`,

  analogies: `- key_concepts: 3-5 conceptos, cada uno explicado con una analogía en la definición
- examples: 2-4 analogías extendidas (escenarios comparativos)
- connections: 1-2 conexiones explicadas con analogías`,
};

// ──────────────────────────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────────────────────────

/**
 * Construye el system prompt para la generación de teoría.
 *
 * El system prompt define:
 *   1. Rol del asistente (profesor ISTQB)
 *   2. Método de enseñanza (theory/examples/analogies)
 *   3. Schema JSON exacto de la salida esperada
 *   4. Restricciones de formato y contenido
 *
 * @param method - Método de enseñanza: "theory", "examples", o "analogies"
 */
export function buildTheorySystemPrompt(method: MethodUsed): string {
  return `Eres un profesor experto en la certificación ISTQB Foundation Level (CTFL v4.0).
Tu tarea es generar contenido teórico educativo de alta calidad para una sesión de estudio.

Todo el contenido DEBE estar en **español**.

## ${METHOD_DESCRIPTIONS[method]}

## CANTIDADES ESPERADAS POR TÓPICO

${METHOD_QUANTITY_HINTS[method]}

## FORMATO DE SALIDA

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura EXACTA:

{
  "topics": [
    {
      "topic_code": "FL-x.x.x",
      "topic_name": "Nombre del tópico en español",
      "level_k": "K1" | "K2" | "K3",
      "introduction": "Introducción de 2-3 párrafos explicando el contexto y la importancia del tópico. Usa saltos de línea (\\n\\n) entre párrafos.",
      "key_concepts": [
        {
          "term": "Nombre del concepto",
          "definition": "Definición clara y completa",
          "example": "Ejemplo breve (opcional pero recomendado)"
        }
      ],
      "examples": [
        {
          "title": "Título del ejemplo",
          "description": "Descripción del escenario o caso",
          "lesson": "Lección o moraleja que se aprende"
        }
      ],
      "connections": [
        {
          "related_topic_code": "FL-x.x.x",
          "relationship": "Cómo se relaciona con el tópico actual"
        }
      ],
      "summary": "Resumen ejecutivo de 1-2 párrafos con los puntos clave a recordar."
    }
  ]
}

## RESTRICCIONES CRÍTICAS

1. **JSON puro**: NO incluyas texto antes ni después del JSON. NO uses bloques de código markdown.
2. **Español**: TODO el contenido debe estar en español. Los nombres de tópicos y conceptos se traducen.
3. **topic_code exacto**: Usa exactamente los topic_codes que se proporcionan. NO inventes códigos.
4. **Profundidad por nivel K**:
   - K1 (Recordar): Enfócate en definiciones y listas de términos
   - K2 (Entender): Explica el "por qué" y las diferencias entre conceptos
   - K3 (Aplicar): Incluye escenarios donde el estudiante debe tomar decisiones
5. **Longitud**: Cada introducción debe tener al menos 100 palabras para explicar adecuadamente el contexto y su importancia. Cada summary al menos 60 palabras. Las definiciones y ejemplos de conceptos clave deben ser detallados y pedagógicamente completos para asegurar un aprendizaje profundo de la materia.
6. **Calidad ISTQB**: El contenido debe ser correcto según el syllabus ISTQB CTFL v4.0.`;
}

// ──────────────────────────────────────────────────────────────
// User Prompt
// ──────────────────────────────────────────────────────────────

/**
 * Construye el user prompt con los datos específicos de la sesión.
 *
 * @param topics - Array de tópicos de la sesión con texto del syllabus
 * @param method - Método de enseñanza
 * @param dayNumber - Número de día en el plan
 * @param sessionType - Tipo de sesión (morning/night/reinforcement)
 * @param attemptNumber - Número de intento (1 = primer intento)
 */
export function buildTheoryUserPrompt(
  topics: SessionTopic[],
  method: MethodUsed,
  dayNumber: number,
  sessionType: string,
  attemptNumber: number,
): string {
  // ─── Construir la lista de tópicos con texto del syllabus ───
  const topicsList = topics
    .map((t) => {
      const syllabusPreview = t.syllabus_text
        ? t.syllabus_text.slice(0, MAX_SYLLABUS_TEXT_CHARS)
        : "(sin texto del syllabus disponible)";

      return `### ${t.code} — ${t.name} [${t.level_k}]
Estado del estudiante: ${t.progress_status} | Intentos previos: ${t.attempts} | Mejor score: ${t.best_score}%

Texto del syllabus:
${syllabusPreview}`;
    })
    .join("\n\n---\n\n");

  // ─── Contexto de refuerzo (si es un re-intento) ──────────
  const reinforcementContext =
    attemptNumber > 1
      ? `\n\n## ⚠️ CONTEXTO DE REFUERZO
Este es el intento #${attemptNumber} del estudiante. Los intentos previos no fueron suficientes.
- Explica los conceptos de forma MÁS DETALLADA que antes
- Usa ejemplos DIFERENTES a los que se habrían usado en intentos anteriores
- Enfatiza los aspectos que suelen causar confusión
- Si el método es "analogies", usa analogías DIFERENTES y más simples\n`
      : "";

  return `## CONTEXTO DE LA SESIÓN

- **Día del plan:** ${dayNumber}
- **Tipo de sesión:** ${sessionType}
- **Método de enseñanza:** ${method}
- **Número de intento:** ${attemptNumber}
- **Total de tópicos en esta sesión:** ${topics.length}
${reinforcementContext}
## TÓPICOS A EXPLICAR

${topicsList}

## INSTRUCCIÓN

Genera el contenido teórico para los ${topics.length} tópico(s) listados arriba usando el método "${method}".
Cada tópico debe tener: introduction, key_concepts, examples, connections, y summary.
Adapta la profundidad al nivel K de cada tópico.
Responde SOLO con el JSON.`;
}
