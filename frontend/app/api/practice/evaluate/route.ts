// ─────────────────────────────────────────────────────────────────
// app/api/practice/evaluate/route.ts
// Route Handler: evalúa una entrega del QA Practice Lab.
//
// Método: POST
// Auth: requiere sesión válida de Supabase Auth.
// Body: PracticeEvaluateRequest
//   {
//     exercise_id: string,
//     submission: SubmissionContent
//   }
//
// Response 200: PracticeEvaluateResponse
// Response 400: body inválido o submission incompatible
// Response 401: usuario no autenticado
// Response 404: ejercicio no encontrado para el usuario
// Response 409: ejercicio ya enviado o sin solución de referencia
// Response 502: error del proveedor IA o JSON inválido
// Response 504: timeout del proveedor IA
//
// SEGURIDAD:
//   - Las API keys solo viven en servidor.
//   - No se imprime ningún secreto en logs.
//   - RLS + filtro user_id protegen ownership.
//   - No se usan joins porque database.ts mantiene Relationships: [].
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
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPracticeEvaluateSystemPrompt,
  buildPracticeEvaluateUserPrompt,
  EVALUATE_TEMPERATURE,
} from "@/lib/prompts/practice-evaluate";
import type {
  ApiChecklistItem,
  BugReportData,
  CriterionResult,
  ExerciseScenario,
  ExerciseSolution,
  PracticeEvaluateResponse,
  PracticeExerciseType,
  PracticeFeedback,
  SubmissionContent,
  TestCaseRow,
  TestCaseType,
} from "@/types/practice";
import {
  isBugReportReferenceAnswer,
  isBugReportScenario,
  parseBugReportData,
} from "@/lib/practice/bug-report-contract";
import type { LevelK, PracticeSubmissionInsert } from "@/types";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_EXERCISE_TYPES: readonly PracticeExerciseType[] = [
  "test_cases",
  "bug_report",
  "api_testing",
  "exploratory",
] as const;

const VALID_LEVEL_K: readonly LevelK[] = ["K1", "K2", "K3"] as const;

const VALID_TEST_CASE_TYPES: readonly TestCaseType[] = [
  "positive",
  "negative",
  "boundary",
] as const;

const PRACTICE_EVALUATE_TIMEOUT_MS = 90_000;
const MAX_FEEDBACK_TOKENS = 6000;
const MAX_FEEDBACK_ATTEMPTS = 2;

function createPracticeEvaluateModelRuntimes(): ModelRuntime[] {
  const runtimes = createModelRuntimes({
    timeoutMs: PRACTICE_EVALUATE_TIMEOUT_MS,
    geminiModels: [process.env.GEMINI_EVALUATE_MODEL],
    openaiModels: [
      process.env.OPENAI_EVALUATE_MODEL,
      process.env.OPENAI_PRACTICE_MODEL,
    ],
  });

  if (runtimes.length === 0) {
    throw new Error(
      "No hay API key de LLM configurada. Define GEMINI_API_KEY o OPENAI_API_KEY en frontend/.env.local.",
    );
  }

  return runtimes;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function toStringList(
  value: unknown,
  fallback: string[],
  maxItems: number,
): string[] {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);

  return items.length > 0 ? items : fallback;
}

function isPracticeExerciseType(value: unknown): value is PracticeExerciseType {
  return (
    typeof value === "string" &&
    VALID_EXERCISE_TYPES.includes(value as PracticeExerciseType)
  );
}

function isLevelK(value: unknown): value is LevelK {
  return typeof value === "string" && VALID_LEVEL_K.includes(value as LevelK);
}

function isExerciseScenario(value: unknown): value is ExerciseScenario {
  return (
    isRecord(value) &&
    typeof value.scenario === "string" &&
    typeof value.task_description === "string" &&
    isStringArray(value.constraints) &&
    isStringArray(value.evaluation_criteria) &&
    value.evaluation_criteria.length > 0
  );
}

function isExerciseSolution(value: unknown): value is ExerciseSolution {
  return (
    isRecord(value) &&
    isRecord(value.model_answer) &&
    typeof value.explanation === "string" &&
    isStringArray(value.key_points) &&
    value.key_points.length > 0
  );
}

