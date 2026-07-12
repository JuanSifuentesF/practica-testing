// ============================================================
// types/practice.ts — Tipos TypeScript del QA Practice Lab
// ============================================================
// Estos tipos definen el contrato entre:
//   - Las tablas de PostgreSQL (practice_exercises, practice_submissions)
//   - Las API Routes (/api/practice/generate, /api/practice/evaluate)
//   - Los componentes UI (TestCaseEditor, BugReportLab, FeedbackPanel)
//
// Convención:
//   - Los tipos de DB (Row/Insert/Update) están en database.ts
//   - Los tipos de dominio (formas del JSONB, request/response) están aquí
//   - Los tipos aquí son MÁS ricos que los Row types porque
//     descomponen los campos JSONB en interfaces tipadas
// ============================================================

import type { LevelK } from "./database";

// ──────────────────────────────────────────────────────────────
// 1. UNION TYPES (Enums del Practice Lab)
// ──────────────────────────────────────────────────────────────

/**
 * Tipos de ejercicio práctico — coincide EXACTAMENTE con el
 * CHECK constraint practice_exercises_type_chk de PL-01.
 *
 * Cada tipo tiene su propia UI y criterios de evaluación:
 *   - test_cases:    tabla editable de casos de prueba (PL-07)
 *   - bug_report:    formulario de reporte de defecto (PL-11)
 *   - api_testing:   checklist de validaciones API (PL-12)
 *   - exploratory:   sesión guiada de testing exploratorio
 */
export type PracticeExerciseType =
  | "test_cases"
  | "bug_report"
  | "api_testing"
  | "exploratory";

/**
 * Severidad de un bug report — estándar de la industria QA.
 * Usado por BugReportData y el formulario de PL-11.
 */
export type BugSeverity = "critical" | "high" | "medium" | "low";

/**
 * Prioridad de corrección — estándar de la industria QA.
 * Independiente de la severidad (un bug critical puede ser
 * low priority si afecta a pocos usuarios).
 */
export type BugPriority = "urgent" | "high" | "medium" | "low";

/**
 * Tipo de caso de prueba — clasificación estándar.
 * Usado por TestCaseRow para categorizar cada test case.
 */
export type TestCaseType = "positive" | "negative" | "boundary";

// ──────────────────────────────────────────────────────────────
// 2. ESTRUCTURAS JSONB — Escenario y Solución del Ejercicio
// ──────────────────────────────────────────────────────────────

/**
 * Estructura del campo scenario_json en practice_exercises.
 * Generado por la IA (Gemini) y almacenado como JSONB.
 *
 * Ejemplo real:
 *   {
 *     scenario: "Una app de registro acepta edades entre 18 y 65.",
 *     task_description: "Define particiones válidas e inválidas.",
 *     constraints: ["Mínimo 5 test cases", "Incluir valores límite"],
 *     evaluation_criteria: ["Cobertura de particiones", "Valores límite"]
 *   }
 */
export interface ExerciseScenario {
  /** Descripción del sistema bajo prueba */
  scenario: string;
  /** Instrucciones específicas de lo que el usuario debe hacer */
  task_description: string;
  /** Restricciones o requerimientos adicionales */
  constraints: string[];
  /** Criterios que la IA usará para evaluar la respuesta */
  evaluation_criteria: string[];
}

export interface BugReportScenario extends ExerciseScenario {
  user_story: string;
  business_rule: string;
  observed_bug: string;
}

/**
 * Estructura del campo solution_json en practice_exercises.
 * Generado por la IA y mostrado DESPUÉS de la evaluación.
 * NULL si aún no se ha generado.
 */
export interface ExerciseSolution<TModelAnswer = Record<string, unknown>> {
  /** Artefacto modelo, con forma dependiente de exercise_type. */
  model_answer: TModelAnswer;
  /** Explicación paso a paso de la solución. */
  explanation: string;
  /** Puntos clave que el usuario debería haber identificado. */
  key_points: string[];
}

// ──────────────────────────────────────────────────────────────
// 3. TIPOS DE FILAS — Datos que escribe el usuario
// ──────────────────────────────────────────────────────────────

