// ============================================================
// plan-calendar.tsx — Calendario visual dinámico del plan
// ============================================================
// TIPO: Server Component
//
// RESPONSABILIDAD:
//   1. Agrupar las sesiones por day_number
//   2. Calcular la fecha real de cada día
//   3. Determinar cuál es "hoy"
//   4. Identificar la primera sesión pendiente del plan
//   5. Renderizar los DayCards con toda esta información
//
// PATRÓN DE DATOS:
//   Las sesiones llegan como un array plano (flat) ordenado.
//   Este componente las transforma en una estructura jerárquica:
//
//   Input:  [session1, session2, ..., session14]
//   Output: Map { 1: [mañana, noche], 2: [mañana, noche], ... }
//
//   Esta transformación se llama "groupBy" y es un patrón funcional
//   muy común en programación. JavaScript no tiene un Array.groupBy
//   nativo en todos los entornos, así que lo implementamos manualmente.
// ============================================================

import { CalendarDays } from "lucide-react";
import { DayCard } from "./day-card";
import type { DaySession } from "./day-card";

// ─── Tipos ────────────────────────────────────────────────────

/** Datos de sesión de la tabla `sessions` de Supabase */
type PersistedSession = {
  id: string;
  day_number: number;
  session_type: string;
  topic_codes: string[];
  method_used: string;
  duration_minutes: number;
  status: string;
  scheduled_at: string | null;
  score_percent: number | null;
};

/** Metadata adicional del plan_json (no persiste en sessions) */
type PlanJsonSession = {
  day_number?: number;
  session_type?: string;
  difficulty?: string;
  title?: string;
};

