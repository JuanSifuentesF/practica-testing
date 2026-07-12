// ============================================================
// lib/prompts/practice-exercise.ts — Prompt Builder para
// generación de ejercicios prácticos del QA Practice Lab
// ============================================================
//
// Construye los prompts (system + user) para generar ejercicios
// prácticos personalizados según el tópico ISTQB y su nivel K.
//
// DIFERENCIAS con los otros Prompt Builders:
//   - theory.ts  → Genera contenido de LECTURA
//   - quiz.ts    → Genera preguntas CERRADAS (4 opciones)
//   - Este       → Genera tareas ABIERTAS donde el usuario
//                   debe PRODUCIR artefactos de testing
//
// MAPEO NIVEL K → TIPO DE TAREA:
//   K1 → Quiz de conceptos y definiciones
//   K2 → Identificar errores en escenarios dados
//   K3 → Crear artefactos de testing desde cero
//
// VARIEDAD: El prompt usa attempt_number para instruir al LLM
// a generar escenarios DIFERENTES en cada invocación.
//
// REGLA: Los prompts están en ESPAÑOL porque el usuario estudia
// en español y el contenido se renderiza tal cual.
// ============================================================

import type { PracticeExerciseType } from "@/types/practice";
import type { LevelK } from "@/types";

// ──────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────

/** Número máximo de caracteres del texto del syllabus */
const MAX_SYLLABUS_TEXT_CHARS = 2000;

/**
 * Instrucciones específicas por tipo de ejercicio.
 * Cada tipo produce artefactos de testing diferentes.
 *
 * ¿Por qué un Record y no un switch?
 *   - TypeScript nos fuerza a cubrir TODOS los tipos
 *   - Si en el futuro agregas un 5to tipo, TypeScript marca error
 *   - Más legible que un switch con 4 cases largos
 */
