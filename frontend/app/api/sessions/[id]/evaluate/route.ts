import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeAiJson } from "@/lib/ai/execute-json";
import { parseFirstJsonObject } from "@/lib/ai/json-object";
import {
  claimQuizAiOperation,
  createQuizAiFingerprint,
  releaseQuizAiOperation,
} from "@/lib/ai/quiz-operation";
import { readAdaptResponse } from "@/lib/sessions/adaptation-contract";
import { readEvaluation } from "@/lib/sessions/evaluation-contract";
import {
  buildEvaluateSystemPrompt,
  buildEvaluateUserPrompt,
  type EvaluationAnswerContext,
} from "@/lib/prompts/evaluate";
import type {
  ActionTaken,
  AnswerOption,
  LevelK,
  MethodUsed,
  OptionsJson,
} from "@/types";
import type {
  ErrorPattern,
  EvaluateResponse,
  EvaluateWithAdaptationResponse,
  UserAnswer,
} from "@/types/evaluate";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_OPTIONS: AnswerOption[] = ["a", "b", "c", "d"];
const VALID_LEVELS: LevelK[] = ["K1", "K2", "K3"];
const EVALUATE_TIMEOUT_MS = 45_000;
const MAX_EVALUATE_COMPLETION_TOKENS = 4_000;
const ADVANCE_THRESHOLD = 70;
const REINFORCE_THRESHOLD = 50;

interface PrivateQuizQuestion {
  question_id: number;
  question: string;
  options: OptionsJson;
  correct: AnswerOption;
  explanation: string;
  topic_code: string;
  topic_name: string;
  level_k: LevelK;
}

interface PrivateQuizAttempt {
  attempt_id: string;
  state: "open" | "completed";
  method_used: MethodUsed;
  attempt_number: number;
  questions: PrivateQuizQuestion[];
}

interface QualitativeEvaluation {
  error_patterns: ErrorPattern[];
  feedback_message: string;
  next_method: MethodUsed;
  reinforcement_minutes: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => expectedKeys.includes(key))
  );
}

function isAnswerOption(value: unknown): value is AnswerOption {
  return (
    typeof value === "string" &&
    VALID_OPTIONS.includes(value as AnswerOption)
  );
}

function isLevelK(value: unknown): value is LevelK {
  return typeof value === "string" && VALID_LEVELS.includes(value as LevelK);
}

function isMethodUsed(value: unknown): value is MethodUsed {
  return value === "theory" || value === "examples" || value === "analogies";
}

function isFrequency(value: unknown): value is ErrorPattern["frequency"] {
  return value === "alta" || value === "media" || value === "baja";
}

function readErrorPattern(value: unknown): ErrorPattern | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["pattern", "frequency", "suggestion"]) ||
    typeof value.pattern !== "string" ||
    value.pattern.trim().length === 0 ||
    value.pattern.length > 500 ||
    !isFrequency(value.frequency) ||
    typeof value.suggestion !== "string" ||
    value.suggestion.trim().length === 0 ||
    value.suggestion.length > 1_000
  ) {
    return null;
  }

  return {
    pattern: value.pattern,
    frequency: value.frequency,
    suggestion: value.suggestion,
  };
}

function determineAction(score: number): ActionTaken {
  if (score >= ADVANCE_THRESHOLD) return "advance";
  if (score >= REINFORCE_THRESHOLD) return "reinforce";
  return "restructure";
}

function readEvaluateBody(value: unknown): {
  attemptId: string;
  answers: UserAnswer[];
} | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["attempt_id", "answers"]) ||
    typeof value.attempt_id !== "string" ||
    !UUID_REGEX.test(value.attempt_id) ||
    !Array.isArray(value.answers) ||
    value.answers.length < 10 ||
    value.answers.length > 12
  ) {
    return null;
  }

  const answers: UserAnswer[] = [];
  const questionIds = new Set<number>();

  for (const item of value.answers) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ["question_id", "user_answer"]) ||
      typeof item.question_id !== "number" ||
      !Number.isInteger(item.question_id) ||
      item.question_id < 0 ||
      questionIds.has(item.question_id) ||
      !isAnswerOption(item.user_answer)
    ) {
      return null;
    }

    questionIds.add(item.question_id);
    answers.push({
      question_id: item.question_id,
      user_answer: item.user_answer,
    });
  }

  return { attemptId: value.attempt_id, answers };
}

