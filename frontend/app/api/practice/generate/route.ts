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
import OpenAI from "openai";
import {
  createModelRuntimes,
  getModelErrorStatus,
  isModelTimeout,
  type ModelRuntime,
} from "@/lib/ai/model-cascade";
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
// ──────────────────────────────────────────────────────────────
// Multi-Provider LLM (mismo patrón que SE-02)
// ──────────────────────────────────────────────────────────────

/**
 * Crea la cascada de candidatos. Cada uno se prueba con la generación real:
 * evita gastar una llamada de salud que no garantiza la generación posterior.
 */
function createPracticeModelRuntimes(): ModelRuntime[] {
  const runtimes = createModelRuntimes({
    timeoutMs: PRACTICE_TIMEOUT_MS,
    geminiModels: [process.env.GEMINI_PRACTICE_MODEL],
    openaiModels: [process.env.OPENAI_PRACTICE_MODEL],
  });

  if (runtimes.length === 0) {
    throw new Error(
      "No hay API key de LLM configurada. " +
        "Define GEMINI_API_KEY o OPENAI_API_KEY en frontend/.env.local",
    );
  }

  return runtimes;
}

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
function parsePracticeResponse(rawText: string): LlmPracticeResponse | null {
  const parsed = parseFirstJsonObject(rawText);
  if (!parsed) {
    console.error(
      `[practice/generate] No se encontró un objeto JSON válido (${rawText.length} chars).`,
    );
    return null;
  }

  // Verificar que tiene la estructura esperada
  if (!parsed.scenario || typeof parsed.scenario !== "object") {
    console.error(
      "[practice/generate] JSON parseado pero sin campo 'scenario':",
      Object.keys(parsed),
    );
    return null;
  }

  if (
    !parsed.reference_solution ||
    typeof parsed.reference_solution !== "object"
  ) {
    console.error(
      "[practice/generate] JSON parseado pero sin campo 'reference_solution':",
      Object.keys(parsed),
    );
    return null;
  }

  return parsed as unknown as LlmPracticeResponse;
}

/**
 * Valida que el escenario generado tiene la estructura mínima
 * requerida por ExerciseScenario.
 *
 * @returns Array de errores (vacío si todo es válido)
 */
function validateScenario(scenario: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!scenario.scenario || typeof scenario.scenario !== "string") {
    errors.push("Falta el campo 'scenario' (descripción del sistema).");
  } else if ((scenario.scenario as string).length < 50) {
    errors.push("El campo 'scenario' es demasiado corto (mín. 50 caracteres).");
  }

  if (
    !scenario.task_description ||
    typeof scenario.task_description !== "string"
  ) {
    errors.push("Falta el campo 'task_description'.");
  } else if ((scenario.task_description as string).length < 20) {
    errors.push("El campo 'task_description' es demasiado corto.");
  }

  if (
    !Array.isArray(scenario.constraints) ||
    scenario.constraints.length === 0
  ) {
    errors.push(
      "Falta o está vacío el campo 'constraints' (debe ser un array no vacío).",
    );
  }

  if (
    !Array.isArray(scenario.evaluation_criteria) ||
    scenario.evaluation_criteria.length === 0
  ) {
    errors.push(
      "Falta o está vacío el campo 'evaluation_criteria' (debe ser un array no vacío).",
    );
  }

  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

  if (modelAnswer.test_cases.length === 0) {
    return ["model_answer.test_cases debe tener al menos una fila."];
  }

  return modelAnswer.test_cases.flatMap((row, index) =>
    validateTestCaseRow(row, index),
  );
}

/**
 * Valida que la solución de referencia tiene la estructura mínima
 * requerida por ExerciseSolution.
 *
 * @returns Array de errores (vacío si todo es válido)
 */
