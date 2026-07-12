import { CheckCircle2, CircleX, FileSearch } from "lucide-react";
import { isBugReportReferenceAnswer } from "@/lib/practice/bug-report-contract";
import type {
  BugReportData,
  ExerciseSolution,
  PracticeFeedback,
} from "@/types/practice";

export function BugEvaluation({
  score,
  feedback,
  submission,
  solution,
}: {
  score: number;
  feedback: PracticeFeedback;
  submission: BugReportData;
  solution: ExerciseSolution<BugReportData>;
}) {
  const model = isBugReportReferenceAnswer(solution.model_answer)
    ? solution.model_answer
    : null;
  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">
            Evaluacion del bug report
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            {feedback.feedback_summary}
          </p>
        </div>
        <strong className="rounded-xl border border-amber-500/40 px-4 py-2 text-2xl text-amber-300">
          {Math.round(score)}%
        </strong>
      </div>
      <ul className="mt-5 space-y-2">
        {feedback.criteria_results.map((criterion, index) => (
          <li
            key={`${criterion.criterion}-${index}`}
            className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3 text-sm"
          >
            <span>
              {criterion.passed ? (
                <CheckCircle2 className="size-4 text-emerald-400" />
              ) : (
                <CircleX className="size-4 text-rose-400" />
              )}
            </span>
            <div>
              <p className="font-medium text-slate-200">
                {criterion.criterion}
              </p>
              <p className="mt-1 text-slate-400">{criterion.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {model ? (
        <Comparison
          user={submission}
          model={model}
          explanation={solution.explanation}
        />
      ) : (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-rose-900/50 bg-rose-950/30 p-4 text-sm text-rose-300"
        >
          La solucion modelo no cumple el contrato de bug report. No la
          interpretes en el cliente: genera un ejercicio nuevo despues de
          aplicar el addendum de PL-05.
        </p>
      )}
    </section>
  );
}

function Comparison({
  user,
  model,
  explanation,
}: {
  user: BugReportData;
  model: BugReportData;
  explanation: string;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        <FileSearch className="size-4 text-amber-300" />
        <h3 className="font-semibold text-white">
          Comparacion con solucion modelo
        </h3>
      </div>
      <p className="mt-1 text-sm text-slate-400">{explanation}</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Report title="Tu reporte" report={user} />
        <Report title="Solucion modelo" report={model} />
      </div>
    </div>
  );
}

function Report({ title, report }: { title: string; report: BugReportData }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/30 p-4 text-sm">
      <h4 className="font-semibold text-white">{title}</h4>
      <dl className="mt-3 space-y-2 text-slate-300">
        <div>
          <dt className="text-xs uppercase text-slate-500">Titulo</dt>
          <dd>{report.title}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-500">Pasos</dt>
          <dd>
            <ol className="list-decimal pl-5">
              {report.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-500">
            Actual / esperado
          </dt>
          <dd>
            {report.actual_result} / {report.expected_result}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-500">
            Severidad / prioridad
          </dt>
          <dd>
            {report.severity} / {report.priority}
          </dd>
        </div>
      </dl>
    </article>
  );
}