/**
 * Una fila en la tabla de test cases del TestCaseEditor (PL-07).
 * Representa un caso de prueba individual dentro de la submission.
 *
 * Ejemplo:
 *   { id: "TC-001", scenario: "Edad mínima válida",
 *     test_data: "18", expected_result: "Registro OK", type: "boundary" }
 */
export interface TestCaseRow {
  /** Identificador secuencial del test case (ej. "TC-001") */
  id: string;
  /** Descripción del escenario que se prueba */
  scenario: string;
  /** Dato de entrada para la prueba */
  test_data: string;
  /** Resultado esperado del sistema */
  expected_result: string;
  /** Clasificación del test case */
  type: TestCaseType;
}

/**
 * Forma de la solución modelo para ejercicios de diseño de test cases.
 * El LLM la genera en PL-04 y PL-05 la valida antes de persistirla.
 */
export interface TestCaseReferenceAnswer {
  test_cases: TestCaseRow[];
}

/**
 * Datos completos de un bug report (PL-11).
 * Estructura clásica de reporte de defecto en QA.
 */
export interface BugReportData {
  /** Título descriptivo del bug */
  title: string;
  /** Condiciones previas necesarias para reproducir */
  preconditions: string;
  /** Pasos de reproducción numerados */
  steps: string[];
  /** Lo que realmente ocurre (el bug) */
  actual_result: string;
  /** Lo que debería ocurrir (comportamiento correcto) */
  expected_result: string;
  /** Impacto del bug en el sistema */
  severity: BugSeverity;
  /** Urgencia de corrección */
  priority: BugPriority;
  /** Evidencia opcional (captura, URL, log) */
  evidence?: string;
}

export type BugReportReferenceAnswer = BugReportData;

/**
 * Un ítem individual en un checklist de API testing (PL-12).
 */
export interface ApiChecklistItem {
  /** Identificador del ítem (ej. "API-001") */
  id: string;
  /** Descripción de la validación a realizar */
  validation: string;
  /** ¿El usuario verificó este punto? */
  checked: boolean;
  /** Observaciones del usuario */
  notes: string;
}

// ──────────────────────────────────────────────────────────────
// 4. TIPOS DE SUBMISSION — Lo que el usuario envía
// ──────────────────────────────────────────────────────────────

/**
 * Contenido del submission_json según el tipo de ejercicio.
 * Cada tipo de ejercicio tiene una estructura de respuesta diferente.
 *
 * El tipo discriminado (tagged union) permite que TypeScript
 * infiera automáticamente la estructura correcta cuando
 * haces `if (submission.type === 'test_cases') { ... }`.
 */
export type SubmissionContent =
  | { type: "test_cases"; test_cases: TestCaseRow[] }
  | { type: "bug_report"; bug_report: BugReportData }
  | { type: "api_testing"; checklist: ApiChecklistItem[] }
  | { type: "exploratory"; notes: string; findings: string[] };

// ──────────────────────────────────────────────────────────────
// 5. TIPOS DE FEEDBACK — Lo que la IA devuelve
// ──────────────────────────────────────────────────────────────

/**
 * Resultado de evaluación de un criterio individual.
 * Parte del feedback_json de practice_submissions.
 */
export interface CriterionResult {
  /** Nombre del criterio evaluado */
  criterion: string;
  /** ¿Se cumplió el criterio? */
  passed: boolean;
  /** Detalle de la evaluación */
  detail: string;
}

/**
 * Estructura completa del campo feedback_json
 * en practice_submissions. Generado por la IA (PL-09).
 */
export interface PracticeFeedback {
  /** Resumen general del desempeño */
  feedback_summary: string;
  /** Evaluación detallada por criterio */
  criteria_results: CriterionResult[];
  /** Casos que el usuario no incluyó pero debería */
  missing_cases: string[];
  /** Lo que el usuario hizo bien */
  strengths: string[];
  /** Áreas de mejora específicas */
  improvements: string[];
}

// ──────────────────────────────────────────────────────────────
// 6. TIPOS COMPUESTOS — Ejercicio y Submission "enriquecidos"
// ──────────────────────────────────────────────────────────────

/**
 * Un ejercicio práctico con JSONB tipado.
 * Equivale a PracticeExerciseRow pero con scenario_json
 * y solution_json descompuestos en interfaces tipadas.
 *
 * Usado por los componentes UI para renderizar el ejercicio.
 */
