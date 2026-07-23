// ─────────────────────────────────────────────────────────────────
// app/api/sessions/[id]/quiz/route.ts
// Route Handler: genera preguntas de quiz ISTQB para una sesión.
//
// Método: POST
// Auth: Requiere sesión válida (cookie JWT de Supabase)
// Params: id — UUID de la sesión
// Body: opcional; un intento existente nunca se reemplaza.
//
// Response (200): { quiz: QuizContent, cached: boolean }
// Response (401): { error: "No autenticado" }
// Response (400): { error: "Descripción del problema" }
// Response (404): { error: "Sesión no encontrada" }
// Response (500): { error: "Error interno del servidor" }
// Response (502): { error: "Error en la generación del quiz" }
//
// IDEMPOTENCIA Y AUTORIDAD:
//   El snapshot completo se persiste en el schema privado de PostgreSQL.
//   El navegador recibe solo pregunta/opciones; nunca correct/explanation.
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAdaptResponse } from "@/lib/sessions/adaptation-contract";
import { readEvaluation } from "@/lib/sessions/evaluation-contract";
import {
  MAX_QUIZ_QUESTIONS,
  MAX_QUIZ_TOPICS_PER_SESSION,
  MIN_QUIZ_QUESTIONS,
} from "@/lib/sessions/quiz-limits";
import { executeAiJson } from "@/lib/ai/execute-json";
import { parseFirstJsonObject } from "@/lib/ai/json-object";
import {
  claimQuizAiOperation,
  createQuizAiFingerprint,
  releaseQuizAiOperation,
} from "@/lib/ai/quiz-operation";
import { buildQuizSystemPrompt, buildQuizUserPrompt } from "@/lib/prompts/quiz";
import type {
  SessionRow,
  StudyPlanRow,
  TopicsJson,
  AnswerOption,
} from "@/types";
import type { SessionTopic } from "@/types/sessions";
import type { QuizQuestion, QuizContent } from "@/types/quiz";
import type { EvaluateResponse } from "@/types/evaluate";

// ─── Forzar Node.js runtime ─────────────────────────────────────
// Edge runtime no soporta el SDK de OpenAI ni las cookies de
// Supabase SSR. Forzamos Node.js para tener acceso completo.
export const runtime = "nodejs";

// ─── Constantes ──────────────────────────────────────────────────
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// El quiz genera menos tokens que la teoría (~3K vs ~5K)
// pero el prompt es más largo por las instrucciones detalladas
const QUIZ_TIMEOUT_MS = 60_000; // 60 segundos
const MAX_QUIZ_COMPLETION_TOKENS = 5_000;

// Opciones válidas de respuesta
const VALID_OPTIONS: AnswerOption[] = ["a", "b", "c", "d"];

interface QuizSnapshotQuestion extends QuizQuestion {
  correct: AnswerOption;
  explanation: string;
}

// ──────────────────────────────────────────────────────────────
// Parser defensivo del response del LLM
// ──────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAnswerOption(value: unknown): value is AnswerOption {
  return value === "a" || value === "b" || value === "c" || value === "d";
}

function isLevelK(value: unknown): value is "K1" | "K2" | "K3" {
  return value === "K1" || value === "K2" || value === "K3";
}

function readCanonicalTopicCodes(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const codes = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") return null;
    const code = item.trim();
    if (code.length === 0 || code.length > 100) return null;
    codes.add(code);
  }

  return [...codes].sort();
}

function readQuizQuestion(
  value: unknown,
  questionId: number,
): QuizSnapshotQuestion | null {
  if (
    !isRecord(value) ||
    typeof value.question !== "string" ||
    value.question.trim().length < 10 ||
    typeof value.explanation !== "string" ||
    value.explanation.trim().length < 20 ||
    typeof value.topic_code !== "string" ||
    !isLevelK(value.level_k) ||
    !isAnswerOption(value.correct) ||
    !isRecord(value.options)
  ) {
    return null;
  }

  const options = value.options;
  if (
    typeof options.a !== "string" ||
    options.a.trim().length < 3 ||
    typeof options.b !== "string" ||
    options.b.trim().length < 3 ||
    typeof options.c !== "string" ||
    options.c.trim().length < 3 ||
    typeof options.d !== "string" ||
    options.d.trim().length < 3
  ) {
    return null;
  }

  return {
    question_id: questionId,
    question: value.question,
    options: {
      a: options.a,
      b: options.b,
      c: options.c,
      d: options.d,
    },
    correct: value.correct,
    explanation: value.explanation,
    topic_code: value.topic_code,
    level_k: value.level_k,
  };
}

