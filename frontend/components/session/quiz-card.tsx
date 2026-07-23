// ============================================================
// components/session/quiz-card.tsx
// Orquestador principal del quiz de la sesión de estudio
// ============================================================
// TIPO: Client Component (orquesta estado, fetches, y sub-componentes)
//
// RESPONSABILIDADES:
//   1. Hacer fetch a POST /api/sessions/[id]/quiz al montar
//   2. Gestionar el estado de respuestas en Record<number, AnswerOption>
//   3. Renderizar QuizQuestionView + QuizNavigation + QuizSummary
//   4. Reutilizar SessionTimer con 45 minutos (mitad de duration_minutes)
//   5. Proporcionar botón "Enviar" (placeholder hasta SE-06)
//   6. Permitir volver a la fase de teoría
//
// PROPS:
//   - sessionData: SessionWithContext — Datos completos de la sesión
//
// ESTADOS:
//   - loading: boolean — Fetch del quiz en progreso
//   - error: string | null — Error al generar quiz
//   - quizContent: QuizContent | null — Quiz generado
//   - currentQuestionIndex: number — Pregunta visible (0-based)
//   - answers: Record<number, AnswerOption> — Respuestas del usuario
//   - showSummary: boolean — Si mostrar el resumen pre-envío
//   - submitting: boolean — Si el envío está en progreso
//   - timerActive: boolean — Si el timer debe correr
//
// PATRÓN "FETCH ON MOUNT":
//   Al montar, el componente hace POST a la API de quiz.
//   Si el quiz ya fue generado, la API retorna el snapshot durable
//   (cached: true). Si no, genera y persiste uno antes de responder.
//   Igual que TheoryPanel hace con la teoría en SE-03.
// ============================================================

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sun,
  Moon,
  RefreshCw,
  FileCheck,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  ClipboardList,
  BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SessionTimer } from "./session-timer";
import { QuizQuestionView } from "./quiz-question-view";
import { QuizNavigation } from "./quiz-navigation";
import { QuizSummary } from "./quiz-summary";
import type { SessionWithContext } from "@/types/sessions";
import type { QuizContent } from "@/types/quiz";
import type { AnswerOption } from "@/types/database";
import type {
  UserAnswer,
  EvaluateResponse,
  EvaluateWithAdaptationResponse,
} from "@/types/evaluate";
import type { AdaptResponse } from "@/types/adapt";
import { FeedbackPanel } from "./feedback-panel";
import { useAiSession } from "@/components/ai/ai-session-provider";

// ─── Props del componente ───────────────────────────────────
interface QuizCardProps {
  sessionData: SessionWithContext;
}

type QuizFetcher = (input: string, init?: RequestInit) => Promise<Response>;

