// ─────────────────────────────────────────────────────────────────
// app/api/sessions/[id]/evaluate/route.ts
// Route Handler: evalúa las respuestas del quiz de una sesión.
//
// Método: POST
// Auth: Requiere sesión válida (cookie JWT de Supabase)
// Params: id — UUID de la sesión
// Body: { answers: UserAnswer[] }
//
// Response (200): EvaluateResponse
// Response (401): { error: "No autenticado" }
// Response (400): { error: "Descripción del problema" }
// Response (404): { error: "Sesión no encontrada" }
// Response (409): { error: "Sesión ya evaluada" }
// Response (500): { error: "Error interno del servidor" }
//
// FLUJO:
//   1. Autenticar usuario
//   2. Validar UUID y estado de la sesión (no completada)
//   3. Validar body (array de respuestas completo)
//   4. Calcular score determinísticamente
//   5. Llamar al LLM para análisis cualitativo (best-effort)
//   6. Insertar respuestas en tabla answers
//   7. Actualizar sesión: score, status, completed_at, action_taken
//   8. Retornar EvaluateResponse
//
// IDEMPOTENCIA:
//   Si la sesión ya tiene status = 'completed', se rechaza con 409.
//   Esto previene doble evaluación accidental.
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createModelRuntimes,
  getModelErrorStatus,
  isModelTimeout,
} from "@/lib/ai/model-cascade";
import {
  buildEvaluateSystemPrompt,
  buildEvaluateUserPrompt,
} from "@/lib/prompts/evaluate";
import type { AnswerOption, LevelK, ActionTaken, MethodUsed } from "@/types";
import type {
  UserAnswer,
  EvaluateResponse,
  FailedTopic,
  ErrorPattern,
} from "@/types/evaluate";

// ─── Forzar Node.js runtime ─────────────────────────────────────
export const runtime = "nodejs";

// ─── Constantes ──────────────────────────────────────────────────
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVALUATE_TIMEOUT_MS = 45_000; // 45 segundos (menos que quiz)

const VALID_OPTIONS: AnswerOption[] = ["a", "b", "c", "d"];
const VALID_LEVELS: LevelK[] = ["K1", "K2", "K3"];

// ─── Umbrales del sistema adaptativo ─────────────────────────────
// Estos valores definen las acciones del sistema.
// Se centralizan aquí para que SE-07 pueda importarlos si es necesario.
const ADVANCE_THRESHOLD = 70; // score >= 70% → advance
const REINFORCE_THRESHOLD = 50; // score 50-69% → reinforce
// score < 50% → restructure

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/**
 * Determina la acción del sistema adaptativo basándose en el score.
 */
function determineAction(score: number): ActionTaken {
  if (score >= ADVANCE_THRESHOLD) return "advance";
  if (score >= REINFORCE_THRESHOLD) return "reinforce";
  return "restructure";
}

/**
 * Calcula los tópicos fallidos agrupados por topic_code.
 */
function calculateFailedTopics(
  answers: UserAnswer[],
  topicNames: Map<string, string>,
): FailedTopic[] {
  // Agrupar por topic_code
  const topicStats = new Map<string, { failed: number; total: number }>();

  for (const answer of answers) {
    const stats = topicStats.get(answer.topic_code) || {
      failed: 0,
      total: 0,
    };
    stats.total++;
    if (answer.user_answer !== answer.correct) {
      stats.failed++;
    }
    topicStats.set(answer.topic_code, stats);
  }

  // Solo retornar tópicos con al menos 1 fallo
  const failedTopics: FailedTopic[] = [];
  for (const [code, stats] of topicStats) {
    if (stats.failed > 0) {
      failedTopics.push({
        topic_code: code,
        topic_name: topicNames.get(code) || code,
        questions_failed: stats.failed,
        questions_total: stats.total,
      });
    }
  }

  return failedTopics;
}

