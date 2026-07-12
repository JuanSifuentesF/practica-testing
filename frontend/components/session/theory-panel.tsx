// ============================================================
// components/session/theory-panel.tsx
// Panel principal de lectura de teoría para una sesión de estudio
// ============================================================
// TIPO: Client Component (orquesta Timer, fetch, y estado de UI)
//
// RESPONSABILIDADES:
//   1. Recibir sessionData como props (del Server Component)
//   2. Verificar si theory_content ya existe
//   3. Si no existe → hacer fetch a /api/sessions/[id]/theory
//   4. Renderizar timer + navegación de tópicos + contenido
//   5. Botón "Ir al quiz" siempre disponible
//
// PROPS:
//   - sessionData: SessionWithContext — Datos de la sesión
//
// ESTADOS:
//   - loading: boolean — Está generando la teoría
//   - error: string | null — Error al generar teoría
//   - theoryContent: TheoryContent | null — Contenido teórico
//   - activeTopicIndex: number — Tópico actualmente visible
//   - timerStarted: boolean — Si el timer ya inició
// ============================================================

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Sun,
  Moon,
  RefreshCw,
  FileCheck,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SessionTimer } from "./session-timer";
import { TheoryTopicView } from "./theory-topic-view";
import type { SessionWithContext } from "@/types/sessions";
import type { TheoryContent } from "@/types/theory";

interface TheoryPanelProps {
  sessionData: SessionWithContext;
}

// ─── Mapeo de session_type a ícono ──────────────────────────
function getSessionIcon(type: string) {
  const map: Record<string, typeof Sun> = {
    morning: Sun,
    night: Moon,
    reinforcement: RefreshCw,
    mock_exam: FileCheck,
  };
  return map[type] || Sun;
}

function getSessionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    morning: "Sesión Matutina",
    night: "Sesión Nocturna",
    reinforcement: "Sesión de Refuerzo",
    mock_exam: "Simulacro de Examen",
  };
  return map[type] || type;
}

function getSessionTypeColor(type: string): string {
  const map: Record<string, string> = {
    morning: "text-amber-300",
    night: "text-indigo-300",
    reinforcement: "text-orange-300",
    mock_exam: "text-purple-300",
  };
  return map[type] || "text-slate-300";
}

function getMethodLabel(method: string): string {
  const map: Record<string, string> = {
    theory: "Teoría formal",
    examples: "Ejemplos prácticos",
    analogies: "Analogías y metáforas",
  };
  return map[method] || method;
}

