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

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { DashboardMetrics } from "@/types/dashboard";
import { DashboardSummaryCards } from "@/components/dashboard/dashboard-summary-cards";
import { ScoreChart } from "@/components/dashboard/score-chart";
import { TimeComparisonChart } from "@/components/dashboard/time-comparison-chart";
import { TopicHeatmap } from "@/components/dashboard/topic-heatmap";

// ──────────────────────────────────────────────────────────────
// Tipos internos para el estado del componente
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

  // ─── Función de fetch ────────────────────────────────────
  // useCallback memoiza la función para evitar re-creaciones
  // innecesarias. Esto es importante si en el futuro agregamos
  // un botón de "refrescar" que llame a fetchMetrics().
  const fetchMetrics = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

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

      // Parsear la respuesta JSON.
      // Puede ser { metrics: DashboardMetrics } o { metrics: null, message: "..." }
      const data = await response.json();

      setState({
        metrics: data.metrics ?? null,
        message: data.message ?? null,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      // Manejar errores de red, parsing, o del servidor.
      const errorMessage =
        err instanceof Error ? err.message : "Error al cargar las métricas";

      setState({
        metrics: null,
        message: null,
        isLoading: false,
        error: errorMessage,
      });
    }
  }, []);

  // ─── Fetch al montar el componente ───────────────────────
  // useEffect con [] se ejecuta UNA sola vez al montar.
  // El fetch es asíncrono pero useEffect no puede ser async,
  // por eso llamamos a fetchMetrics() sin await.
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ═══════════════════════════════════════════════════════════
  // RENDER: Estado de carga
  // ═══════════════════════════════════════════════════════════

  if (state.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {/* Encabezado */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Tu Dashboard
          </h1>
          <p className="text-slate-400">Cargando tus métricas de estudio...</p>
        </div>

        {/* Skeleton de la gráfica */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="h-5 w-48 bg-slate-800 rounded animate-pulse mb-4" />
          <div className="h-[300px] bg-slate-800/50 rounded-lg animate-pulse" />
        </div>

        {/* Skeleton de tarjetas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-6"
            >
              <div className="h-4 w-32 bg-slate-800 rounded animate-pulse mb-3" />
              <div className="h-8 w-20 bg-slate-800 rounded animate-pulse" />
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
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Tu Dashboard
          </h1>
        </div>

        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-2">
            ⚠️ Error al cargar las métricas
          </h3>
          <p className="text-sm text-red-300/80 mb-4">{state.error}</p>
          <button
            onClick={fetchMetrics}
            className="
              px-4 py-2 text-sm font-medium rounded-lg
              bg-red-500/20 text-red-400
              hover:bg-red-500/30 transition-colors
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
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Tu Dashboard
          </h1>
          <p className="text-slate-400">
            {state.message ?? "No tienes un plan de estudio activo."}
          </p>
        </div>

        {/* Call to action para crear plan */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <div className="text-5xl mb-4">📚</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            ¡Comienza tu preparación!
          </h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
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
    <div className="flex flex-col gap-6">
      {/* ─── Encabezado ─── */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Tu Dashboard
        </h1>
        <p className="text-slate-400">
          Resumen de tu progreso en el plan de estudio ISTQB.
        </p>
      </div>

      {/* ─── Resumen ejecutivo DA-05 ─── */}
      <DashboardSummaryCards metrics={metrics} />

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
