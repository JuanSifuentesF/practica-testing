"use client";

// ─────────────────────────────────────────────────────────────────
// practice/_components/practice-card.tsx
// Tarjeta individual de un tópico ISTQB en el Hub de Prácticas.
//
// TIPO: Client Component (interactivo — botones de navegación).
// PATRÓN: Presentational — recibe datos via props, no hace queries.
//
// MUESTRA:
//   - Código del tópico (FL-x.x.x) como badge
//   - Nombre descriptivo del tópico
//   - Badge de nivel K con color semántico
//   - Contador de ejercicios generados para este tópico
//   - Botón "Practicar" que navega a /practice/[topicCode]
//
// DISEÑO:
//   - Fondo oscuro con borde sutil (consistente con dashboard cards)
//   - Hover effect con elevación y brillo del borde
//   - Responsive: 1 col en mobile, 2+ col en desktop (manejado por parent)
// ─────────────────────────────────────────────────────────────────

import Link from "next/link";
import { Beaker, ChevronRight } from "lucide-react";
import type { LevelK } from "@/types/database";

// ─── Props ────────────────────────────────────────────────────

export interface PracticeCardProps {
  /** Código del tópico ISTQB (e.g., "FL-4.2.1") */
  topicCode: string;
  /** Nombre descriptivo del tópico */
  topicName: string;
  /** Nivel cognitivo del tópico */
  levelK: LevelK;
  /** Total de ejercicios generados para este tópico */
  exerciseCount: number;
  /** ID del documento (para pasar como query param) */
  documentId: string;
}

// ─── Estilos por nivel K ──────────────────────────────────────

const LEVEL_K_STYLES: Record<LevelK, string> = {
  K1: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  K2: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  K3: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

/** Descripción corta de cada nivel para tooltip */
const LEVEL_K_LABELS: Record<LevelK, string> = {
  K1: "Recordar",
  K2: "Comprender",
  K3: "Aplicar",
};

// ─── Componente ───────────────────────────────────────────────

export function PracticeCard({
  topicCode,
  topicName,
  levelK,
  exerciseCount,
  documentId,
}: PracticeCardProps) {
  // La URL destino incluye el topicCode como segmento dinámico
  // y el document_id como query param para que PL-07 sepa
  // de qué documento obtener los datos.
  const practiceUrl = `/practice/${encodeURIComponent(topicCode)}?document_id=${documentId}`;

  return (
    <div
      className="
        group relative rounded-xl border border-slate-800
        bg-slate-900/50 p-4
        transition-all duration-200
        hover:border-slate-700 hover:bg-slate-900/80
        hover:shadow-lg hover:shadow-emerald-500/5
      "
    >
      <div className="flex items-start justify-between gap-3">
        {/* ─── Lado izquierdo: código + nombre + nivel K ─── */}
        <div className="flex-1 min-w-0">
          {/* Fila superior: código del tópico + badge nivel K */}
          <div className="flex items-center gap-2 mb-1.5">
            {/* Badge del código del tópico */}
            <span
              className="
                inline-flex items-center px-2 py-0.5
                text-xs font-mono font-semibold
                rounded-md bg-slate-800 text-slate-300
                border border-slate-700
              "
            >
              {topicCode}
            </span>

            {/* Badge del nivel K con color semántico */}
            <span
              title={LEVEL_K_LABELS[levelK]}
              className={`
                inline-flex items-center px-2 py-0.5
                text-xs font-semibold rounded-md border
                ${LEVEL_K_STYLES[levelK]}
              `}
            >
              {levelK}
            </span>
          </div>

          {/* Nombre del tópico — truncado si es muy largo */}
          <p
            className="text-sm text-slate-200 leading-snug line-clamp-2"
            title={topicName}
          >
            {topicName}
          </p>

          {/* Contador de ejercicios */}
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <Beaker className="size-3.5" />
            <span>
              {exerciseCount === 0
                ? "Sin ejercicios"
                : exerciseCount === 1
                  ? "1 ejercicio"
                  : `${exerciseCount} ejercicios`}
            </span>
          </div>
        </div>

        {/* ─── Lado derecho: botón de acción ─── */}
        <Link
          href={practiceUrl}
          className="
            flex items-center gap-1 shrink-0
            px-3 py-2 text-xs font-semibold rounded-lg
            bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
            hover:bg-emerald-500/20 hover:border-emerald-500/40
            transition-colors
          "
        >
          Practicar
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
