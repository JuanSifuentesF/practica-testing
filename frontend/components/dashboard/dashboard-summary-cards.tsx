"use client";

// ============================================================
// components/dashboard/dashboard-summary-cards.tsx
// ============================================================
// TIPO: Client Component ('use client')
//
// RESPONSABILIDADES:
//   1. Recibir DashboardMetrics desde DashboardPage.
//   2. Formatear la fecha estimada del examen sin desfase horario.
//   3. Calcular días restantes desde la fecha actual del navegador.
//   4. Mostrar contadores ejecutivos: progreso, sesiones, racha y estado.
//   5. Normalizar valores parciales para que la UI no reviente.
//
// NO HACE:
//   - Fetch de datos (eso lo hace DashboardPage).
//   - Queries a Supabase.
//   - Mutaciones del plan.
//
// PATRON: Presentation Component
//   Solo sabe dibujar lo que recibe como props.
//   Toda la lógica de obtención de datos vive en DashboardPage.
// ============================================================

import type { DashboardMetrics } from "@/types/dashboard";

// ──────────────────────────────────────────────────────────────
// Props del componente
// ──────────────────────────────────────────────────────────────

interface DashboardSummaryCardsProps {
  metrics: DashboardMetrics;
}

// ──────────────────────────────────────────────────────────────
// Sistema de tonos semánticos
// ──────────────────────────────────────────────────────────────

type Tone = "emerald" | "sky" | "amber" | "rose" | "violet" | "slate";

interface StatCardProps {
  label: string;
  value: string;
  helper: string;
  tone: Tone;
}

// Clases para el contenedor principal de la tarjeta de fecha
const TONE_CLASSES: Record<Tone, string> = {
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  slate: "border-slate-700 bg-slate-800/40 text-slate-300",
};

// Clases para el valor numérico de las StatCards
const TONE_TEXT_CLASSES: Record<Tone, string> = {
  emerald: "text-emerald-300",
  sky: "text-sky-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  violet: "text-violet-300",
  slate: "text-slate-300",
};

// ──────────────────────────────────────────────────────────────
// Labels del estado del plan
// ──────────────────────────────────────────────────────────────

const PLAN_STATUS_LABELS: Record<DashboardMetrics["plan_status"], string> = {
  active: "Activo",
  completed: "Completado",
  abandoned: "Abandonado",
};

// ──────────────────────────────────────────────────────────────
// Funciones auxiliares de normalización
// ──────────────────────────────────────────────────────────────

function safeNumber(value: number | null | undefined, fallback = 0): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return value;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

// ──────────────────────────────────────────────────────────────
// Funciones auxiliares de fecha
// ──────────────────────────────────────────────────────────────

