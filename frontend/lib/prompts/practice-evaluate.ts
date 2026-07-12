// ============================================================
// lib/prompts/practice-evaluate.ts — Prompt Builder para
// evaluación de ejercicios prácticos del QA Practice Lab
// ============================================================
//
// Construye los prompts (system + user) para que el LLM evalúe
// la respuesta del usuario a un ejercicio práctico y genere
// feedback estructurado siguiendo PracticeFeedback (PL-03).
//
// DIFERENCIAS con practice-exercise.ts (PL-04):
//   - PL-04 genera contenido NUEVO (escenarios + soluciones)
//   - PL-08 ANALIZA y COMPARA respuestas existentes
//   - PL-08 usa temperatura más baja (0.3 vs 0.8) para
//     consistencia en la evaluación
//
// DIFERENCIAS con evaluate.ts (SE-06):
//   - SE-06 evalúa quizzes (respuestas múltiples cerradas)
//   - PL-08 evalúa ejercicios prácticos (respuestas ABIERTAS)
//   - PL-08 evalúa contra una solución de referencia + criterios
//   - PL-08 genera PracticeFeedback (5 campos), no error_patterns
//
// PATRÓN:
//   Funciones puras — reciben datos, retornan strings.
//   Sin estado, sin efectos secundarios, sin imports de React.
//   Testeables unitariamente con datos mock.
//
// REGLA: Los prompts están en ESPAÑOL porque el usuario estudia
// en español y el contenido se renderiza tal cual.
// ============================================================

import type {
  ExerciseScenario,
  ExerciseSolution,
  SubmissionContent,
  PracticeExerciseType,
} from "@/types/practice";
import type { LevelK } from "@/types";

// ──────────────────────────────────────────────────────────────
// Constantes exportadas
// ──────────────────────────────────────────────────────────────

/**
 * Temperatura recomendada para evaluación.
 * BAJA (0.3) → evaluaciones más consistentes y predecibles.
 *
 * Comparación:
 *   - PL-04 (generación) usa 0.8 → creatividad en escenarios
 *   - SE-06 (quiz eval)   no exporta → dejada al route handler
 *   - PL-08 (practice eval) usa 0.3 → consistencia en juicio
 *
 * ¿Por qué exportar esto como constante?
 *   Para que PL-09 no tenga que "inventar" la temperatura.
 *   El Prompt Builder conoce mejor que nadie qué temperatura
 *   necesita su prompt para funcionar correctamente.
 */
export const EVALUATE_TEMPERATURE = 0.3;

/**
 * Modelo recomendado para evaluación.
 * Exportado para que PL-09 tenga un fallback si no hay preferencia.
 */
export const EVALUATE_MODEL = "gemini-2.5-flash";

/**
 * Máximo de caracteres para el contenido del usuario en el prompt.
 * Si la submission es muy larga (ej. muchos test cases o un bug report
 * extenso), truncamos para no exceder el contexto del LLM.
 *
 * 8000 chars es suficiente para ~20 test cases o un bug report completo.
 */
const MAX_USER_CONTENT_CHARS = 8000;

// ──────────────────────────────────────────────────────────────
// Instrucciones de evaluación por tipo de ejercicio
// ──────────────────────────────────────────────────────────────

/**
 * Criterios de evaluación específicos por tipo de ejercicio.
 * El evaluador necesita saber QUÉ buscar en cada tipo diferente.
 *
 * ¿Por qué un Record y no un switch?
 *   Mismo patrón que EXERCISE_TYPE_INSTRUCTIONS en PL-04:
 *   TypeScript nos fuerza a cubrir TODOS los tipos.
 */
