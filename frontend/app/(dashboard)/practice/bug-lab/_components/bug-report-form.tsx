"use client";

import { useState, type FormEvent } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import { parseBugReportData } from "@/lib/practice/bug-report-contract";
import type { BugPriority, BugReportData, BugSeverity } from "@/types/practice";

const SEVERITIES: BugSeverity[] = ["critical", "high", "medium", "low"];
const PRIORITIES: BugPriority[] = ["urgent", "high", "medium", "low"];

interface Draft extends Omit<BugReportData, "evidence"> {
  evidence: string;
}

const INITIAL_DRAFT: Draft = {
  title: "",
  preconditions: "",
  steps: [""],
  actual_result: "",
  expected_result: "",
  severity: "medium",
  priority: "medium",
  evidence: "",
};

export function BugReportForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (report: BugReportData) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);

  function updateField<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateStep(index: number, value: string) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, i) => (i === index ? value : step)),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseBugReportData(draft);
    if (!parsed.ok) {
      setFormError(parsed.issues.join(" "));
      return;
    }
    setFormError(null);
    await onSubmit(parsed.value);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
    >
      <h2 className="text-base font-semibold text-white">
        Redacta el reporte de defecto
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Describe hechos reproducibles. La evidencia textual es opcional.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Titulo"
          value={draft.title}
          onChange={(value) => updateField("title", value)}
          disabled={disabled}
        />
        <Field
          label="Precondiciones"
          value={draft.preconditions}
          onChange={(value) => updateField("preconditions", value)}
          disabled={disabled}
        />
        <Field
          label="Resultado actual"
          value={draft.actual_result}
          onChange={(value) => updateField("actual_result", value)}
          disabled={disabled}
          multiline
        />
        <Field
          label="Resultado esperado"
          value={draft.expected_result}
          onChange={(value) => updateField("expected_result", value)}
          disabled={disabled}
          multiline
        />
        <SelectField
          label="Severidad"
          value={draft.severity}
          values={SEVERITIES}
          onChange={(value) => updateField("severity", value as BugSeverity)}
          disabled={disabled}
        />
        <SelectField
          label="Prioridad"
          value={draft.priority}
          values={PRIORITIES}
          onChange={(value) => updateField("priority", value as BugPriority)}
          disabled={disabled}
        />
      </div>
      <Field
        label="Evidencia opcional"
        value={draft.evidence}
        onChange={(value) => updateField("evidence", value)}
        disabled={disabled}
        multiline
      />
      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-slate-200">
          Pasos para reproducir
        </legend>
        <div className="mt-3 space-y-2">
          {draft.steps.map((step, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={step}
                disabled={disabled}
                onChange={(event) => updateStep(index, event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                placeholder={`Paso ${index + 1}`}
              />
              <button
                type="button"
                disabled={disabled || draft.steps.length === 1}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    steps: current.steps.filter((_, i) => i !== index),
                  }))
                }
                className="rounded-lg border border-slate-700 px-3 text-slate-400 disabled:opacity-40"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            setDraft((current) => ({
              ...current,
              steps: [...current.steps, ""],
            }))
          }
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-amber-300"
        >
          <Plus className="size-4" />
          Agregar paso
        </button>
      </fieldset>
      {formError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-900/50 bg-rose-950/30 p-3 text-sm text-rose-300"
        >
          {formError}
        </p>
      )}
      <button
        disabled={disabled}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="size-4" />
        Enviar para evaluar
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  multiline?: boolean;
}) {
  const className =
    "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white";
  return (
    <label className="block text-sm font-medium text-slate-200">
      {label}
      {multiline ? (
        <textarea
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} min-h-24`}
        />
      ) : (
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  values,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  values: readonly string[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-200">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}
