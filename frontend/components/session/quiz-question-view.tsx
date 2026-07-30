// ============================================================
// components/session/quiz-question-view.tsx
// Vista de una pregunta individual del quiz
// ============================================================
// TIPO: Client Component (necesita interactividad: onClick)
//
// RESPONSABILIDADES:
//   1. Mostrar el enunciado de la pregunta
//   2. Renderizar las 4 opciones (A, B, C, D) como botones
//   3. Resaltar la opción seleccionada (sin revelar la correcta)
//   4. Mostrar metadatos: número de pregunta, topic_code, level_k
//
// PROPS:
//   - question: QuizQuestion — La pregunta a mostrar
//   - selectedAnswer: AnswerOption | null — Respuesta seleccionada
//   - onSelectAnswer: (answer: AnswerOption) => void — Callback
//   - questionNumber: number — Número de pregunta (1-based)
//   - totalQuestions: number — Total de preguntas en el quiz
//
// REGLA CRÍTICA:
//   El contrato público ni siquiera contiene `correct` o `explanation`.
// ============================================================

"use client";

import { Badge } from "@/components/ui/badge";
import type { QuizQuestion } from "@/types/quiz";
import type { AnswerOption } from "@/types/database";

// ─── Props del componente ───────────────────────────────────
interface QuizQuestionViewProps {
  /** La pregunta actual del quiz */
  question: QuizQuestion;
  /** La respuesta seleccionada por el usuario (null si no ha respondido) */
  selectedAnswer: AnswerOption | null;
  /** Callback cuando el usuario selecciona/cambia una opción */
  onSelectAnswer: (answer: AnswerOption) => void;
  /** Número de la pregunta (1-based, para mostrar "Pregunta 3 de 10") */
  questionNumber: number;
  /** Total de preguntas en el quiz */
  totalQuestions: number;
}

// ─── Constantes ─────────────────────────────────────────────
// Mapeo de clave interna ("a","b","c","d") a letra mayúscula
// para mostrar en la UI
const OPTION_LABELS: Record<AnswerOption, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
};

// Colores por nivel K — misma paleta que TheoryPanel para consistencia
function getLevelKBadgeClass(levelK: string): string {
  const colorMap: Record<string, string> = {
    K1: "border-sky-700 bg-sky-950/40 text-sky-300",
    K2: "border-violet-700 bg-violet-950/40 text-violet-300",
    K3: "border-rose-700 bg-rose-950/40 text-rose-300",
  };
  return colorMap[levelK] || colorMap.K1;
}

// ─── Componente ─────────────────────────────────────────────
export function QuizQuestionView({
  question,
  selectedAnswer,
  onSelectAnswer,
  questionNumber,
  totalQuestions,
}: QuizQuestionViewProps) {
  // Convertimos options (Record) en array para iterar
  // El orden siempre será a, b, c, d gracias a OPTION_LABELS
  const optionKeys: AnswerOption[] = ["a", "b", "c", "d"];

  return (
    <div className="space-y-6">
      {/* ── Header: número + tópico + nivel K ──────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Pregunta {questionNumber} de {totalQuestions}
        </span>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-border text-muted-foreground text-xs"
          >
            {question.topic_code}
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs ${getLevelKBadgeClass(question.level_k)}`}
          >
            {question.level_k}
          </Badge>
        </div>
      </div>

      {/* ── Enunciado de la pregunta ───────────────────────── */}
      {/* whitespace-pre-line preserva saltos de línea del LLM  */}
      {/* (útil en preguntas K3 con escenarios multilínea)       */}
      <p className="text-base font-medium leading-relaxed text-white whitespace-pre-line">
        {question.question}
      </p>

      {/* ── Opciones A/B/C/D ──────────────────────────────── */}
      {/* Cada opción es un botón con toggle visual.            */}
      {/* Al hacer clic → onSelectAnswer(key) actualiza el      */}
      {/* estado en el componente padre (QuizCard).             */}
      <div className="grid gap-3">
        {optionKeys.map((key) => {
          const text = question.options[key];
          const isSelected = selectedAnswer === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectAnswer(key)}
              className={`group flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
                isSelected
                  ? "border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/5"
                  : "border-border/50 bg-muted/30 hover:border-border hover:bg-muted/60"
              }`}
            >
              {/* Círculo con la letra de la opción */}
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors duration-200 ${
                  isSelected
                    ? "bg-emerald-500 text-slate-950"
                    : "bg-muted/50 text-foreground group-hover:bg-muted group-hover:text-foreground"
                }`}
              >
                {OPTION_LABELS[key]}
              </span>

              {/* Texto de la opción */}
              <span
                className={`text-sm leading-relaxed pt-1 transition-colors duration-200 ${
                  isSelected
                    ? "text-emerald-100"
                    : "text-foreground group-hover:text-foreground"
                }`}
              >
                {text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