const EVALUATION_CRITERIA_BY_TYPE: Record<PracticeExerciseType, string> = {
  test_cases: `## CRITERIOS ESPECÍFICOS PARA TEST CASES

Al evaluar test cases, presta atención especial a:

1. **Cobertura de particiones**: ¿El estudiante identificó TODAS las particiones
   de equivalencia del escenario? ¿Cubrió particiones válidas E inválidas?

2. **Valores límite**: ¿Incluyó los valores en los BORDES de cada partición?
   (ej. si el rango válido es 18-65, ¿tiene tests para 17, 18, 65, 66?)

3. **Mix positivo/negativo**: ¿Tiene tanto test cases positivos (resultado OK)
   como negativos (resultado de error)? Una tabla solo con positivos es incompleta.

4. **Claridad de datos**: ¿Los datos de prueba son CONCRETOS (ej. "edad = 17")
   en vez de vagos (ej. "edad inválida")?

5. **Resultados esperados precisos**: ¿Los resultados esperados son específicos
   (ej. "Error: edad mínima es 18") en vez de genéricos (ej. "Falla")?

6. **IDs descriptivos**: ¿Los escenarios de test case son claros y autoexplicativos?`,

  bug_report: `## CRITERIOS ESPECÍFICOS PARA BUG REPORTS

Al evaluar bug reports, presta atención especial a:

1. **Título claro y descriptivo**: ¿El título describe QUÉ falla, DÓNDE, y CUÁNDO?
   Malo: "Error en login". Bueno: "Error 500 al hacer login con email con caracteres especiales".

2. **Pasos reproducibles**: ¿Cada paso es atómico y secuencial? ¿Un tester
   podría seguirlos sin conocimiento previo del sistema?

3. **Precondiciones completas**: ¿Están listadas TODAS las precondiciones
   necesarias para reproducir el bug?

4. **Resultado actual vs esperado**: ¿Distingue claramente lo que OCURRIÓ
   de lo que DEBERÍA haber ocurrido?

5. **Severidad justificada**: ¿La severidad asignada es coherente con el
   impacto del bug? (ej. un crash no puede ser "low")

6. **Prioridad coherente**: ¿La prioridad considera el impacto en usuarios
   y la frecuencia de uso de la funcionalidad?`,

  api_testing: `## CRITERIOS ESPECÍFICOS PARA API TESTING

Al evaluar checklists de API testing, presta atención especial a:

1. **Cobertura de status codes**: ¿Incluye validaciones para 200, 400, 401,
   404, 500 según corresponda al endpoint?

2. **Validación de input**: ¿Prueba campos requeridos faltantes, formatos
   inválidos, valores fuera de rango, y tipos incorrectos?

3. **Autenticación/autorización**: ¿Incluye pruebas sin token, con token
   inválido, y con token de otro usuario?

4. **Edge cases**: ¿Considera strings vacíos, valores nulos, arrays vacíos,
   números negativos, y caracteres especiales?

5. **Formato de respuesta**: ¿Valida que la estructura del JSON de respuesta
   cumple con el contrato esperado?

6. **Idempotencia**: ¿Verifica que llamadas repetidas producen el resultado esperado?`,

  exploratory: `## CRITERIOS ESPECÍFICOS PARA TESTING EXPLORATORIO

Al evaluar sesiones de testing exploratorio, presta atención especial a:

1. **Charters bien escritos**: ¿Siguen el formato "Explore [target] with
   [resources] to discover [information]"?

2. **Cobertura de riesgos**: ¿Los charters cubren las áreas de riesgo
   identificadas en el escenario?

3. **Heurísticas aplicables**: ¿El estudiante identificó heurísticas relevantes
   (ej. SFDIPOT, FEW HICCUPS, CRUD)?

4. **Oráculos de prueba**: ¿Definió cómo determinar si algo es un bug
   (comparación con spec, sistema similar, sentido común)?

5. **Notas de sesión**: ¿Las notas son suficientemente detalladas para
   que otro tester pueda continuar el trabajo?

6. **Hallazgos accionables**: ¿Los findings son específicos y reproducibles?`,
};

// ──────────────────────────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────────────────────────

/**
 * Construye el system prompt para la evaluación de ejercicios
 * prácticos del QA Practice Lab.
 *
 * El system prompt define:
 *   1. Rol del asistente (evaluador pedagógico de ISTQB)
 *   2. Formato JSON exacto de la salida esperada
 *   3. Reglas de comportamiento (objetividad, consistencia)
 *   4. Criterios específicos según el tipo de ejercicio
 *
 * NOTA: Este prompt es más restrictivo que el de PL-04 porque
 * la evaluación requiere consistencia entre diferentes intentos.
 * La creatividad es indeseable aquí.
 *
 * @param exerciseType - Tipo de ejercicio (determina criterios específicos)
 */
