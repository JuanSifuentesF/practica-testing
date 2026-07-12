// ============================================================
// plan-preview.tsx — Orquestador del plan de estudio (REFACTORIZADO)
// ============================================================
// TIPO: Server Component (NO tiene 'use client')
//
// VERSIÓN: UP-06 (refactorizado desde UP-05)
//
// RESPONSABILIDADES:
//   1. Recibir planId/documentId del componente padre (page.tsx)
//   2. Hacer las queries a Supabase (study_plans, sessions, topic_progress)
//   3. Manejar estados de error y vacío
//   4. Calcular datos derivados (métricas, primera sesión pendiente)
//   5. DELEGAR la renderización a componentes especializados
//
// EVOLUCIÓN DESDE UP-05:
//   Antes (UP-05): Componente monolítico de 377 líneas que hacía
//     fetch, cálculos, y renderizaba header + métricas + sesiones.
//   Ahora (UP-06): Componente orquestador que delega a:
//     - PlanHeader: título, estado, resumen
//     - PlanStats: métricas en tarjetas
//     - ExamCountdown: cuenta regresiva al examen
//     - PlanCalendar: calendario dinámico por objective_days
//
// PRINCIPIO APLICADO:
//   "Smart Container / Dumb Components" (Contenedor inteligente /
//   Componentes presentacionales). PlanPreview es el "smart container"
//   que sabe cómo obtener datos. Los componentes hijos son "dumb"
//   (presentacionales) — solo saben renderizar las props que reciben.
// ============================================================

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Importar componentes hijos (todos co-localizados en _components/)
import { PlanHeader } from "./plan-header";
import { PlanStats } from "./plan-stats";
import { ExamCountdown } from "./exam-countdown";
import { PlanCalendar } from "./plan-calendar";

// ─── Tipos ────────────────────────────────────────────────────
// Definimos tipos locales para los datos que recibimos de Supabase.
// Estos tipos son específicos de este componente — no los reutilizamos
// fuera de aquí, así que no necesitan ir a types/database.ts.

