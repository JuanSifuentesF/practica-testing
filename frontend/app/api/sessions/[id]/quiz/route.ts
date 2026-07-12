// ─────────────────────────────────────────────────────────────────
// app/api/sessions/[id]/quiz/route.ts
// Route Handler: genera preguntas de quiz ISTQB para una sesión.
//
// Método: POST
// Auth: Requiere sesión válida (cookie JWT de Supabase)
// Params: id — UUID de la sesión
// Body (opcional):
//   {
//     force?: boolean  // true = regenerar aunque ya exista en cache
//   }
//
// Response (200): { quiz: QuizContent, cached: boolean }
// Response (401): { error: "No autenticado" }
// Response (400): { error: "Descripción del problema" }
// Response (404): { error: "Sesión no encontrada" }
// Response (500): { error: "Error interno del servidor" }
// Response (502): { error: "Error en la generación del quiz" }
//
// IDEMPOTENCIA:
//   El quiz se almacena en un Map en memoria durante el lifetime
//   del servidor Next.js. No existe columna quiz_content en DB.
//   El cache se pierde al reiniciar, hacer HMR o redeployar.
//
// NOTA: A diferencia de theory_content, el quiz NO se persiste
// en la tabla sessions. Las preguntas son efímeras; solo las
// RESPUESTAS del usuario se guardarán en la tabla answers (SE-06).
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createModelRuntimes,
  getModelErrorStatus,
  isModelTimeout,
} from "@/lib/ai/model-cascade";
import { buildQuizSystemPrompt, buildQuizUserPrompt } from "@/lib/prompts/quiz";
import type {
  SessionRow,
  StudyPlanRow,
  TopicsJson,
  AnswerOption,
} from "@/types";
import type { SessionTopic } from "@/types/sessions";
import type { QuizQuestion, QuizContent } from "@/types/quiz";

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

// Opciones válidas de respuesta
const VALID_OPTIONS: AnswerOption[] = ["a", "b", "c", "d"];

// ─── Cache en memoria ────────────────────────────────────────────
// Map de session_id → QuizContent para evitar regenerar el quiz
// si el usuario recarga la página durante el quiz.
// Este cache vive mientras el servidor Next.js esté corriendo.
// Se pierde al reiniciar — esto es aceptable porque el quiz
// no se evalúa hasta que el usuario lo envía (SE-06).
const quizCache = new Map<string, QuizContent>();

// ──────────────────────────────────────────────────────────────
// Parser defensivo del response del LLM
// ──────────────────────────────────────────────────────────────

/**
 * Extrae y parsea el JSON del response del LLM.
 *
 * Maneja los mismos casos edge que el parser de SE-02:
 *   - Texto introductorio antes del JSON
 *   - Bloques de código markdown (```json ... ```)
 *   - Texto final después del JSON
 */
