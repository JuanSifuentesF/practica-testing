// ============================================================
// plan-header.tsx — Cabecera del plan de estudio
// ============================================================
// TIPO: Server Component (NO tiene 'use client')
//
// RESPONSABILIDAD ÚNICA:
//   Mostrar la identidad visual del plan: título, estado, resumen,
//   y la acción de "Generar otro plan".
//
// ¿POR QUÉ SERVER COMPONENT?
//   No hay interactividad — solo renderiza datos estáticos que
//   vienen del servidor. El <Link> de Next.js funciona en Server
//   Components porque es un componente que el framework resuelve
//   durante el build/render del servidor.
//
// PROPS:
//   - status: el estado actual del plan (active, completed, abandoned)
//   - planId: UUID del plan (para mostrar al usuario avanzado)
//   - summary: resumen textual generado por la IA (puede ser null)
// ============================================================

import Link from "next/link";
import { BookOpen, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Tipos ────────────────────────────────────────────────────
// Definimos las props como un type dedicado para claridad.
// Esto es más limpio que inline props en la firma de la función.

type PlanHeaderProps = {
  /** Estado del plan: "active" | "completed" | "abandoned" */
  status: string;
  /** UUID del plan para referencia */
  planId: string;
  /** Resumen generado por la IA (puede no existir) */
  summary: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Traduce el estado del plan a español con su color correspondiente.
 *
 * Patrón: función pura que recibe un valor y retorna datos de display.
 * Esto separa la lógica de presentación del componente, facilitando
 * pruebas unitarias y reutilización.
 */
function getStatusDisplay(status: string) {
  switch (status) {
    case "active":
      return {
        label: "Activo",
        // bg con opacidad baja + texto brillante + borde sutil
        // Este patrón de 3 capas crea profundidad visual en tema oscuro
        className:
          "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30",
      };
    case "completed":
      return {
        label: "Completado",
        className:
          "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30",
      };
    case "abandoned":
      return {
        label: "Abandonado",
        className:
          "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30",
      };
    default:
      return {
        label: status,
        className: "bg-muted text-muted-foreground border-border",
      };
  }
}

// ─── Componente ───────────────────────────────────────────────

export function PlanHeader({ status, planId, summary }: PlanHeaderProps) {
  // Obtener los datos de display para el estado actual.
  // Llamar al helper FUERA del JSX mantiene el template limpio.
  const statusDisplay = getStatusDisplay(status);

  return (
    <section className="flex flex-col gap-4">
      {/* ── Fila superior: Título + Acción ──────────────────── */}
      {/*
        flex-col en mobile: el título y el botón se apilan verticalmente.
        md:flex-row en desktop: se ponen lado a lado.
        md:items-start: alinea al tope (no al centro) porque el título
        puede ser más alto que el botón si el resumen es largo.
        md:justify-between: empuja el botón al extremo derecho.
      */}
      <div
        className="flex flex-col gap-4 rounded-xl border border-emerald-900/60
                    bg-emerald-950/20 p-6 md:flex-row md:items-start
                    md:justify-between"
      >
        <div className="flex flex-col gap-2">
          {/* ── Label + Status Badge ────────────────────── */}
          <div className="flex items-center gap-3">
            {/* Ícono decorativo — BookOpen de lucide-react */}
            <BookOpen className="h-5 w-5 text-emerald-400" />
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-400">
              Plan de estudio
            </p>
            {/*
              Badge de shadcn/ui con variante "outline" + clases custom.
              Usamos "outline" como base y sobreescribimos los colores
              con las clases del helper getStatusDisplay().
            */}
            <Badge variant="outline" className={statusDisplay.className}>
              {statusDisplay.label}
            </Badge>
          </div>

          {/* ── Título principal ────────────────────────── */}
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tu plan ISTQB está listo
          </h1>

          {/* ── Plan ID (para debugging/soporte) ────────── */}
          {/*
            Mostramos el ID con fuente monoespaciada y color muy tenue.
            Solo es útil para soporte técnico o debugging.
            En producción podrías ocultarlo detrás de un toggle.
          */}
          <p className="text-xs font-mono text-muted-foreground">Plan ID: {planId}</p>
        </div>

        {/* ── Botón "Generar otro plan" ───────────────────── */}
        {/*
          Link de Next.js que navega a /setup sin reload completo.
          Estilizado como botón secundario (borde, sin fondo sólido)
          para no competir visualmente con el botón primario "Empezar".
        */}
        <Link
          href="/setup"
          className="inline-flex h-10 items-center justify-center gap-2
                     rounded-lg border border-border px-4 text-sm
                     font-medium text-foreground transition-colors
                     hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" />
          Generar otro plan
        </Link>
      </div>

      {/* ── Resumen del plan (condicional) ─────────────────── */}
      {/*
        Renderizado condicional: solo se muestra si la IA generó un summary.
        El operador && es un short-circuit: si summary es null/undefined/"",
        React no renderiza nada.
      */}
      {summary ? (
        <div className="rounded-xl border border-border bg-card/50 p-6">
          <h2 className="text-lg font-semibold text-foreground">Resumen</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{summary}</p>
        </div>
      ) : null}
    </section>
  );
}
