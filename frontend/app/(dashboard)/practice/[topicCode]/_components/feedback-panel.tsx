"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  TrendingUp,
  XCircle,
} from "lucide-react";
import type { PracticeFeedback } from "@/types/practice";

interface FeedbackPanelProps {
  score: number;
  feedback: PracticeFeedback;
}

type ScoreTone = "strong" | "medium" | "low";

const SCORE_TONE_STYLES: Record<ScoreTone, string> = {
  strong: "border-emerald-500/50 bg-emerald-950/40 text-emerald-300",
  medium: "border-amber-500/50 bg-amber-950/40 text-amber-300",
  low: "border-rose-500/50 bg-rose-950/40 text-rose-300",
};

function getScoreTone(score: number): ScoreTone {
  if (score >= 80) return "strong";
  if (score >= 60) return "medium";
  return "low";
}

function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function ScoreBadge({ score }: { score: number }) {
  const safeScore = normalizeScore(score);
  const tone = getScoreTone(safeScore);

  return (
    <div
      className={`inline-flex items-baseline gap-1 rounded-xl border px-4 py-2 ${SCORE_TONE_STYLES[tone]}`}
    >
      <span className="text-3xl font-black tracking-tight">{safeScore}</span>
      <span className="text-sm font-bold">%</span>
    </div>
  );
}

export function FeedbackPanel({ score, feedback }: FeedbackPanelProps) {
  const criteriaResults = feedback.criteria_results ?? [];
  const strengths = feedback.strengths ?? [];
  const improvements = feedback.improvements ?? [];
  const missingCases = feedback.missing_cases ?? [];
  const passed = criteriaResults.filter((criterion) => criterion.passed).length;
  const total = criteriaResults.length;

  return (
    <section className="rounded-xl border border-border bg-card/60 p-5 shadow-lg shadow-black/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <ListChecks className="size-4 text-brand-400" />
            <h2 className="text-base font-semibold text-foreground">
              Resultado de la evaluacion
            </h2>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-foreground">
            {feedback.feedback_summary ||
              "La evaluacion no incluyo un resumen textual."}
          </p>
        </div>
        <ScoreBadge score={score} />
      </div>

      <div className="mt-5 rounded-lg border border-border bg-card/40 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Criterios evaluados ({passed}/{total})
        </h3>

        {criteriaResults.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {criteriaResults.map((criterion, index) => (
              <li
                key={`${criterion.criterion}-${index}`}
                className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
                  criterion.passed
                    ? "border-emerald-900/40 bg-emerald-950/20"
                    : "border-rose-900/40 bg-rose-950/20"
                }`}
              >
                {criterion.passed ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
                )}
                <div>
                  <p
                    className={`font-medium ${
                      criterion.passed ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {criterion.criterion}
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {criterion.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            La API no devolvio criterios individuales. Revisa la respuesta en
            DevTools antes de ajustar el prompt.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <FeedbackList
          icon={<TrendingUp className="size-4 text-emerald-400" />}
          title="Fortalezas"
          emptyText="No se registraron fortalezas especificas."
          items={strengths}
          markerClassName="text-emerald-400"
        />
        <FeedbackList
          icon={<Lightbulb className="size-4 text-amber-400" />}
          title="Areas de mejora"
          emptyText="No se registraron mejoras especificas."
          items={improvements}
          markerClassName="text-amber-400"
        />
        <FeedbackList
          icon={<AlertTriangle className="size-4 text-rose-400" />}
          title="Casos faltantes"
          emptyText="No se reportaron casos faltantes."
          items={missingCases}
          markerClassName="text-rose-400"
        />
      </div>
    </section>
  );
}

interface FeedbackListProps {
  icon: ReactNode;
  title: string;
  emptyText: string;
  items: string[];
  markerClassName: string;
}

function FeedbackList({
  icon,
  title,
  emptyText,
  items,
  markerClassName,
}: FeedbackListProps) {
  return (
    <div className="rounded-lg border border-border bg-card/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h3>
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <span className={`mt-1 ${markerClassName}`}>•</span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}
