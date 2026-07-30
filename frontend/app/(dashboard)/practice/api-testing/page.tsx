"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { EndpointCard } from "./_components/endpoint-card";
import { ValidationChecklist } from "./_components/validation-checklist";
import {
  assertApiChecklistStorageFixtures,
  clearApiChecklistProgress,
  createInitialApiChecklistProgress,
  EXTRACT_PDF_FULL_CHECKLIST,
  EXTRACT_PDF_FULL_ENDPOINT,
  readApiChecklistProgress,
  saveApiChecklistProgress,
  type ApiChecklistProgress,
  type ChecklistProgressItem,
} from "./_components/checklist-storage";

if (process.env.NODE_ENV === "development") assertApiChecklistStorageFixtures();

export default function ApiTestingPage() {
  const [progress, setProgress] = useState<ApiChecklistProgress>(
    createInitialApiChecklistProgress,
  );
  const [hydrated, setHydrated] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const stored = readApiChecklistProgress();
      if (stored.kind === "valid") setProgress(stored.progress);
      if (stored.kind === "invalid")
        setStorageNotice(
          "El progreso local era incompatible y se reinicio de forma segura.",
        );
      if (stored.kind === "unavailable")
        setStorageNotice(
          "El almacenamiento local esta bloqueado; puedes usar la checklist sin persistencia.",
        );
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function updateItem(id: string, patch: Partial<ChecklistProgressItem>) {
    const nextProgress = {
      ...progress,
      [id]: { ...progress[id], ...patch },
    };
    setProgress(nextProgress);
    if (!saveApiChecklistProgress(nextProgress))
      setStorageNotice("No fue posible guardar el progreso en este navegador.");
  }

  function resetProgress() {
    const cleared = clearApiChecklistProgress();
    const initialProgress = createInitialApiChecklistProgress();
    const saved = saveApiChecklistProgress(initialProgress);
    setProgress(initialProgress);
    setStorageNotice(
      cleared && saved
        ? "Checklist restablecida. El nuevo progreso se guardara localmente."
        : "Checklist restablecida en pantalla, pero el almacenamiento local esta bloqueado.",
    );
  }

  const completed = EXTRACT_PDF_FULL_CHECKLIST.filter(
    (item) => progress[item.id]?.checked,
  ).length;
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/practice"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver al Practice Lab
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-blue-300">
            Laboratorio educativo de contrato HTTP
          </p>
          <h1 className="text-2xl font-bold text-foreground">
            API Testing Checklist
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {completed}/{EXTRACT_PDF_FULL_CHECKLIST.length} validaciones
            marcadas
          </p>
        </div>
        <button
          type="button"
          onClick={resetProgress}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
        >
          <RotateCcw className="size-4" />
          Restablecer progreso
        </button>
      </div>
      {storageNotice && (
        <p
          role="status"
          className="flex gap-2 rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-200"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {storageNotice}
        </p>
      )}
      <EndpointCard endpoint={EXTRACT_PDF_FULL_ENDPOINT} />
      {hydrated ? (
        <ValidationChecklist
          items={EXTRACT_PDF_FULL_CHECKLIST}
          progress={progress}
          disabled={false}
          onItemChange={updateItem}
        />
      ) : (
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      )}
    </div>
  );
}