export function buildPracticeEvaluateSystemPrompt(
  exerciseType: PracticeExerciseType,
): string {
  return `Eres un evaluador pedagógico experto en ISTQB Foundation Level (CTFL v4.0).
Tu tarea es evaluar la respuesta de un estudiante a un EJERCICIO PRÁCTICO de testing.

Todo el contenido DEBE estar en **español**.

## TU ROL

Eres un INSTRUCTOR DE LABORATORIO que revisa el trabajo de un aprendiz.
NO eres un profesor que da respuestas — eres un EVALUADOR que:

1. Compara la respuesta del estudiante contra la solución de referencia
2. Evalúa CADA criterio de evaluación definido en el ejercicio
3. Identifica qué casos de prueba o elementos importantes faltan
4. Destaca lo que el estudiante hizo bien (SIEMPRE empieza por lo positivo)
5. Señala áreas específicas de mejora con sugerencias concretas

Debes ser OBJETIVO y CONSISTENTE. Dos respuestas similares deben
recibir evaluaciones similares, independientemente del intento.

## FORMATO DE SALIDA

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura EXACTA:

{
  "feedback_summary": "Resumen general del desempeño en 2-3 oraciones. Menciona el tipo de ejercicio, qué tan bien cubrió los criterios, y el veredicto general. Empieza con lo positivo.",
  "criteria_results": [
    {
      "criterion": "Texto EXACTO del criterio evaluado (copiado de evaluation_criteria)",
      "passed": true,
      "detail": "Explicación de por qué pasó o falló este criterio. Menciona elementos específicos de la respuesta del estudiante como evidencia."
    }
  ],
  "missing_cases": [
    "Caso de prueba o elemento importante que el estudiante NO incluyó pero DEBERÍA haber incluido. Sé MUY específico: menciona qué dato concreto, qué escenario, qué valor límite falta."
  ],
  "strengths": [
    "Fortaleza específica mostrada por el estudiante. Ej: 'Correcta identificación de valores límite para la partición de edad (incluyó 17, 18, 65, 66).'"
  ],
  "improvements": [
    "Área de mejora específica con sugerencia accionable. Ej: 'Agregar test cases negativos para valores no numéricos (letras, símbolos, strings vacíos).'"
  ]
}

## REGLAS PARA criteria_results

1. Debe haber EXACTAMENTE UN CriterionResult por cada criterio en evaluation_criteria.
   NO inventes criterios adicionales ni omitas ninguno.
2. El campo "criterion" debe contener el TEXTO EXACTO del criterio de evaluación.
3. "passed" es booleano: true si el criterio se cumplió suficientemente, false si no.
4. "detail" debe ser específico y citar evidencia de la respuesta del estudiante.
   Malo: "No cumple el criterio". Bueno: "Solo incluyó 3 test cases positivos,
   sin ningún caso negativo o de valor límite."
5. Si la respuesta cumple parcialmente un criterio (ej. 4 de 6 test cases),
   marca passed = false pero reconoce lo parcial en detail.

## REGLAS PARA missing_cases

1. Lista entre 0 y 8 casos faltantes (no más).
2. Compara con la solución de referencia para identificar qué falta.
3. Sé ESPECÍFICO: "Falta test case para edad = 0 (límite inferior absoluto)"
   en vez de "Faltan valores límite".
4. Si la respuesta es muy completa (cubrió casi todo), retorna un array vacío [].
5. NO repitas lo que ya dijiste en criteria_results.

## REGLAS PARA strengths

1. SIEMPRE incluye al menos 1 fortaleza, incluso si la respuesta es parcial.
   Encuentra algo positivo: buena estructura, un caso correcto, claridad, etc.
2. Máximo 5 fortalezas.
3. Sé específico: cita elementos concretos de la respuesta.

## REGLAS PARA improvements

1. Lista entre 1 y 5 áreas de mejora.
2. Cada mejora debe ser ACCIONABLE: el estudiante debe saber QUÉ hacer diferente.
   Malo: "Mejorar los test cases". Bueno: "Agregar test cases con datos no numéricos
   (letras, símbolos) para validar que el sistema rechaza entradas inválidas."
3. Si la respuesta es perfecta, incluye una mejora de tipo "nivel avanzado"
   (ej. "Para ir más allá, podrías documentar la prioridad de cada test case").

## REGLAS PARA feedback_summary

1. SIEMPRE empezar con lo positivo (qué hizo bien el estudiante).
2. Mencionar el tipo de ejercicio (test cases, bug report, etc.).
3. Dar un veredicto general claro (bueno, necesita mejora, incompleto).
4. Máximo 3 oraciones. NO usar emojis.
5. Tono constructivo y motivador — como un instructor que quiere que el
   aprendiz mejore, no que se desanime.

${EVALUATION_CRITERIA_BY_TYPE[exerciseType]}

## RESTRICCIONES CRÍTICAS

1. **JSON puro**: NO incluyas texto antes ni después del JSON. NO uses bloques de código markdown.
2. **Español**: TODO el contenido debe estar en español.
3. **No inventar datos**: Solo evalúa lo que el estudiante envió. No inventes elementos que no están en su respuesta.
4. **Objetividad**: Evalúa contra los criterios y la solución de referencia, no contra tu opinión.
5. **Consistencia**: Dos respuestas con la misma calidad deben recibir evaluaciones equivalentes.
6. **Constructividad**: Incluso respuestas muy pobres deben recibir al menos 1 fortaleza y sugerencias concretas de mejora.`;
}