function parseQuizResponse(
  rawText: string,
  expectedTopics: SessionTopic[],
): QuizSnapshotQuestion[] | null {
  const value = parseFirstJsonObject(rawText);
  if (!value || !Array.isArray(value.questions)) return null;

  const questions: QuizSnapshotQuestion[] = [];
  for (let index = 0; index < value.questions.length; index += 1) {
    const question = readQuizQuestion(value.questions[index], index);
    if (!question) return null;
    questions.push(question);
  }

  return validateQuizQuestions(questions, expectedTopics).length === 0
    ? questions
    : null;
}

function createDemoQuizRaw(topics: SessionTopic[]): string {
  const correctOptions: AnswerOption[] = ["a", "b", "c", "d"];
  const optionOrder: AnswerOption[] = ["a", "b", "c", "d"];
  const questionCount = Math.max(
    MIN_QUIZ_QUESTIONS,
    Math.min(MAX_QUIZ_QUESTIONS, topics.length),
  );
  const questions: QuizSnapshotQuestion[] = Array.from(
    { length: questionCount },
    (_, index) => {
    const topic = topics[index % topics.length];
    const correct = correctOptions[index % correctOptions.length];
    const correctText =
      "Definir un resultado esperado antes de ejecutar la prueba.";
    const distractors = [
      "Cambiar el criterio después de observar el resultado.",
      "Omitir la precondición para acelerar la prueba.",
      "Aceptar cualquier salida sin compararla.",
    ];
    let distractorIndex = 0;
    const optionValues = optionOrder.reduce<Record<AnswerOption, string>>(
      (result, option) => {
        if (option === correct) {
          result[option] = correctText;
        } else {
          result[option] = distractors[distractorIndex];
          distractorIndex += 1;
        }
        return result;
      },
      { a: "", b: "", c: "", d: "" },
    );

    return {
      question_id: index,
      question:
        "[MODO DEMO] ¿Qué acción produce evidencia verificable para el tópico " +
        topic.code +
        "?",
      options: optionValues,
      correct,
      explanation:
        "[MODO DEMO] Definir el resultado esperado permite comparar la salida observada con un oráculo explícito.",
      topic_code: topic.code,
      level_k: topic.level_k,
    };
    },
  );

  return JSON.stringify({ questions });
}

// ──────────────────────────────────────────────────────────────
// Validación estricta de las preguntas
// ──────────────────────────────────────────────────────────────

/**
 * Valida que las preguntas del quiz cumplen con el formato esperado.
 *
 * Verifica:
 *   1. Cada pregunta tiene question, options, correct, explanation
 *   2. options tiene exactamente 4 claves: a, b, c, d
 *   3. correct es uno de: "a", "b", "c", "d"
 *   4. topic_code es uno de los esperados
 *   5. level_k es uno de: "K1", "K2", "K3"
 *   6. La cantidad total está entre 10 y 12 preguntas
 *   7. La distribución de correct no está sesgada
 *
 * @returns Array de errores (vacío si todo está bien)
 */
