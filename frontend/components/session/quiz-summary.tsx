// ============================================================
// components/session/quiz-summary.tsx
// Resumen pre-envío del quiz
// ============================================================
// TIPO: Client Component (necesita onClick para navegación)
//
// RESPONSABILIDADES:
//   1. Mostrar contadores: respondidas vs. pendientes
//   2. Listar TODAS las preguntas con su estado
//   3. Permitir click en cualquier pregunta para volver a ella
//   4. Habilitar botón "Enviar" solo si TODAS respondidas
//   5. Mostrar advertencia visual si hay preguntas sin responder
//
// PROPS:
//   - questions: QuizQuestion[] — Todas las preguntas del quiz
//   - answers: Record<number, AnswerOption> — Respuestas del usuario
//   - onNavigateToQuestion: (index: number) => void — Ir a pregunta
//   - onSubmit: () => void — Enviar todas las respuestas
//   - onBack: () => void — Volver al quiz (cerrar resumen)
//   - submitting: boolean — Si el envío está en progreso
// ============================================================

"use client";

import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Send,
  ArrowLeft,
} from "lucide-react";
import type { QuizQuestion } from "@/types/quiz";
import type { AnswerOption } from "@/types/database";

interface QuizSummaryProps {
  questions: QuizQuestion[];
  answers: Record<number, AnswerOption>;
  onNavigateToQuestion: (index: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}

// ─── Etiquetas de opciones para mostrar la selección ────────
const OPTION_LABELS: Record<AnswerOption, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
};

export function QuizSummary({
  questions,
  answers,
  onNavigateToQuestion,
  onSubmit,
  onBack,
  submitting,
}: QuizSummaryProps) {
  // ── Contadores derivados ──────────────────────────────────
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalQuestions - answeredCount;
  const allAnswered = unansweredCount === 0;

  return (
    <div className="space-y-6">
      {/* ── Título ────────────────────────────────────────── */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">Resumen del Quiz</h2>
        <p className="mt-1 text-sm text-slate-400">
          Revisa tus respuestas antes de enviar
        </p>
      </div>

      {/* ── Contadores: respondidas / pendientes ─────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{answeredCount}</p>
          <p className="text-xs text-emerald-300/70">Respondidas</p>
        </div>
        <div
          className={`rounded-xl border p-4 text-center ${
            unansweredCount > 0
              ? "border-amber-500/20 bg-amber-950/20"
              : "border-slate-700 bg-slate-800/30"
          }`}
        >
          <p
            className={`text-2xl font-bold ${
              unansweredCount > 0 ? "text-amber-400" : "text-slate-500"
            }`}
          >
            {unansweredCount}
          </p>
          <p
            className={`text-xs ${
              unansweredCount > 0 ? "text-amber-300/70" : "text-slate-500"
            }`}
          >
            Pendientes
          </p>
        </div>
      </div>

      {/* ── Lista de preguntas con estado ─────────────────── */}
      {/* max-h con scroll para quizzes de 10-12 preguntas     */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {questions.map((q, index) => {
          const answer = answers[q.question_id];
          const isAnswered = answer !== undefined;

          return (
            <button
              key={q.question_id}
              type="button"
              onClick={() => onNavigateToQuestion(index)}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                isAnswered
                  ? "border-slate-700/50 bg-slate-800/20 hover:bg-slate-800/40"
                  : "border-amber-500/30 bg-amber-950/10 hover:bg-amber-950/20"
              }`}
            >
              {/* Ícono de estado: ✓ respondida / ○ pendiente */}
              {isAnswered ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-amber-400" />
              )}

              {/* Texto truncado de la pregunta */}
              <span className="flex-1 truncate text-sm text-slate-300">
                {index + 1}.{" "}
                {q.question.length > 80
                  ? q.question.slice(0, 80) + "..."
                  : q.question}
              </span>

              {/* Badge con la opción seleccionada */}
              {isAnswered && (
                <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded bg-emerald-500/20 text-xs font-bold text-emerald-300">
                  {OPTION_LABELS[answer]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Warning si faltan preguntas ───────────────────── */}
      {!allAnswered && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/10 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
          <p className="text-sm text-amber-300">
            Debes responder <strong>todas</strong> las preguntas antes de
            enviar. Haz clic en cualquier pregunta pendiente para ir a ella.
          </p>
        </div>
      )}

      {/* ── Botones de acción ─────────────────────────────── */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-700 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al quiz
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!allAnswered || submitting}
          className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          {submitting ? "Enviando..." : "Enviar respuestas"}
        </button>
      </div>
    </div>
  );
}
