// ============================================================
// components/session/feedback-panel.tsx
// Panel de resultados post-quiz con feedback visual completo
// ============================================================
// TIPO: Client Component (useRouter para navegar; CollapsibleSection maneja su propio estado)
//
// RESPONSABILIDADES:
//   1. Mostrar score grande y animado con badge de decisión
//   2. Listar tópicos fallidos con detalle de preguntas
//   3. Mostrar patrones de error identificados por el LLM
//   4. Mostrar mensaje de feedback personalizado
//   5. Informar sobre la adaptación del plan (si hubo)
//   6. Ofrecer botones de navegación (dashboard, siguiente sesión)
//
// PROPS:
//   - evaluation: EvaluateResponse — datos de la evaluación
//   - adaptation: AdaptResponse | null — resultado de la adaptación
//   - questions: QuizQuestion[] — preguntas del quiz (para mostrar explanations)
//   - userAnswers: Record<number, AnswerOption> — respuestas del usuario
//   - session: SessionWithContext — datos de la sesión para contexto
//
// DISEÑO:
//   El panel reemplaza el `alert()` placeholder que existía en SE-07.
//   No hace fetches propios — recibe todo como props desde QuizCard.
//   Visualmente sigue el design system dark del proyecto:
//     - Fondo slate-900/60 con bordes slate-800
//     - Acentos emerald para positivo, amber para warning, red para error
//     - Tipografía Inter/system con tamaños consistentes
// ============================================================

"use client";

import { useRouter } from "next/navigation";
import {
  Trophy,
  RefreshCw,
  CheckCircle2,
  XCircle,
  BarChart3,
  ArrowRight,
  Calendar,
  Lightbulb,
  MessageSquare,
  Target,
  BookOpen,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "./collapsible-section";
import type {
  EvaluateResponse,
  FailedTopic,
  ErrorPattern,
} from "@/types/evaluate";
import type { AdaptResponse } from "@/types/adapt";
import type { QuizQuestion } from "@/types/quiz";
import type { SessionWithContext } from "@/types/sessions";
import type { AnswerOption } from "@/types/database";

// ─── Props del componente ───────────────────────────────────
interface FeedbackPanelProps {
  evaluation: EvaluateResponse;
  adaptation: AdaptResponse | null;
  questions: QuizQuestion[];
  userAnswers: Record<number, AnswerOption>;
  session: SessionWithContext;
}

// ─── Tipos auxiliares internos ──────────────────────────────
interface ActionConfig {
  label: string;
  emoji: string;
  badgeClass: string;
  ringClass: string;
  scoreColor: string;
  description: string;
}

// ─── Configuración visual por tipo de acción ────────────────
// Centralizado para evitar condicionales dispersos por todo el JSX.
const ACTION_CONFIGS: Record<string, ActionConfig> = {
  advance: {
    label: "Avanzas al siguiente tópico",
    emoji: "✅",
    badgeClass: "border-emerald-600 bg-emerald-950/60 text-emerald-300",
    ringClass: "ring-emerald-500/30",
    scoreColor: "text-emerald-400",
    description: "Has demostrado dominio sobre los conceptos evaluados.",
  },
  reinforce: {
    label: "Sesión de refuerzo agendada",
    emoji: "⚠️",
    badgeClass: "border-amber-600 bg-amber-950/60 text-amber-300",
    ringClass: "ring-amber-500/30",
    scoreColor: "text-amber-400",
    description:
      "Estás cerca del umbral. Una sesión corta de refuerzo te ayudará.",
  },
  restructure: {
    label: "Plan reestructurado",
    emoji: "🔄",
    badgeClass: "border-orange-600 bg-orange-950/60 text-orange-300",
    ringClass: "ring-orange-500/30",
    scoreColor: "text-orange-400",
    description:
      "Algunos conceptos necesitan más trabajo con un enfoque diferente.",
  },
};

// ─── Etiquetas legibles para opciones A-D ────────────────────
const OPTION_LABELS: Record<AnswerOption, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
};

