"use client";

// ============================================================
// app/(dashboard)/dashboard/page.tsx — Dashboard de Progreso
// ============================================================
// TIPO: Client Component ('use client')
//
// CAMBIO RESPECTO AL PLACEHOLDER (FE-04):
//   Antes era un Server Component con tarjetas estáticas.
//   Ahora es un Client Component que hace fetch al endpoint
//   de métricas (DA-01) y renderiza la gráfica de scores.
//
// ¿POR QUÉ CLIENT COMPONENT?
//   1. Necesita useState para manejar loading/error/datos
//   2. Necesita useEffect para el fetch al montar
//   3. ScoreChart (Recharts) requiere Client Component
//
// PATRÓN: Container Component
//   Esta página es el "container" que obtiene los datos y
//   los pasa a componentes de presentación (ScoreChart, etc.)
//   Los componentes hijos son "puros" — solo reciben props.
//
// FETCH CON COOKIES:
//   Al hacer fetch('/api/dashboard/metrics') desde un Client
//   Component, el navegador envía automáticamente las cookies
"use client";

// ============================================================
// app/(dashboard)/dashboard/page.tsx — Dashboard de Progreso
// ============================================================
// TIPO: Client Component ('use client')
//
// CAMBIO RESPECTO AL PLACEHOLDER (FE-04):
//   Antes era un Server Component con tarjetas estáticas.
//   Ahora es un Client Component que hace fetch al endpoint
//   de métricas (DA-01) y renderiza la gráfica de scores.
//
// ¿POR QUÉ CLIENT COMPONENT?
//   1. Necesita useState para manejar loading/error/datos
//   2. Necesita useEffect para el fetch al montar
//   3. ScoreChart (Recharts) requiere Client Component
//
// PATRÓN: Container Component
//   Esta página es el "container" que obtiene los datos y
//   los pasa a componentes de presentación (ScoreChart, etc.)
//   Los componentes hijos son "puros" — solo reciben props.
//
// FETCH CON COOKIES:
//   Al hacer fetch('/api/dashboard/metrics') desde un Client
//   Component, el navegador envía automáticamente las cookies
//   de sesión. El endpoint usa esas cookies para autenticar
//   al usuario via Supabase. No necesitamos pasar tokens
//   manualmente.
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardMetrics } from "@/types/dashboard";
import { ScoreChart } from "@/components/dashboard/score-chart";
import { TimeComparisonChart } from "@/components/dashboard/time-comparison-chart";
import { TopicHeatmap } from "@/components/dashboard/topic-heatmap";
import { PracticeProgressCard } from "@/components/dashboard/practice-progress-card";
import { useAiSession } from "@/components/ai/ai-session-provider";
// ──────────────────────────────────────────────────────────────

interface DashboardState {
  /** Métricas del dashboard, null si no hay plan activo */
  metrics: DashboardMetrics | null;
  /** Mensaje cuando no hay plan */
  message: string | null;
  /** true mientras se cargan los datos */
  isLoading: boolean;
  /** Mensaje de error si el fetch falló */
  error: string | null;
}

