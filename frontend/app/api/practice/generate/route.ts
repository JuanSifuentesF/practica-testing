// ─────────────────────────────────────────────────────────────────
// app/api/practice/generate/route.ts
// Route Handler: genera un ejercicio práctico para un tópico ISTQB.
//
// Método: POST
// Auth: Requiere sesión válida (cookie JWT de Supabase)
// Body:
//   {
//     document_id: string,     // UUID del documento con topics_json
//     topic_code: string,      // Ej. "FL-4.2.1"
//     level_k: "K1" | "K2" | "K3",
//     exercise_type: "test_cases" | "bug_report" | "api_testing" | "exploratory",
//     study_plan_id?: string   // UUID opcional del plan activo
//   }
//
// Response (200): PracticeGenerateResponse { exercise: PracticeExercise }
// Response (400): { error: "Descripción del problema" }
// Response (401): { error: "No autenticado" }
// Response (404): { error: "Documento o tópico no encontrado" }
// Response (500): { error: "Error interno del servidor" }
// Response (502): { error: "Error en la generación del ejercicio" }
// Response (504): { error: "Timeout del LLM" }
//
// SEGURIDAD:
//   - Valida sesión con supabase.auth.getUser()
//   - Verifica ownership de document_id (user_id === auth.uid)
//   - GEMINI_API_KEY nunca se expone al cliente ni a logs
//   - RLS en practice_exercises garantiza aislamiento
//
// PATRÓN: Sigue la misma estructura que SE-02 (theory/route.ts):
//   Multi-provider LLM → Parser defensivo → Validación → Persistencia
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { executeAiJson } from "@/lib/ai/execute-json";
import { createClient } from "@/lib/supabase/server";
import {
  buildPracticeSystemPrompt,
  buildPracticeUserPrompt,
} from "@/lib/prompts/practice-exercise";
import type {
  PracticeExerciseType,
  ExerciseScenario,
  ExerciseSolution,
  TestCaseType,
} from "@/types/practice";
import {
  isBugReportReferenceAnswer,
  isBugReportScenario,
} from "@/lib/practice/bug-report-contract";
import { parseFirstJsonObject } from "@/lib/ai/json-object";
import { buildPracticeResponseFormat } from "@/lib/ai/practice-response-format";
import type {
  LevelK,
  TopicsJson,
  DocumentRow,
  PracticeExerciseInsert,
} from "@/types";

// ─── Forzar Node.js runtime ─────────────────────────────────────
// Edge Runtime no soporta el SDK de OpenAI ni operaciones de
// Supabase que dependen de cookies de Node.js.
export const runtime = "nodejs";

// ─── Constantes ──────────────────────────────────────────────────

/** Regex para validar UUIDs */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tipos de ejercicio válidos — espejo del CHECK constraint de PL-01 */
const VALID_EXERCISE_TYPES: readonly PracticeExerciseType[] = [
  "test_cases",
  "bug_report",
  "api_testing",
  "exploratory",
] as const;

/** Niveles K válidos — espejo del CHECK constraint de DB-02 */
const VALID_LEVEL_K: readonly LevelK[] = ["K1", "K2", "K3"] as const;

const VALID_TEST_CASE_TYPES: readonly TestCaseType[] = [
  "positive",
  "negative",
  "boundary",
] as const;

/**
 * Timeout para generación de ejercicios.
 * Los ejercicios prácticos generan ~2-4K tokens de output
 * (escenario + solución de referencia), similar a la teoría.
 */
const PRACTICE_TIMEOUT_MS = 90_000; // 90 segundos
const MAX_PRACTICE_COMPLETION_TOKENS = 6_000;

// ──────────────────────────────────────────────────────────────
// Parser defensivo del response del LLM
// ──────────────────────────────────────────────────────────────

/**
 * Estructura cruda del JSON que retorna el LLM.
 * Corresponde al schema especificado en el system prompt de PL-04.
 */