export function TheoryPanel({ sessionData }: TheoryPanelProps) {
  const router = useRouter();

  // ═══════════════════════════════════════════════════════════
  // ESTADO
  // ═══════════════════════════════════════════════════════════
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theoryContent, setTheoryContent] = useState<TheoryContent | null>(
    null,
  );
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // EFECTO: Cargar teoría al montar
  // ═══════════════════════════════════════════════════════════
  // Este efecto implementa el patrón "Fetch on Mount":
  //   1. Si theory_content ya existe en sessionData → parsear y usar
  //   2. Si no existe → hacer POST a la API para generarla
  //   3. En ambos casos, activar el timer al finalizar
  useEffect(() => {
    let cancelled = false;

    async function loadTheory() {
      // ── Caso 1: Teoría ya existe (cache de SE-02) ──────────
      if (sessionData.theory_content) {
        try {
          const parsed: TheoryContent =
            typeof sessionData.theory_content === "string"
              ? JSON.parse(sessionData.theory_content)
              : sessionData.theory_content;

          if (!cancelled) {
            setTheoryContent(parsed);
            setActiveTopicIndex(0);
            setLoading(false);
            setError(null);
            setTimerActive(true);
          }
          return;
        } catch {
          // Si el JSON está corrupto, continuar con la regeneración
          console.warn("[TheoryPanel] theory_content corrupto, regenerando...");
        }
      }

      // ── Caso 2: Generar teoría via API ─────────────────────
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetch(`/api/sessions/${sessionData.id}/theory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: false }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(
            data.error || `Error ${response.status} al generar teoría`,
          );
        }

        const data = await response.json();

        if (!cancelled) {
          setTheoryContent(data.theory);
          setActiveTopicIndex(0);
          setTimerActive(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Error desconocido al generar teoría",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTheory();

    // Cleanup: si el componente se desmonta antes de que el
    // fetch termine, el flag cancelled evita actualizar estado
    // de un componente desmontado (React warning).
    return () => {
      cancelled = true;
    };
  }, [sessionData.id, sessionData.theory_content]);

  // ═══════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════

  // Regenerar teoría con force=true
  async function handleRetry() {
    setLoading(true);
    setError(null);
    setTheoryContent(null);

    try {
      const response = await fetch(`/api/sessions/${sessionData.id}/theory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || `Error ${response.status} al regenerar teoría`,
        );
      }

      const data = await response.json();
      setTheoryContent(data.theory);
      setActiveTopicIndex(0);
      setTimerActive(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error desconocido al regenerar teoría",
      );
    } finally {
      setLoading(false);
    }
  }

  // Navegar al quiz (SE-04, por ahora placeholder)
  function handleGoToQuiz() {
    // En SE-04 se implementará la navegación real al quiz.
    // Por ahora, mostramos un alert o navegamos a la misma
    // página con un parámetro indicando la fase de quiz.
    router.push(`/session?session_id=${sessionData.id}&phase=quiz`);
  }

  // ═══════════════════════════════════════════════════════════
  // VARIABLES DERIVADAS
  // ═══════════════════════════════════════════════════════════
  const SessionIcon = getSessionIcon(sessionData.session_type);
  const sessionColor = getSessionTypeColor(sessionData.session_type);
  const totalTopics = theoryContent?.topics?.length || 0;
  const activeTopic = theoryContent?.topics?.[activeTopicIndex];

  // Progreso del plan
  const progressPercent =
    sessionData.plan_context.total_sessions > 0
      ? (sessionData.plan_context.completed_sessions /
          sessionData.plan_context.total_sessions) *
        100
      : 0;

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* HEADER: Info de la sesión + Timer                      */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        {/* ── Fila superior: tipo + número + timer ──────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Info de la sesión */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800">
              <SessionIcon className={`h-5 w-5 ${sessionColor}`} />
            </div>
            <div>
              <p
                className={`text-xs font-medium uppercase tracking-wide ${sessionColor}`}
              >
                Día {sessionData.day_number} —{" "}
                {getSessionTypeLabel(sessionData.session_type)}
              </p>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Sesión {sessionData.session_number} de{" "}
                {sessionData.plan_context.total_sessions}
              </h1>
            </div>
          </div>

          {/* Timer */}
          {timerActive && (
            <div className="sm:w-64">
              <SessionTimer
                durationMinutes={Math.floor(sessionData.duration_minutes / 2)}
                autoStart={true}
              />
            </div>
          )}
        </div>

        {/* ── Barra de progreso del plan ───────────────────── */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Progreso del plan</span>
            <span>
              {sessionData.plan_context.completed_sessions} /{" "}
              {sessionData.plan_context.total_sessions} sesiones
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* ── Método de enseñanza ──────────────────────────── */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <BookOpen className="h-3.5 w-3.5" />
          <span>Método: {getMethodLabel(sessionData.method_used)}</span>
          {sessionData.attempt_number > 1 && (
            <Badge
              variant="outline"
              className="border-orange-700 bg-orange-950/40 text-orange-300 text-xs"
            >
              Intento #{sessionData.attempt_number}
            </Badge>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ESTADO: Loading / Error                                */}
      {/* ═══════════════════════════════════════════════════════ */}
      {loading && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-2 border-slate-700 border-t-emerald-400 animate-spin" />
              <Sparkles className="absolute top-1/2 left-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                Generando contenido teórico...
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Gemini está preparando la teoría para{" "}
                {sessionData.topics.length} tópico
                {sessionData.topics.length > 1 ? "s" : ""}. Esto puede tomar
                15-30 segundos.
              </p>
            </div>
          </div>
        </section>
      )}

      {error && (
        <section className="rounded-2xl border border-red-500/30 bg-red-950/10 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">
                Error al generar la teoría
              </p>
              <p className="mt-1 text-sm text-red-300/70">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                disabled={loading}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-700 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-900/50 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reintentar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CONTENIDO TEÓRICO                                      */}
      {/* ═══════════════════════════════════════════════════════ */}
      {theoryContent && totalTopics > 0 && (
        <>
          {/* ── Navegación de tópicos (tabs) ──────────────── */}
          {totalTopics > 1 && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex flex-wrap gap-2">
                {theoryContent.topics.map((topic, index) => (
                  <button
                    key={topic.topic_code}
                    type="button"
                    onClick={() => setActiveTopicIndex(index)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      index === activeTopicIndex
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent"
                    }`}
                  >
                    <span className="font-mono">{topic.topic_code}</span>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline truncate max-w-[140px]">
                      {topic.topic_name}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Vista del tópico activo ───────────────────── */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            {activeTopic && <TheoryTopicView topic={activeTopic} />}
          </section>

          {/* ── Navegación anterior/siguiente ─────────────── */}
          {totalTopics > 1 && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setActiveTopicIndex((prev) => Math.max(0, prev - 1))
                }
                disabled={activeTopicIndex === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="h-4 w-4" />
                Tópico anterior
              </button>
              <span className="text-xs text-slate-500">
                {activeTopicIndex + 1} / {totalTopics}
              </span>
              <button
                type="button"
                onClick={() =>
                  setActiveTopicIndex((prev) =>
                    Math.min(totalTopics - 1, prev + 1),
                  )
                }
                disabled={activeTopicIndex === totalTopics - 1}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Siguiente tópico
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ACCIONES: Ir al quiz + Volver al plan                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-400">
            {theoryContent ? (
              <p>
                ¿Listo para evaluar tu comprensión? El quiz tendrá preguntas
                estilo ISTQB sobre los tópicos que acabas de estudiar.
              </p>
            ) : loading ? (
              <p>Espera a que se genere la teoría o ve directamente al quiz.</p>
            ) : (
              <p>
                Cuando estés listo, pasa al quiz para evaluar tu comprensión.
              </p>
            )}
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              type="button"
              onClick={() => router.push("/plan")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Plan
            </button>
            <button
              type="button"
              onClick={handleGoToQuiz}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              <Sparkles className="h-4 w-4" />
              Ir al quiz
            </button>
          </div>
        </div>
      </section>

      {/* ── Metadatos de la generación (solo si hay contenido) ── */}
      {theoryContent && (
        <p className="text-center text-xs text-slate-600">
          Generado por {theoryContent.model_name} (
          {theoryContent.model_provider}) ·{" "}
          {new Date(theoryContent.generated_at).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
