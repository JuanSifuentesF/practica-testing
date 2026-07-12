import type { ReactNode } from "react";
import { Bug, ClipboardList, ShieldAlert } from "lucide-react";
import type { BugReportScenario } from "@/types/practice";

export function ScenarioDisplay({ scenario }: { scenario: BugReportScenario }) {
  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5">
      <div className="flex items-start gap-3">
        <Bug className="mt-0.5 size-5 shrink-0 text-amber-400" />
        <div>
          <h1 className="text-xl font-bold text-white">Bug Report Lab</h1>
          <p className="mt-1 text-sm text-slate-300">{scenario.scenario}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <InfoCard
          icon={<ClipboardList className="size-4 text-sky-400" />}
          title="Historia de usuario"
          text={scenario.user_story}
        />
        <InfoCard
          icon={<ShieldAlert className="size-4 text-violet-400" />}
          title="Regla de negocio"
          text={scenario.business_rule}
        />
        <InfoCard
          icon={<Bug className="size-4 text-rose-400" />}
          title="Bug observado"
          text={scenario.observed_bug}
        />
      </div>

      <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/30 p-4">
        <h2 className="text-sm font-semibold text-white">Tu tarea</h2>
        <p className="mt-1 text-sm text-slate-300">
          {scenario.task_description}
        </p>
      </div>
    </section>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/30 p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {title}
        </h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
    </article>
  );
}
