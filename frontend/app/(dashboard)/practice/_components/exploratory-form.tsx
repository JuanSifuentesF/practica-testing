"use client";

import { useState, type FormEvent } from "react";
import { Plus, Send, Trash2, Search, FileText } from "lucide-react";

export function ExploratoryForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (data: { notes: string; findings: string[] }) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [findings, setFindings] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);

  function updateFinding(index: number, val: string) {
    setFindings((current) =>
      current.map((item, i) => (i === index ? val : item))
    );
  }

  function addFinding() {
    setFindings((current) => [...current, ""]);
  }

  function removeFinding(index: number) {
    setFindings((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!notes.trim()) {
      setError("Las notas de la sesión exploratoria son obligatorias.");
      return;
    }
    const cleanFindings = findings.filter((f) => f.trim() !== "");
    if (cleanFindings.length === 0) {
      setError("Debes registrar al menos un hallazgo o hipótesis comprobada.");
      return;
    }

    setError(null);
    await onSubmit({ notes: notes.trim(), findings: cleanFindings });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border border-border bg-card/60 p-6"
    >
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Search className="size-5 text-purple-400" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Bitácora de Testing Exploratorio (Charters)
          </h2>
          <p className="text-xs text-muted-foreground">
            Registra el resumen de tu exploración, observaciones y los hallazgos o anomalías descubiertas.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="size-4 text-purple-400" />
          Notas de la Sesión / Cobertura Explorada
        </label>
        <textarea
          disabled={disabled}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Describe la estrategia ejecutada, los flujos navegados, heurísticas aplicadas y comportamientos generales observados..."
          rows={4}
          className="w-full rounded-lg border border-border bg-muted p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-purple-500 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Hallazgos, Comportamientos Anómalos o Hipótesis
        </label>
        {findings.map((finding, index) => (
          <div key={index} className="flex gap-2">
            <input
              disabled={disabled}
              value={finding}
              onChange={(e) => updateFinding(index, e.target.value)}
              placeholder={`Hallazgo ${index + 1}: ej. Al presionar el botón 'Atrás' el token se duplica...`}
              className="flex-1 rounded-lg border border-border bg-muted p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-purple-500 focus:outline-none disabled:opacity-50"
            />
            {findings.length > 1 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeFinding(index)}
                className="rounded-lg p-2.5 text-muted-foreground hover:bg-red-950/40 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={addFinding}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
        >
          <Plus className="size-4" />
          Agregar hallazgo
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Send className="size-4" />
          Enviar Bitácora Exploratoria
        </button>
      </div>
    </form>
  );
}