function normalizeTestCaseRows(value: unknown): {
  rows?: TestCaseRow[];
  error?: string;
} {
  if (!Array.isArray(value)) {
    return { error: "submission.test_cases debe ser un array." };
  }

  if (value.length === 0) {
    return { error: "Debes enviar al menos un caso de prueba." };
  }

  const rows: TestCaseRow[] = [];

  for (const [index, rawRow] of value.entries()) {
    if (!isRecord(rawRow)) {
      return { error: `test_cases[${index}] debe ser un objeto.` };
    }

    const scenario = readString(rawRow.scenario);
    const testData = readString(rawRow.test_data);
    const expectedResult = readString(rawRow.expected_result);
    const type = VALID_TEST_CASE_TYPES.includes(rawRow.type as TestCaseType)
      ? (rawRow.type as TestCaseType)
      : null;

    if (!scenario || !testData || !expectedResult || !type) {
      return {
        error:
          `test_cases[${index}] requiere scenario, test_data, ` +
          "expected_result y type válido.",
      };
    }

    rows.push({
      id: readString(rawRow.id) || `TC-${String(index + 1).padStart(3, "0")}`,
      scenario,
      test_data: testData,
      expected_result: expectedResult,
      type,
    });
  }

  return { rows };
}

function normalizeBugReport(value: unknown): {
  bugReport?: BugReportData;
  error?: string;
} {
  const parsed = parseBugReportData(value);

  if (!parsed.ok) {
    return { error: parsed.issues.join(" ") };
  }

  return { bugReport: parsed.value };
}

function normalizeApiChecklist(value: unknown): {
  checklist?: ApiChecklistItem[];
  error?: string;
} {
  if (!Array.isArray(value)) {
    return { error: "submission.checklist debe ser un array." };
  }

  const checklist: ApiChecklistItem[] = [];

  for (const [index, rawItem] of value.entries()) {
    if (!isRecord(rawItem)) {
      return { error: `checklist[${index}] debe ser un objeto.` };
    }

    const validation = readString(rawItem.validation);
    if (!validation) {
      return { error: `checklist[${index}].validation es requerido.` };
    }

    checklist.push({
      id: readString(rawItem.id) || `API-${String(index + 1).padStart(3, "0")}`,
      validation,
      checked: rawItem.checked === true,
      notes: typeof rawItem.notes === "string" ? rawItem.notes.trim() : "",
    });
  }

  if (checklist.length === 0) {
    return { error: "Debes enviar al menos un ítem de checklist." };
  }

  return { checklist };
}

function normalizeSubmission(
  value: unknown,
  expectedType: PracticeExerciseType,
): { submission?: SubmissionContent; error?: string } {
  if (!isRecord(value)) {
    return { error: "submission debe ser un objeto." };
  }

  if (value.type !== expectedType) {
    return {
      error:
        `submission.type debe ser "${expectedType}" porque el ejercicio ` +
        `guardado es de tipo "${expectedType}".`,
    };
  }

  if (expectedType === "test_cases") {
    const normalized = normalizeTestCaseRows(value.test_cases);
    if (!normalized.rows) return { error: normalized.error };
    return { submission: { type: "test_cases", test_cases: normalized.rows } };
  }

  if (expectedType === "bug_report") {
    const normalized = normalizeBugReport(value.bug_report);
    if (!normalized.bugReport) return { error: normalized.error };
    return {
      submission: { type: "bug_report", bug_report: normalized.bugReport },
    };
  }

  if (expectedType === "api_testing") {
    const normalized = normalizeApiChecklist(value.checklist);
    if (!normalized.checklist) return { error: normalized.error };
    return {
      submission: { type: "api_testing", checklist: normalized.checklist },
    };
  }

  const notes = typeof value.notes === "string" ? value.notes.trim() : "";
  const findings = isStringArray(value.findings)
    ? value.findings.map((finding) => finding.trim()).filter(Boolean)
    : [];

  if (!notes && findings.length === 0) {
    return {
      error: "exploratory requiere notes o findings con al menos un contenido.",
    };
  }

  return { submission: { type: "exploratory", notes, findings } };
}

