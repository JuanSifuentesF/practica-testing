// ============================================================
// components/session/collapsible-section.tsx
// Sección colapsable reutilizable con animación
// ============================================================
// TIPO: Client Component (necesita useState para el toggle)
//
// PROPS:
//   - title: string — Título de la sección
//   - icon: LucideIcon — Ícono que acompaña al título
//   - defaultOpen?: boolean — Si la sección inicia abierta
//   - children: ReactNode — Contenido de la sección
//   - badge?: string — Badge opcional junto al título
//
// DISEÑO:
//   El header es un <button> semántico para accesibilidad.
//   La animación usa grid-rows de 0fr → 1fr (truco CSS moderno)
//   que anima la altura de manera suave sin JavaScript.
// ============================================================

"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: string;
}

export function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  badge,
}: CollapsibleSectionProps) {
  // ─── Estado: abierto o cerrado ────────────────────────────
  // defaultOpen determina el estado inicial. Las secciones
  // de "Introducción" y "Conceptos clave" se abren por defecto
  // para que el estudiante vea contenido al cargar la página.
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      {/* ── Header clicable ──────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-800/50"
        // aria-expanded es importante para lectores de pantalla.
        // Indica si la sección está expandida o colapsada.
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-100">{title}</span>
          {badge && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
              {badge}
            </span>
          )}
        </div>
        {/* ── Chevron con rotación animada ─────────────────── */}
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      {/* ── Contenido colapsable ─────────────────────────────── */}
      {/* Truco CSS: grid con grid-template-rows animado.
          - Cerrado: grid-rows: 0fr → el contenido tiene height: 0
          - Abierto: grid-rows: 1fr → el contenido tiene su height natural
          - overflow: hidden oculta el contenido cuando está colapsado
          - transition en grid-template-rows da la animación suave */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
