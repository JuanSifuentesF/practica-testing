"use client";

// ============================================================
// components/dashboard/time-comparison-chart.tsx
// ============================================================
// TIPO: Client Component ('use client')
//
// RESPONSABILIDADES:
//   1. Recibir metrics.time_comparison desde /api/dashboard/metrics.
//   2. Normalizar valores nulos o parciales sin romper la UI.
//   3. Mostrar tiempo estimado vs tiempo real por sesión.
//   4. Calcular resumen de promedio real y desviación total.
//
// NO HACE:
//   - Fetch de datos
//   - Queries a Supabase
//   - Mutaciones o envíos de formularios
// ============================================================

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { TimeComparison } from "@/types/dashboard";

interface TimeComparisonChartProps {
  /** Array creado por GET /api/dashboard/metrics en DA-01 */
  data: TimeComparison[];
}

type EfficiencyStatus = "faster" | "on_track" | "slower" | "unknown";

interface TimeChartDatum extends TimeComparison {
  label: string;
  actual_minutes: number | null;
  variance_minutes: number | null;
  efficiency_percent: number | null;
  status: EfficiencyStatus;
}

const SESSION_TYPE_LABELS: Record<TimeComparison["session_type"], string> = {
  morning: "Mañana",
  night: "Noche",
  reinforcement: "Refuerzo",
  mock_exam: "Simulacro",
};

const ESTIMATED_COLOR = "#38bdf8";

const ACTUAL_COLORS: Record<EfficiencyStatus, string> = {
  faster: "#34d399",
  on_track: "#fbbf24",
  slower: "#fb7185",
  unknown: "#64748b",
};

function toPositiveMinutes(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return null;
  }

  return Math.round(value);
}

function getSessionShortLabel(
  sessionType: TimeComparison["session_type"],
): string {
  switch (sessionType) {
    case "morning":
      return "AM";
    case "night":
      return "PM";
    case "reinforcement":
      return "RF";
    case "mock_exam":
      return "EX";
    default:
      return "SE";
  }
}

function getEfficiencyStatus(
  estimatedMinutes: number,
  actualMinutes: number | null,
): EfficiencyStatus {
  if (actualMinutes === null) {
    return "unknown";
  }

  const lowerBound = estimatedMinutes * 0.9;
  const upperBound = estimatedMinutes * 1.1;

  if (actualMinutes < lowerBound) {
    return "faster";
  }

  if (actualMinutes > upperBound) {
    return "slower";
  }

  return "on_track";
}

function getStatusLabel(status: EfficiencyStatus): string {
  switch (status) {
    case "faster":
      return "Más rápido";
    case "on_track":
      return "En rango";
    case "slower":
      return "Más lento";
    case "unknown":
    default:
      return "Sin registro";
  }
}

function normalizeTimeData(
  data: TimeComparison[] | null | undefined,
): TimeChartDatum[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((entry, index): TimeChartDatum => {
      const estimatedMinutes =
        toPositiveMinutes(entry?.estimated_minutes) ?? 90;
      const actualMinutes = toPositiveMinutes(entry?.actual_minutes);
      const status = getEfficiencyStatus(estimatedMinutes, actualMinutes);
      const varianceMinutes =
        actualMinutes === null ? null : actualMinutes - estimatedMinutes;
      const efficiencyPercent =
        actualMinutes === null
          ? null
          : Math.round((actualMinutes / estimatedMinutes) * 100);

      return {
        session_id: entry?.session_id ?? `session-${index}`,
        day_number: entry?.day_number ?? index + 1,
        session_type: entry?.session_type ?? "morning",
        estimated_minutes: estimatedMinutes,
        actual_minutes: actualMinutes,
        label: `D${entry?.day_number ?? index + 1} ${getSessionShortLabel(
          entry?.session_type ?? "morning",
        )}`,
        variance_minutes: varianceMinutes,
        efficiency_percent: efficiencyPercent,
        status,
      };
    })
    .sort((a, b) => {
      if (a.day_number !== b.day_number) {
        return a.day_number - b.day_number;
      }

      return a.session_type.localeCompare(b.session_type);
    });
}

function calculateAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

function formatSignedMinutes(value: number | null): string {
  if (value === null) {
    return "Sin datos";
  }

  if (value === 0) {
    return "0 min";
  }

  return value > 0 ? `+${value} min` : `${value} min`;
}

function CustomTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0]?.payload as TimeChartDatum | undefined;

  if (!data) {
    return null;
  }

  const statusColor = ACTUAL_COLORS[data.status];

  return (
    <div className="min-w-[240px] rounded-xl border border-slate-700 bg-slate-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
      <div className="mb-3 border-b border-slate-800 pb-3">
        <p className="text-sm font-bold text-white">
          Día {data.day_number} — {SESSION_TYPE_LABELS[data.session_type]}
        </p>
        <p className="mt-1 text-xs text-slate-500">Sesión {data.session_id}</p>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Estimado</span>
          <span className="font-semibold text-sky-300">
            {data.estimated_minutes} min
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Real</span>
          <span className="font-semibold" style={{ color: statusColor }}>
            {data.actual_minutes === null
              ? "Sin registro"
              : `${data.actual_minutes} min`}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Diferencia</span>
          <span className="font-semibold text-slate-100">
            {formatSignedMinutes(data.variance_minutes)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Estado</span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {getStatusLabel(data.status)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TimeComparisonChart({ data }: TimeComparisonChartProps) {
  const chartData = normalizeTimeData(data);
  const sessionsWithActual = chartData.filter(
    (entry) => entry.actual_minutes !== null,
  );
  const averageEstimated = calculateAverage(
    chartData.map((entry) => entry.estimated_minutes),
  );
  const averageActual = calculateAverage(
    sessionsWithActual.map((entry) => entry.actual_minutes ?? 0),
  );
  const totalVariance = sessionsWithActual.reduce(
    (sum, entry) => sum + (entry.variance_minutes ?? 0),
    0,
  );

  if (chartData.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⏱️</span>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Gestión de Tiempo
          </h2>
        </div>

        <div className="mt-5 flex h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-950/30 text-center">
          <p className="text-sm text-slate-400">
            Aún no hay sesiones completadas para comparar.
          </p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Completa una sesión de teoría y quiz para que el dashboard pueda
            calcular tiempo estimado vs tiempo real.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl shadow-black/10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Tiempo Real vs Estimado
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Compara los minutos planificados para cada sesión contra el tiempo
            real registrado entre started_at y completed_at.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
            <p className="text-slate-500">Prom. estimado</p>
            <p className="mt-1 text-lg font-bold text-sky-300">
              {averageEstimated ?? 0}m
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
            <p className="text-slate-500">Prom. real</p>
            <p className="mt-1 text-lg font-bold text-emerald-300">
              {averageActual === null ? "--" : `${averageActual}m`}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
            <p className="text-slate-500">Desvío total</p>
            <p className="mt-1 text-lg font-bold text-amber-300">
              {formatSignedMinutes(totalVariance)}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-4 text-xs text-slate-300">
        <span className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: ESTIMATED_COLOR }}
          />
          Estimado
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-400" />
          Real rápido
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-amber-400" />
          Real en rango
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-rose-400" />
          Real lento
        </span>
      </div>

      <div className="h-[360px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 12, right: 8, left: -16, bottom: 8 }}
            barGap={4}
            barCategoryGap="18%"
          >
            <CartesianGrid
              stroke="#334155"
              strokeDasharray="3 3"
              strokeOpacity={0.45}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={{ stroke: "#475569" }}
              axisLine={{ stroke: "#475569" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={(value: number) => `${value}m`}
              tickLine={{ stroke: "#475569" }}
              axisLine={{ stroke: "#475569" }}
            />
            <ReferenceLine
              y={averageEstimated ?? 90}
              stroke="#38bdf8"
              strokeDasharray="6 4"
              strokeOpacity={0.45}
              label={{
                value: "Promedio estimado",
                position: "insideTopRight",
                fill: "#7dd3fc",
                fontSize: 11,
              }}
            />
            <Tooltip
              content={CustomTooltip}
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            />
            <Bar
              dataKey="estimated_minutes"
              name="Estimado"
              fill={ESTIMATED_COLOR}
              radius={[8, 8, 0, 0]}
            />
            <Bar dataKey="actual_minutes" name="Real" radius={[8, 8, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.session_id}
                  fill={ACTUAL_COLORS[entry.status]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {sessionsWithActual.length < chartData.length && (
        <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
          Algunas sesiones no tienen tiempo real porque falta started_at o
          completed_at. El chart las mantiene visibles para que el dashboard no
          oculte datos incompletos.
        </p>
      )}
    </section>
  );
}