function parseQuizResponse(rawText: string): QuizQuestion[] | null {
  let text = rawText.trim();

  // ─── Intentar extraer de bloque markdown ────────────────
  const markdownMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (markdownMatch) {
    text = markdownMatch[1].trim();
  }

  // ─── Intentar encontrar el JSON delimitado por {} ───────
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(text);

    // Verificar que tiene la estructura esperada
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      return null;
    }

    return parsed.questions as QuizQuestion[];
  } catch {
    return null;
  }
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
  questions: QuizQuestion[],
  expectedTopicCodes: string[],
): string[] {
  const errors: string[] = [];
  const expectedCodesSet = new Set(expectedTopicCodes);
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

  if (questions.length < 10 || questions.length > 12) {
    errors.push(
      `La cantidad de preguntas (${questions.length}) no es válida. ` +
        `Debe estar entre 10 y 12.`,
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
    if (!q.topic_code || !expectedCodesSet.has(q.topic_code)) {
      errors.push(
        `${prefix}: topic_code="${q.topic_code}" no es uno de los tópicos de la sesión.`,
      );
    }

    // Verificar level_k
    if (!q.level_k || !["K1", "K2", "K3"].includes(q.level_k)) {
      errors.push(
        `${prefix}: level_k="${q.level_k}" no es válido. Debe ser K1, K2, o K3.`,
      );
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

    // Leer body (opcional — solo para el flag 'force')
    let force = false;
    try {
      const body = await request.json();
      if (body && typeof body.force === "boolean") {
        force = body.force;
      }
    } catch {
      // Body vacío o no-JSON es aceptable — force queda en false
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
    // PASO 4: Verificar caché en memoria (idempotencia)
    // ═══════════════════════════════════════════════════════════
    if (!force) {
      const cached = quizCache.get(sessionId);
      if (cached) {
        console.log(`[quiz] Retornando quiz cacheado para sesión ${sessionId}`);
        return NextResponse.json({
          quiz: cached,
          cached: true,
        });
      }
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

    // Obtener progreso de los tópicos (para saber historial de errores)
    const { data: progressRows } = await supabase
      .from("topic_progress")
      .select("topic_code, status, attempts, best_score, level_k")
      .eq("study_plan_id", plan.id)
      .eq("user_id", user.id)
      .in("topic_code", session.topic_codes || []);

    const progressMap = new Map();
    if (progressRows) {
      for (const row of progressRows) {
        progressMap.set(row.topic_code, row);
      }
    }

    // Construir array de SessionTopic para el prompt builder
    const sessionTopics: SessionTopic[] = (session.topic_codes || []).map(
      (code: string) => {
        const topicData = topicsJson[code];
        const progress = progressMap.get(code);
        return {
          code,
          name: topicData?.name || code,
          level_k: topicData?.level_k || progress?.level_k || "K1",
          syllabus_text: topicData?.text || "",
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

    // ═══════════════════════════════════════════════════════════
    // PASO 7: Llamar al LLM con cascada Gemini → OpenAI
    // ═══════════════════════════════════════════════════════════
    const modelRuntimes = createModelRuntimes({
      timeoutMs: QUIZ_TIMEOUT_MS,
      geminiModels: [process.env.GEMINI_QUIZ_MODEL],
      openaiModels: [process.env.OPENAI_QUIZ_MODEL],
      maxRetries: 2,
    });

    console.log(
      `[quiz] Generando quiz para sesión ${sessionId} ` +
        `(${sessionTopics.length} tópicos)`,
    );

    const expectedCodes = session.topic_codes || [];
    let questionsWithIds: QuizQuestion[] | null = null;
    let modelRuntime: (typeof modelRuntimes)[number] | null = null;
    let elapsed = 0;
    let tokensUsed = 0;
    let allAttemptsTimedOut = modelRuntimes.length > 0;

    for (const candidate of modelRuntimes) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), candidate.timeoutMs);
      const startTime = Date.now();

      try {
        const completion = await candidate.client.chat.completions.create(
          {
            model: candidate.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.8,
            // Temperature 0.8 (vs 0.7 para teoría):
            // Queremos más variedad en las preguntas. Un temperature más
            // alto genera distractores más creativos y preguntas menos
            // predecibles. Si siempre usamos 0.7, el quiz de hoy sería
            // muy similar al quiz de ayer para el mismo tópico.
          },
          { signal: controller.signal },
        );

        const parsedQuestions = parseQuizResponse(
          completion.choices[0]?.message?.content || "",
        );
        if (!parsedQuestions) {
          allAttemptsTimedOut = false;
          continue;
        }

        const candidateQuestions: QuizQuestion[] = parsedQuestions.map(
          (q, index) => ({
            ...q,
            question_id: index,
            // Normalizar correct a minúsculas por si el LLM retorna "A" en vez de "a"
            correct: q.correct?.toLowerCase() as AnswerOption,
          }),
        );
        const structuralErrors = validateQuizQuestions(
          candidateQuestions,
          expectedCodes,
        ).filter(
          (error) => !error.startsWith("Todas las respuestas correctas"),
        );
        if (structuralErrors.length > 0) {
          allAttemptsTimedOut = false;
          continue;
        }

        questionsWithIds = candidateQuestions;
        modelRuntime = candidate;
        elapsed = Date.now() - startTime;
        tokensUsed = completion.usage?.total_tokens || 0;
        break;
      } catch (llmError) {
        const status = getModelErrorStatus(llmError);
        if (!isModelTimeout(llmError) && status !== 408 && status !== 504) {
          allAttemptsTimedOut = false;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!questionsWithIds || !modelRuntime) {
      return NextResponse.json(
        {
          error:
            allAttemptsTimedOut
              ? "Los modelos de IA agotaron el tiempo de respuesta. Intenta de nuevo."
              : "No se pudo generar un quiz válido. Intenta de nuevo.",
        },
        { status: allAttemptsTimedOut ? 504 : 502 },
      );
    }

    console.log(
      `[quiz] LLM respondió en ${elapsed}ms, ` +
        `${tokensUsed} tokens, modelo=${modelRuntime.model}`,
    );

    // ═══════════════════════════════════════════════════════════
    // PASO 8: Construir QuizContent y cachear
    // ═══════════════════════════════════════════════════════════
    const quizContent: QuizContent = {
      questions: questionsWithIds,
      total_questions: questionsWithIds.length,
      generated_at: new Date().toISOString(),
      model_provider: modelRuntime.provider,
      model_name: modelRuntime.model,
    };

    // Guardar en cache en memoria
    quizCache.set(sessionId, quizContent);

    console.log(
      `[quiz] Quiz generado: ${questionsWithIds.length} preguntas, ` +
        `${elapsed}ms, ${tokensUsed} tokens, cacheado en memoria`,
    );

    // ═══════════════════════════════════════════════════════════
    // PASO 9: Retornar el quiz
    // ═══════════════════════════════════════════════════════════
    return NextResponse.json({
      quiz: quizContent,
      cached: false,
    });
  } catch {
    console.error("[quiz] Error inesperado.");

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
