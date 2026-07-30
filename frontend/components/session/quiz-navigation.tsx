// ============================================================
// components/session/quiz-navigation.tsx
// Navegación entre preguntas del quiz
// ============================================================
// TIPO: Client Component (necesita interactividad: onClick)
//
// RESPONSABILIDADES:
//   1. Mostrar dots numerados para cada pregunta (salto directo)
//   2. Indicar visualmente: current (anillo), answered (verde), pending (gris)
//   3. Botones Previous/Next para navegación secuencial
//   4. Contador textual "X / N"
//
// PROPS:
//   - currentIndex: number — Índice de la pregunta actual (0-based)
//   - totalQuestions: number — Total de preguntas
//   - answers: Record<number, AnswerOption> — Respuestas actuales
//   - onNavigate: (index: number) => void — Saltar a pregunta
//
// NOTA SOBRE question_id vs. array index:
//   En nuestro quiz, question_id === array index (ambos 0-indexed).
//   La API asigna question_id secuencialmente: 0, 1, 2, ..., n-1.
//   Por eso usamos el array index como clave en el Record de answers.
// ============================================================

"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import type { AnswerOption } from "@/types/database";

interface QuizNavigationProps {
  /** Índice de la pregunta actual (0-based) */
  currentIndex: number;
  /** Total de preguntas en el quiz */
  totalQuestions: number;
  /** Mapa de respuestas: { question_id: answer } */
  answers: Record<number, AnswerOption>;
  /** Callback para saltar a una pregunta específica */
  onNavigate: (index: number) => void;
}

export function QuizNavigation({
  currentIndex,
  totalQuestions,
  answers,
  onNavigate,
}: QuizNavigationProps) {
  return (
    <div className="space-y-4">
      {/* ── Dots grid: salto directo a cualquier pregunta ──── */}
      {/* Cada dot es un botón cuadrado con el número de la     */}
      {/* pregunta. El estilo visual indica 3 estados:           */}
      {/*   • Current: emerald sólido + ring                    */}
      {/*   • Answered: emerald transparente + borde            */}
      {/*   • Pending: gris oscuro                              */}
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: totalQuestions }, (_, i) => {
          const isAnswered = answers[i] !== undefined;
          const isCurrent = i === currentIndex;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onNavigate(i)}
              aria-label={`Ir a pregunta ${i + 1}${isAnswered ? " (respondida)" : ""}`}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all duration-200 ${
                isCurrent
                  ? // Estado: pregunta actual
                    "bg-emerald-500 text-slate-950 ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-background"
                  : isAnswered
                    ? // Estado: respondida (pero no la actual)
                      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                    : // Estado: pendiente
                      "bg-muted text-muted-foreground border border-border hover:border-border hover:text-foreground"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* ── Previous / Next + contador ────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </button>

        <span className="text-xs text-muted-foreground">
          {currentIndex + 1} / {totalQuestions}
        </span>

        <button
          type="button"
          onClick={() => onNavigate(currentIndex + 1)}
          disabled={currentIndex === totalQuestions - 1}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Siguiente
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
