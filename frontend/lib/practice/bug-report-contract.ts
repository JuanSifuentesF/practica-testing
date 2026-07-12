import type {
  BugPriority,
  BugReportData,
  BugReportExercise,
  BugReportReferenceAnswer,
  BugReportScenario,
  BugSeverity,
  ExerciseScenario,
  ExerciseSolution,
  PracticeFeedback,
  PracticeSubmission,
} from "@/types/practice";

const SEVERITIES: readonly BugSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
];
const PRIORITIES: readonly BugPriority[] = ["urgent", "high", "medium", "low"];

type ContractResult =
  | { ok: true; value: BugReportData }
  | { ok: false; issues: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .map(requiredString)
    .filter((item): item is string => item !== null);
  return items.length === value.length ? items : null;
}

export function isBugReportScenario(
  value: unknown,
): value is BugReportScenario {
  if (!isRecord(value)) return false;

  const base: ExerciseScenario = {
    scenario: requiredString(value.scenario) ?? "",
    task_description: requiredString(value.task_description) ?? "",
    constraints: stringArray(value.constraints) ?? [],
    evaluation_criteria: stringArray(value.evaluation_criteria) ?? [],
  };

  return Boolean(
    base.scenario &&
    base.task_description &&
    base.constraints.length > 0 &&
    base.evaluation_criteria.length > 0 &&
    requiredString(value.user_story) &&
    requiredString(value.business_rule) &&
    requiredString(value.observed_bug),
  );
}

export function parseBugReportData(value: unknown): ContractResult {
  if (!isRecord(value))
    return { ok: false, issues: ["El reporte debe ser un objeto."] };

  const title = requiredString(value.title);
  const preconditions = requiredString(value.preconditions);
  const steps = stringArray(value.steps);
  const actualResult = requiredString(value.actual_result);
  const expectedResult = requiredString(value.expected_result);
  const severity = value.severity;
  const priority = value.priority;
  const evidence = requiredString(value.evidence);
  const issues: string[] = [];

  if (!title) issues.push("El titulo es obligatorio.");
  if (!preconditions) issues.push("Las precondiciones son obligatorias.");
  if (!steps || steps.length === 0)
    issues.push("Agrega al menos un paso reproducible.");
  if (!actualResult) issues.push("El resultado actual es obligatorio.");
  if (!expectedResult) issues.push("El resultado esperado es obligatorio.");
  if (!SEVERITIES.includes(severity as BugSeverity))
    issues.push("La severidad no es valida.");
  if (!PRIORITIES.includes(priority as BugPriority))
    issues.push("La prioridad no es valida.");
  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true as const,
    value: {
      title: title!,
      preconditions: preconditions!,
      steps: steps!,
      actual_result: actualResult!,
      expected_result: expectedResult!,
      severity: severity as BugSeverity,
      priority: priority as BugPriority,
      ...(evidence ? { evidence } : {}),
    },
  };
}

export function isBugReportReferenceAnswer(
  value: unknown,
): value is BugReportReferenceAnswer {
  return parseBugReportData(value).ok;
}

export type BugReportEvaluateResponse = {
  submission: Omit<PracticeSubmission, "content" | "feedback"> & {
    content: { type: "bug_report"; bug_report: BugReportData };
    feedback: PracticeFeedback;
  };
  solution: ExerciseSolution<BugReportReferenceAnswer>;
};

function isPracticeFeedback(value: unknown): value is PracticeFeedback {
  if (!isRecord(value) || !Array.isArray(value.criteria_results)) return false;
  return (
    typeof value.feedback_summary === "string" &&
    value.criteria_results.every(
      (item) =>
        isRecord(item) &&
        typeof item.criterion === "string" &&
        typeof item.passed === "boolean" &&
        typeof item.detail === "string",
    ) &&
    [value.missing_cases, value.strengths, value.improvements].every(
      (items) => stringArray(items) !== null,
    )
  );
}

export function isBugReportExercise(
  value: unknown,
): value is BugReportExercise {
  return (
    isRecord(value) &&
    value.exercise_type === "bug_report" &&
    typeof value.id === "string" &&
    typeof value.user_id === "string" &&
    typeof value.document_id === "string" &&
    typeof value.topic_code === "string" &&
    ["K1", "K2", "K3"].includes(value.level_k as string) &&
    typeof value.attempt_number === "number" &&
    typeof value.created_at === "string" &&
    (typeof value.study_plan_id === "string" || value.study_plan_id === null) &&
    value.solution === null &&
    isBugReportScenario(value.scenario)
  );
}

export function isBugReportEvaluateResponse(
  value: unknown,
): value is BugReportEvaluateResponse {
  if (
    !isRecord(value) ||
    !isRecord(value.submission) ||
    !isRecord(value.solution)
  )
    return false;
  const content = value.submission.content;
  return (
    isRecord(content) &&
    content.type === "bug_report" &&
    typeof value.submission.id === "string" &&
    typeof value.submission.user_id === "string" &&
    typeof value.submission.exercise_id === "string" &&
    typeof value.submission.submitted_at === "string" &&
    parseBugReportData(content.bug_report).ok &&
    isPracticeFeedback(value.submission.feedback) &&
    (typeof value.submission.score_percent === "number" ||
      value.submission.score_percent === null) &&
    isBugReportReferenceAnswer(value.solution.model_answer) &&
    typeof value.solution.explanation === "string" &&
    stringArray(value.solution.key_points) !== null
  );
}

const validReport = {
  title: "Checkout acepta una tarjeta vencida",
  preconditions: "Usuario autenticado con un producto en carrito.",
  steps: ["Abrir checkout", "Ingresar una tarjeta vencida", "Confirmar pago"],
  actual_result: "El pedido queda confirmado.",
  expected_result: "Se rechaza el pago y se informa que la tarjeta vencio.",
  severity: "high",
  priority: "urgent",
  evidence: "captura-checkout-01",
};

export const BUG_REPORT_CONTRACT_FIXTURES = [
  { name: "valido", value: validReport, expected: true },
  {
    name: "legacy sin precondiciones",
    value: { ...validReport, preconditions: "" },
    expected: false,
  },
  {
    name: "campo requerido ausente",
    value: { ...validReport, title: "" },
    expected: false,
  },
  {
    name: "enum invalido",
    value: { ...validReport, severity: "blocker" },
    expected: false,
  },
  {
    name: "pasos vacios",
    value: { ...validReport, steps: [] },
    expected: false,
  },
] as const;

export function assertBugReportContractFixtures(): void {
  const failed = BUG_REPORT_CONTRACT_FIXTURES.filter(
    (fixture) => parseBugReportData(fixture.value).ok !== fixture.expected,
  );
  if (failed.length > 0) {
    throw new Error(
      `Fixtures de bug report fallaron: ${failed.map((item) => item.name).join(", ")}`,
    );
  }
}
