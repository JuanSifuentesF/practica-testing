"use client";

import { CheckCircle2, Circle, ClipboardCheck } from "lucide-react";
import type {
  ApiChecklistCategory,
  ApiChecklistDefinition,
  ApiChecklistProgress,
  ChecklistProgressItem,
} from "./checklist-storage";

const CATEGORY_STYLES: Record<ApiChecklistCategory, string> = {
  request: "border-sky-500/30 bg-sky-950/20 text-sky-300",
  validation: "border-amber-500/30 bg-amber-950/20 text-amber-300",
  error: "border-rose-500/30 bg-rose-950/20 text-rose-300",
  response: "border-emerald-500/30 bg-emerald-950/20 text-emerald-300",
};

export function ValidationChecklist({
  items,
  progress,
  disabled,
  onItemChange,
}: {
  items: readonly ApiChecklistDefinition[];
  progress: ApiChecklistProgress;
  disabled: boolean;
  onItemChange: (id: string, patch: Partial<ChecklistProgressItem>) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card/60 p-5">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="size-5 text-blue-300" />
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Checklist de validaciones
          </h2>
          <p className="text-sm text-muted-foreground">
            Registra pruebas manuales; esta UI no contacta FastAPI.
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {items.map((item) => {
          const entry = progress[item.id];
          if (!entry)
            return (
              <p
                key={item.id}
                role="alert"
                className="rounded-lg border border-rose-900/50 p-3 text-sm text-rose-300"
              >
                Progreso incompatible para {item.id}. Restablece la checklist.
              </p>
            );
          return (
            <article
              key={item.id}
              className="rounded-lg border border-border bg-card/30 p-4"
            >
              <div className="flex gap-3">
                <button
                  type="button"
                  aria-label={`Marcar ${item.description}`}
                  aria-pressed={entry.checked}
                  disabled={disabled}
                  onClick={() =>
                    onItemChange(item.id, { checked: !entry.checked })
                  }
                  className="mt-0.5 text-muted-foreground disabled:opacity-50"
                >
                  {entry.checked ? (
                    <CheckCircle2 className="size-5 text-emerald-400" />
                  ) : (
                    <Circle className="size-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_STYLES[item.category]}`}
                    >
                      {item.category}
                    </span>
                    <h3 className="text-sm font-medium text-foreground">
                      {item.description}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    <strong>Esperado:</strong> {item.expectedResult}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.documentation}
                  </p>
                  <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Resultado real observado
                    <textarea
                      value={entry.actualResult}
                      disabled={disabled}
                      onChange={(event) =>
                        onItemChange(item.id, {
                          actualResult: event.target.value,
                        })
                      }
                      placeholder="Ej.: 422, error_code=NO_TEXT_EXTRACTED"
                      className="mt-1 min-h-20 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                    />
                  </label>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