type PlanCalendarProps = {
  /** Sesiones del plan (de la tabla sessions) */
  sessions: PersistedSession[];
  /** Sesiones del plan_json (metadata: difficulty, title) */
  planJsonSessions: PlanJsonSession[];
  /** Fecha de inicio del plan (ISO: "2026-06-30") */
  startDate: string;
  /** Número total de días del plan */
  totalDays: number;
  /** ID de la primera sesión pendiente (para el botón "Empezar") */
  firstPendingSessionId: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Ordena los tipos de sesión en orden lógico.
 * Mañana (1) siempre va antes que Noche (2), etc.
 */
function getSessionOrder(sessionType: string): number {
  switch (sessionType) {
    case "morning":
      return 1;
    case "night":
      return 2;
    case "reinforcement":
      return 3;
    case "mock_exam":
      return 4;
    default:
      return 5;
  }
}

/**
 * Busca la metadata del plan_json que corresponde a una sesión persistida.
 *
 * La relación se hace por (day_number + session_type), NO por índice.
 * Esto es más robusto porque el orden del array plan_json puede
 * diferir del orden en la tabla sessions.
 */
function findPlanJsonSession(
  planJsonSessions: PlanJsonSession[],
  persistedSession: PersistedSession,
): PlanJsonSession | undefined {
  return planJsonSessions.find(
    (jsonSession) =>
      jsonSession.day_number === persistedSession.day_number &&
      jsonSession.session_type === persistedSession.session_type,
  );
}

/**
 * Calcula la fecha real de un día del plan.
 *
 * @param startDate - Fecha de inicio del plan (ISO: "2026-06-30")
 * @param dayNumber - Número del día (1-totalDays)
 * @returns Fecha ISO del día (ej. "2026-07-02" para day 3)
 *
 * ALGORITMO:
 *   1. Parsear startDate como Date (con T12:00:00 para timezone safety)
 *   2. Sumar (dayNumber - 1) días al Date
 *   3. Formatear de vuelta a ISO string (YYYY-MM-DD)
 *
 * ¿Por qué dayNumber - 1?
 *   Porque day_number = 1 es el PRIMER día = start_date.
 *   day_number = 2 es start_date + 1 día, etc.
 */
function calculateDayDate(startDate: string, dayNumber: number): string {
  const date = new Date(startDate + "T12:00:00");
  date.setDate(date.getDate() + (dayNumber - 1));

  // Formatear a YYYY-MM-DD usando métodos de Date.
  // padStart(2, "0") asegura que los meses/días de un dígito
  // tengan un cero al inicio (ej. "7" → "07").
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Verifica si una fecha ISO es "hoy" en el servidor.
 *
 * Compara solo la parte de fecha (YYYY-MM-DD) para evitar
 * problemas con horas y zonas horarias.
 */
function isDateToday(dateStr: string): boolean {
  const today = new Date();
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return dateStr === todayStr;
}

// ─── Componente ───────────────────────────────────────────────

export function PlanCalendar({
  sessions,
  planJsonSessions,
  startDate,
  totalDays,
  firstPendingSessionId,
}: PlanCalendarProps) {
  // ═══════════════════════════════════════════════════════════
  // PASO 1: Agrupar sesiones por day_number
  // ═══════════════════════════════════════════════════════════
  // Map<number, PersistedSession[]> donde key = day_number.
  //
  // Usamos Map en lugar de Object porque:
  // 1. Las claves numéricas mantienen su tipo (no se convierten a string)
  // 2. Map preserva el orden de inserción
  // 3. Map tiene .size para obtener el conteo sin Object.keys()

  const sessionsByDay = new Map<number, PersistedSession[]>();

  // Ordenar sesiones antes de agrupar para garantizar
  // que mañana siempre aparezca antes que noche.
  const sortedSessions = [...sessions].sort((a, b) => {
    const dayDiff = a.day_number - b.day_number;
    if (dayDiff !== 0) return dayDiff;
    return getSessionOrder(a.session_type) - getSessionOrder(b.session_type);
  });

  for (const session of sortedSessions) {
    const existing = sessionsByDay.get(session.day_number) || [];
    existing.push(session);
    sessionsByDay.set(session.day_number, existing);
  }

  // ═══════════════════════════════════════════════════════════
  // PASO 2: Generar los datos de cada día
  // ═══════════════════════════════════════════════════════════
  // Iteramos del día 1 al totalDays (típicamente 7).
  // Incluso si un día no tiene sesiones (improbable pero posible),
  // lo mostramos con un estado vacío.

  const days = Array.from({ length: totalDays }, (_, i) => {
    const dayNumber = i + 1;
    const dayDate = calculateDayDate(startDate, dayNumber);
    const daySessions = sessionsByDay.get(dayNumber) || [];

    // Transformar PersistedSession → DaySession (agregar metadata del plan_json)
    const enrichedSessions: DaySession[] = daySessions.map((session, index) => {
      const jsonSession = findPlanJsonSession(planJsonSessions, session);

      return {
        id: session.id,
        sessionType: session.session_type,
        title: jsonSession?.title || `Sesión ${dayNumber}.${index + 1}`,
        difficulty: jsonSession?.difficulty,
        durationMinutes: session.duration_minutes,
        topicCodes: session.topic_codes,
        methodUsed: session.method_used,
        status: session.status,
        scheduledAt: session.scheduled_at,
        scorePercent: session.score_percent,
        // Solo la primera sesión pendiente del plan completo
        // recibe isFirstPending = true.
        isFirstPending: session.id === firstPendingSessionId,
      };
    });

    return {
      dayNumber,
      dayDate,
      isToday: isDateToday(dayDate),
      sessions: enrichedSessions,
    };
  });

  // ═══════════════════════════════════════════════════════════
  // PASO 3: Renderizar
  // ═══════════════════════════════════════════════════════════

  // Estado vacío: si no hay sesiones en absoluto
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <CalendarDays className="mx-auto h-12 w-12 text-slate-600" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          No hay sesiones programadas
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Este plan no tiene sesiones. Intenta generar un nuevo plan desde la
          página de configuración.
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {/* ── Header de sección ──────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-emerald-400" />
          <h2 className="text-xl font-semibold text-white">
            Calendario de Estudio
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          {sessions.length} sesiones · {totalDays} días
        </p>
      </div>

      {/* ── Barra de progreso visual ───────────────────────── */}
      {/*
        Muestra una barra horizontal que indica cuántas sesiones
        se han completado vs el total. Útil como vista rápida
        del avance del plan.
      */}
      {(() => {
        const completed = sessions.filter(
          (s) => s.status === "completed",
        ).length;
        const progressPercent =
          sessions.length > 0
            ? Math.round((completed / sessions.length) * 100)
            : 0;

        return (
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-400">
              {completed}/{sessions.length} completadas
            </span>
          </div>
        );
      })()}

      {/* ── DayCards ────────────────────────────────────────── */}
      {/*
        Cada DayCard ocupa el ancho completo.
        Los días se apilan verticalmente como una timeline.
        El gap-6 (24px) crea separación visual entre días.
      */}
      <div className="flex flex-col gap-6">
        {days.map((day) => (
          <DayCard
            key={day.dayNumber}
            dayNumber={day.dayNumber}
            dayDate={day.dayDate}
            isToday={day.isToday}
            sessions={day.sessions}
          />
        ))}
      </div>
    </section>
  );
}
