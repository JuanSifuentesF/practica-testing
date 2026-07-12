"use client";

// ─────────────────────────────────────────────────────────────────
// practice/_components/practice-filter.tsx
// Componente de filtros para el Hub de Prácticas.
//
// TIPO: Client Component (interactivo — maneja clicks en filtros).
// PATRÓN: Presentational — recibe estado via props,
//         emite cambios via callbacks (onFilterChange).
//
// FILTROS DISPONIBLES:
//   1. Por capítulo ISTQB (FL-1 a FL-6)
//   2. Por nivel cognitivo (K1, K2, K3)
//
// DISEÑO: Horizontal pills/badges que se activan/desactivan al click.
//         Consistente con el estilo oscuro del dashboard.
// ─────────────────────────────────────────────────────────────────

import { X, Filter } from "lucide-react";
import type { LevelK } from "@/types/database";

// ─── Props ────────────────────────────────────────────────────

export interface PracticeFilterProps {
  /** Lista de capítulos disponibles (e.g., ["1", "2", "3", ...]) */
  availableChapters: string[];
  /** Capítulo actualmente seleccionado (null = todos) */
  selectedChapter: string | null;
  /** Niveles K actualmente activos (array vacío = todos) */
  selectedLevels: LevelK[];
  /** Callback cuando cambia cualquier filtro */
  onChapterChange: (chapter: string | null) => void;
  /** Callback cuando cambia la selección de niveles K */
  onLevelChange: (levels: LevelK[]) => void;
}

// ─── Constantes de diseño ─────────────────────────────────────

/** Nombres descriptivos de los capítulos ISTQB FL */
const CHAPTER_NAMES: Record<string, string> = {
  "1": "Fundamentos del Testing",
  "2": "Testing en el SDLC",
  "3": "Testing Estático",
  "4": "Técnicas de Testing",
  "5": "Gestión del Testing",
  "6": "Herramientas de Testing",
};

/** Todos los niveles K posibles */
const ALL_LEVELS: LevelK[] = ["K1", "K2", "K3"];

/** Colores por nivel K — consistentes con los badges del proyecto */
const LEVEL_COLORS: Record<LevelK, { active: string; inactive: string }> = {
  K1: {
    active: "bg-sky-500/30 text-sky-300 border-sky-500/50",
    inactive:
      "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-sky-500/10 hover:text-sky-400 hover:border-sky-500/30",
  },
  K2: {
    active: "bg-amber-500/30 text-amber-300 border-amber-500/50",
    inactive:
      "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30",
  },
  K3: {
    active: "bg-rose-500/30 text-rose-300 border-rose-500/50",
    inactive:
      "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30",
  },
};

// ─── Componente ───────────────────────────────────────────────

export function PracticeFilter({
  availableChapters,
  selectedChapter,
  selectedLevels,
  onChapterChange,
  onLevelChange,
}: PracticeFilterProps) {
  // ─── Handler para toggle de nivel K ─────────────────────
  // Si el nivel ya está activo, lo quitamos del array.
  // Si no está activo, lo agregamos.
  // Si el array resultante incluye los 3 niveles, volvemos
  // a array vacío (= "todos seleccionados").
  function handleLevelToggle(level: LevelK) {
    let updated: LevelK[];
    if (selectedLevels.includes(level)) {
      // Quitar este nivel
      updated = selectedLevels.filter((l) => l !== level);
    } else {
      // Agregar este nivel
      updated = [...selectedLevels, level];
    }
    // Si seleccionaron los 3, equivale a "todos" → resetear
    if (updated.length === ALL_LEVELS.length) {
      updated = [];
    }
    onLevelChange(updated);
  }

  // ─── ¿Hay algún filtro activo? ──────────────────────────
  const hasActiveFilters =
    selectedChapter !== null || selectedLevels.length > 0;

  // ─── Handler para limpiar todos los filtros ─────────────
  function handleClearAll() {
    onChapterChange(null);
    onLevelChange([]);
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      {/* ─── Encabezado ─── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
          <Filter className="size-4" />
          <span>Filtros</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="
              flex items-center gap-1 text-xs text-slate-500
              hover:text-slate-300 transition-colors cursor-pointer
            "
          >
            <X className="size-3" />
            Limpiar
          </button>
        )}
      </div>

      {/* ─── Filtro por capítulo ─── */}
      <div className="mb-3">
        <p className="text-xs text-slate-500 mb-2">Capítulo</p>
        <div className="flex flex-wrap gap-2">
          {/* Pill "Todos" */}
          <button
            onClick={() => onChapterChange(null)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-lg border
              transition-colors cursor-pointer
              ${
                selectedChapter === null
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                  : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
              }
            `}
          >
            Todos
          </button>

          {/* Pills por capítulo */}
          {availableChapters.map((ch) => (
            <button
              key={ch}
              onClick={() =>
                onChapterChange(selectedChapter === ch ? null : ch)
              }
              title={CHAPTER_NAMES[ch] ?? `Capítulo ${ch}`}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-lg border
                transition-colors cursor-pointer
                ${
                  selectedChapter === ch
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                    : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700/50 hover:text-slate-300"
                }
              `}
            >
              Cap. {ch}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Filtro por nivel K ─── */}
      <div>
        <p className="text-xs text-slate-500 mb-2">Nivel Cognitivo</p>
        <div className="flex gap-2">
          {ALL_LEVELS.map((level) => {
            const isActive =
              selectedLevels.length === 0 || selectedLevels.includes(level);
            const colors = LEVEL_COLORS[level];
            return (
              <button
                key={level}
                onClick={() => handleLevelToggle(level)}
                className={`
                  px-3 py-1.5 text-xs font-semibold rounded-lg border
                  transition-colors cursor-pointer
                  ${isActive ? colors.active : colors.inactive}
                `}
              >
                {level}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
