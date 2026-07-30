// ============================================================
// plan-stats.tsx — Métricas del plan en tarjetas
// ============================================================
// TIPO: Server Component
//
// RESPONSABILIDAD ÚNICA:
//   Mostrar métricas del plan en un grid de 4 tarjetas:
//   1. Total de sesiones y días
//   2. Fecha de inicio y fin
//   3. Cobertura de tópicos (cubiertos/total)
//   4. Distribución por nivel K (K1/K2/K3)
//
// ¿POR QUÉ NO ES CLIENT COMPONENT?
//   No hay interactividad. Todas las métricas se calculan en el
//   servidor y se renderizan como HTML estático. Resultado: 0 KB
//   de JavaScript adicional enviado al navegador.
//
// PATRÓN DE DISEÑO:
//   Composición > Herencia. En lugar de un componente genérico
//   "MetricCard" con 20 props, creamos tarjetas especializadas
//   dentro de un grid, cada una con su propia lógica de display.
// ============================================================

import type { ComponentType } from "react";
import { Calendar, GraduationCap, BookOpen, Layers } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────

type PlanStatsProps = {
  /** Número total de sesiones (típicamente 14) */
  totalSessions: number;
  /** Número de días del plan (típicamente 7) */
  totalDays: number;
  /** Fecha de inicio del plan (ISO string: "2026-06-30") */
  startDate: string;
  /** Fecha estimada de fin (ISO string: "2026-07-06") */
  estimatedEndDate: string;
  /** Tópicos cubiertos por el plan */
  coveredTopics: number;
  /** Total de tópicos del syllabus */
  totalTopics: number;
  /** Distribución por nivel K */
  topicsPerLevel: {
    K1: number;
    K2: number;
    K3: number;
  };
};

// ─── Helper ───────────────────────────────────────────────────

/**
 * Formatea una fecha ISO (YYYY-MM-DD) a formato legible en español.
 *
 * ¿Por qué agregar T12:00:00?
 *   new Date("2026-06-30") se interpreta como UTC medianoche.
 *   En zonas horarias negativas (ej. UTC-6 México), esto resulta
 *   en "29 de junio" en lugar de "30 de junio".
 *   Al usar T12:00:00, el mediodía UTC cae en el mismo día calendario
 *   para todas las zonas horarias del mundo (±12h max).
 */
function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(dateStr + "T12:00:00"));
  } catch {
    // Si la fecha es inválida, retornar el string original.
    // Esto evita que un dato corrupto crashee toda la página.
    return dateStr;
  }
}

// ─── Componente auxiliar: MetricCard ──────────────────────────

/**
 * Tarjeta individual de métrica. Componente interno (no exportado).
 *
 * ¿Por qué no exportarla?
 *   Porque MetricCard solo tiene sentido dentro del contexto de PlanStats.
 *   Si la exportáramos, cualquier archivo podría usarla y crearíamos
 *   acoplamiento innecesario. Mejor mantenerla privada.
 */
function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  /** Componente de ícono de lucide-react */
  icon: ComponentType<{ className?: string }>;
  /** Etiqueta de la métrica (ej. "Sesiones") */
  label: string;
  /** Valor principal (ej. "14") */
  value: string;
  /** Detalle secundario (ej. "14 días") */
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-5">
      {/* Fila superior: ícono + etiqueta */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-emerald-400" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      {/* Valor principal grande */}
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {/* Detalle secundario */}
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────

export function PlanStats({
  totalSessions,
  totalDays,
  startDate,
  estimatedEndDate,
  coveredTopics,
  totalTopics,
  topicsPerLevel,
}: PlanStatsProps) {
  // Calcular el porcentaje de cobertura para el detalle.
  // Math.round evita decimales largos (ej. 98.41269... → 98).
  const coveragePercent =
    totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0;

  return (
    // Grid responsivo:
    // - Mobile: 1 columna (las tarjetas se apilan)
    // - Tablet (md): 2 columnas
    // - Desktop (lg): 4 columnas (todas en una fila)
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={GraduationCap}
        label="Sesiones"
        value={String(totalSessions)}
        detail={`${totalDays} días de estudio`}
      />

      <MetricCard
        icon={Calendar}
        label="Periodo"
        value={formatDate(startDate)}
        detail={`Fin: ${formatDate(estimatedEndDate)}`}
      />

      <MetricCard
        icon={BookOpen}
        label="Cobertura"
        value={`${coveredTopics}/${totalTopics}`}
        detail={`${coveragePercent}% del syllabus`}
      />

      <MetricCard
        icon={Layers}
        label="Niveles K"
        value={`K1:${topicsPerLevel.K1} K2:${topicsPerLevel.K2} K3:${topicsPerLevel.K3}`}
        detail="Distribución del plan"
      />
    </div>
  );
}
