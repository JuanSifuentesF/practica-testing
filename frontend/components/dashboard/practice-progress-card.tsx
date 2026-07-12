import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, ClipboardCheck, FlaskConical, Trophy } from "lucide-react";
import type { PracticeExerciseType } from "@/types/practice";
import type { PracticeStats } from "@/types/dashboard";

const TYPE_META: Record<
  PracticeExerciseType,
  { label: string; icon: string; className: string }
> = {
  test_cases: {
    label: "Test Cases",
    icon: "🧪",
    className: "border-emerald-500/30 bg-emerald-950/20 text-emerald-300",
  },
  bug_report: {
    label: "Bug Reports",
    icon: "🐛",
    className: "border-amber-500/30 bg-amber-950/20 text-amber-300",
  },
  api_testing: {
    label: "API Testing",
    icon: "🔌",
    className: "border-sky-500/30 bg-sky-950/20 text-sky-300",
  },
  exploratory: {
    label: "Exploratorio",
    icon: "🔍",
    className: "border-violet-500/30 bg-violet-950/20 text-violet-300",
  },
};

function scoreLabel(score: number | null): string {
  return score === null || !Number.isFinite(score)
    ? "Sin evaluaciones"
    : `${Math.round(Math.min(100, Math.max(0, score)))}%`;
}

export function PracticeProgressCard({ stats }: { stats: PracticeStats }) {
  const most = stats.most_practiced_type
    ? TYPE_META[stats.most_practiced_type]
    : null;
  const completion =
    stats.total_exercises === 0
      ? 0
      : Math.round((stats.completed_exercises / stats.total_exercises) * 100);
  return (
    <section className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/35 via-slate-950/60 to-slate-900/50 p-5 shadow-xl shadow-black/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="size-5 text-blue-300" />
            <h2 className="text-lg font-semibold text-white">Practice Lab</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Actividad práctica del documento de tu plan activo.
          </p>
        </div>
        <Link
          href="/practice"
          className="rounded-lg border border-blue-500/30 px-3 py-2 text-sm font-medium text-blue-200 hover:bg-blue-500/10"
        >
          Ir a práctica
        </Link>
      </div>
      {stats.total_exercises === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-5 text-sm text-slate-400">
          Aún no generaste ejercicios prácticos para este syllabus.
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric
              icon={<FlaskConical className="size-4 text-blue-300" />}
              label="Generados"
              value={String(stats.total_exercises)}
            />
            <Metric
              icon={<ClipboardCheck className="size-4 text-emerald-300" />}
              label="Evaluados"
              value={`${stats.completed_exercises}/${stats.total_exercises}`}
            />
            <Metric
              icon={<Trophy className="size-4 text-amber-300" />}
              label="Score promedio"
              value={scoreLabel(stats.avg_score)}
            />
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 to-emerald-400 transition-[width] duration-700"
              style={{ width: `${completion}%` }}
              aria-label={`${completion}% de ejercicios evaluados`}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(TYPE_META) as PracticeExerciseType[]).map((type) => (
              <span
                key={type}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${TYPE_META[type].className}`}
              >
                {TYPE_META[type].icon} {TYPE_META[type].label}:{" "}
                {stats.by_type[type]}
              </span>
            ))}
          </div>
          {most && (
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-300">
              <BarChart3 className="size-4 text-blue-300" />
              Tipo más practicado:{" "}
              <span className="font-semibold text-white">
                {most.icon} {most.label}
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