function validateQuizQuestions(
  questions: QuizSnapshotQuestion[],
  expectedTopics: SessionTopic[],
): string[] {
  const errors: string[] = [];
  const expectedLevelByCode = new Map(
    expectedTopics.map((topic) => [topic.code, topic.level_k]),
  );
  const coveredTopicCodes = new Set<string>();
  const correctDistribution: Record<string, number> = {
    a: 0,
    b: 0,
    c: 0,
    d: 0,
  };

  if (questions.length === 0) {
    errors.push("El LLM no generó ninguna pregunta.");
    return errors;
  }

  if (
    questions.length < MIN_QUIZ_QUESTIONS ||
    questions.length > MAX_QUIZ_QUESTIONS
  ) {
    errors.push(
      `La cantidad de preguntas (${questions.length}) no es válida. ` +
        `Debe estar entre ${MIN_QUIZ_QUESTIONS} y ${MAX_QUIZ_QUESTIONS}.`,
    );
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const prefix = `Pregunta ${i + 1}`;

    // Verificar campos obligatorios
    if (
      !q.question ||
      typeof q.question !== "string" ||
      q.question.length < 10
    ) {
      errors.push(`${prefix}: enunciado falta o es demasiado corto.`);
    }

    if (
      !q.explanation ||
      typeof q.explanation !== "string" ||
      q.explanation.length < 20
    ) {
      errors.push(`${prefix}: explicación falta o es demasiado corta.`);
    }

    // Verificar options
    if (!q.options || typeof q.options !== "object") {
      errors.push(`${prefix}: opciones faltan o no son un objeto.`);
    } else {
      for (const opt of VALID_OPTIONS) {
        if (
          !q.options[opt] ||
          typeof q.options[opt] !== "string" ||
          q.options[opt].length < 3
        ) {
          errors.push(`${prefix}: opción "${opt}" falta o es demasiado corta.`);
        }
      }
    }

    // Verificar correct
    if (!q.correct || !VALID_OPTIONS.includes(q.correct as AnswerOption)) {
      errors.push(
        `${prefix}: correct="${q.correct}" no es válido. Debe ser a, b, c, o d.`,
      );
    } else {
      correctDistribution[q.correct]++;
    }

    // Verificar topic_code
    if (!q.topic_code || !expectedLevelByCode.has(q.topic_code)) {
      errors.push(
        `${prefix}: topic_code="${q.topic_code}" no es uno de los tópicos de la sesión.`,
      );
    } else {
      coveredTopicCodes.add(q.topic_code);
    }

    // Verificar level_k
    if (!q.level_k || !["K1", "K2", "K3"].includes(q.level_k)) {
      errors.push(
        `${prefix}: level_k="${q.level_k}" no es válido. Debe ser K1, K2, o K3.`,
      );
    } else if (q.level_k !== expectedLevelByCode.get(q.topic_code)) {
      errors.push(
        `${prefix}: level_k="${q.level_k}" contradice el nivel autoritativo del tópico.`,
      );
    }
  }

  for (const topic of expectedTopics) {
    if (!coveredTopicCodes.has(topic.code)) {
      errors.push(`El tópico "${topic.code}" no tiene preguntas en el quiz.`);
    }
  }

  // Verificar distribución de respuestas correctas
  // Si todas las correctas son la misma letra, hay un problema
  const usedOptions = Object.entries(correctDistribution)
    .filter(([, count]) => count > 0)
    .map(([opt]) => opt);

  if (usedOptions.length === 1 && questions.length >= 4) {
    errors.push(
      `Todas las respuestas correctas son "${usedOptions[0]}". ` +
        `Deben variar entre a, b, c, y d.`,
    );
  }

  return errors;
}