// ──────────────────────────────────────────────────────────────
// User Prompt
// ──────────────────────────────────────────────────────────────

/**
 * Parámetros de entrada para construir el user prompt de evaluación.
 *
 * ¿Por qué un objeto en vez de parámetros posicionales?
 *   - Mismo patrón que PracticePromptInput en PL-04
 *   - Más legible en el call site (PL-09)
 *   - No importa el orden de los campos
 *   - Fácil de extender sin romper call sites existentes
 */
export interface PracticeEvaluateInput {
  /** Escenario original del ejercicio (generado por PL-04/PL-05) */
  scenario: ExerciseScenario;
  /** Solución de referencia (generada por PL-04/PL-05, almacenada en DB) */
  solution: ExerciseSolution;
  /** Respuesta del usuario (tagged union — PL-03) */
  userSubmission: SubmissionContent;
  /** Tipo de ejercicio (para contexto adicional) */
  exerciseType: PracticeExerciseType;
  /** Código del tópico ISTQB (ej. "FL-4.2.1") */
  topicCode: string;
  /** Nivel cognitivo del tópico */
  levelK: LevelK;
}

/**
 * Serializa el contenido de la submission del usuario a un string
 * legible para el LLM, según el tipo de ejercicio.
 *
 * Cada tipo de SubmissionContent tiene una estructura diferente
 * (tagged union discriminada por `type`), así que necesitamos
 * un serializer específico para cada uno.
 *
 * @param submission - Contenido de la submission (tagged union)
 * @returns String formateado para el LLM
 */
function serializeUserSubmission(submission: SubmissionContent): string {
  switch (submission.type) {
    case "test_cases": {
      if (submission.test_cases.length === 0) {
        return "(El estudiante no envió ningún test case)";
      }
      // Formatear como tabla legible
      const header =
        "| ID | Escenario | Dato de Prueba | Resultado Esperado | Tipo |";
      const separator = "|---|---|---|---|---|";
      const rows = submission.test_cases.map(
        (tc) =>
          `| ${tc.id} | ${tc.scenario} | ${tc.test_data} | ${tc.expected_result} | ${tc.type} |`,
      );
      return `### Test Cases del Estudiante (${submission.test_cases.length} filas)\n\n${header}\n${separator}\n${rows.join("\n")}`;
    }

    case "bug_report": {
      const br = submission.bug_report;
      return `### Bug Report del Estudiante

**Título:** ${br.title}
**Precondiciones:** ${br.preconditions}
**Pasos de reproducción:**
${br.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}
**Resultado actual:** ${br.actual_result}
**Resultado esperado:** ${br.expected_result}
**Severidad:** ${br.severity}
**Prioridad:** ${br.priority}
**Evidencia:** ${br.evidence ?? "(no proporcionada)"}`;
    }

    case "api_testing": {
      if (submission.checklist.length === 0) {
        return "(El estudiante no envió ningún ítem de checklist)";
      }
      const items = submission.checklist.map(
        (item) =>
          `- [${item.checked ? "x" : " "}] ${item.id}: ${item.validation}${item.notes ? ` (Notas: ${item.notes})` : ""}`,
      );
      return `### Checklist de API Testing del Estudiante (${submission.checklist.length} ítems)\n\n${items.join("\n")}`;
    }

    case "exploratory": {
      return `### Sesión de Testing Exploratorio del Estudiante

**Notas de la sesión:**
${submission.notes}

**Hallazgos (${submission.findings.length}):**
${submission.findings.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}`;
    }

    default: {
      // Fallback defensivo — si llega un tipo desconocido,
      // serializamos como JSON genérico.
      return `### Respuesta del Estudiante (formato desconocido)\n\n${JSON.stringify(submission, null, 2)}`;
    }
  }
}