async function loadDashboardState(): Promise<DashboardState> {
  try {
    // fetch relativo — las cookies se envían automáticamente.
    // No necesitamos headers de Authorization porque Supabase
    // SSR usa cookies httpOnly, no tokens en headers.
    const response = await fetch("/api/dashboard/metrics");

    // Si el servidor responde con error HTTP, parseamos el body
    // para obtener el mensaje de error.
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Error desconocido" }));
      throw new Error(
        errorData.error ?? `Error ${response.status}: ${response.statusText}`,
      );
    }

    // Puede ser { metrics: DashboardMetrics } o
    // { metrics: null, message: "..." }.
    const data = await response.json();

    return {
      metrics: data.metrics ?? null,
      message: data.message ?? null,
      isLoading: false,
      error: null,
    };
  } catch (err) {
    return {
      metrics: null,
      message: null,
      isLoading: false,
      error:
        err instanceof Error ? err.message : "Error al cargar las métricas",
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Componente principal

// ──────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // Estado unificado del dashboard.
  // Usamos un solo objeto en lugar de 4 useState separados
  // para evitar renders intermedios con estados inconsistentes.
  const [state, setState] = useState<DashboardState>({
    metrics: null,
    message: null,
    isLoading: true,
    error: null,
  });

  const { byokApiKey } = useAiSession();

  // Banner direccional de onboarding si no hay clave de IA configurada
  const aiKeyWarningBanner = byokApiKey === "" ? (
    <div className="flex flex-col gap-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 sm:flex-row sm:items-center sm:justify-between light:border-amber-200 light:bg-amber-50">
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5" role="img" aria-label="api key warning">🔑</span>
        <div>
          <h3 className="font-semibold text-amber-400 light:text-amber-800">Configuración de IA Requerida</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-200/80 light:text-amber-700">
            Para poder interactuar con la IA, generar planes o rendir cuestionarios, primero necesitas ingresar tu API Key temporal (BYOK).
          </p>
        </div>
      </div>
      <Link
        href="/settings/ai"
        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-center text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-amber-500 light:hover:bg-amber-700 cursor-pointer"
      >
        Configurar API Key →
      </Link>
    </div>
  ) : null;

  // ─── Reintento iniciado por el usuario ───────────────────
  function fetchMetrics() {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    void loadDashboardState().then((nextState) => {
      setState(nextState);
    });
  }

  // ─── Fetch al montar el componente ───────────────────────
  // El estado inicial ya representa la carga. La respuesta de la
  // fuente externa actualiza React desde su callback asíncrono.
  useEffect(() => {
    let ignore = false;

    void loadDashboardState().then((nextState) => {
      if (!ignore) {
        setState(nextState);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // RENDER: Estado de carga
  // ═══════════════════════════════════════════════════════════

  if (state.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {/* Encabezado */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tu Dashboard
          </h1>
          <p className="text-muted-foreground">Cargando tus métricas de estudio...</p>
        </div>

        {/* Skeleton de la gráfica */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="h-5 w-48 bg-muted rounded animate-pulse mb-4" />
          <div className="h-[300px] bg-muted/50 rounded-lg animate-pulse" />
        </div>

        {/* Skeleton de tarjetas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="h-4 w-32 bg-muted rounded animate-pulse mb-3" />
              <div className="h-8 w-20 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Estado de error
  // ═══════════════════════════════════════════════════════════

  if (state.error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tu Dashboard
          </h1>
        </div>

        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 light:border-red-200 light:bg-red-50">
          <h3 className="mb-2 text-lg font-semibold text-red-400 light:text-red-800">
            ⚠️ Error al cargar las métricas
          </h3>
          <p className="mb-4 text-sm text-red-300/80 light:text-red-700">{state.error}</p>
          <button
            onClick={fetchMetrics}
            className="
              px-4 py-2 text-sm font-medium rounded-lg
              bg-red-500/20 text-red-400
              hover:bg-red-500/30 transition-colors
              light:bg-red-100 light:text-red-800 light:hover:bg-red-200
              cursor-pointer
            "
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Sin plan activo
  // ═══════════════════════════════════════════════════════════

  if (!state.metrics) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Tu Dashboard
          </h1>
          <p className="text-muted-foreground">
            {state.message ?? "No tienes un plan de estudio activo."}
          </p>
        </div>

        {aiKeyWarningBanner}

        {/* Call to action para crear plan */}
        <div data-tour="plan-card" className="rounded-xl border border-border bg-card text-card-foreground p-8 text-center shadow-sm">
          <div className="text-5xl mb-4">📚</div>
          <h2 className="text-xl font-semibold mb-2">
            ¡Comienza tu preparación!
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            Sube tu PDF del syllabus ISTQB, configura tu plan de estudio, y la
            IA generará un plan personalizado adaptado a tu ritmo.
          </p>
          <Link
            href="/setup"
            className="
              inline-flex items-center gap-2 px-6 py-3
              rounded-lg font-semibold text-sm
              bg-emerald-600 text-white
              hover:bg-emerald-500 transition-colors
            "
          >
            Crear mi plan de estudio →
          </Link>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Con datos — Dashboard completo
  // ═══════════════════════════════════════════════════════════

  const { metrics } = state;

  return (
    <div className="flex flex-col gap-6" data-tour="plan-card">
      {/* ─── Encabezado ─── */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Tu Dashboard
        </h1>
        <p className="text-muted-foreground">
          Resumen de tu progreso en el plan de estudio ISTQB.
        </p>
      </div>

      {aiKeyWarningBanner}


      <PracticeProgressCard stats={metrics.practice_stats} />

      {/* ─── Gráfica de scores (DA-02) ─── */}
      <ScoreChart data={metrics.scores_by_session} />

      {/* ─── Placeholder para componentes futuros ─── */}
      {/* Estos se implementarán en DA-03, DA-04 y DA-05 */}
      <div className="grid gap-4 md:grid-cols-2 min-w-0">
        {/* Placeholder DA-03: Heatmap de tópicos */}
        {/* DA-03: Heatmap de tópicos por estado */}
        <div className="md:col-span-2">
          <TopicHeatmap topicProgress={metrics.topic_progress} />
        </div>

        {/* DA-04: Tiempo real vs estimado */}
        <div className="md:col-span-2">
          <TimeComparisonChart data={metrics.time_comparison} />
        </div>
      </div>
    </div>
  );
}