export interface PracticeExercise {
  id: string;
  user_id: string;
  document_id: string;
  study_plan_id: string | null;
  topic_code: string;
  level_k: LevelK;
  exercise_type: PracticeExerciseType;
  attempt_number: number;
  scenario: ExerciseScenario;
  solution: ExerciseSolution | null;
  created_at: string;
}

export type BugReportExercise = Omit<
  PracticeExercise,
  "exercise_type" | "scenario"
> & {
  exercise_type: "bug_report";
  scenario: BugReportScenario;
};

/**
 * Una submission con JSONB tipado.
 * Equivale a PracticeSubmissionRow pero con submission_json
 * y feedback_json descompuestos en interfaces tipadas.
 *
 * Usado por el FeedbackPanel (PL-10) para mostrar resultados.
 */
export interface PracticeSubmission {
  id: string;
  user_id: string;
  exercise_id: string;
  content: SubmissionContent;
  score_percent: number | null;
  feedback: PracticeFeedback | null;
  submitted_at: string;
}

// ──────────────────────────────────────────────────────────────
// 7. TIPOS DE REQUEST/RESPONSE — Contrato con las API Routes
// ──────────────────────────────────────────────────────────────

/**
 * Request body para POST /api/practice/generate (PL-05).
 * El frontend envía esto para pedir un nuevo ejercicio.
 */
export interface PracticeGenerateRequest {
  /** ID del documento de donde se toman los tópicos */
  document_id: string;
  /** Código del tópico ISTQB (ej. "FL-4.2.1") */
  topic_code: string;
  /** Nivel cognitivo — determina la complejidad */
  level_k: LevelK;
  /** Tipo de ejercicio deseado */
  exercise_type: PracticeExerciseType;
  /** ID del plan de estudio activo (opcional) */
  study_plan_id?: string | null;
}

/**
 * Response body de POST /api/practice/generate (PL-05).
 * La API Route devuelve esto con el ejercicio generado.
 */
export interface PracticeGenerateResponse {
  /** El ejercicio completo con escenario tipado */
  exercise: PracticeExercise;
}

/**
 * Request body para POST /api/practice/evaluate (PL-09).
 * El frontend envía la respuesta del usuario para evaluación.
 */
export interface PracticeEvaluateRequest {
  /** ID del ejercicio que se está respondiendo */
  exercise_id: string;
  /** Contenido de la respuesta del usuario (tagged union) */
  submission: SubmissionContent;
}

/**
 * Response body de POST /api/practice/evaluate (PL-09).
 * La API Route devuelve esto con el score y feedback.
 */
export interface PracticeEvaluateResponse {
  /** La submission guardada con score y feedback */
  submission: PracticeSubmission;
  /** La solución de referencia del ejercicio (revelada después de evaluar) */
  solution: ExerciseSolution;
}

// ──────────────────────────────────────────────────────────────
// 8. TIPOS HELPER — Utilidades para la UI
// ──────────────────────────────────────────────────────────────

/**
 * Metadata de un tipo de ejercicio para el Hub de prácticas (PL-06).
 * Usado para renderizar las tarjetas de selección de tipo.
 */
export interface ExerciseTypeInfo {
  /** Tipo de ejercicio */
  type: PracticeExerciseType;
  /** Nombre para mostrar en la UI */
  label: string;
  /** Descripción corta del tipo */
  description: string;
  /** Emoji o ícono representativo */
  icon: string;
  /** Color de la tarjeta (Tailwind class) */
  colorClass: string;
}

/**
 * Resumen de práctica por tópico — para el Hub (PL-06).
 * Agrega información de múltiples ejercicios y submissions.
 */
export interface TopicPracticeSummary {
  /** Código del tópico ISTQB */
  topic_code: string;
  /** Nombre descriptivo del tópico */
  topic_name: string;
  /** Nivel K del tópico */
  level_k: LevelK;
  /** Total de ejercicios generados para este tópico */
  total_exercises: number;
  /** Total de submissions enviadas */
  total_submissions: number;
  /** Score promedio de todas las submissions evaluadas */
  average_score: number | null;
  /** Mejor score obtenido */
  best_score: number | null;
}