function readPrivateQuestion(value: unknown): PrivateQuizQuestion | null {
  if (
    !isRecord(value) ||
    typeof value.question_id !== "number" ||
    !Number.isInteger(value.question_id) ||
    value.question_id < 0 ||
    typeof value.question !== "string" ||
    !isRecord(value.options) ||
    typeof value.options.a !== "string" ||
    typeof value.options.b !== "string" ||
    typeof value.options.c !== "string" ||
    typeof value.options.d !== "string" ||
    !isAnswerOption(value.correct) ||
    typeof value.explanation !== "string" ||
    typeof value.topic_code !== "string" ||
    typeof value.topic_name !== "string" ||
    !isLevelK(value.level_k)
  ) {
    return null;
  }

  return {
    question_id: value.question_id,
    question: value.question,
    options: {
      a: value.options.a,
      b: value.options.b,
      c: value.options.c,
      d: value.options.d,
    },
    correct: value.correct,
    explanation: value.explanation,
    topic_code: value.topic_code,
    topic_name: value.topic_name,
    level_k: value.level_k,
  };
}

function readPrivateAttempt(value: unknown): PrivateQuizAttempt | null {
  if (
    !isRecord(value) ||
    typeof value.attempt_id !== "string" ||
    !UUID_REGEX.test(value.attempt_id) ||
    (value.state !== "open" && value.state !== "completed") ||
    !isMethodUsed(value.method_used) ||
    typeof value.attempt_number !== "number" ||
    !Number.isInteger(value.attempt_number) ||
    value.attempt_number < 1 ||
    !Array.isArray(value.questions) ||
    value.questions.length < 10 ||
    value.questions.length > 12
  ) {
    return null;
  }

  const questions: PrivateQuizQuestion[] = [];
  const ids = new Set<number>();
  for (const item of value.questions) {
    const question = readPrivateQuestion(item);
    if (!question || ids.has(question.question_id)) return null;
    ids.add(question.question_id);
    questions.push(question);
  }

  return {
    attempt_id: value.attempt_id,
    state: value.state,
    method_used: value.method_used,
    attempt_number: value.attempt_number,
    questions,
  };
}

function buildAnswerContext(
  questions: PrivateQuizQuestion[],
  answers: UserAnswer[],
): EvaluationAnswerContext[] | null {
  const selections = new Map(
    answers.map((answer) => [answer.question_id, answer.user_answer]),
  );

  if (
    selections.size !== questions.length ||
    questions.some((question) => !selections.has(question.question_id))
  ) {
    return null;
  }

  return questions.map((question) => ({
    ...question,
    user_answer: selections.get(question.question_id)!,
  }));
}

function parseEvaluateResponse(rawText: string): QualitativeEvaluation | null {
  const value = parseFirstJsonObject(rawText);
  if (
    !value ||
    typeof value.feedback_message !== "string" ||
    value.feedback_message.trim().length === 0 ||
    value.feedback_message.length > 2_000 ||
    !isMethodUsed(value.next_method) ||
    typeof value.reinforcement_minutes !== "number" ||
    !Number.isInteger(value.reinforcement_minutes) ||
    value.reinforcement_minutes < 0 ||
    value.reinforcement_minutes > 120 ||
    !Array.isArray(value.error_patterns) ||
    value.error_patterns.length > 5
  ) {
    return null;
  }

  const errorPatterns: ErrorPattern[] = [];
  for (const item of value.error_patterns) {
    const pattern = readErrorPattern(item);
    if (!pattern) return null;
    errorPatterns.push(pattern);
  }

  return {
    error_patterns: errorPatterns,
    feedback_message: value.feedback_message,
    next_method: value.next_method,
    reinforcement_minutes: value.reinforcement_minutes,
  };
}

function createDemoEvaluationRaw(
  score: number,
  action: ActionTaken,
  currentMethod: MethodUsed,
): string {
  const nextMethod: MethodUsed =
    action === "advance"
      ? currentMethod
      : currentMethod === "theory"
        ? "examples"
        : currentMethod === "examples"
          ? "analogies"
          : "theory";

  return JSON.stringify({
    error_patterns: [],
    feedback_message:
      `[MODO DEMO] Retroalimentación simulada. Resultado determinístico: ${score}%.`,
    next_method: nextMethod,
    reinforcement_minutes:
      action === "advance" ? 0 : action === "reinforce" ? 15 : 30,
  });
}