function formatDateEsMx(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return "Sin fecha";
  }

  try {
    return new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${isoDate}T00:00:00Z`));
  } catch {
    return isoDate;
  }
}

function daysUntilIsoDate(isoDate: string | null | undefined): number | null {
  if (!isoDate) {
    return null;
  }

  const targetMs = Date.parse(`${isoDate}T00:00:00Z`);

  if (Number.isNaN(targetMs)) {
    return null;
  }

  const now = new Date();
  const todayUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  return Math.ceil((targetMs - todayUtcMs) / (1000 * 60 * 60 * 24));
}

function getCountdownCopy(daysRemaining: number | null): string {
  if (daysRemaining === null) {
    return "Fecha estimada de examen";
  }

  if (daysRemaining > 1) {
    return `${daysRemaining} días restantes`;
  }

  if (daysRemaining === 1) {
    return "1 día restante";
  }

  if (daysRemaining === 0) {
    return "El examen estimado es hoy";
  }

  return "La fecha estimada ya pasó";
}

function getCountdownTone(daysRemaining: number | null): Tone {
  if (daysRemaining === null) {
    return "slate";
  }

  if (daysRemaining < 0) {
    return "rose";
  }

  if (daysRemaining <= 3) {
    return "amber";
  }

  return "violet";
}

function getProgressTone(percent: number): Tone {
  if (percent >= 70) {
    return "emerald";
  }

  if (percent >= 40) {
    return "sky";
  }

  return "amber";
}

// ──────────────────────────────────────────────────────────────
// Sub-componente: Tarjeta de métrica individual
// ──────────────────────────────────────────────────────────────

function StatCard({ label, value, helper, tone }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-xl shadow-black/10">
      <p className="text-sm font-medium text-slate-400">{label}</p>

      <p className={`mt-2 text-3xl font-bold ${TONE_TEXT_CLASSES[tone]}`}>
        {value}
      </p>

      <p className="mt-2 text-xs leading-relaxed text-slate-500">{helper}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Componente principal exportado
// ──────────────────────────────────────────────────────────────

export function DashboardSummaryCards({ metrics }: DashboardSummaryCardsProps) {
  const completionPercent = clampPercent(
    safeNumber(metrics.completion_percent),
  );
  const totalTopics = Math.max(0, safeNumber(metrics.topic_status?.total));
  const masteredTopics = Math.min(
    Math.max(0, safeNumber(metrics.topic_status?.mastered)),
    totalTopics,
  );
  const totalSessions = Math.max(0, safeNumber(metrics.total_sessions));
  const completedSessions = Math.min(
    Math.max(0, safeNumber(metrics.completed_sessions)),
    totalSessions === 0
      ? safeNumber(metrics.completed_sessions)
      : totalSessions,
  );
  const sessionPercent =
    totalSessions === 0
      ? 0
      : Math.round((completedSessions / totalSessions) * 100);
  const currentStreak = Math.max(0, safeNumber(metrics.current_streak));
  const daysRemaining = daysUntilIsoDate(metrics.estimated_end_date);
  const countdownTone = getCountdownTone(daysRemaining);
  const progressTone = getProgressTone(completionPercent);
  const planStatusLabel =
    PLAN_STATUS_LABELS[metrics.plan_status] ?? "Desconocido";

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 shadow-2xl shadow-black/20">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_2fr]">
        <div
          className={`rounded-2xl border p-6 ${TONE_CLASSES[countdownTone]}`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] opacity-80">
            Fecha estimada de examen
          </p>

          <p className="mt-4 text-4xl font-black tracking-tight text-white">
            {formatDateEsMx(metrics.estimated_end_date)}
          </p>

          <p className="mt-3 text-sm font-semibold">
            {getCountdownCopy(daysRemaining)}
          </p>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-300">Inicio del plan</span>
              <span className="font-semibold text-white">
                {formatDateEsMx(metrics.start_date)}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-300">Duración objetivo</span>
              <span className="font-semibold text-white">
                {safeNumber(metrics.objective_days)} días
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-300">Estado</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white">
                {planStatusLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Progreso de tópicos"
            value={`${completionPercent.toFixed(1)}%`}
            helper={`${masteredTopics} de ${totalTopics} tópicos dominados`}
            tone={progressTone}
          />

          <StatCard
            label="Sesiones completadas"
            value={`${completedSessions}/${totalSessions}`}
            helper={`${sessionPercent}% del calendario ejecutado`}
            tone="sky"
          />

          <StatCard
            label="Racha actual"
            value={`${currentStreak} ${currentStreak === 1 ? "día" : "días"}`}
            helper={
              currentStreak > 0
                ? "Hay consistencia reciente en el estudio."
                : "Completa una sesión hoy para activar la racha."
            }
            tone={currentStreak > 0 ? "amber" : "slate"}
          />

          <StatCard
            label="Plan"
            value={planStatusLabel}
            helper="Estado calculado desde study_plans.status"
            tone={metrics.plan_status === "active" ? "emerald" : "slate"}
          />
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400 transition-[width] duration-700"
          style={{ width: `${completionPercent}%` }}
          aria-label={`Progreso general ${completionPercent.toFixed(1)} por ciento`}
        />
      </div>
    </section>
  );
}