const EXERCISE_TYPE_INSTRUCTIONS: Record<PracticeExerciseType, string> = {
  test_cases: `TIPO DE EJERCICIO: DISEÑO DE CASOS DE PRUEBA

El escenario debe describir un SISTEMA o FUNCIONALIDAD con:
- Reglas de negocio claras (rangos numéricos, estados válidos, transiciones)
- Suficiente detalle para aplicar técnicas de diseño de pruebas
- Al menos 2-3 variables o condiciones que interactúen

La tarea debe pedir al estudiante que DISEÑE CASOS DE PRUEBA usando
la técnica apropiada (Equivalence Partitioning, Boundary Value Analysis,
Decision Tables, State Transition, etc.).

Los constraints deben especificar:
- Número mínimo de test cases esperados
- Técnica(s) de diseño a aplicar
- Si debe incluir casos positivos Y negativos

La solución de referencia debe contener:
- Una tabla con: ID, escenario, dato de prueba, resultado esperado, tipo (positive/negative/boundary)
- Explicación de por qué se eligieron esos test cases
- Puntos clave que un tester profesional no debería olvidar

CONTRATO OBLIGATORIO DE LA SOLUCIÓN MODELO:
- Genera exactamente 6 objetos completos en reference_solution.model_answer.test_cases.
- Cada objeto DEBE incluir estas cinco claves técnicas exactas, sin traducirlas ni renombrarlas:
  "id", "scenario", "test_data", "expected_result", "type".
- Todos los valores de esas claves deben ser strings no vacíos.
- "type" solo puede ser "positive", "negative" o "boundary" en minúsculas.
- No uses alias en español como "tipo", "dato_prueba" o "resultado_esperado".
- Antes de responder, revisa cada una de las 6 filas contra este contrato.`,

  bug_report: `TIPO DE EJERCICIO: REPORTE DE DEFECTO

El escenario debe describir un SISTEMA CON UN BUG VISIBLE:
- Descripción del comportamiento esperado
- Descripción del comportamiento real (el bug)
- Contexto suficiente para que el estudiante pueda reportarlo

La tarea debe pedir al estudiante que ESCRIBA UN BUG REPORT
siguiendo el estándar de la industria QA.

Los constraints deben especificar:
- El bug report debe incluir: título, precondiciones, pasos de reproducción,
  resultado actual, resultado esperado, severidad, y prioridad
- Todos los pasos deben ser reproducibles

La solución de referencia debe contener:
- Un bug report completo de ejemplo
- Justificación de la severidad y prioridad asignadas
- Errores comunes al reportar bugs (títulos vagos, pasos incompletos)

CONTRATO OBLIGATORIO DE ESCENARIO Y SOLUCIÓN MODELO:
- El escenario DEBE incluir las claves JSON "user_story", "business_rule" y "observed_bug" como strings no vacíos.
- Son campos separados e independientes — no fundirlos en uno solo.
- La solución modelo DEBE incluir "evidence" como campo opcional con valor sugerido en el formato.
- Los cuatro campos base de ExerciseScenario (scenario, task_description, constraints, evaluation_criteria) permanecen intactos.`,

  api_testing: `TIPO DE EJERCICIO: TESTING DE API

El escenario debe describir un ENDPOINT DE API REST con:
- URL, método HTTP, parámetros/body esperados
- Reglas de validación (campos requeridos, formatos, rangos)
- Posibles respuestas (200, 400, 401, 404, 500)

La tarea debe pedir al estudiante que DISEÑE UN CHECKLIST
de validaciones para el endpoint.

Los constraints deben especificar:
- Categorías del checklist: validación de input, autenticación,
  códigos de respuesta, edge cases
- Número mínimo de validaciones esperadas

La solución de referencia debe contener:
- Un checklist completo con categorías
- Ejemplos de requests con datos válidos e inválidos
- Validaciones que un tester junior suele olvidar`,

  exploratory: `TIPO DE EJERCICIO: TESTING EXPLORATORIO

El escenario debe describir un SISTEMA o MÓDULO para explorar:
- Descripción general de la funcionalidad
- Restricciones del negocio que limitan el alcance
- Áreas de riesgo conocidas

La tarea debe pedir al estudiante que DISEÑE UNA SESIÓN
de testing exploratorio usando charters (SBTM).

Los constraints deben especificar:
- Duración de la sesión (ej. 30 min)
- Charter format: "Explore [target] with [resources] to discover [information]"
- Debe identificar heurísticas aplicables

La solución de referencia debe contener:
- 2-3 charters bien escritos
- Heurísticas y oráculos aplicables
- Áreas de riesgo que el estudiante debería priorizar`,
};

const BUG_REPORT_SCENARIO_FIELDS = `
    "user_story": "Como [rol], quiero [objetivo] para [beneficio]",
    "business_rule": "Regla de negocio concreta que debe cumplirse",
    "observed_bug": "Comportamiento real, visible y reproducible que incumple la regla",`;

const REFERENCE_SOLUTION_FORMATS: Record<PracticeExerciseType, string> = {
  test_cases: `"model_answer": {
      "test_cases": [
        {
          "id": "TC-001",
          "scenario": "Condición concreta que se valida",
          "test_data": "Datos de entrada específicos",
          "expected_result": "Resultado observable esperado",
          "type": "positive"
        }
      ]
    },`,
  bug_report: `"model_answer": {
      "title": "Título conciso del defecto",
      "preconditions": "Condiciones previas verificables",
      "steps": ["Paso 1", "Paso 2"],
      "actual_result": "Resultado actual observable",
      "expected_result": "Resultado esperado según la regla",
      "severity": "medium",
      "priority": "medium",
      "evidence": "captura-login-01 o URL de evidencia opcional"
    },`,
  api_testing: `"model_answer": {
      "checklist": [
        { "id": "API-001", "validation": "Validación concreta", "checked": true, "notes": "Justificación" }
      ]
    },`,
  exploratory: `"model_answer": {
      "notes": "Notas estructuradas de la sesión",
      "findings": ["Hallazgo o riesgo identificado"]
    },`,
};

/**
 * Descripciones de la tarea según el nivel K.
 * Complementan las instrucciones del tipo de ejercicio.
 *
 * K1 → El foco está en reconocer e identificar
 * K2 → El foco está en analizar y encontrar errores
 * K3 → El foco está en crear artefactos desde cero
 */
