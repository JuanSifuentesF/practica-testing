// ============================================================
// day-card.tsx — Tarjeta de un día del plan (agrupa sesiones)
// ============================================================
// TIPO: Server Component
//
// RESPONSABILIDAD ÚNICA:
//   Agrupar y mostrar las sesiones de UN día del plan:
//   - Header con número de día y fecha real
//   - Indicador "HOY" si el día coincide con la fecha actual
//   - Dificultad general del día (derivada de las sesiones)
//   - Sesiones de mañana y noche como SessionCards
//
// CÁLCULO DE FECHA REAL:
//   El plan guarda start_date y cada sesión tiene day_number (1-totalDays).
//   La fecha del día N se calcula como:
//     dayDate = start_date + (day_number - 1) días
//
//   Ejemplo: si start_date = "2026-06-30" y day_number = 3,
//   entonces dayDate = "2026-07-02" (30 jun + 2 días)
//
// INDICADOR "HOY":
//   Comparamos dayDate con la fecha actual del servidor.
//   Esto funciona en Server Components porque la comparación
//   se hace durante el render del servidor (cada request genera
//   HTML fresco). No hay riesgo de hydration mismatch porque
//   el HTML no cambia entre server render y client hydration
//   (el componente es Server-only, no se hidrata).
// ============================================================

import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SessionCard } from "./session-card";

// ─── Tipos ────────────────────────────────────────────────────

/**
 * Datos de una sesión que DayCard necesita para renderizar SessionCards.
 * Este tipo unifica datos de la tabla `sessions` con metadata del `plan_json`.
 */
export type DaySession = {
  id: string;
  sessionType: string;
  title: string;
  difficulty: string | undefined;
  durationMinutes: number;
  topicCodes: string[];
  methodUsed: string;
  status: string;
  scheduledAt: string | null;
  scorePercent: number | null;
  isFirstPending: boolean;
};

type DayCardProps = {
  /** Número del día (1-totalDays) */
  dayNumber: number;
  /** Fecha real del día como ISO string (calculada por el padre) */
  dayDate: string;
  /** Si este día es "hoy" */
  isToday: boolean;
  /** Sesiones de este día (ya ordenadas: mañana primero) */
  sessions: DaySession[];
};

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Formatea la fecha del día a formato largo en español.
 * Ej: "2026-06-30" → "Lunes 30 de junio"
 */
function formatDayDate(dateStr: string): string {
  try {
    // Crear Date con T12:00:00 para evitar desfase de zona horaria.
    const date = new Date(dateStr + "T12:00:00");
    return new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Deriva la dificultad general del día a partir de sus sesiones.
 *
 * Lógica: si cualquier sesión del día es "hard", el día es "Difícil".
 * Si alguna es "medium" (y ninguna "hard"), el día es "Medio".
 * Si todas son "easy" o no tienen dificultad, el día es "Fácil".
 *
 * Este enfoque de "dificultad máxima" es conservador: prepara
 * al estudiante para el nivel más exigente que encontrará ese día.
 */
function getDayDifficulty(sessions: DaySession[]) {
  const difficulties = sessions
    .map((s) => s.difficulty)
    .filter(Boolean) as string[];

  if (difficulties.includes("hard")) {
    return {
      label: "Difícil",
      className: "bg-red-500/20 text-red-300 border-red-500/30",
    };
  }
  if (difficulties.includes("medium")) {
    return {
      label: "Medio",
      className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    };
  }
  return {
    label: "Fácil",
    className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  };
}

// ─── Componente ───────────────────────────────────────────────

export function DayCard({
  dayNumber,
  dayDate,
  isToday,
  sessions,
}: DayCardProps) {
  const dayDifficulty = getDayDifficulty(sessions);
  const formattedDate = formatDayDate(dayDate);

  // Calcular la duración total del día sumando todas las sesiones.
  const totalDayMinutes = sessions.reduce(
    (sum, s) => sum + s.durationMinutes,
    0,
  );

  return (
    <div
      className={`
        rounded-2xl border p-5 transition-colors
        ${
          isToday
            ? // El día actual tiene un borde más brillante y un fondo
              // con un sutil tinte esmeralda para destacar.
              "border-emerald-500/40 bg-slate-900/80 ring-1 ring-emerald-500/10"
            : "border-slate-800 bg-slate-900/40"
        }
      `}
    >
      {/* ── Header del día ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {/* Número de día en un círculo */}
          <div
            className={`
              flex h-10 w-10 shrink-0 items-center justify-center
              rounded-full text-sm font-bold
              ${
                isToday
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-300"
              }
            `}
          >
            {dayNumber}
          </div>

          <div>
            {/* Fecha formateada + Badge "HOY" */}
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold capitalize text-white">
                {/*
                  capitalize: convierte la primera letra a mayúscula.
                  Intl.DateTimeFormat retorna "lunes 30 de junio" en
                  minúsculas. Con capitalize se convierte en
                  "Lunes 30 de junio".
                */}
                {formattedDate}
              </h3>
              {isToday && (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/20 text-emerald-300
                             border-emerald-500/30 text-xs"
                >
                  HOY
                </Badge>
              )}
            </div>

            {/* Info secundaria: dificultad + duración total */}
            <div className="flex items-center gap-3 mt-0.5">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs text-slate-500">
                Día {dayNumber} · {sessions.length}{" "}
                {sessions.length === 1 ? "sesión" : "sesiones"} ·{" "}
                {totalDayMinutes} min total
              </span>
            </div>
          </div>
        </div>

        {/* Badge de dificultad del día */}
        <Badge variant="outline" className={dayDifficulty.className}>
          {dayDifficulty.label}
        </Badge>
      </div>

      {/* ── Separador visual ─────────────────────────────────── */}
      <div className="my-4 h-px bg-slate-800" />

      {/* ── Sesiones del día ─────────────────────────────────── */}
      {/*
        Grid responsivo:
        - Mobile: 1 columna (sesiones apiladas verticalmente)
        - Desktop (md): 2 columnas (mañana | noche lado a lado)
      */}
      <div className="grid gap-4 md:grid-cols-2">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            sessionId={session.id}
            sessionType={session.sessionType}
            title={session.title}
            difficulty={session.difficulty}
            durationMinutes={session.durationMinutes}
            topicCodes={session.topicCodes}
            methodUsed={session.methodUsed}
            status={session.status}
            scheduledAt={session.scheduledAt}
            scorePercent={session.scorePercent}
            isFirstPending={session.isFirstPending}
          />
        ))}
      </div>
    </div>
  );
}