/**
 * Parsea la respuesta del LLM de evaluación.
 * Maneja JSON envuelto en bloques de código markdown.
 */
function parseEvaluateResponse(rawContent: string): {
  error_patterns: ErrorPattern[];
  feedback_message: string;
  next_method: MethodUsed;
  reinforcement_minutes: number;
} | null {
  try {
    // Intentar parsear directamente
    let content = rawContent.trim();

    // Remover bloques de código markdown si el LLM los incluyó
    if (content.startsWith("```")) {
      const lines = content.split("\n");
      // Remover primera línea (```json) y última (```)
      const startIndex = lines[0].includes("json") ? 1 : 1;
      const endIndex =
        lines[lines.length - 1] === "```" ? lines.length - 1 : lines.length;
      content = lines.slice(startIndex, endIndex).join("\n");
    }

    const parsed = JSON.parse(content);

    // Validar campos obligatorios
    if (
      !parsed.feedback_message ||
      typeof parsed.feedback_message !== "string"
    ) {
      console.error("[evaluate] feedback_message faltante o inválido");
      return null;
    }

    // Validar error_patterns
    const errorPatterns: ErrorPattern[] = [];
    if (Array.isArray(parsed.error_patterns)) {
      for (const ep of parsed.error_patterns) {
        if (ep.pattern && ep.frequency && ep.suggestion) {
          errorPatterns.push({
            pattern: String(ep.pattern),
            frequency: ["alta", "media", "baja"].includes(ep.frequency)
              ? ep.frequency
              : "media",
            suggestion: String(ep.suggestion),
          });
        }
      }
    }

    // Validar next_method
    const validMethods: MethodUsed[] = ["theory", "examples", "analogies"];
    const nextMethod = validMethods.includes(parsed.next_method)
      ? parsed.next_method
      : "theory";

    // Validar reinforcement_minutes
    const reinforcementMinutes =
      typeof parsed.reinforcement_minutes === "number" &&
      parsed.reinforcement_minutes >= 0
        ? Math.round(parsed.reinforcement_minutes)
        : 0;

    return {
      error_patterns: errorPatterns,
      feedback_message: parsed.feedback_message,
      next_method: nextMethod,
      reinforcement_minutes: reinforcementMinutes,
    };
  } catch {
    console.warn("[evaluate] Respuesta del LLM con JSON inválido.");
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// POST /api/sessions/[id]/evaluate
// ──────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    // ═════════════════════════════════════════════════════════
    // 1. AUTENTICACIÓN
    // ═════════════════════════════════════════════════════════
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // ═════════════════════════════════════════════════════════
    // 2. VALIDAR UUID
    // ═════════════════════════════════════════════════════════
    const { id: sessionId } = await params;

    if (!sessionId || !UUID_REGEX.test(sessionId)) {
      return NextResponse.json(
        { error: "ID de sesión inválido. Debe ser un UUID válido." },
        { status: 400 },
      );
    }

    // ═════════════════════════════════════════════════════════
    // 3. CARGAR Y VALIDAR SESIÓN
    // ═════════════════════════════════════════════════════════
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Sesión no encontrada o no pertenece al usuario." },
        { status: 404 },
      );
    }

    // Validar que la sesión NO esté ya completada (idempotencia)
    if (session.status === "completed") {
      return NextResponse.json(
        {
          error: "Esta sesión ya fue evaluada. No se puede evaluar dos veces.",
        },
        { status: 409 },
      );
    }

    // Cargar el plan en una query separada. Esto evita depender de
    // inferencia de relaciones en los tipos generados de Supabase.
    const { data: plan } = await supabase
      .from("study_plans")
      .select("id, document_id")
      .eq("id", session.study_plan_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!plan) {
      return NextResponse.json(
        { error: "No se encontró el plan asociado a esta sesión." },
        { status: 404 },
      );
    }

    // Defensa adicional contra duplicados: si por un fallo parcial
    // quedaron respuestas guardadas pero la sesión no quedó completed,
    // no insertamos otra tanda de answers.
    const { count: existingAnswersCount } = await supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("user_id", user.id);

    if ((existingAnswersCount || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Esta sesión ya tiene respuestas guardadas. No se puede evaluar dos veces.",
        },
        { status: 409 },
      );
    }

    // ═════════════════════════════════════════════════════════
    // 4. VALIDAR BODY
    // ═════════════════════════════════════════════════════════
    let body: { answers?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Body inválido. Se esperaba JSON." },
        { status: 400 },
      );
    }

    if (!body.answers || !Array.isArray(body.answers)) {
      return NextResponse.json(
        { error: "Campo 'answers' requerido como array." },
        { status: 400 },
      );
    }

    const userAnswers = body.answers as UserAnswer[];

    // Validar cantidad esperada. SE-04 genera 10-12 preguntas;
    // aceptar menos permitiría envíos parciales por bypass de UI.
    if (userAnswers.length < 10 || userAnswers.length > 12) {
      return NextResponse.json(
        { error: "El quiz debe enviar entre 10 y 12 respuestas completas." },
        { status: 400 },
      );
    }

    const seenQuestionIds = new Set<number>();

    // Validar cada respuesta individualmente
    for (let i = 0; i < userAnswers.length; i++) {
      const a = userAnswers[i];

      if (typeof a.question_id !== "number" || a.question_id < 0) {
        return NextResponse.json(
          { error: `Respuesta ${i}: question_id debe ser un número válido.` },
          { status: 400 },
        );
      }

      if (seenQuestionIds.has(a.question_id)) {
        return NextResponse.json(
          {
            error: `Respuesta ${i}: question_id duplicado (${a.question_id}).`,
          },
          { status: 400 },
        );
      }
      seenQuestionIds.add(a.question_id);

      if (!a.question_text || typeof a.question_text !== "string") {
        return NextResponse.json(
          { error: `Respuesta ${i}: question_text es requerido.` },
          { status: 400 },
        );
      }

      if (!a.options || typeof a.options !== "object") {
        return NextResponse.json(
          { error: `Respuesta ${i}: options es requerido.` },
          { status: 400 },
        );
      }

      for (const option of VALID_OPTIONS) {
        if (!a.options[option] || typeof a.options[option] !== "string") {
          return NextResponse.json(
            {
              error: `Respuesta ${i}: opción "${option}" falta o es inválida.`,
            },
            { status: 400 },
          );
        }
      }

      if (!VALID_OPTIONS.includes(a.user_answer)) {
        return NextResponse.json(
          {
            error: `Respuesta ${i}: user_answer debe ser "a", "b", "c" o "d". Recibido: "${a.user_answer}"`,
          },
          { status: 400 },
        );
      }

      if (!VALID_OPTIONS.includes(a.correct)) {
        return NextResponse.json(
          {
            error: `Respuesta ${i}: correct debe ser "a", "b", "c" o "d". Recibido: "${a.correct}"`,
          },
          { status: 400 },
        );
      }

      if (!VALID_LEVELS.includes(a.level_k)) {
        return NextResponse.json(
          {
            error: `Respuesta ${i}: level_k debe ser K1, K2 o K3. Recibido: "${a.level_k}"`,
          },
          { status: 400 },
        );
      }

      if (!a.topic_code || typeof a.topic_code !== "string") {
        return NextResponse.json(
          { error: `Respuesta ${i}: topic_code es requerido.` },
          { status: 400 },
        );
      }
    }

    // ═════════════════════════════════════════════════════════
    // 5. CALCULAR SCORE (DETERMINÍSTICO)
    // ═════════════════════════════════════════════════════════
    // El score es una simple proporción. NO depende del LLM.
    let correctCount = 0;
    for (const answer of userAnswers) {
      if (answer.user_answer === answer.correct) {
        correctCount++;
      }
    }

    const totalQuestions = userAnswers.length;
    // Math.round para evitar decimales (70.5 → 71, no 70.500...)
    const score = Math.round((correctCount / totalQuestions) * 100);
    const action = determineAction(score);

    console.log(
      `[evaluate] Sesión ${sessionId}: ${correctCount}/${totalQuestions} = ${score}% → ${action}`,
    );

    // ═════════════════════════════════════════════════════════
    // 6. OBTENER NOMBRES DE TÓPICOS (para failed_topics)
    // ═════════════════════════════════════════════════════════
    // Necesitamos los nombres legibles de los tópicos para el response.
    // Los obtenemos de documents.topics_json.
    const topicNames = new Map<string, string>();

    const { data: doc } = await supabase
      .from("documents")
      .select("topics_json")
      .eq("id", plan.document_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (doc?.topics_json) {
      const topicsJson = doc.topics_json as Record<
        string,
        { name?: string; text?: string; level_k?: string }
      >;
      for (const [code, entry] of Object.entries(topicsJson)) {
        topicNames.set(code, entry.name || code);
      }
    }

    const failedTopics = calculateFailedTopics(userAnswers, topicNames);

    // ═════════════════════════════════════════════════════════
    // 7. ANÁLISIS CUALITATIVO CON LLM (BEST-EFFORT)
    // ═════════════════════════════════════════════════════════
    // Si el LLM falla o no hay key configurada, usamos fallbacks.
    let errorPatterns: ErrorPattern[] = [];
    let feedbackMessage = "";
    let nextMethod: MethodUsed = session.method_used as MethodUsed;
    let reinforcementMinutes = 0;

    const candidates = createModelRuntimes({
      timeoutMs: EVALUATE_TIMEOUT_MS,
      geminiModels: [process.env.GEMINI_SESSION_EVALUATE_MODEL],
      openaiModels: [process.env.OPENAI_SESSION_EVALUATE_MODEL],
      providers: ["gemini", "openai"],
      maxRetries: 0,
    });

    if (candidates.length > 0) {
      const systemPrompt = buildEvaluateSystemPrompt();
      const userPrompt = buildEvaluateUserPrompt(
        userAnswers,
        score,
        correctCount,
        totalQuestions,
        session.method_used as MethodUsed,
        session.attempt_number || 1,
      );

      for (const candidate of candidates) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          EVALUATE_TIMEOUT_MS,
        );

        try {
          console.log(
            `[evaluate] Llamando a ${candidate.provider}/${candidate.model} para análisis cualitativo...`,
          );

          const completion = await candidate.client.chat.completions.create(
            {
              model: candidate.model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              response_format: { type: "json_object" },
              temperature: 0.4, // Baja — queremos análisis consistente, no creativo
              max_tokens: 4000, // Suficiente para error_patterns + feedback en español (estaba en 2000 que trunca JSON)
            },
            { signal: controller.signal },
          );

          const rawContent = completion.choices?.[0]?.message?.content;
          const parsed = rawContent ? parseEvaluateResponse(rawContent) : null;

          if (!parsed) {
            console.warn(
              `[evaluate] ${candidate.provider}/${candidate.model} devolvió una respuesta inválida; probando el siguiente candidato.`,
            );
            continue;
          }

          errorPatterns = parsed.error_patterns;
          feedbackMessage = parsed.feedback_message;
          nextMethod = parsed.next_method;
          reinforcementMinutes = parsed.reinforcement_minutes;
          console.log(
            `[evaluate] LLM retornó: ${errorPatterns.length} patrones, método=${nextMethod}, refuerzo=${reinforcementMinutes}min`,
          );
          break;
        } catch (llmError) {
          const failure =
            controller.signal.aborted || isModelTimeout(llmError)
              ? "timeout"
              : `error de proveedor (status=${getModelErrorStatus(llmError)})`;
          console.warn(
            `[evaluate] ${candidate.provider}/${candidate.model}: ${failure}; probando el siguiente candidato.`,
          );
        } finally {
          clearTimeout(timeoutId);
        }
      }
    } else {
      console.log(
        "[evaluate] Sin LLM configurado. Usando evaluación determinística pura.",
      );
    }

    // ─── Fallback si el LLM no generó feedback ──────────────
    if (!feedbackMessage) {
      if (score >= ADVANCE_THRESHOLD) {
        feedbackMessage = `Obtuviste ${score}% (${correctCount} de ${totalQuestions} correctas). Has demostrado un buen dominio de los conceptos evaluados. Continúa con el siguiente tópico de tu plan de estudio.`;
      } else if (score >= REINFORCE_THRESHOLD) {
        feedbackMessage = `Obtuviste ${score}% (${correctCount} de ${totalQuestions} correctas). Estás cerca del umbral de aprobación. Una sesión de refuerzo corta te ayudará a consolidar los conceptos que necesitan más trabajo.`;
      } else {
        feedbackMessage = `Obtuviste ${score}% (${correctCount} de ${totalQuestions} correctas). Algunos conceptos necesitan más trabajo. Te recomendamos revisar los tópicos con un enfoque diferente para fortalecer tu comprensión.`;
      }
    }

    // Fallback reinforcement_minutes basado en score
    if (reinforcementMinutes === 0 && score < ADVANCE_THRESHOLD) {
      reinforcementMinutes = score >= REINFORCE_THRESHOLD ? 15 : 30;
    }

    // ═════════════════════════════════════════════════════════
    // 8. PERSISTIR EN SUPABASE
    // ═════════════════════════════════════════════════════════

    // ─── 8a. Insertar respuestas en tabla answers ───────────
    // Construimos el array de inserts siguiendo el tipo AnswerInsert
    // de database.ts. Cada pregunta → una fila en answers.
    const answerInserts = userAnswers.map((a) => ({
      session_id: sessionId,
      user_id: user.id,
      question_text: a.question_text,
      options_json: a.options,
      correct_answer: a.correct,
      user_answer: a.user_answer,
      is_correct: a.user_answer === a.correct,
      topic_code: a.topic_code,
      level_k: a.level_k || null,
      explanation: a.explanation || null,
    }));

    const { error: insertError } = await supabase
      .from("answers")
      .insert(answerInserts);

    if (insertError) {
      console.error("[evaluate] Error insertando answers:", insertError);
      return NextResponse.json(
        {
          error: "Error al guardar las respuestas. Intenta de nuevo.",
        },
        { status: 500 },
      );
    }

    console.log(
      `[evaluate] ${answerInserts.length} respuestas insertadas en answers`,
    );

    // ─── 8b. Actualizar sesión ──────────────────────────────
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        score_percent: score,
        action_taken: action,
        status: "completed" as const,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[evaluate] Error actualizando sesión:", updateError);
      // Las respuestas YA se guardaron. El error de update es menos
      // grave — el usuario puede reintentar o un admin puede corregir.
      // Logueamos pero no fallamos por completo.
      console.warn(
        "[evaluate] ADVERTENCIA: Respuestas guardadas pero sesión no actualizada.",
      );
    } else {
      console.log(
        `[evaluate] Sesión ${sessionId} actualizada: status=completed, score=${score}%, action=${action}`,
      );
    }

    // ═════════════════════════════════════════════════════════
    // 9. CONSTRUIR Y RETORNAR RESPONSE
    // ═════════════════════════════════════════════════════════
    const response: EvaluateResponse = {
      score,
      correct_count: correctCount,
      total_questions: totalQuestions,
      action,
      failed_topics: failedTopics,
      error_patterns: errorPatterns,
      feedback_message: feedbackMessage,
      next_method: nextMethod,
      reinforcement_minutes: reinforcementMinutes,
      evaluated_at: new Date().toISOString(),
    };

    const elapsed = Date.now() - startTime;
    console.log(`[evaluate] Completado en ${elapsed}ms`);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[evaluate] Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