type PlanSession = {
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

type StudyPlan = {
  id: string;
  document_id: string;
  objective_days: number;
  start_date: string;
  estimated_end_date: string;
  status: string;
  plan_json: {
    plan_summary?: string;
    coverage?: {
      total_topics?: number;
      covered_topic_codes?: string[];
      omitted_topic_codes?: string[];
    };
    sessions?: Array<{
      day_number?: number;
      session_type?: string;
      difficulty?: string;
      title?: string;
    }>;
    topics_per_level?: {
      K1?: number;
      K2?: number;
      K3?: number;
    };
  };
  created_at: string;
};

/** Resultado de la query a topic_progress (agregado por level_k) */
type TopicLevelCount = {
  level_k: string | null;
};

type PlanPreviewProps = {
  planId: string | null;
  documentId: string | null; // backward compat con UP-04
};

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Ordena las sesiones por day_number y luego por session_type.
 * Mañana (1) siempre va antes que Noche (2).
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

// ─── Componente principal ─────────────────────────────────────

export async function PlanPreview({ planId, documentId }: PlanPreviewProps) {
  // ═══════════════════════════════════════════════════════════
  // GUARD CLAUSE: Sin identificador, no podemos buscar el plan.
  // ═══════════════════════════════════════════════════════════
  if (!planId && !documentId) {
    return (
      <EmptyState
        title="Plan no encontrado"
        message="La URL no incluye plan_id ni document_id. Vuelve a generar el plan desde Mi Plan."
      />
    );
  }

  // ═══════════════════════════════════════════════════════════
  // QUERY 1: Obtener el plan de estudio
  // ═══════════════════════════════════════════════════════════
  const supabase = await createClient();

  // Construir la query dinámicamente según el identificador disponible.
  // Priorizar plan_id (UP-05+) sobre document_id (UP-04 legacy).
  let planQuery = supabase.from("study_plans").select("*");

  if (planId) {
    planQuery = planQuery.eq("id", planId);
  } else if (documentId) {
    planQuery = planQuery
      .eq("document_id", documentId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
  }

  const { data: planData, error: planError } = await planQuery.maybeSingle();

  if (planError) {
    console.error("[PlanPreview] Error al cargar plan:", planError);
    return (
      <EmptyState
        title="Error al cargar el plan"
        message={`Error al cargar el plan desde Supabase: ${planError.message}`}
      />
    );
  }

  if (!planData) {
    return (
      <EmptyState
        title="Plan no encontrado"
        message="No se encontró un plan con ese identificador. Puede haber sido eliminado o no haberse guardado."
      />
    );
  }

  // ═══════════════════════════════════════════════════════════
  // QUERY 2: Obtener las sesiones del plan
  // ═══════════════════════════════════════════════════════════
  const { data: sessionsData, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      "id, day_number, session_type, topic_codes, method_used, duration_minutes, status, scheduled_at, score_percent",
    )
    .eq("study_plan_id", planData.id)
    .order("day_number", { ascending: true });

  if (sessionsError) {
    console.error("[PlanPreview] Error al cargar sesiones:", sessionsError);
    return (
      <EmptyState
        title="Error al cargar sesiones"
        message={`Error al cargar las sesiones del plan: ${sessionsError.message}`}
      />
    );
  }

  // ═══════════════════════════════════════════════════════════
  // QUERY 3: Obtener topic_progress para distribución por nivel K
  // ═══════════════════════════════════════════════════════════
  // Solo necesitamos el campo level_k para contar K1/K2/K3.
  // Esto es más eficiente que traer todas las columnas.
  const { data: topicData } = await supabase
    .from("topic_progress")
    .select("level_k")
    .eq("study_plan_id", planData.id);

  // ═══════════════════════════════════════════════════════════
  // PROCESAMIENTO DE DATOS
  // ═══════════════════════════════════════════════════════════

  // Cast seguro: Supabase retorna tipos genéricos, los casteamos
  // a nuestros tipos locales que sabemos son correctos.
  const plan = planData as unknown as StudyPlan;

  // Ordenar sesiones por día y luego por tipo.
  const sessions = ((sessionsData || []) as PlanSession[]).sort((a, b) => {
    const dayDiff = a.day_number - b.day_number;
    if (dayDiff !== 0) return dayDiff;
    return getSessionOrder(a.session_type) - getSessionOrder(b.session_type);
  });

  // ── Métricas derivadas ──────────────────────────────────
  const totalSessions = sessions.length;
  const totalDays = plan.objective_days;
  const totalTopics = plan.plan_json?.coverage?.total_topics ?? 0;
  const coveredTopics =
    plan.plan_json?.coverage?.covered_topic_codes?.length ?? 0;

  // Calcular distribución K a partir de topic_progress (DB real)
  // con fallback al plan_json si no hay datos de topic_progress.
  const topicLevels = (topicData || []) as TopicLevelCount[];
  const topicsPerLevel = {
    K1: topicLevels.filter((t) => t.level_k === "K1").length,
    K2: topicLevels.filter((t) => t.level_k === "K2").length,
    K3: topicLevels.filter((t) => t.level_k === "K3").length,
  };

  // Si topic_progress no tiene datos con level_k, usar plan_json como fallback
  const hasKData =
    topicsPerLevel.K1 + topicsPerLevel.K2 + topicsPerLevel.K3 > 0;
  const finalTopicsPerLevel = hasKData
    ? topicsPerLevel
    : {
        K1: plan.plan_json?.topics_per_level?.K1 ?? 0,
        K2: plan.plan_json?.topics_per_level?.K2 ?? 0,
        K3: plan.plan_json?.topics_per_level?.K3 ?? 0,
      };

  // ── Primera sesión pendiente ────────────────────────────
  // Buscar la primera sesión con status "pending" para el botón "Empezar".
  // Las sesiones ya están ordenadas por day_number + session_type,
  // así que .find() retorna la primera en orden cronológico.
  const firstPendingSession = sessions.find((s) => s.status === "pending");
  const firstPendingSessionId = firstPendingSession?.id ?? null;

  // Metadata del plan_json (difficulty, title por sesión)
  const planJsonSessions = plan.plan_json?.sessions || [];

  // ═══════════════════════════════════════════════════════════
  // RENDER: Delegar a componentes especializados
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col gap-6">
      {/* ── 1. Cabecera: título, estado, resumen ────────────── */}
      <PlanHeader
        status={plan.status}
        planId={plan.id}
        summary={plan.plan_json?.plan_summary ?? null}
      />

      {/* ── 2. Métricas: sesiones, fechas, cobertura, K-levels */}
      <PlanStats
        totalSessions={totalSessions}
        totalDays={totalDays}
        startDate={plan.start_date}
        estimatedEndDate={plan.estimated_end_date}
        coveredTopics={coveredTopics}
        totalTopics={totalTopics}
        topicsPerLevel={finalTopicsPerLevel}
      />

      {/* ── 3. Cuenta regresiva al examen ──────────────────── */}
      {/*
        ExamCountdown es un Client Component. Recibe la fecha como
        STRING (serializable) y calcula los días restantes en el browser.
        Esto evita hydration mismatch con cálculos de Date.
      */}
      <ExamCountdown estimatedEndDate={plan.estimated_end_date} />

      {/* ── 4. Calendario de sesiones por día ──────────────── */}
      <PlanCalendar
        sessions={sessions}
        planJsonSessions={planJsonSessions}
        startDate={plan.start_date}
        totalDays={totalDays}
        firstPendingSessionId={firstPendingSessionId}
      />
    </div>
  );
}

// ─── Componente auxiliar: EmptyState ──────────────────────────
// Mantenemos EmptyState en este archivo porque es específico
// de los estados de error de PlanPreview. No lo extraemos porque
// no se reutiliza en otros contextos.

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
        {message}
      </p>
      <Link
        href="/setup"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-lg
                   bg-emerald-500 px-4 text-sm font-medium text-slate-950
                   transition-colors hover:bg-emerald-400"
      >
        Volver a configuración
      </Link>
    </div>
  );
}