const LEVEL_K_TASK_DESCRIPTIONS: Record<LevelK, string> = {
  K1: `NIVEL K1 (RECORDAR):
- El ejercicio debe enfocarse en IDENTIFICAR y RECONOCER conceptos
- El escenario puede listar opciones y pedir clasificación
- La tarea es más guiada: el estudiante reconoce qué técnica se aplica
- La dificultad es BAJA: conceptos fundamentales, no aplicación compleja
- Ejemplo: "De los siguientes escenarios, ¿cuál requiere Boundary Value Analysis?"`,

  K2: `NIVEL K2 (ENTENDER):
- El ejercicio debe enfocarse en ANALIZAR e IDENTIFICAR ERRORES
- El escenario presenta un artefacto con errores intencionales
- La tarea es encontrar los errores y EXPLICAR por qué están mal
- La dificultad es MEDIA: requiere comprensión profunda del concepto
- Ejemplo: "Este plan de pruebas tiene 3 errores. Identifícalos y justifica."`,

  K3: `NIVEL K3 (APLICAR):
- El ejercicio debe requerir CREAR artefactos de testing DESDE CERO
- El escenario describe un sistema real con reglas de negocio
- La tarea es PRODUCIR una solución completa (test cases, bug report, etc.)
- La dificultad es ALTA: requiere aplicar técnicas en un contexto nuevo
- Ejemplo: "Diseña los test cases para el siguiente formulario de registro."`,
};

// ──────────────────────────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────────────────────────

/**
 * Construye el system prompt para la generación de ejercicios prácticos.
 *
 * El system prompt define:
 *   1. Rol del asistente (instructor de laboratorio de QA)
 *   2. Instrucciones específicas según el exercise_type
 *   3. Schema JSON exacto de la salida esperada
 *   4. Restricciones de formato y contenido
 *
 * @param exerciseType - Tipo de ejercicio a generar
 */
export function buildPracticeSystemPrompt(
  exerciseType: PracticeExerciseType,
): string {
  return `Eres un instructor experto en QA y testing de software, certificado ISTQB Foundation Level (CTFL v4.0).
Tu tarea es generar un EJERCICIO PRÁCTICO para un laboratorio de testing.

Todo el contenido DEBE estar en **español**.

## TU ROL

No eres un profesor que explica teoría — eres un INSTRUCTOR DE LABORATORIO.
Diseñas ejercicios donde el estudiante debe PRODUCIR artefactos de testing:
- Tablas de test cases
- Bug reports profesionales
- Checklists de validación de API
- Sesiones de testing exploratorio

Cada ejercicio debe ser REALISTA y basado en un ESCENARIO CONCRETO.

## ${EXERCISE_TYPE_INSTRUCTIONS[exerciseType]}

## FORMATO DE SALIDA

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura EXACTA:

{
  "scenario": {
    "scenario": "Descripción detallada del sistema bajo prueba (2-4 párrafos). Incluye reglas de negocio, restricciones y contexto suficiente.",
    ${exerciseType === "bug_report" ? BUG_REPORT_SCENARIO_FIELDS : ""}
    "task_description": "Instrucciones claras de lo que el estudiante debe hacer. Empieza con un verbo de acción.",
    "constraints": ["Restricción o requisito 1", "Restricción o requisito 2", "Restricción o requisito 3"],
    "evaluation_criteria": ["Criterio de evaluación 1", "Criterio de evaluación 2", "Criterio de evaluación 3"]
  },
  "reference_solution": {
    ${REFERENCE_SOLUTION_FORMATS[exerciseType]}
    "explanation": "Explicación paso a paso de cómo se llegó a la solución. ¿Por qué estos test cases? ¿Por qué esa severidad?",
    "key_points": ["Punto clave 1 que el estudiante no debería olvidar", "Punto clave 2", "Punto clave 3"]
  }
}

## RESTRICCIONES CRÍTICAS

1. **JSON puro**: NO incluyas texto antes ni después del JSON. NO uses bloques de código markdown.
2. **Español**: TODO el contenido debe estar en español.
3. **Escenario realista**: El escenario debe ser de un sistema de software REAL, no abstracto.
   Ejemplos buenos: "Una app de e-commerce", "Un cajero automático", "Un formulario de registro médico".
   Ejemplos malos: "Un sistema genérico", "Un programa", "Una aplicación".
4. **Complejidad apropiada**: El escenario debe tener suficiente detalle para generar al menos 5-8 test cases o equivalente.
5. **Solución completa**: reference_solution debe ser lo suficientemente detallada para servir como RÚBRICA de evaluación.
6. **evaluation_criteria medibles**: Cada criterio debe ser verificable (ej: "Incluye al menos 3 valores límite" en vez de "Buenos test cases").
7. **constraints accionables**: Cada constraint debe ser específico (ej: "Mínimo 6 test cases" en vez de "Suficientes test cases").`;
}

