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
import { executeAiJson } from "@/lib/ai/execute-json";
import { parseFirstJsonObject } from "@/lib/ai/json-object";
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

function readStringList(
  value: unknown,
  minimum: number,
  maximum: number,
): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.length > maximum ||
    !value.every(
      (item) => typeof item === "string" && item.trim().length > 0,
    )
  ) {
    return null;
  }

  return value;
}

function parsePracticeFeedback(
  rawText: string,
  expectedCriteria: string[],
): PracticeFeedback | null {
  const value = parseFirstJsonObject(rawText);
  if (
    !value ||
    typeof value.feedback_summary !== "string" ||
    value.feedback_summary.trim().length === 0 ||
    !Array.isArray(value.criteria_results) ||
    value.criteria_results.length !== expectedCriteria.length
  ) {
    return null;
  }

  const byCriterion = new Map<string, CriterionResult>();
  for (const item of value.criteria_results) {
    if (
      !isRecord(item) ||
      typeof item.criterion !== "string" ||
      !expectedCriteria.includes(item.criterion) ||
      byCriterion.has(item.criterion) ||
      typeof item.passed !== "boolean" ||
      typeof item.detail !== "string" ||
      item.detail.trim().length === 0
    ) {
      return null;
    }

    byCriterion.set(item.criterion, {
      criterion: item.criterion,
      passed: item.passed,
      detail: item.detail,
    });
  }

  const criteriaResults: CriterionResult[] = [];
  for (const criterion of expectedCriteria) {
    const result = byCriterion.get(criterion);
    if (!result) return null;
    criteriaResults.push(result);
  }

  const missingCases = readStringList(value.missing_cases, 0, 8);
  const strengths = readStringList(value.strengths, 1, 5);
  const improvements = readStringList(value.improvements, 1, 5);
  if (!missingCases || !strengths || !improvements) return null;

  return {
    feedback_summary: value.feedback_summary,
    criteria_results: criteriaResults,
    missing_cases: missingCases,
    strengths,
    improvements,
  };
}

function createDemoPracticeFeedbackRaw(expectedCriteria: string[]): string {
  return JSON.stringify({
    feedback_summary:
      "[MODO DEMO] Evaluación simulada para comprobar persistencia y UI sin proveedor externo.",
    criteria_results: expectedCriteria.map((criterion) => ({
      criterion,
      passed: true,
      detail:
        "[MODO DEMO] El criterio se marca como cumplido únicamente para ejercitar el flujo.",
    })),
    missing_cases: [],
    strengths: ["[MODO DEMO] La entrega tiene una estructura consumible."],
    improvements: [
      "[MODO DEMO] Repite la práctica en Managed o BYOK para feedback contextual.",
    ],
  });
}

function feedbackToJson(feedback: PracticeFeedback): Record<string, unknown> {
  return {
    feedback_summary: feedback.feedback_summary,
    criteria_results: feedback.criteria_results.map((criterion) => ({
      criterion: criterion.criterion,
      passed: criterion.passed,
      detail: criterion.detail,
    })),
    missing_cases: feedback.missing_cases,
    strengths: feedback.strengths,
    improvements: feedback.improvements,
  };
}

function submissionToJson(
  submission: SubmissionContent,
): Record<string, unknown> {
  switch (submission.type) {
    case "test_cases":
      return {
        type: submission.type,
        test_cases: submission.test_cases.map((testCase) => ({
          id: testCase.id,
          scenario: testCase.scenario,
          test_data: testCase.test_data,
          expected_result: testCase.expected_result,
          type: testCase.type,
        })),
      };
    case "bug_report":
      return {
        type: submission.type,
        bug_report: {
          title: submission.bug_report.title,
          preconditions: submission.bug_report.preconditions,
          steps: submission.bug_report.steps,
          actual_result: submission.bug_report.actual_result,
          expected_result: submission.bug_report.expected_result,
          severity: submission.bug_report.severity,
          priority: submission.bug_report.priority,
          evidence: submission.bug_report.evidence ?? "",
        },
      };
    case "api_testing":
      return {
        type: submission.type,
        checklist: submission.checklist.map((item) => ({
          id: item.id,
          validation: item.validation,
          checked: item.checked,
          notes: item.notes,
        })),
      };
    case "exploratory":
      return {
        type: submission.type,
        notes: submission.notes,
        findings: submission.findings,
      };
  }
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

    const repairPrompt =
      userPrompt +
      "\n\n## REINTENTO OBLIGATORIO\n\n" +
      "La respuesta anterior no cumplió el contrato JSON. " +
      "Devuelve solo un objeto JSON completo, sin markdown, texto adicional " +
      "ni cadenas o arrays truncados.";

    const ai = await executeAiJson<PracticeFeedback>({
      request,
      userId: user.id,
      feature: "practice_evaluate",
      systemPrompt,
      userPrompts: [userPrompt, repairPrompt],
      maxCompletionTokensPerAttempt: MAX_FEEDBACK_TOKENS,
      timeoutMs: PRACTICE_EVALUATE_TIMEOUT_MS,
      parse: (rawText) =>
        parsePracticeFeedback(rawText, scenario.evaluation_criteria),
      createDemoRaw: () =>
        createDemoPracticeFeedbackRaw(scenario.evaluation_criteria),
      tuning: () => ({
        response_format: { type: "json_object" },
        temperature: EVALUATE_TEMPERATURE,
      }),
    });

    if (!ai.ok) {
      return NextResponse.json(ai.body, { status: ai.status });
    }

    const feedback = ai.value;

    const scorePercent = calculateScorePercent(feedback);

    const insertData: PracticeSubmissionInsert = {
      user_id: user.id,
      exercise_id: exercise.id,
      submission_json: submissionToJson(normalizedSubmission.submission),
      score_percent: scorePercent,
      feedback_json: feedbackToJson(feedback),
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
      `[practice/evaluate] ${exercise.topic_code} evaluado en ${elapsedMs}ms, score=${scorePercent}`,
    );

    return NextResponse.json(responseBody, { status: 200 });
  } catch {
    console.error("[practice/evaluate] Error inesperado");

    return NextResponse.json(
      { error: "Error interno del servidor al evaluar la práctica." },
      { status: 500 },
    );
  }
}