function readFinalizeResult(value: unknown): EvaluateResponse | null {
  if (
    !isRecord(value) ||
    (value.outcome !== "finalized" && value.outcome !== "duplicate") ||
    !isRecord(value.evaluation)
  ) {
    return null;
  }

  return readEvaluation(value.evaluation);
}

function databaseErrorResponse(message: string) {
  if (message.includes("QUIZ_ATTEMPT_NOT_FOUND")) {
    return NextResponse.json(
      { error: "Quiz no encontrado para esta sesión." },
      { status: 404 },
    );
  }
  if (message.includes("QUIZ_REPLAY_CONFLICT")) {
    return NextResponse.json(
      {
        error: "Esta sesión ya fue evaluada con otras respuestas.",
        code: "QUIZ_REPLAY_CONFLICT",
      },
      { status: 409 },
    );
  }
  if (message.includes("QUIZ_SESSION_COMPLETED")) {
    return NextResponse.json(
      { error: "Esta sesión ya fue evaluada.", code: "QUIZ_SESSION_COMPLETED" },
      { status: 409 },
    );
  }
  if (message.includes("QUIZ_SESSION_NOT_ACTIVE")) {
    return NextResponse.json(
      {
        error: "La sesión no está activa para evaluación.",
        code: "QUIZ_SESSION_NOT_ACTIVE",
      },
      { status: 409 },
    );
  }
  if (
    message.includes("QUIZ_SUBMISSION_INVALID") ||
    message.includes("QUIZ_IDENTITY_REQUIRED") ||
    message.includes("QUIZ_QUALITATIVE_INVALID")
  ) {
    return NextResponse.json(
      { error: "Las respuestas enviadas no coinciden con el quiz." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "Error al guardar la evaluación." },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id: sessionId } = await params;
    if (!sessionId || !UUID_REGEX.test(sessionId)) {
      return NextResponse.json(
        { error: "ID de sesión inválido. Debe ser un UUID válido." },
        { status: 400 },
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Body inválido. Se esperaba JSON." },
        { status: 400 },
      );
    }

    const body = readEvaluateBody(rawBody);
    if (!body) {
      return NextResponse.json(
        {
          error:
            "El body debe contener solo attempt_id y entre 10 y 12 selecciones completas.",
        },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { data: privateData, error: privateError } = await adminClient.rpc(
      "get_quiz_attempt_private",
      {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_attempt_id: body.attemptId,
      },
    );

    if (privateError) {
      console.error("[evaluate] Error leyendo snapshot privado:", privateError);
      return NextResponse.json(
        { error: "Error al recuperar el quiz." },
        { status: 500 },
      );
    }

    if (!privateData) {
      return NextResponse.json(
        { error: "Quiz no encontrado para esta sesión." },
        { status: 404 },
      );
    }

    const attempt = readPrivateAttempt(privateData);
    if (!attempt || attempt.attempt_id !== body.attemptId) {
      console.error("[evaluate] Snapshot privado con contrato inválido.");
      return NextResponse.json(
        { error: "El quiz almacenado tiene un formato inválido." },
        { status: 500 },
      );
    }

    const answerContext = buildAnswerContext(attempt.questions, body.answers);
    if (!answerContext) {
      return NextResponse.json(
        { error: "Las respuestas enviadas no coinciden con el quiz." },
        { status: 400 },
      );
    }

    const correctCount = answerContext.filter(
      (answer) => answer.user_answer === answer.correct,
    ).length;
    const totalQuestions = answerContext.length;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const action = determineAction(score);

    let errorPatterns: ErrorPattern[] = [];
    let claimedOperation: {
      userId: string;
      sessionId: string;
      operation: "evaluate";
      fingerprint: string;
      claimToken: string;
    } | null = null;

    const releaseClaim = async () => {
      if (!claimedOperation) return;
      try {
        await releaseQuizAiOperation(adminClient, claimedOperation);
      } catch (error) {
        console.error("[evaluate] No se pudo liberar la reserva de IA:", error);
      }
    };

    // A replay already has a persisted qualitative result. Skipping the LLM
    // keeps retries idempotent in both data and quota consumption.
    if (attempt.state === "open" && score < 100) {
      const canonicalAnswers = [...body.answers].sort(
        (left, right) => left.question_id - right.question_id,
      );
      const fingerprint = createQuizAiFingerprint(
        JSON.stringify({ attemptId: body.attemptId, answers: canonicalAnswers }),
      );
      const operationClaim = await claimQuizAiOperation(adminClient, {
        userId: user.id,
        sessionId,
        operation: "evaluate",
        fingerprint,
      });

      if (
        operationClaim.outcome === "in_progress" ||
        operationClaim.outcome === "conflict"
      ) {
        return NextResponse.json(
          {
            error:
              operationClaim.outcome === "conflict"
                ? "Esta sesión ya se está evaluando con otras respuestas."
                : "La evaluación está en progreso. Intenta de nuevo en unos segundos.",
            code:
              operationClaim.outcome === "conflict"
                ? "QUIZ_EVALUATION_CONFLICT"
                : "QUIZ_EVALUATION_IN_PROGRESS",
          },
          { status: 409, headers: { "Retry-After": "2" } },
        );
      }

      if (operationClaim.outcome === "acquired") {
        claimedOperation = {
          userId: user.id,
          sessionId,
          operation: "evaluate",
          fingerprint,
          claimToken: operationClaim.claimToken,
        };
      }

      const currentMethod = attempt.method_used;
      if (claimedOperation) {
        const ai = await executeAiJson<QualitativeEvaluation>({
          request,
          userId: user.id,
          feature: "evaluate",
          systemPrompt: buildEvaluateSystemPrompt(),
          userPrompts: [
            buildEvaluateUserPrompt(
              answerContext,
              score,
              correctCount,
              totalQuestions,
              currentMethod,
              attempt.attempt_number,
            ),
          ],
          maxCompletionTokensPerAttempt: MAX_EVALUATE_COMPLETION_TOKENS,
          timeoutMs: EVALUATE_TIMEOUT_MS,
          parse: parseEvaluateResponse,
          createDemoRaw: () =>
            createDemoEvaluationRaw(score, action, currentMethod),
          tuning: () => ({
            response_format: { type: "json_object" },
            temperature: 0.4,
          }),
        }).catch(async (error: unknown) => {
          await releaseClaim();
          throw error;
        });

        if (!ai.ok) {
          await releaseClaim();
          return NextResponse.json(ai.body, { status: ai.status });
        }

        // El LLM identifica patrones, pero no gobierna el mensaje, acción,
        // método ni minutos. Un 100% nunca puede conservar patrones de error.
        errorPatterns = score === 100 ? [] : ai.value.error_patterns;
      }
    }

    const finalization = claimedOperation
      ? await adminClient.rpc("finalize_quiz_and_adapt_claimed", {
          p_user_id: user.id,
          p_session_id: sessionId,
          p_attempt_id: body.attemptId,
          p_answers: body.answers.map((answer) => ({ ...answer })),
          p_qualitative: {
            error_patterns: errorPatterns,
          },
          p_request_fingerprint: claimedOperation.fingerprint,
          p_claim_token: claimedOperation.claimToken,
        })
      : await adminClient.rpc("finalize_quiz_and_adapt", {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_attempt_id: body.attemptId,
        p_answers: body.answers.map((answer) => ({ ...answer })),
        p_qualitative: {
          error_patterns: errorPatterns,
        },
        });
    const { data: finalized, error: finalizeError } = finalization;

    if (finalizeError) {
      await releaseClaim();
      console.error("[evaluate] Error finalizando intento:", finalizeError);
      return databaseErrorResponse(finalizeError.message);
    }

    const evaluation = readFinalizeResult(finalized);
    const adaptation = isRecord(finalized)
      ? readAdaptResponse(finalized.adaptation)
      : null;
    if (
      !evaluation ||
      !adaptation ||
      adaptation.action !== evaluation.action
    ) {
      await releaseClaim();
      console.error("[evaluate] RPC retornó un contrato inválido.");
      return NextResponse.json(
        { error: "La evaluación guardada tiene un formato inválido." },
        { status: 500 },
      );
    }

    const response: EvaluateWithAdaptationResponse = {
      ...evaluation,
      adaptation,
    };
    return NextResponse.json(response, { status: 200 });
  } catch {
    console.error("[evaluate] Error inesperado.");
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
