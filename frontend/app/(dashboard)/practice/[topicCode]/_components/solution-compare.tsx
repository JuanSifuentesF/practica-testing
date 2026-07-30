"use client";

import type { ReactNode } from "react";
import { BookOpen, ClipboardCheck, UserRoundCheck } from "lucide-react";
import type {
  ExerciseSolution,
  SubmissionContent,
  TestCaseRow,
} from "@/types/practice";

interface SolutionCompareProps {
  solution: ExerciseSolution;
  submission: SubmissionContent;
}

type TableTone = "user" | "model";

const TEST_CASE_TYPES = ["positive", "negative", "boundary"] as const;

const TYPE_STYLES: Record<TestCaseRow["type"], string> = {
  positive: "bg-emerald-950/50 text-emerald-300 border-emerald-900/50",
  negative: "bg-rose-950/50 text-rose-300 border-rose-900/50",
  boundary: "bg-amber-950/50 text-amber-300 border-amber-900/50",
};

const TABLE_TONE_STYLES: Record<TableTone, string> = {
  user: "border-border bg-card/30",
  model: "border-brand-800/50 bg-brand-950/20",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTestCaseType(value: unknown): value is TestCaseRow["type"] {
  return (
    typeof value === "string" &&
    TEST_CASE_TYPES.includes(value as TestCaseRow["type"])
  );
}

function isTestCaseRow(value: unknown): value is TestCaseRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.scenario === "string" &&
    typeof value.test_data === "string" &&
    typeof value.expected_result === "string" &&
    isTestCaseType(value.type)
  );
}

function isTestCaseArray(value: unknown): value is TestCaseRow[] {
  return Array.isArray(value) && value.every(isTestCaseRow);
}

function getModelTestCases(solution: ExerciseSolution): TestCaseRow[] {
  const candidate = solution.model_answer.test_cases;
  return isTestCaseArray(candidate) ? candidate : [];
}

function getUserTestCases(submission: SubmissionContent): TestCaseRow[] {
  return submission.type === "test_cases" ? submission.test_cases : [];
}

export function SolutionCompare({
  solution,
  submission,
}: SolutionCompareProps) {
  const userTestCases = getUserTestCases(submission);
  const modelTestCases = getModelTestCases(solution);

  return (
    <section className="rounded-xl border border-brand-800/50 bg-brand-950/20 p-5 shadow-lg shadow-black/10">
      <div className="mb-4 flex items-start gap-3">
        <BookOpen className="mt-0.5 size-5 text-brand-400" />
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Comparacion con la solucion modelo
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            {solution.explanation ||
              "La API no devolvio una explicacion textual de la solucion."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TestCaseTable
          icon={<UserRoundCheck className="size-4 text-foreground" />}
          title="Tu respuesta"
          rows={userTestCases}
          emptyText="No hay test cases del usuario para comparar."
          tone="user"
        />
        <TestCaseTable
          icon={<ClipboardCheck className="size-4 text-brand-300" />}
          title="Solucion modelo"
          rows={modelTestCases}
          emptyText="La solucion modelo no incluyo una tabla de test cases."
          tone="model"
        />
      </div>

      {solution.key_points.length > 0 && (
        <div className="mt-5 rounded-lg border border-border bg-card/30 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">
            Puntos clave que debias identificar
          </h3>
          <ul className="grid gap-2 md:grid-cols-2">
            {solution.key_points.map((point, index) => (
              <li
                key={`${point}-${index}`}
                className="flex items-start gap-2 text-sm text-foreground"
              >
                <span className="mt-1 text-brand-400">•</span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface TestCaseTableProps {
  icon: ReactNode;
  title: string;
  rows: TestCaseRow[];
  emptyText: string;
  tone: TableTone;
}

function TestCaseTable({
  icon,
  title,
  rows,
  emptyText,
  tone,
}: TestCaseTableProps) {
  return (
    <div className={`rounded-lg border p-4 ${TABLE_TONE_STYLES[tone]}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {rows.length} casos
        </span>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-border bg-card/80">
                <th className="w-20 px-3 py-2 text-left font-medium text-muted-foreground">
                  ID
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Escenario
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Dato
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Resultado esperado
                </th>
                <th className="w-24 px-3 py-2 text-left font-medium text-muted-foreground">
                  Tipo
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.id}-${index}`}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {row.id}
                  </td>
                  <td className="px-3 py-2 text-foreground">{row.scenario}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.test_data}</td>
                  <td className="px-3 py-2 text-foreground">
                    {row.expected_result}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TYPE_STYLES[row.type]}`}
                    >
                      {row.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
    </div>
  );
}
