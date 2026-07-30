"use client";

// ─────────────────────────────────────────────────────────────────
// [topicCode]/_components/theory-brief.tsx
// Resumen breve de la teoría del tópico ISTQB seleccionado.
//
// TIPO: Client Component (presentational — solo props, sin queries).
//
// MUESTRA:
//   - Badge con código del tópico (FL-x.x.x) y nivel K
//   - Nombre del tópico como título
//   - Texto del syllabus (truncado si es muy largo)
//   - Colapsable si excede cierta longitud
//
// PROPÓSITO:
//   Dar al usuario CONTEXTO antes de generar un ejercicio.
//   Debe recordarle de qué trata el tópico sin reemplazar
//   el estudio de la teoría completa (eso fue SE-02/SE-03).
// ─────────────────────────────────────────────────────────────────

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import type { LevelK } from "@/types/database";

// ─── Props ────────────────────────────────────────────────────

export interface TheoryBriefProps {
  /** Código del tópico (e.g., "FL-4.2.1") */
  topicCode: string;
  /** Nombre descriptivo del tópico */
  topicName: string;
  /** Nivel cognitivo del tópico */
  levelK: LevelK;
  /** Texto del syllabus (puede ser largo) */
  syllabusText: string;
}

// ─── Constantes ───────────────────────────────────────────────

/** Máximo de caracteres antes de colapsar */
const MAX_PREVIEW_LENGTH = 400;

const LEVEL_K_STYLES: Record<LevelK, string> = {
  K1: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  K2: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  K3: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const LEVEL_K_LABELS: Record<LevelK, string> = {
  K1: "K1 — Recordar",
  K2: "K2 — Comprender",
  K3: "K3 — Aplicar",
};

// ─── Componente ───────────────────────────────────────────────

export function TheoryBrief({
  topicCode,
  topicName,
  levelK,
  syllabusText,
}: TheoryBriefProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = syllabusText.length > MAX_PREVIEW_LENGTH;
  const displayText =
    isLong && !expanded
      ? syllabusText.slice(0, MAX_PREVIEW_LENGTH) + "…"
      : syllabusText;

  return (
    <div className="rounded-xl border border-border bg-card/50 p-5">
      {/* Header con ícono */}
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="size-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-foreground">
          Contexto Teórico
        </h2>
      </div>

      {/* Badges: código del tópico + nivel K */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="
            inline-flex items-center px-2.5 py-0.5
            text-xs font-mono font-semibold
            rounded-md bg-muted text-foreground
            border border-border
          "
        >
          {topicCode}
        </span>
        <span
          className={`
            inline-flex items-center px-2.5 py-0.5
            text-xs font-semibold rounded-md border
            ${LEVEL_K_STYLES[levelK]}
          `}
        >
          {LEVEL_K_LABELS[levelK]}
        </span>
      </div>

      {/* Nombre del tópico */}
      <h3 className="text-base font-semibold text-foreground mb-2">{topicName}</h3>

      {/* Texto del syllabus */}
      {syllabusText ? (
        <>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {displayText}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="
                flex items-center gap-1 mt-2 text-xs text-brand-400
                hover:text-brand-300 transition-colors cursor-pointer
              "
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3" /> Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" /> Ver más
                </>
              )}
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No hay texto del syllabus disponible para este tópico.
        </p>
      )}
    </div>
  );
}