function parseJsonObject(rawText: string): Record<string, unknown> | null {
  let text = rawText.trim();

  const markdownMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (markdownMatch) {
    text = markdownMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch (error) {
    console.error("[practice/evaluate] Error parseando JSON del LLM:", error);
    return null;
  }
}

function normalizeCriterionResults(
  value: unknown,
  expectedCriteria: string[],
): CriterionResult[] {
  const rawItems = Array.isArray(value) ? value : [];

  return expectedCriteria.map((criterion, index) => {
    const exactMatch = rawItems.find(
      (item) => isRecord(item) && item.criterion === criterion,
    );
    const rawItem = exactMatch || rawItems[index];

    if (!isRecord(rawItem)) {
      return {
        criterion,
        passed: false,
        detail: "El modelo no devolvió una evaluación para este criterio.",
      };
    }

    return {
      criterion,
      passed: rawItem.passed === true,
      detail:
        readString(rawItem.detail) || "Sin detalle específico del modelo.",
    };
  });
}

function normalizeFeedback(
  value: unknown,
  expectedCriteria: string[],
): PracticeFeedback | null {
  if (!isRecord(value)) return null;

  const criteriaResults = normalizeCriterionResults(
    value.criteria_results,
    expectedCriteria,
  );

  return {
    feedback_summary:
      readString(value.feedback_summary) ||
      "La práctica fue evaluada. Revisa el detalle por criterio para identificar fortalezas y mejoras.",
    criteria_results: criteriaResults,
    missing_cases: toStringList(value.missing_cases, [], 8),
    strengths: toStringList(value.strengths, ["Completaste la entrega."], 5),
    improvements: toStringList(
      value.improvements,
      ["Revisa la solución de referencia y completa los criterios pendientes."],
      5,
    ),
  };
}

function calculateScorePercent(feedback: PracticeFeedback): number {
  const totalCriteria = Math.max(feedback.criteria_results.length, 1);
  const passedCriteria = feedback.criteria_results.filter(
    (criterion) => criterion.passed,
  ).length;

  return Math.min(
    100,
    Math.max(0, Math.round((passedCriteria / totalCriteria) * 100)),
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    let body: Record<string, unknown>;
    try {
      const parsedBody: unknown = await request.json();
      if (!isRecord(parsedBody)) {
        return NextResponse.json(
          { error: "El body debe ser un objeto JSON." },
          { status: 400 },
        );
      }
      body = parsedBody;
    } catch {
      return NextResponse.json(
        { error: "El body de la petición debe ser JSON válido." },
        { status: 400 },
      );
    }

    const exerciseId = readString(body.exercise_id);
    if (!exerciseId || !UUID_REGEX.test(exerciseId)) {
      return NextResponse.json(
        { error: "exercise_id es requerido y debe ser un UUID válido." },
        { status: 400 },
      );
    }

    if (!("submission" in body)) {
      return NextResponse.json(
        { error: "submission es requerido. No uses submission_json en PL-09." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para evaluar tu práctica." },
        { status: 401 },
      );
    }

    // solution_json no está disponible para el rol authenticated. Después de
    // autenticar al usuario, el servidor la lee con service_role y conserva
    // el filtro explícito de ownership porque el cliente admin omite RLS.
    const admin = createAdminClient();
    const { data: exercise, error: exerciseError } = await admin
      .from("practice_exercises")
      .select(
        "id, user_id, document_id, topic_code, level_k, exercise_type, scenario_json, solution_json, created_at",
      )
      .eq("id", exerciseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (exerciseError) {
      console.error(
        "[practice/evaluate] Error buscando ejercicio:",
        exerciseError,
      );
      return NextResponse.json(
        { error: "Error al buscar el ejercicio." },
        { status: 500 },
      );
    }

    if (!exercise) {
      return NextResponse.json(
        {
          error:
            "Ejercicio no encontrado. Verifica que exercise_id existe y pertenece a tu cuenta.",
        },
        { status: 404 },
      );
    }

    const exerciseType = exercise.exercise_type;
    const levelK = exercise.level_k;
    const scenario = exercise.scenario_json;
    const solution = exercise.solution_json;

    if (!isPracticeExerciseType(exerciseType) || !isLevelK(levelK)) {
      return NextResponse.json(
        { error: "El ejercicio guardado tiene metadatos inválidos." },
        { status: 500 },
      );
    }

    if (!isExerciseScenario(scenario)) {
      return NextResponse.json(
        { error: "El ejercicio guardado no tiene scenario_json válido." },
        { status: 500 },
      );
    }

    if (exerciseType === "bug_report" && !isBugReportScenario(scenario)) {
      return NextResponse.json(
        {
          error:
            "El ejercicio de bug report fue creado con un escenario incompatible. Genera uno nuevo antes de evaluar.",
        },
        { status: 409 },
      );
    }

    if (!isExerciseSolution(solution)) {
      return NextResponse.json(
        {
          error:
            "El ejercicio no tiene solución de referencia válida. Genera un ejercicio nuevo antes de evaluar.",
        },
        { status: 409 },
      );
    }

    if (
      exerciseType === "bug_report" &&
      !isBugReportReferenceAnswer(solution.model_answer)
    ) {
      return NextResponse.json(
        {
          error:
            "El ejercicio de bug report tiene una solución modelo incompatible. Genera uno nuevo antes de evaluar.",
        },
        { status: 409 },
      );
    }

    const normalizedSubmission = normalizeSubmission(
      body.submission,
      exerciseType,
    );
    if (!normalizedSubmission.submission) {
      return NextResponse.json(
        { error: normalizedSubmission.error || "submission inválida." },
        { status: 400 },
      );
    }

    const { count: existingSubmissions, error: duplicateError } = await supabase
      .from("practice_submissions")
      .select("id", { count: "exact", head: true })
      .eq("exercise_id", exercise.id)
      .eq("user_id", user.id);

    if (duplicateError) {
      console.error(
        "[practice/evaluate] Error verificando submissions previas:",
        duplicateError,
      );
      return NextResponse.json(
        { error: "Error al verificar si el ejercicio ya fue enviado." },
        { status: 500 },
      );
    }

    if ((existingSubmissions ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Este ejercicio ya fue enviado. Genera un nuevo ejercicio para otro intento.",
        },
        { status: 409 },
      );
    }

    const systemPrompt = buildPracticeEvaluateSystemPrompt(exerciseType);
    const userPrompt = buildPracticeEvaluateUserPrompt({
      scenario,
      solution,
      userSubmission: normalizedSubmission.submission,
      exerciseType,
      topicCode: exercise.topic_code,
      levelK,
    });

    const modelRuntimes = createPracticeEvaluateModelRuntimes();
    let feedback: PracticeFeedback | null = null;
    let lastFinishReason = "unknown";
    let timedOutModels = 0;
    let evaluatedWith = "unknown";

    for (const modelRuntime of modelRuntimes) {
      for (let attempt = 1; attempt <= MAX_FEEDBACK_ATTEMPTS; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          modelRuntime.timeoutMs,
        );

        const attemptUserPrompt =
          attempt === 1
            ? userPrompt
            : `${userPrompt}\n\n## REINTENTO OBLIGATORIO\n\nTu respuesta anterior no pudo parsearse como JSON válido. Devuelve SOLO un objeto JSON completo, sin markdown, sin texto adicional, sin truncar cadenas y con todos los arrays cerrados.`;

        let completion: OpenAI.Chat.Completions.ChatCompletion;
        try {
          completion = await modelRuntime.client.chat.completions.create(
            {
              model: modelRuntime.model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: attemptUserPrompt },
              ],
              response_format: { type: "json_object" },
              temperature: EVALUATE_TEMPERATURE,
              max_tokens: MAX_FEEDBACK_TOKENS,
            },
            { signal: controller.signal },
          );
        } catch (llmError) {
          if (isModelTimeout(llmError)) {
            timedOutModels += 1;
            console.warn(
              `[practice/evaluate] ${modelRuntime.model} agotó el timeout; ` +
                "probando el siguiente candidato.",
            );
          } else {
            const status = getModelErrorStatus(llmError);
            console.warn(
              `[practice/evaluate] ${modelRuntime.model} no está disponible ` +
                `o rechazó la solicitud (status=${status}).`,
            );
          }
          break;
        } finally {
          clearTimeout(timeoutId);
        }

        const choice = completion.choices[0];
        const rawContent = choice?.message?.content || "";
        lastFinishReason = String(choice?.finish_reason || "unknown");
        const usage = completion.usage;

        console.log(
          `[practice/evaluate] ${modelRuntime.model} intento ` +
            `${attempt}/${MAX_FEEDBACK_ATTEMPTS}: ` +
            `finish_reason=${lastFinishReason}, ` +
            `tokens=${usage?.total_tokens || "N/A"}, ` +
            `completion_tokens=${usage?.completion_tokens || "N/A"}, ` +
            `chars=${rawContent.length}`,
        );

        const parsedFeedback = parseJsonObject(rawContent);
        feedback = normalizeFeedback(
          parsedFeedback,
          scenario.evaluation_criteria,
        );

        if (feedback) {
          evaluatedWith = `${modelRuntime.provider}/${modelRuntime.model}`;
          break;
        }

        console.warn(
          `[practice/evaluate] ${modelRuntime.model} devolvió feedback ` +
            `inválido en intento ${attempt}; finish_reason=${lastFinishReason}.`,
        );
      }

      if (feedback) {
        break;
      }
    }

    if (!feedback) {
      const allModelsTimedOut = timedOutModels === modelRuntimes.length;
      return NextResponse.json(
        {
          error: allModelsTimedOut
            ? "Los modelos disponibles no respondieron a tiempo. Intenta de nuevo."
            : "Ningún modelo disponible devolvió un PracticeFeedback válido. " +
              `Último finish_reason=${lastFinishReason}. Intenta de nuevo.`,
        },
        { status: allModelsTimedOut ? 504 : 502 },
      );
    }

    const scorePercent = calculateScorePercent(feedback);

    const insertData: PracticeSubmissionInsert = {
      user_id: user.id,
      exercise_id: exercise.id,
      submission_json: normalizedSubmission.submission as unknown as Record<
        string,
        unknown
      >,
      score_percent: scorePercent,
      feedback_json: feedback as unknown as Record<string, unknown>,
    };

    const { data: insertedSubmission, error: insertError } = await supabase
      .from("practice_submissions")
      .insert(insertData)
      .select("*")
      .single();

    if (insertError) {
      console.error(
        "[practice/evaluate] Error insertando submission:",
        insertError,
      );

      if (insertError.code === "23503") {
        return NextResponse.json(
          {
            error:
              "No se pudo crear la submission porque el exercise_id no tiene ownership válido.",
          },
          { status: 400 },
        );
      }

      if (insertError.code === "23514") {
        return NextResponse.json(
          { error: "score_percent debe estar entre 0 y 100." },
          { status: 400 },
        );
      }

      if (insertError.code === "42501") {
        return NextResponse.json(
          { error: "RLS rechazó la inserción de la submission." },
          { status: 403 },
        );
      }

      return NextResponse.json(
        { error: "Error al guardar la evaluación en la base de datos." },
        { status: 500 },
      );
    }

    const responseBody: PracticeEvaluateResponse = {
      submission: {
        id: insertedSubmission.id,
        user_id: insertedSubmission.user_id,
        exercise_id: insertedSubmission.exercise_id,
        content: normalizedSubmission.submission,
        score_percent: insertedSubmission.score_percent,
        feedback,
        submitted_at: insertedSubmission.submitted_at,
      },
      solution,
    };

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[practice/evaluate] ${exercise.topic_code} evaluado en ${elapsedMs}ms ` +
        `con ${evaluatedWith}, score=${scorePercent}`,
    );

    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    console.error("[practice/evaluate] Error inesperado:", error);

    if (error instanceof OpenAI.APIConnectionError) {
      return NextResponse.json(
        {
          error:
            "No se pudo conectar con el proveedor de IA. Verifica conexión y variables de entorno.",
        },
        { status: 502 },
      );
    }

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        {
          error: `Error del proveedor de IA (${error.status || 502}): ${error.message}`,
        },
        { status: 502 },
      );
    }

    if (error instanceof Error && error.message.includes("No hay API key")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Error interno del servidor al evaluar la práctica." },
      { status: 500 },
    );
  }
}