interface LlmPracticeResponse {
  scenario: ExerciseScenario;
  reference_solution: ExerciseSolution;
}

/**
 * Extrae y parsea el JSON del response del LLM.
 *
 * Los LLMs a veces retornan el JSON envuelto en:
 *   - Texto introductorio ("Aquí tienes el ejercicio:")
 *   - Bloques de código markdown (```json ... ```)
 *   - Texto final ("Espero que sea útil")
 *
 * Esta función maneja todos esos casos, siguiendo el mismo
 * patrón defensivo de parseTheoryResponse() en SE-02.
 *
 * @param rawText - Texto crudo del LLM
 * @returns Objeto parseado o null si el JSON es inválido
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNonEmptyString)
  );
}

function validateTestCaseRow(value: unknown, index: number): string[] {
  const rowLabel = `Fila ${index + 1} de model_answer.test_cases`;

  if (!isRecord(value)) {
    return [`${rowLabel} debe ser un objeto.`];
  }

  const errors: string[] = [];
  const requiredStringFields = [
    "id",
    "scenario",
    "test_data",
    "expected_result",
  ] as const;

  for (const field of requiredStringFields) {
    if (typeof value[field] !== "string" || value[field].trim().length === 0) {
      errors.push(`${rowLabel} requiere '${field}' como string no vacío.`);
    }
  }

  if (
    typeof value.type !== "string" ||
    !VALID_TEST_CASE_TYPES.includes(value.type as TestCaseType)
  ) {
    errors.push(
      `${rowLabel} requiere 'type' con positive, negative o boundary.`,
    );
  }

  return errors;
}

function validateTestCaseReferenceAnswer(modelAnswer: unknown): string[] {
  if (!isRecord(modelAnswer) || !Array.isArray(modelAnswer.test_cases)) {
    return ["model_answer.test_cases debe ser un array."];
  }

  if (modelAnswer.test_cases.length !== 6) {
    return ["model_answer.test_cases debe contener exactamente 6 filas."];
  }

  return modelAnswer.test_cases.flatMap((row, index) =>
    validateTestCaseRow(row, index),
  );
}

function isApiChecklistReferenceAnswer(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.checklist)) return false;

  return (
    value.checklist.length > 0 &&
    value.checklist.every(
      (item) =>
        isRecord(item) &&
        isNonEmptyString(item.id) &&
        isNonEmptyString(item.validation) &&
        typeof item.checked === "boolean" &&
        isNonEmptyString(item.notes),
    )
  );
}

function isExploratoryReferenceAnswer(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.notes) &&
    isNonEmptyStringArray(value.findings)
  );
}

function readScenario(
  value: unknown,
  exerciseType: PracticeExerciseType,
): ExerciseScenario | null {
  if (
    !isRecord(value) ||
    typeof value.scenario !== "string" ||
    value.scenario.trim().length < 50 ||
    typeof value.task_description !== "string" ||
    value.task_description.trim().length < 20 ||
    !isNonEmptyStringArray(value.constraints) ||
    !isNonEmptyStringArray(value.evaluation_criteria)
  ) {
    return null;
  }

  const base: ExerciseScenario = {
    scenario: value.scenario,
    task_description: value.task_description,
    constraints: value.constraints,
    evaluation_criteria: value.evaluation_criteria,
  };

  if (exerciseType !== "bug_report") return base;

  const bugScenario = {
    ...base,
    user_story: value.user_story,
    business_rule: value.business_rule,
    observed_bug: value.observed_bug,
  };

  return isBugReportScenario(bugScenario) ? bugScenario : null;
}

function readSolution(
  value: unknown,
  exerciseType: PracticeExerciseType,
): ExerciseSolution | null {
  if (
    !isRecord(value) ||
    !isRecord(value.model_answer) ||
    typeof value.explanation !== "string" ||
    value.explanation.trim().length < 30 ||
    !isNonEmptyStringArray(value.key_points)
  ) {
    return null;
  }

  if (
    exerciseType === "test_cases" &&
    validateTestCaseReferenceAnswer(value.model_answer).length > 0
  ) {
    return null;
  }

  if (
    exerciseType === "bug_report" &&
    (!isBugReportReferenceAnswer(value.model_answer) ||
      !isNonEmptyString(value.model_answer.evidence))
  ) {
    return null;
  }

  if (
    exerciseType === "api_testing" &&
    !isApiChecklistReferenceAnswer(value.model_answer)
  ) {
    return null;
  }

  if (
    exerciseType === "exploratory" &&
    !isExploratoryReferenceAnswer(value.model_answer)
  ) {
    return null;
  }

  return {
    model_answer: value.model_answer,
    explanation: value.explanation,
    key_points: value.key_points,
  };
}

function parsePracticeResponse(
  rawText: string,
  exerciseType: PracticeExerciseType,
): LlmPracticeResponse | null {
  const value = parseFirstJsonObject(rawText);
  if (!value) return null;

  const scenario = readScenario(value.scenario, exerciseType);
  const referenceSolution = readSolution(
    value.reference_solution,
    exerciseType,
  );

  return scenario && referenceSolution
    ? { scenario, reference_solution: referenceSolution }
    : null;
}

function scenarioToJson(scenario: ExerciseScenario): Record<string, unknown> {
  const base = {
    scenario: scenario.scenario,
    task_description: scenario.task_description,
    constraints: scenario.constraints,
    evaluation_criteria: scenario.evaluation_criteria,
  };

  return isBugReportScenario(scenario)
    ? {
        ...base,
        user_story: scenario.user_story,
        business_rule: scenario.business_rule,
        observed_bug: scenario.observed_bug,
      }
    : base;
}

function solutionToJson(solution: ExerciseSolution): Record<string, unknown> {
  return {
    model_answer: solution.model_answer,
    explanation: solution.explanation,
    key_points: solution.key_points,
  };
}

function createDemoPracticeRaw(
  exerciseType: PracticeExerciseType,
  topicCode: string,
): string {
  const baseScenario: ExerciseScenario = {
    scenario:
      "[MODO DEMO] Una plataforma de estudio permite guardar un progreso y debe rechazar entradas incompatibles sin perder datos previamente válidos.",
    task_description:
      "Diseña una evidencia de prueba clara para el comportamiento descrito.",
    constraints: [
      "Usar datos concretos.",
      "Incluir al menos un caso negativo.",
    ],
    evaluation_criteria: [
      "La respuesta cubre el flujo principal.",
      "La respuesta incluye validación de error.",
    ],
  };

  const scenario =
    exerciseType === "bug_report"
      ? {
          ...baseScenario,
          user_story:
            "Como estudiante quiero guardar mi avance para continuar después.",
          business_rule:
            "El progreso válido no puede perderse si una entrada nueva falla.",
          observed_bug:
            "Al enviar un valor inválido se elimina el progreso anterior.",
        }
      : baseScenario;

  let modelAnswer: Record<string, unknown>;
  switch (exerciseType) {
    case "test_cases":
      modelAnswer = {
        test_cases: Array.from({ length: 6 }, (_, index) => ({
          id: "DEMO-TC-" + String(index + 1).padStart(3, "0"),
          scenario:
            index % 2 === 0
              ? "Guardar un valor válido"
              : "Rechazar un valor inválido",
          test_data: index % 2 === 0 ? "progreso=50" : "progreso=-1",
          expected_result:
            index % 2 === 0
              ? "El progreso queda almacenado."
              : "Se muestra error y se conserva el progreso previo.",
          type:
            index % 3 === 0
              ? "boundary"
              : index % 2 === 0
                ? "positive"
                : "negative",
        })),
      };
      break;
    case "bug_report":
      modelAnswer = {
        title: "Se elimina el progreso previo al enviar un valor inválido",
        preconditions: "Existe un progreso válido guardado.",
        steps: [
          "Abrir la configuración de progreso.",
          "Enviar un valor fuera del rango permitido.",
          "Recargar la vista.",
        ],
        actual_result: "El progreso anterior desaparece.",
        expected_result:
          "Se rechaza el valor y se conserva el progreso anterior.",
        severity: "high",
        priority: "high",
        evidence: "Fixture textual de modo Demo.",
      };
      break;
    case "api_testing":
      modelAnswer = {
        checklist: [
          {
            id: "DEMO-API-001",
            validation: "Respuesta exitosa con input válido",
            checked: true,
            notes: "Esperar contrato JSON documentado.",
          },
          {
            id: "DEMO-API-002",
            validation: "Rechazo con input fuera de rango",
            checked: true,
            notes: "Esperar 400 sin mutación parcial.",
          },
        ],
      };
      break;
    case "exploratory":
      modelAnswer = {
        notes:
          "Explorar persistencia, recuperación y mensajes de error del progreso.",
        findings: [
          "El valor válido se conserva después de recargar.",
          "El valor inválido se rechaza sin mutar el estado previo.",
        ],
      };
      break;
  }

  return JSON.stringify({
    scenario,
    reference_solution: {
      model_answer: modelAnswer,
      explanation:
        "[MODO DEMO] La solución demuestra el shape esperado y no reemplaza una evaluación pedagógica real.",
      key_points: [
        "Definir precondición.",
        "Usar datos concretos.",
        "Comparar actual contra esperado.",
        "Tópico " + topicCode,
      ],
    },
  });
}

// ──────────────────────────────────────────────────────────────
// Route Handler: POST
// ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ═══════════════════════════════════════════════════════════
    // PASO 1: Parsear y validar el request body
    // ═══════════════════════════════════════════════════════════

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "El body de la petición debe ser JSON válido." },
        { status: 400 },
      );
    }

    const { document_id, topic_code, level_k, exercise_type, study_plan_id } =
      body as {
        document_id: unknown;
        topic_code: unknown;
        level_k: unknown;
        exercise_type: unknown;
        study_plan_id: unknown;
      };

    // ─── Validar document_id ────────────────────────────────
    if (
      !document_id ||
      typeof document_id !== "string" ||
      !UUID_REGEX.test(document_id)
    ) {
      return NextResponse.json(
        { error: "document_id debe ser un UUID válido." },
        { status: 400 },
      );
    }

    // ─── Validar topic_code ─────────────────────────────────
    if (
      !topic_code ||
      typeof topic_code !== "string" ||
      topic_code.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "topic_code es requerido (ej. 'FL-4.2.1')." },
        { status: 400 },
      );
    }

    // ─── Validar level_k ────────────────────────────────────
    if (
      !level_k ||
      typeof level_k !== "string" ||
      !VALID_LEVEL_K.includes(level_k as LevelK)
    ) {
      return NextResponse.json(
        { error: `level_k debe ser uno de: ${VALID_LEVEL_K.join(", ")}.` },
        { status: 400 },
      );
    }

    // ─── Validar exercise_type ──────────────────────────────
    if (
      !exercise_type ||
      typeof exercise_type !== "string" ||
      !VALID_EXERCISE_TYPES.includes(exercise_type as PracticeExerciseType)
    ) {
      return NextResponse.json(
        {
          error: `exercise_type debe ser uno de: ${VALID_EXERCISE_TYPES.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    // ─── Validar study_plan_id (opcional) ────────────────────
    if (
      study_plan_id !== undefined &&
      study_plan_id !== null &&
      (typeof study_plan_id !== "string" || !UUID_REGEX.test(study_plan_id))
    ) {
      return NextResponse.json(
        { error: "study_plan_id, si se proporciona, debe ser un UUID válido." },
        { status: 400 },
      );
    }

    // Castear a tipos seguros después de validar
    const validatedDocumentId = document_id as string;
    const validatedTopicCode = (topic_code as string).trim();
    const validatedLevelK = level_k as LevelK;
    const validatedExerciseType = exercise_type as PracticeExerciseType;
    const validatedStudyPlanId = (study_plan_id as string | null) ?? null;

    // ═══════════════════════════════════════════════════════════
    // PASO 2: Autenticación
    // ═══════════════════════════════════════════════════════════
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para generar ejercicios." },
        { status: 401 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 3: Verificar ownership del documento + obtener tópico
    // ═══════════════════════════════════════════════════════════
    // Combinamos ownership check + extracción de topics_json en
    // una sola query. El filtro user_id = auth.uid (via RLS)
    // garantiza que solo el dueño accede al documento.

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, topics_json")
      .eq("id", validatedDocumentId)
      .eq("user_id", user.id)
      .maybeSingle<Pick<DocumentRow, "id" | "topics_json">>();

    if (docError) {
      console.error("[practice/generate] Error al buscar documento:", docError);
      return NextResponse.json(
        { error: "Error al verificar el documento." },
        { status: 500 },
      );
    }

    if (!doc) {
      return NextResponse.json(
        {
          error:
            "Documento no encontrado. Verifica que el document_id es correcto " +
            "y que pertenece a tu cuenta.",
        },
        { status: 404 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 4: Extraer texto del tópico desde topics_json
    // ═══════════════════════════════════════════════════════════
    const topicsJson: TopicsJson = doc.topics_json || {};
    const topicData = topicsJson[validatedTopicCode];

    if (!topicData) {
      // El topic_code no existe en el documento — posible typo del frontend
      const availableCodes = Object.keys(topicsJson).slice(0, 10).join(", ");
      return NextResponse.json(
        {
          error:
            `El tópico "${validatedTopicCode}" no existe en el documento. ` +
            `Tópicos disponibles (primeros 10): ${availableCodes || "(ninguno)"}`,
        },
        { status: 404 },
      );
    }

    if (topicData.level_k !== validatedLevelK) {
      return NextResponse.json(
        {
          error:
            `level_k="${validatedLevelK}" contradice el nivel autoritativo ` +
            `del tópico ${validatedTopicCode} (${topicData.level_k}).`,
        },
        { status: 400 },
      );
    }

    const syllabusText = topicData.text || "";
    const topicName = topicData.name || validatedTopicCode;

    // ═══════════════════════════════════════════════════════════
    // PASO 5: Calcular attempt_number
    // ═══════════════════════════════════════════════════════════
    // Contamos cuántos ejercicios previos tiene el usuario para
    // este mismo tópico + tipo de ejercicio + documento.
    // Esto permite que el prompt de PL-04 genere escenarios variados.

    const { count: previousAttempts, error: countError } = await supabase
      .from("practice_exercises")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("document_id", validatedDocumentId)
      .eq("topic_code", validatedTopicCode)
      .eq("exercise_type", validatedExerciseType);

    if (countError) {
      console.error(
        "[practice/generate] Error al contar intentos previos:",
        countError,
      );
      // No es crítico — podemos continuar con attempt_number = 1
    }

    const attemptNumber = (previousAttempts ?? 0) + 1;

    // ═══════════════════════════════════════════════════════════
    // PASO 6: Construir prompts con el builder de PL-04
    // ═══════════════════════════════════════════════════════════
    const systemPrompt = buildPracticeSystemPrompt(validatedExerciseType);
    const userPrompt = buildPracticeUserPrompt({
      topicCode: validatedTopicCode,
      topicName,
      levelK: validatedLevelK,
      syllabusText,
      exerciseType: validatedExerciseType,
      attemptNumber,
    });

    // ═══════════════════════════════════════════════════════════
    // PASOS 7 y 8: Generar, parsear y validar con runtime IA
    // ═══════════════════════════════════════════════════════════
    console.log(
      `[practice/generate] Generando ejercicio para ${validatedTopicCode} ` +
        `(${validatedExerciseType}, ${validatedLevelK}, intento #${attemptNumber})`,
    );

    const ai = await executeAiJson<LlmPracticeResponse>({
      request,
      userId: user.id,
      feature: "practice_generate",
      systemPrompt,
      userPrompts: [userPrompt],
      maxCompletionTokensPerAttempt: MAX_PRACTICE_COMPLETION_TOKENS,
      timeoutMs: PRACTICE_TIMEOUT_MS,
      parse: (rawText) =>
        parsePracticeResponse(rawText, validatedExerciseType),
      createDemoRaw: () =>
        createDemoPracticeRaw(validatedExerciseType, validatedTopicCode),
      tuning: (provider) => ({
        response_format: buildPracticeResponseFormat(validatedExerciseType),
        ...(provider === "gemini"
          ? { reasoning_effort: "low" as const }
          : { temperature: 0.3 }),
      }),
    });

    if (!ai.ok) {
      return NextResponse.json(ai.body, { status: ai.status });
    }

    const parsed = ai.value;

    // ═══════════════════════════════════════════════════════════
    // PASO 9: Persistir en Supabase
    // ═══════════════════════════════════════════════════════════
    // Construimos el INSERT usando PracticeExerciseInsert de PL-03.
    // RLS garantiza que solo el dueño puede insertar ejercicios
    // con su user_id (policy de PL-02).

    const insertData: PracticeExerciseInsert = {
      user_id: user.id,
      document_id: validatedDocumentId,
      study_plan_id: validatedStudyPlanId,
      topic_code: validatedTopicCode,
      level_k: validatedLevelK,
      exercise_type: validatedExerciseType,
      attempt_number: attemptNumber,
      scenario_json: scenarioToJson(parsed.scenario),
      solution_json: solutionToJson(parsed.reference_solution),
    };

    const { data: insertedExercise, error: insertError } = await supabase
      .from("practice_exercises")
      .insert(insertData)
      .select(
        "id, user_id, document_id, study_plan_id, topic_code, level_k, exercise_type, attempt_number, scenario_json, created_at",
      )
      .single();

    if (insertError) {
      console.error(
        "[practice/generate] Error al insertar ejercicio:",
        insertError,
      );

      // Distinguir errores de constraint
      if (insertError.code === "23503") {
        // Foreign key violation
        return NextResponse.json(
          {
            error:
              "Error de referencia: verifica que document_id y study_plan_id " +
              "son válidos y pertenecen a tu cuenta.",
          },
          { status: 400 },
        );
      }

      if (insertError.code === "23514") {
        // Check constraint violation
        return NextResponse.json(
          {
            error:
              "Error de validación en la base de datos. " +
              "Verifica que exercise_type y level_k son valores válidos.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error:
            "El ejercicio fue generado, pero no se pudo guardar. " +
            "Intenta de nuevo.",
        },
        { status: 500 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 10: Construir y retornar PracticeGenerateResponse
    // ═══════════════════════════════════════════════════════════
    // Transformamos la fila de DB (con JSONB genérico) en un
    // PracticeExercise tipado con interfaces de PL-03.

    return NextResponse.json({
      exercise: {
        id: insertedExercise.id,
        user_id: insertedExercise.user_id,
        document_id: insertedExercise.document_id,
        study_plan_id: insertedExercise.study_plan_id,
        topic_code: insertedExercise.topic_code,
        level_k: insertedExercise.level_k,
        exercise_type: insertedExercise.exercise_type,
        attempt_number: insertedExercise.attempt_number,
        scenario: parsed.scenario,
        solution: null, // ⚠️ NO revelar la solución al frontend
        created_at: insertedExercise.created_at,
      },
    });
  } catch {
    // ═══════════════════════════════════════════════════════════
    // Error handler global — mismo patrón que SE-02
    // ═══════════════════════════════════════════════════════════
    console.error("[practice/generate] Error inesperado");

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