/**
 * Serializa la solución de referencia a un string legible para el LLM.
 *
 * @param solution - Solución de referencia (generada por PL-04/PL-05)
 * @returns String formateado para el LLM
 */
function serializeReferenceSolution(solution: ExerciseSolution): string {
  const modelAnswer =
    typeof solution.model_answer === "object"
      ? JSON.stringify(solution.model_answer, null, 2)
      : String(solution.model_answer);

  const keyPointsList = solution.key_points
    .map((kp, i) => `  ${i + 1}. ${kp}`)
    .join("\n");

  return `### Respuesta Modelo

${modelAnswer}

### Explicación de la Solución

${solution.explanation}

### Puntos Clave

${keyPointsList}`;
}

/**
 * Construye el user prompt con los datos específicos de la evaluación.
 *
 * Ensambla 5 secciones de información que el LLM necesita:
 *   1. Metadata del ejercicio (tópico, tipo, nivel K)
 *   2. Escenario original (sistema bajo prueba + tarea)
 *   3. Solución de referencia (modelo a comparar)
 *   4. Respuesta del usuario (lo que envió)
 *   5. Criterios de evaluación (la rúbrica)
 *
 * @param input - Datos del ejercicio y la submission
 */
export function buildPracticeEvaluateUserPrompt(
  input: PracticeEvaluateInput,
): string {
  const {
    scenario,
    solution,
    userSubmission,
    exerciseType,
    topicCode,
    levelK,
  } = input;

  // ─── Serializar contenido del usuario ────────────────────
  let userContent = serializeUserSubmission(userSubmission);

  // ─── Truncar si es muy largo ─────────────────────────────
  // Esto previene exceder el contexto del LLM cuando el usuario
  // envía muchos test cases o un bug report muy extenso.
  if (userContent.length > MAX_USER_CONTENT_CHARS) {
    userContent =
      userContent.slice(0, MAX_USER_CONTENT_CHARS) +
      "\n\n... (contenido truncado por longitud)";
  }

  // ─── Serializar solución de referencia ───────────────────
  const solutionContent = serializeReferenceSolution(solution);

  // ─── Construir lista de criterios ────────────────────────
  const criteriaList = scenario.evaluation_criteria
    .map((c, i) => `  ${i + 1}. ${c}`)
    .join("\n");

  return `## METADATA DEL EJERCICIO

- **Tópico:** ${topicCode}
- **Nivel K:** ${levelK}
- **Tipo de ejercicio:** ${exerciseType}

## ESCENARIO ORIGINAL

${scenario.scenario}

**Tarea asignada:** ${scenario.task_description}

**Restricciones del ejercicio:**
${scenario.constraints.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}

## SOLUCIÓN DE REFERENCIA (respuesta modelo perfecta)

${solutionContent}

## RESPUESTA DEL ESTUDIANTE (lo que debes evaluar)

${userContent}

## CRITERIOS DE EVALUACIÓN (tu rúbrica)

Debes evaluar CADA uno de estos criterios y generar un CriterionResult por cada uno:

${criteriaList}

## INSTRUCCIÓN

Evalúa la respuesta del estudiante comparándola con la solución de referencia.
Para CADA criterio de evaluación, genera un CriterionResult con:
- "criterion": el texto exacto del criterio
- "passed": true/false
- "detail": explicación con evidencia específica de la respuesta del estudiante

Luego identifica los casos faltantes, las fortalezas, y las áreas de mejora.
Responde SOLO con el JSON.`;
}