// ─── Formateo seguro para columnas DATE de PostgreSQL ─────────
// Evita que "2026-07-07" se muestre como día anterior por zona horaria.
function formatDateEsMx(
  isoDate: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("es-MX", {
    ...options,
    timeZone: "UTC",
  });
}

// ─── Componente principal ───────────────────────────────────
export function FeedbackPanel({
  evaluation,
  adaptation,
  questions,
  userAnswers,
  session,
}: FeedbackPanelProps) {
  const router = useRouter();

  // Determinar la configuración visual basada en la acción
  const config = ACTION_CONFIGS[evaluation.action] || ACTION_CONFIGS.advance;

  // Preparar datos de preguntas individuales con resultados
  const questionResults = questions.map((q) => {
    const userAnswer = userAnswers[q.question_id] ?? null;
    const isCorrect = userAnswer === q.correct;
    return { ...q, userAnswer, isCorrect };
  });

  // Calcular la fecha estimada (preferir la nueva si hubo restructure)
  const estimatedEndDate =
    adaptation?.new_estimated_end_date ||
    session.plan_context.estimated_end_date;

  return (
    <div className="flex flex-col gap-5">
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 1: Score Hero — Score grande + Badge de decisión   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex flex-col items-center gap-5 text-center">
          {/* ── Score circular ─────────────────────────────────── */}
          <div
            className={`flex h-28 w-28 items-center justify-center rounded-full ring-4 ${config.ringClass} bg-slate-800/80`}
          >
            <div>
              <p
                className={`text-4xl font-extrabold tracking-tight ${config.scoreColor}`}
              >
                {evaluation.score}%
              </p>
              <p className="text-xs text-slate-400">
                {evaluation.correct_count}/{evaluation.total_questions}
              </p>
            </div>
          </div>

          {/* ── Badge de decisión ──────────────────────────────── */}
          <Badge
            variant="outline"
            className={`px-4 py-1.5 text-sm font-semibold ${config.badgeClass}`}
          >
            {config.emoji} {config.label}
          </Badge>

          {/* ── Descripción corta ──────────────────────────────── */}
          <p className="max-w-md text-sm leading-6 text-slate-400">
            {config.description}
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 2: Feedback del LLM                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {evaluation.feedback_message && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                Retroalimentación del agente
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-400">
                {evaluation.feedback_message}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 3: Tópicos fallidos                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {evaluation.failed_topics.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <Target className="h-4 w-4 text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">
              Tópicos que necesitan atención
            </h3>
            <span className="rounded-full bg-red-950/60 px-2 py-0.5 text-xs font-medium text-red-300">
              {evaluation.failed_topics.length}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {evaluation.failed_topics.map((topic: FailedTopic) => (
              <div
                key={topic.topic_code}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 rounded-md bg-slate-700/60 px-2 py-0.5 text-xs font-mono text-slate-300">
                    {topic.topic_code}
                  </span>
                  <span className="text-sm text-slate-300 truncate">
                    {topic.topic_name}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-red-400 font-medium">
                  {topic.questions_failed}/{topic.questions_total} fallidas
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 4: Detalle de preguntas (expandible)               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Detalle de preguntas"
        icon={BookOpen}
        badge={`${evaluation.correct_count} correctas · ${
          evaluation.total_questions - evaluation.correct_count
        } fallidas`}
      >
        <div className="flex flex-col gap-3">
          {questionResults.map((qr, idx) => (
            <div
              key={qr.question_id}
              className={`rounded-lg border px-4 py-3 ${
                qr.isCorrect
                  ? "border-emerald-800/40 bg-emerald-950/10"
                  : "border-red-800/40 bg-red-950/10"
              }`}
            >
              {/* ── Header de la pregunta ──────────────────── */}
              <div className="flex items-start gap-2.5">
                {qr.isCorrect ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">
                    Pregunta {idx + 1}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">
                    {qr.question}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-slate-500">
                  {qr.topic_code}
                </span>
              </div>

              {/* ── Respuestas: usuario vs. correcta ───────── */}
              {!qr.isCorrect && (
                <div className="mt-2.5 ml-6 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-400">Tu respuesta:</span>
                    <span className="font-medium text-red-300">
                      {qr.userAnswer
                        ? `${OPTION_LABELS[qr.userAnswer]}) ${qr.options[qr.userAnswer]}`
                        : "Sin respuesta"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-400">Correcta:</span>
                    <span className="font-medium text-emerald-300">
                      {OPTION_LABELS[qr.correct]}) {qr.options[qr.correct]}
                    </span>
                  </div>
                  {/* ── Explicación ──────────────────────── */}
                  {qr.explanation && (
                    <div className="mt-1.5 rounded-md bg-slate-800/50 px-3 py-2">
                      <div className="flex items-start gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                        <p className="text-xs leading-5 text-slate-400">
                          {qr.explanation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Preguntas correctas: solo confirmar ─────── */}
              {qr.isCorrect && (
                <div className="mt-1.5 ml-6 text-xs text-emerald-400/70">
                  {OPTION_LABELS[qr.correct]}) {qr.options[qr.correct]}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 5: Patrones de error (solo si el LLM los generó)   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {evaluation.error_patterns.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">
              Patrones de error detectados
            </h3>
          </div>

          <div className="flex flex-col gap-3">
            {evaluation.error_patterns.map((ep: ErrorPattern, idx: number) => {
              // Determinar color de frecuencia
              const freqColor =
                ep.frequency === "alta"
                  ? "border-red-700 bg-red-950/40 text-red-300"
                  : ep.frequency === "media"
                    ? "border-amber-700 bg-amber-950/40 text-amber-300"
                    : "border-slate-700 bg-slate-800/40 text-slate-300";

              return (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-800 bg-slate-800/20 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-200">
                      {ep.pattern}
                    </p>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${freqColor}`}
                    >
                      {ep.frequency}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-slate-400">
                    💡 {ep.suggestion}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 6: Información de adaptación                       */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {adaptation && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
              <RefreshCw className="h-4 w-4 text-violet-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-200">
                Adaptación del plan
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-400">
                {adaptation.message}
              </p>

              {/* ── Detalle de adaptación ──────────────────────── */}
              <div className="mt-3 flex flex-wrap gap-3">
                {/* Sesiones de refuerzo creadas */}
                {adaptation.reinforcement_session_ids.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/60 px-3 py-1.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs text-slate-300">
                      {adaptation.reinforcement_session_ids.length} sesión
                      {adaptation.reinforcement_session_ids.length > 1
                        ? "es"
                        : ""}{" "}
                      de refuerzo
                    </span>
                  </div>
                )}

                {/* Nueva fecha estimada */}
                {adaptation.new_estimated_end_date && (
                  <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/60 px-3 py-1.5">
                    <Calendar className="h-3.5 w-3.5 text-orange-400" />
                    <span className="text-xs text-slate-300">
                      Nueva fecha:{" "}
                      {formatDateEsMx(adaptation.new_estimated_end_date, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 7: Fecha estimada de examen + Plan progress        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Fecha estimada */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
              <Calendar className="h-4 w-4 text-sky-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Fecha estimada de examen
              </p>
              <p className="text-sm font-semibold text-slate-200">
                {formatDateEsMx(estimatedEndDate, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Progreso del plan */}
          <div className="text-right">
            <p className="text-xs text-slate-500">Progreso del plan</p>
            <p className="text-sm font-semibold text-slate-200">
              {session.plan_context.completed_sessions} de{" "}
              {session.plan_context.total_sessions} sesiones
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECCIÓN 8: Botones de acción                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <section className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {/* ── Ver mi progreso → Dashboard ──────────────────────── */}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-6 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/50"
        >
          <BarChart3 className="h-4 w-4" />
          Ver mi progreso
        </button>

        {/* ── Siguiente sesión ─────────────────────────────────── */}
        <button
          type="button"
          onClick={() => router.push("/session")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          Siguiente sesión
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>
    </div>
  );
}