async function fetchQuizWithRetry(
  fetcher: QuizFetcher,
  sessionId: string,
): Promise<Response> {
  const request = () =>
    fetcher(`/api/sessions/${sessionId}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

  let response = await request();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    if (
      response.status !== 409 ||
      !Number.isFinite(retryAfter) ||
      retryAfter <= 0
    ) {
      return response;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(retryAfter, 5) * 1_000),
    );
    response = await request();
  }

  return response;
}

// ─── Helpers reutilizados de TheoryPanel ─────────────────────
// Mismas funciones para mantener consistencia visual entre
// la fase de teoría y la fase de quiz.

const SESSION_ICONS: Record<string, typeof Sun> = {
  morning: Sun,
  night: Moon,
  reinforcement: RefreshCw,
  mock_exam: FileCheck,
};

function getSessionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    morning: "Sesión Matutina",
    night: "Sesión Nocturna",
    reinforcement: "Sesión de Refuerzo",
    mock_exam: "Simulacro de Examen",
  };
  return map[type] || type;
}

function getSessionTypeColor(type: string): string {
  const map: Record<string, string> = {
    morning: "text-amber-300",
    night: "text-indigo-300",
    reinforcement: "text-orange-300",
    mock_exam: "text-purple-300",
  };
  return map[type] || "text-slate-300";
}

// ─── Componente principal ───────────────────────────────────
export function QuizCard({ sessionData }: QuizCardProps) {
  const router = useRouter();
  const { aiFetch } = useAiSession();

  // ═══════════════════════════════════════════════════════════
  // ESTADO
  // ═══════════════════════════════════════════════════════════
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizContent, setQuizContent] = useState<QuizContent | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, AnswerOption>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [evaluationResult, setEvaluationResult] =
    useState<EvaluateResponse | null>(null);
  const [adaptResult, setAdaptResult] = useState<AdaptResponse | null>(null);

  // ═══════════════════════════════════════════════════════════
  // EFECTO: Cargar quiz al montar
  // ═══════════════════════════════════════════════════════════
  // Mismo patrón que TheoryPanel: fetch on mount con cleanup.
  // El flag `cancelled` previene actualizaciones de estado
  // si el componente se desmonta antes de que el fetch termine.
  useEffect(() => {
    let cancelled = false;

    async function loadQuiz() {
      setLoading(true);
      setError(null);
      setQuizContent(null);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setShowSummary(false);
      setSubmitting(false);
      setTimerActive(false);
      setEvaluationResult(null);
      setAdaptResult(null);

      try {
        const response = await fetchQuizWithRetry(aiFetch, sessionData.id);

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            data.error || `Error ${response.status} al generar quiz`,
          );
        }

        const data = await response.json();

        if (!cancelled) {
          setQuizContent(data.quiz);
          setEvaluationResult(data.evaluation ?? null);
          setAdaptResult(data.adaptation ?? null);
          setTimerActive(!data.evaluation);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Error desconocido al generar quiz",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadQuiz();

    return () => {
      cancelled = true;
    };
  }, [aiFetch, sessionData.id]);

  // ═══════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════

  // ── Seleccionar respuesta ─────────────────────────────────
  function handleSelectAnswer(answer: AnswerOption) {
    if (!quizContent) return;

    // Obtener el question_id de la pregunta actual.
    // Si el índice quedó fuera de rango por algún cambio inesperado,
    // salimos sin romper la UI.
    const visibleQuestion = quizContent.questions[currentQuestionIndex];
    if (!visibleQuestion) return;

    // Actualizar el Record de respuestas con spread operator
    // (patrón inmutable para que React detecte el cambio)
    setAnswers((prev) => ({
      ...prev,
      [visibleQuestion.question_id]: answer,
    }));
  }

  // ── Navegar a una pregunta específica ─────────────────────
  function handleNavigate(index: number) {
    if (!quizContent) return;

    // Clamp al rango válido [0, totalQuestions - 1]
    const clamped = Math.max(
      0,
      Math.min(quizContent.questions.length - 1, index),
    );

    setCurrentQuestionIndex(clamped);
    // Si estábamos en el resumen, volver al quiz
    setShowSummary(false);
  }

  // ── Enviar respuestas a /api/sessions/[id]/evaluate ───────
  // Envía solo IDs y selecciones. El servidor recupera del snapshot
  // privado la pregunta, respuesta correcta y explicación.
  async function handleSubmit() {
    const total = quizContent?.questions.length || 0;
    const answered = Object.keys(answers).length;

    if (!quizContent || total === 0 || answered !== total || submitting) {
      return;
    }

    setSubmitting(true);
    setAdaptResult(null);

    try {
      // ── Paso 1: Construir selecciones públicas ──────────────
      const userAnswers: UserAnswer[] = quizContent.questions.map((q) => {
        const selectedAnswer = answers[q.question_id];

        if (!selectedAnswer) {
          throw new Error(
            `Falta respuesta para la pregunta ${q.question_id + 1}`,
          );
        }

        return {
          question_id: q.question_id,
          user_answer: selectedAnswer,
        };
      });

      // ── Paso 2: POST a /api/sessions/[id]/evaluate ──────────
      const response = await aiFetch(`/api/sessions/${sessionData.id}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attempt_id: quizContent.attempt_id,
          answers: userAnswers,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        if (response.status === 409) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const delaySeconds =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter, 5)
              : 2;

          for (let attempt = 0; attempt < 15; attempt += 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, delaySeconds * 1_000),
            );
            const latestResponse = await fetchQuizWithRetry(
              aiFetch,
              sessionData.id,
            );
            if (latestResponse.ok) {
              const latest = await latestResponse.json();
              if (latest.evaluation) {
                setQuizContent(latest.quiz);
                setEvaluationResult(latest.evaluation);
                setAdaptResult(latest.adaptation ?? null);
                setTimerActive(false);
                setShowSummary(false);
                router.refresh();
                return;
              }
            }
          }
        }

        throw new Error(
          data.error || `Error ${response.status} al evaluar quiz`,
        );
      }

      const result: EvaluateWithAdaptationResponse = await response.json();

      // ── Paso 3: Guardar resultado de evaluación ────────────
      setEvaluationResult(result);
      setAdaptResult(result.adaptation);
      setTimerActive(false);
      setShowSummary(false);
      router.refresh();

      // La UI del FeedbackPanel se renderiza automáticamente
      // cuando evaluationResult no es null (ver sección JSX).
    } catch (err) {
      alert(
        `❌ Error al evaluar: ${err instanceof Error ? err.message : "Error desconocido"}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Reintentar generación de quiz ─────────────────────────
  async function handleRetry() {
    setLoading(true);
    setError(null);
    setQuizContent(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setShowSummary(false);
    setSubmitting(false);
    setTimerActive(false);
    setEvaluationResult(null);
    setAdaptResult(null);

    try {
      const response = await fetchQuizWithRetry(aiFetch, sessionData.id);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || `Error ${response.status} al regenerar quiz`,
        );
      }

      const data = await response.json();
      setQuizContent(data.quiz);
      setEvaluationResult(data.evaluation ?? null);
      setAdaptResult(data.adaptation ?? null);
      setTimerActive(!data.evaluation);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido al regenerar quiz",
      );
    } finally {
      setLoading(false);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // VARIABLES DERIVADAS
  // ═══════════════════════════════════════════════════════════
  const SessionIcon = SESSION_ICONS[sessionData.session_type] || Sun;
  const sessionColor = getSessionTypeColor(sessionData.session_type);

  // Progreso del plan (barra superior)
  const progressPercent =
    sessionData.plan_context.total_sessions > 0
      ? (sessionData.plan_context.completed_sessions /
          sessionData.plan_context.total_sessions) *
        100
      : 0;

  // Datos del quiz
  const currentQuestion = quizContent?.questions[currentQuestionIndex] ?? null;
  const totalQuestions = quizContent?.questions.length || 0;
  const answeredCount = evaluationResult
    ? evaluationResult.total_questions
    : Object.keys(answers).length;
  const allAnswered = totalQuestions > 0 && answeredCount === totalQuestions;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* HEADER: Info de la sesión + Timer                      */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        {/* ── Fila superior: tipo + número + timer ──────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Info de la sesión */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800">
              <SessionIcon className={`h-5 w-5 ${sessionColor}`} />
            </div>
            <div>
              <p
                className={`text-xs font-medium uppercase tracking-wide ${sessionColor}`}
              >
                Día {sessionData.day_number} —{" "}
                {getSessionTypeLabel(sessionData.session_type)}
              </p>
              <h1 className="text-xl font-bold tracking-tight text-white">
                📝 Quiz — Sesión {sessionData.session_number} de{" "}
                {sessionData.plan_context.total_sessions}
              </h1>
            </div>
          </div>

          {/* Timer de 45 min (mitad de duration_minutes) */}
          {timerActive && (
            <div className="sm:w-64">
              <SessionTimer
                durationMinutes={Math.floor(sessionData.duration_minutes / 2)}
                autoStart={true}
              />
            </div>
          )}
        </div>

        {/* ── Barra de progreso del plan ───────────────────── */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Progreso del plan</span>
            <span>
              {sessionData.plan_context.completed_sessions} /{" "}
              {sessionData.plan_context.total_sessions} sesiones
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* ── Indicador de progreso del quiz ───────────────── */}
        {quizContent && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <ClipboardList className="h-3.5 w-3.5" />
            <span>
              {answeredCount} de {totalQuestions} respondidas
            </span>
            {allAnswered && (
              <Badge
                variant="outline"
                className="border-emerald-700 bg-emerald-950/40 text-emerald-300 text-xs"
              >
                ✓ Completo
              </Badge>
            )}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ESTADO: Loading                                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      {loading && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-2 border-slate-700 border-t-emerald-400 animate-spin" />
              <Sparkles className="absolute top-1/2 left-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                Generando quiz...
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Gemini está creando preguntas estilo ISTQB para{" "}
                {sessionData.topics.length} tópico
                {sessionData.topics.length > 1 ? "s" : ""}. Esto puede tomar
                15-30 segundos.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ESTADO: Error                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {error && (
        <section className="rounded-2xl border border-red-500/30 bg-red-950/10 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">
                Error al generar el quiz
              </p>
              <p className="mt-1 text-sm text-red-300/70">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                disabled={loading}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-700 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-900/50 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reintentar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CONTENIDO: Pregunta actual                             */}
      {/* ═══════════════════════════════════════════════════════ */}
      {quizContent && !evaluationResult && !showSummary && currentQuestion && (
        <>
          {/* ── Vista de la pregunta ─────────────────────────── */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <QuizQuestionView
              question={currentQuestion}
              selectedAnswer={answers[currentQuestion.question_id] ?? null}
              onSelectAnswer={handleSelectAnswer}
              questionNumber={currentQuestionIndex + 1}
              totalQuestions={totalQuestions}
            />
          </section>

          {/* ── Navegación entre preguntas ───────────────────── */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <QuizNavigation
              currentIndex={currentQuestionIndex}
              totalQuestions={totalQuestions}
              answers={answers}
              onNavigate={handleNavigate}
            />
          </section>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CONTENIDO: Resumen pre-envío                           */}
      {/* ═══════════════════════════════════════════════════════ */}
      {quizContent && !evaluationResult && showSummary && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <QuizSummary
            questions={quizContent.questions}
            answers={answers}
            onNavigateToQuestion={handleNavigate}
            onSubmit={handleSubmit}
            onBack={() => setShowSummary(false)}
            submitting={submitting}
          />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ESTADO: Evaluación completada — FeedbackPanel (SE-08)  */}
      {/* ═══════════════════════════════════════════════════════ */}
      {evaluationResult && quizContent && (
        <FeedbackPanel
          evaluation={evaluationResult}
          adaptation={adaptResult}
          session={sessionData}
        />
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ACCIONES: Ver resumen + Volver a teoría                */}
      {/* ═══════════════════════════════════════════════════════ */}
      {quizContent && !evaluationResult && !showSummary && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              {allAnswered
                ? "¡Has respondido todas las preguntas! Revisa el resumen antes de enviar."
                : `Faltan ${totalQuestions - answeredCount} pregunta${
                    totalQuestions - answeredCount > 1 ? "s" : ""
                  } por responder.`}
            </p>
            <div className="flex gap-3 shrink-0">
              {/* Volver a la teoría (navega sin phase=quiz) */}
              <button
                type="button"
                onClick={() =>
                  router.push(`/session?session_id=${sessionData.id}`)
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
              >
                <BookOpen className="h-4 w-4" />
                Teoría
              </button>

              {/* Ver resumen pre-envío */}
              <button
                type="button"
                onClick={() => setShowSummary(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
              >
                <ClipboardList className="h-4 w-4" />
                Ver resumen
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Metadatos de generación ──────────────────────────── */}
      {quizContent && (
        <p className="text-center text-xs text-slate-600">
          Generado por {quizContent.model_name} ({quizContent.model_provider}) ·{" "}
          {new Date(quizContent.generated_at).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