function readPublicQuizContent(value: unknown): {
  quiz: QuizContent;
  created: boolean | null;
  evaluation: EvaluateResponse | null;
} | null {
  if (
    !isRecord(value) ||
    typeof value.attempt_id !== "string" ||
    !UUID_REGEX.test(value.attempt_id) ||
    !Array.isArray(value.questions) ||
    typeof value.total_questions !== "number" ||
    !Number.isInteger(value.total_questions) ||
    value.total_questions !== value.questions.length ||
    typeof value.generated_at !== "string" ||
    typeof value.model_provider !== "string" ||
    typeof value.model_name !== "string" ||
    (value.state !== "open" && value.state !== "completed") ||
    (value.state === "open" && value.evaluation !== null)
  ) {
    return null;
  }

  const questions: QuizQuestion[] = [];
  for (const item of value.questions) {
    if (
      !isRecord(item) ||
      typeof item.question_id !== "number" ||
      !Number.isInteger(item.question_id) ||
      item.question_id < 0 ||
      typeof item.question !== "string" ||
      !isRecord(item.options) ||
      typeof item.options.a !== "string" ||
      typeof item.options.b !== "string" ||
      typeof item.options.c !== "string" ||
      typeof item.options.d !== "string" ||
      typeof item.topic_code !== "string" ||
      !isLevelK(item.level_k) ||
      "correct" in item ||
      "explanation" in item
    ) {
      return null;
    }

    questions.push({
      question_id: item.question_id,
      question: item.question,
      options: {
        a: item.options.a,
        b: item.options.b,
        c: item.options.c,
        d: item.options.d,
      },
      topic_code: item.topic_code,
      level_k: item.level_k,
    });
  }

  const evaluation =
    value.state === "completed" ? readEvaluation(value.evaluation) : null;
  if (value.state === "completed" && !evaluation) return null;

  return {
    quiz: {
      attempt_id: value.attempt_id,
      questions,
      total_questions: value.total_questions,
      generated_at: value.generated_at,
      model_provider: value.model_provider,
      model_name: value.model_name,
    },
    created: typeof value.created === "boolean" ? value.created : null,
    evaluation,
  };
}