function validateSolution(
  solution: Record<string, unknown>,
  exerciseType: PracticeExerciseType,
): string[] {
  const errors: string[] = [];

  if (!isRecord(solution.model_answer)) {
    errors.push("Falta el campo 'model_answer' en reference_solution.");
  } else if (exerciseType === "test_cases") {
    errors.push(...validateTestCaseReferenceAnswer(solution.model_answer));
  } else if (
    exerciseType === "bug_report" &&
    !isBugReportReferenceAnswer(solution.model_answer)
  ) {
    errors.push(
      "model_answer de bug_report debe contener title, preconditions, steps, actual_result, expected_result, severity y priority válidos.",
    );
  }

  if (!solution.explanation || typeof solution.explanation !== "string") {
    errors.push("Falta el campo 'explanation' en reference_solution.");
  } else if (solution.explanation.length < 30) {
    errors.push("El campo 'explanation' es demasiado corto.");
  }

  if (
    !Array.isArray(solution.key_points) ||
    solution.key_points.length === 0 ||
    !solution.key_points.every(
      (item) => typeof item === "string" && item.trim().length > 0,
    )
  ) {
    errors.push("key_points debe ser un array no vacío de strings.");
  }

  return errors;
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
    // PASOS 7 y 8: Generar, parsear y validar con fallback
    // ═══════════════════════════════════════════════════════════
    const modelRuntimes = createPracticeModelRuntimes();
    let parsed: LlmPracticeResponse | null = null;
    let timedOutModels = 0;

    for (const modelRuntime of modelRuntimes) {
      console.log(
        `[practice/generate] Generando ejercicio para ${validatedTopicCode} ` +
          `(${validatedExerciseType}, ${validatedLevelK}, intento #${attemptNumber}, ` +
          `modelo=${modelRuntime.model})`,
      );

      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        modelRuntime.timeoutMs,
      );

      let completion: OpenAI.Chat.Completions.ChatCompletion;
      try {
        completion = await modelRuntime.client.chat.completions.create(
          {
            model: modelRuntime.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            // Structured Outputs exige el contrato completo del ejercicio.
            response_format: buildPracticeResponseFormat(
              validatedExerciseType,
            ),
            // Gemini 3.x conserva su temperatura predeterminada y usa un
            // esfuerzo bajo porque esta generación prioriza latencia.
            ...(modelRuntime.provider === "gemini"
              ? { reasoning_effort: "low" as const }
              : { temperature: 0.3 }),
          },
          { signal: controller.signal },
        );
      } catch (llmError) {
        if (isModelTimeout(llmError)) {
          timedOutModels += 1;
          console.warn(
            `[practice/generate] ${modelRuntime.model} agotó el timeout; ` +
              "probando el siguiente candidato.",
          );
        } else {
          const status = getModelErrorStatus(llmError);
          console.warn(
            `[practice/generate] ${modelRuntime.model} no está disponible ` +
              `o rechazó la solicitud (status=${status}).`,
          );
        }
        continue;
      } finally {
        clearTimeout(timeoutId);
      }

      const rawResponse = completion.choices[0]?.message?.content || "";
      const elapsed = Date.now() - startTime;
      const tokensUsed = completion.usage?.total_tokens || 0;

      console.log(
        `[practice/generate] ${modelRuntime.model} respondió en ${elapsed}ms, ` +
          `${tokensUsed} tokens, ${rawResponse.length} chars`,
      );

      const candidate = parsePracticeResponse(rawResponse);
      if (!candidate) {
        console.warn(
          `[practice/generate] ${modelRuntime.model} devolvió JSON inválido; ` +
            "probando el siguiente candidato.",
        );
        continue;
      }

      const scenarioErrors = [
        ...validateScenario(
          candidate.scenario as unknown as Record<string, unknown>,
        ),
        ...(validatedExerciseType === "bug_report" &&
        !isBugReportScenario(candidate.scenario)
          ? [
              "scenario de bug_report requiere user_story, business_rule y observed_bug como strings no vacíos.",
            ]
          : []),
      ];
      if (scenarioErrors.length > 0) {
        console.warn(
          `[practice/generate] ${modelRuntime.model} devolvió un scenario ` +
            `inválido: ${scenarioErrors.join("; ")}`,
        );
        continue;
      }

      const solutionErrors = validateSolution(
        candidate.reference_solution as unknown as Record<string, unknown>,
        validatedExerciseType,
      );
      if (solutionErrors.length > 0) {
        console.warn(
          `[practice/generate] ${modelRuntime.model} devolvió una solución ` +
            `inválida: ${solutionErrors.join("; ")}`,
        );
        continue;
      }

      parsed = candidate;
      break;
    }

    if (!parsed) {
      const allModelsTimedOut = timedOutModels === modelRuntimes.length;
      return NextResponse.json(
        {
          error: allModelsTimedOut
            ? "Los modelos disponibles no respondieron a tiempo. Intenta de nuevo."
            : "Ningún modelo disponible devolvió un ejercicio válido. Intenta de nuevo.",
        },
        { status: allModelsTimedOut ? 504 : 502 },
      );
    }

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
      scenario_json: parsed.scenario as unknown as Record<string, unknown>,
      solution_json: parsed.reference_solution as unknown as Record<
        string,
        unknown
      >,
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
  } catch (error) {
    // ═══════════════════════════════════════════════════════════
    // Error handler global — mismo patrón que SE-02
    // ═══════════════════════════════════════════════════════════
    console.error("[practice/generate] Error inesperado:", error);

    // Distinguir errores del LLM de otros errores
    if (error instanceof OpenAI.APIError) {
      const statusCode = error.status || 502;
      return NextResponse.json(
        {
          error: `Error del proveedor de IA (${statusCode}): ${error.message}`,
        },
        { status: 502 },
      );
    }

    if (error instanceof OpenAI.APIConnectionError) {
      return NextResponse.json(
        {
          error:
            "No se pudo conectar con el proveedor de IA. " +
            "Verifica tu conexión a internet.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