// ──────────────────────────────────────────────────────────────
// User Prompt
// ──────────────────────────────────────────────────────────────

/**
 * Parámetros de entrada para construir el user prompt.
 *
 * ¿Por qué un objeto en vez de parámetros posicionales?
 *   - Más legible en el call site
 *   - No importa el orden de los campos
 *   - Fácil de extender sin romper call sites existentes
 */
export interface PracticePromptInput {
  /** Código del tópico ISTQB (ej. "FL-4.2.1") */
  topicCode: string;
  /** Nombre descriptivo del tópico */
  topicName: string;
  /** Nivel cognitivo del tópico */
  levelK: LevelK;
  /** Texto del syllabus para este tópico (puede ser largo) */
  syllabusText: string;
  /** Tipo de ejercicio a generar */
  exerciseType: PracticeExerciseType;
  /** Número de intento (1 = primero). Indica al LLM que varíe el escenario. */
  attemptNumber: number;
}

/**
 * Construye el user prompt con los datos específicos del ejercicio.
 *
 * @param input - Datos del tópico, nivel K y configuración del ejercicio
 */
export function buildPracticeUserPrompt(input: PracticePromptInput): string {
  const {
    topicCode,
    topicName,
    levelK,
    syllabusText,
    exerciseType,
    attemptNumber,
  } = input;

  // ─── Truncar texto del syllabus para no exceder el contexto ──
  const syllabusPreview = syllabusText
    ? syllabusText.slice(0, MAX_SYLLABUS_TEXT_CHARS)
    : "(sin texto del syllabus disponible)";

  // ─── Instrucciones de nivel K ────────────────────────────────
  const levelKInstructions = LEVEL_K_TASK_DESCRIPTIONS[levelK];

  // ─── Contexto de variedad (cuando attempt > 1) ──────────────
  // Esto instruye al LLM a generar un escenario DIFERENTE
  // al que generó en intentos anteriores.
  const varietyContext =
    attemptNumber > 1
      ? `\n\n## ⚠️ VARIEDAD OBLIGATORIA
Este es el intento #${attemptNumber} del estudiante para este mismo tópico y tipo de ejercicio.
DEBES generar un escenario COMPLETAMENTE DIFERENTE a los anteriores:
- Usa un DOMINIO diferente (si antes fue e-commerce, ahora usa salud, banca, educación, etc.)
- Cambia las reglas de negocio y restricciones
- Varía la complejidad dentro del nivel K
- NO repitas el mismo tipo de sistema bajo prueba
- Si es K3, cambia la técnica principal que se evalúa\n`
      : "";

  return `## TÓPICO DEL EJERCICIO

- **Código:** ${topicCode}
- **Nombre:** ${topicName}
- **Nivel K:** ${levelK}
- **Tipo de ejercicio:** ${exerciseType}
- **Intento número:** ${attemptNumber}

## NIVEL COGNITIVO

${levelKInstructions}

## TEXTO DEL SYLLABUS ISTQB

${syllabusPreview}
${varietyContext}
## INSTRUCCIÓN

Genera UN ejercicio práctico de tipo "${exerciseType}" para el tópico "${topicCode}" (${topicName}) a nivel ${levelK}.
El escenario debe ser realista, específico, y con suficiente detalle para que el estudiante produzca una solución completa.
La solución de referencia debe servir como rúbrica de evaluación.
Responde SOLO con el JSON.`;
}