// ──────────────────────────────────────────────────────────────
// Route Handler: POST
// ──────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ═══════════════════════════════════════════════════════════
    // PASO 1: Extraer y validar parámetros
    // ═══════════════════════════════════════════════════════════
    const { id: sessionId } = await params;

    if (!sessionId || !UUID_REGEX.test(sessionId)) {
      return NextResponse.json(
        { error: "session_id debe ser un UUID válido" },
        { status: 400 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 2: Autenticación
    // ═══════════════════════════════════════════════════════════
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 3: Buscar la sesión
    // ═══════════════════════════════════════════════════════════
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle<SessionRow>();

    if (sessionError) {
      console.error("[quiz] Error al buscar sesión:", sessionError);
      return NextResponse.json(
        { error: "Error al buscar la sesión" },
        { status: 500 },
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: "Sesión no encontrada." },
        { status: 404 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 4: Recuperar snapshot durable (idempotencia)
    // ═══════════════════════════════════════════════════════════
    const adminClient = createAdminClient();
    const { data: storedAttempt, error: storedAttemptError } =
      await adminClient.rpc("get_quiz_attempt_public", {
        p_user_id: user.id,
        p_session_id: sessionId,
      });

    if (storedAttemptError) {
      console.error("[quiz] Error leyendo snapshot privado:", storedAttemptError);
      return NextResponse.json(
        { error: "Error al recuperar el quiz." },
        { status: 500 },
      );
    }

    if (storedAttempt) {
      const parsedAttempt = readPublicQuizContent(storedAttempt);
      if (!parsedAttempt) {
        console.error("[quiz] Snapshot público inválido.");
        return NextResponse.json(
          { error: "El quiz almacenado tiene un formato inválido." },
          { status: 500 },
        );
      }

      let adaptation = null;
      if (parsedAttempt.evaluation) {
        const { data: adaptationData, error: adaptationError } =
          await adminClient.rpc("apply_session_adaptation_v2", {
            p_user_id: user.id,
            p_session_id: sessionId,
          });
        adaptation = readAdaptResponse(adaptationData);
        if (
          adaptationError ||
          !adaptation ||
          adaptation.action !== parsedAttempt.evaluation.action
        ) {
          console.error(
            "[quiz] No se pudo rehidratar la adaptación:",
            adaptationError,
          );
          return NextResponse.json(
            { error: "No se pudo recuperar la adaptación del plan." },
            { status: 500 },
          );
        }
      }

      return NextResponse.json({
        quiz: parsedAttempt.quiz,
        cached: true,
        evaluation: parsedAttempt.evaluation,
        adaptation,
      });
    }

    if (session.status !== "active") {
      return NextResponse.json(
        { error: "La sesión debe completar la fase teórica antes del quiz." },
        { status: 409 },
      );
    }

    const sessionTopicCodes = readCanonicalTopicCodes(session.topic_codes);
    if (!sessionTopicCodes) {
      return NextResponse.json(
        { error: "La sesión no tiene tópicos válidos para generar el quiz." },
        { status: 400 },
      );
    }
    if (sessionTopicCodes.length > MAX_QUIZ_TOPICS_PER_SESSION) {
      return NextResponse.json(
        {
          error:
            `La sesión contiene ${sessionTopicCodes.length} tópicos, pero el máximo evaluable es ` +
            `${MAX_QUIZ_TOPICS_PER_SESSION}. Regenera el plan con más días.`,
          code: "QUIZ_SESSION_TOO_DENSE",
        },
        { status: 409 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 5: Obtener datos del plan y tópicos
    // ═══════════════════════════════════════════════════════════
    const { data: plan } = await supabase
      .from("study_plans")
      .select("id, document_id, objective_days, start_date, estimated_end_date")
      .eq("id", session.study_plan_id)
      .eq("user_id", user.id)
      .maybeSingle<
        Pick<
          StudyPlanRow,
          | "id"
          | "document_id"
          | "objective_days"
          | "start_date"
          | "estimated_end_date"
        >
      >();

    if (!plan) {
      return NextResponse.json(
        { error: "No se encontró el plan asociado a esta sesión." },
        { status: 404 },
      );
    }

    // Obtener topics_json del documento
    const { data: doc } = await supabase
      .from("documents")
      .select("topics_json")
      .eq("id", plan.document_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const topicsJson: TopicsJson = doc?.topics_json || {};
    const invalidTopicCodes = sessionTopicCodes.filter((code) => {
      const topic = topicsJson[code];
      return (
        !topic ||
        typeof topic.name !== "string" ||
        topic.name.trim().length === 0 ||
        typeof topic.text !== "string" ||
        !isLevelK(topic.level_k)
      );
    });
    if (invalidTopicCodes.length > 0) {
      return NextResponse.json(
        {
          error:
            "La sesión contiene tópicos que no existen en el documento autoritativo.",
          code: "QUIZ_SESSION_TOPICS_INVALID",
        },
        { status: 409 },
      );
    }

    // Obtener progreso de los tópicos (para saber historial de errores)
    const { data: progressRows } = await supabase
      .from("topic_progress")
      .select("topic_code, status, attempts, best_score, level_k")
      .eq("study_plan_id", plan.id)
      .eq("user_id", user.id)
      .in("topic_code", sessionTopicCodes);

    const progressMap = new Map();
    if (progressRows) {
      for (const row of progressRows) {
        progressMap.set(row.topic_code, row);
      }
    }

    // Construir array de SessionTopic para el prompt builder
    const sessionTopics: SessionTopic[] = sessionTopicCodes.map(
      (code: string) => {
        const topicData = topicsJson[code];
        const progress = progressMap.get(code);
        return {
          code,
          name: topicData.name,
          level_k: topicData.level_k,
          syllabus_text: topicData.text,
          progress_status: progress?.status || "pending",
          attempts: progress?.attempts || 0,
          best_score: progress?.best_score || 0,
        };
      },
    );

    if (sessionTopics.length === 0) {
      return NextResponse.json(
        { error: "La sesión no tiene tópicos asignados." },
        { status: 400 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 6: Construir prompts
    // ═══════════════════════════════════════════════════════════
    const systemPrompt = buildQuizSystemPrompt();
    const userPrompt = buildQuizUserPrompt(
      sessionTopics,
      session.day_number,
      session.session_type,
      session.attempt_number,
    );

    const operationFingerprint = createQuizAiFingerprint(
      JSON.stringify({ sessionId, systemPrompt, userPrompt }),
    );
    const operationClaim = await claimQuizAiOperation(adminClient, {
      userId: user.id,
      sessionId,
      operation: "generate",
      fingerprint: operationFingerprint,
    });

    if (operationClaim.outcome !== "acquired") {
      const conflict = operationClaim.outcome === "conflict";
      return NextResponse.json(
        {
          error: conflict
            ? "La generación pendiente no coincide con esta sesión. Recarga e intenta de nuevo."
            : "El quiz se está generando. Intenta de nuevo en unos segundos.",
          code: conflict
            ? "QUIZ_GENERATION_CONFLICT"
            : "QUIZ_GENERATION_IN_PROGRESS",
        },
        { status: 409, headers: { "Retry-After": "2" } },
      );
    }

    const claimInput = {
      userId: user.id,
      sessionId,
      operation: "generate" as const,
      fingerprint: operationFingerprint,
      claimToken: operationClaim.claimToken,
    };
    const releaseClaim = async () => {
      try {
        await releaseQuizAiOperation(adminClient, claimInput);
      } catch (error) {
        console.error("[quiz] No se pudo liberar la reserva de IA:", error);
      }
    };

    // ═══════════════════════════════════════════════════════════
    // PASO 7: Generar con runtime IA centralizado
    // ═══════════════════════════════════════════════════════════
    console.log(
      `[quiz] Generando quiz para sesión ${sessionId} ` +
        `(${sessionTopics.length} tópicos)`,
    );

    const ai = await executeAiJson<QuizSnapshotQuestion[]>({
      request,
      userId: user.id,
      feature: "quiz",
      systemPrompt,
      userPrompts: [userPrompt],
      maxCompletionTokensPerAttempt: MAX_QUIZ_COMPLETION_TOKENS,
      timeoutMs: QUIZ_TIMEOUT_MS,
      parse: (rawText) => parseQuizResponse(rawText, sessionTopics),
      createDemoRaw: () => createDemoQuizRaw(sessionTopics),
      tuning: () => ({ temperature: 0.8 }),
    }).catch(async (error: unknown) => {
      await releaseClaim();
      throw error;
    });

    if (!ai.ok) {
      await releaseClaim();
      return NextResponse.json(ai.body, { status: ai.status });
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 8: Persistir el snapshot privado antes de responder
    // ═══════════════════════════════════════════════════════════
    const topicNames = new Map(
      sessionTopics.map((topic) => [topic.code, topic.name]),
    );
    const generatedAt = new Date().toISOString();
    const questionsForStorage: Record<string, unknown>[] = ai.value.map(
      (question) => ({
        ...question,
        topic_name: topicNames.get(question.topic_code) ?? question.topic_code,
      }),
    );

    const { data: persistedAttempt, error: persistError } =
      await adminClient.rpc("store_quiz_attempt_claimed", {
        p_user_id: user.id,
        p_session_id: sessionId,
        p_questions: questionsForStorage,
        p_model_provider: ai.provider ?? "demo",
        p_model_name: ai.model ?? "fixture-ai05",
        p_generated_at: generatedAt,
        p_request_fingerprint: operationFingerprint,
        p_claim_token: operationClaim.claimToken,
      });

    if (persistError) {
      await releaseClaim();
      console.error("[quiz] Error persistiendo snapshot privado:", persistError);
      const status =
        persistError.message === "QUIZ_SESSION_COMPLETED" ? 409 : 500;
      return NextResponse.json(
        {
          error:
            status === 409
              ? "Esta sesión ya fue evaluada."
              : "No se pudo guardar el quiz generado.",
        },
        { status },
      );
    }

    const parsedAttempt = readPublicQuizContent(persistedAttempt);
    if (!parsedAttempt) {
      await releaseClaim();
      console.error("[quiz] RPC de persistencia retornó un contrato inválido.");
      return NextResponse.json(
        { error: "El quiz generado tiene un formato inválido." },
        { status: 500 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 9: Retornar el quiz
    // ═══════════════════════════════════════════════════════════
    return NextResponse.json({
      quiz: parsedAttempt.quiz,
      cached: parsedAttempt.created === false,
      evaluation: parsedAttempt.evaluation,
      adaptation: null,
    });
  } catch {
    console.error("[quiz] Error inesperado.");

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
