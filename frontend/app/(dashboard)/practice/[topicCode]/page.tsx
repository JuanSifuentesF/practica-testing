"use client";

// ============================================================
// app/(dashboard)/practice/[topicCode]/page.tsx
// Página de práctica individual por tópico ISTQB
// ============================================================
// TIPO: Client Component ('use client')
//
// RESPONSABILIDADES:
//   1. Leer topicCode de la URL (useParams)
//   2. Leer document_id de searchParams (useSearchParams)
//   3. Cargar el tópico del documento (topics_json de Supabase)
//   4. Generar ejercicio bajo demanda (POST /api/practice/generate)
//   5. Renderizar la secuencia: teoría → ejercicio → editor
//   6. Gestionar el estado del TestCaseEditor (filas de test cases)
//   7. Preparar la submission para envío (PL-09)
//
// URL: /practice/FL-4.2.1?document_id=UUID
//
// NEXT.JS 16:
//   En Client Components, useParams() retorna un objeto síncrono
//   con los parámetros de la ruta. Para searchParams usamos
//   useSearchParams() del hook de Next.js.
//
// PATRÓN: Container + fetch-on-demand
//   Los datos del tópico se cargan al montar (useEffect).
//   El ejercicio se genera solo al click (no al montar).
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { LevelK } from "@/types/database";
import type {
  PracticeEvaluateRequest,
  PracticeEvaluateResponse,
  PracticeExercise,
  SubmissionContent,
  TestCaseRow,
} from "@/types/practice";
import { FeedbackPanel } from "./_components/feedback-panel";
import { SolutionCompare } from "./_components/solution-compare";
import { TheoryBrief } from "./_components/theory-brief";
import { ExercisePrompt } from "./_components/exercise-prompt";
import { TestCaseEditor } from "./_components/test-case-editor";

// ──────────────────────────────────────────────────────────────
// Tipos internos
// ──────────────────────────────────────────────────────────────

interface TopicEntry {
  text: string;
  level_k: string;
  name: string;
}

interface TopicData {
  topicCode: string;
  topicName: string;
  levelK: LevelK;
  syllabusText: string;
  documentId: string;
}

interface PageState {
  isLoadingTopic: boolean;
  topicError: string | null;
  topic: TopicData | null;
  isGenerating: boolean;
  generateError: string | null;
  exercise: PracticeExercise | null;
  testCaseRows: TestCaseRow[];
  isSubmitting: boolean;
  submitted: boolean;
  submitError: string | null;
  evaluateResult: PracticeEvaluateResponse | null;
}

// ──────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────

/**
 * Extrae el número mínimo de filas del array de constraints.
 * Busca patrones como "Mínimo 6 test cases" o "Al menos 5 casos".
 */
function extractMinRows(constraints: string[]): number {
  for (const c of constraints) {
    const match = c.match(/(?:mínimo|al menos|minimum)\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  return 3; // Default razonable
}

// ──────────────────────────────────────────────────────────────
// Componente Principal
// ──────────────────────────────────────────────────────────────

export default function PracticeTopicPage() {
  const params = useParams<{ topicCode: string }>();
  const searchParams = useSearchParams();

  // ─── Extraer parámetros de la URL ─────────────────────
  const topicCode = decodeURIComponent(params.topicCode ?? "");
  const documentId = searchParams.get("document_id") ?? "";

  // ─── Estado de la página ──────────────────────────────
  const [state, setState] = useState<PageState>({
    isLoadingTopic: true,
    topicError: null,
    topic: null,
    isGenerating: false,
    generateError: null,
    exercise: null,
    testCaseRows: [],
    isSubmitting: false,
    submitted: false,
    submitError: null,
    evaluateResult: null,
  });

  // ═══════════════════════════════════════════════════════════
  // FETCH: Cargar datos del tópico al montar
  // ═══════════════════════════════════════════════════════════

  const loadTopicData = useCallback(async () => {
    if (!topicCode || !documentId) {
      setState((prev) => ({
        ...prev,
        isLoadingTopic: false,
        topicError: "Faltan parámetros: topicCode o document_id en la URL.",
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoadingTopic: true, topicError: null }));

    try {
      const supabase = createClient();

      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("id, topics_json")
        .eq("id", documentId)
        .single();

      if (docError || !doc) {
        throw new Error("No se pudo cargar el documento.");
      }

      const topicsJson =
        (doc.topics_json as Record<string, TopicEntry> | null) ?? {};
      const topicEntry = topicsJson[topicCode];

      if (!topicEntry) {
        throw new Error(
          `El tópico "${topicCode}" no existe en el documento. Verifica la URL.`,
        );
      }

      setState((prev) => ({
        ...prev,
        isLoadingTopic: false,
        topicError: null,
        topic: {
          topicCode,
          topicName: topicEntry.name || topicCode,
          levelK: (topicEntry.level_k || "K1") as LevelK,
          syllabusText: topicEntry.text || "",
          documentId: doc.id as string,
        },
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoadingTopic: false,
        topicError:
          err instanceof Error ? err.message : "Error al cargar el tópico.",
      }));
    }
  }, [topicCode, documentId]);

  useEffect(() => {
    loadTopicData();
  }, [loadTopicData]);

  // ═══════════════════════════════════════════════════════════
  // FETCH: Generar ejercicio (on-demand)
  // ═══════════════════════════════════════════════════════════

  async function handleGenerateExercise() {
    if (!state.topic) return;

    setState((prev) => ({
      ...prev,
      isGenerating: true,
      generateError: null,
      submitError: null,
      exercise: null,
      testCaseRows: [],
      submitted: false,
      evaluateResult: null,
    }));

    try {
      const response = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: state.topic.documentId,
          topic_code: state.topic.topicCode,
          level_k: state.topic.levelK,
          exercise_type: "test_cases",
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Error desconocido" }));
        throw new Error(
          errorData.error ?? `Error ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();
      const exercise = data.exercise as PracticeExercise;

      const initialRows: TestCaseRow[] = [
        {
          id: "TC-001",
          scenario: "",
          test_data: "",
          expected_result: "",
          type: "positive",
        },
      ];

      setState((prev) => ({
        ...prev,
        isGenerating: false,
        generateError: null,
        exercise,
        testCaseRows: initialRows,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        generateError:
          err instanceof Error ? err.message : "Error al generar ejercicio.",
      }));
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLER: Enviar respuesta a la API de evaluacion
  // ═══════════════════════════════════════════════════════════

  async function handleSubmit() {
    if (!state.exercise || state.testCaseRows.length === 0) return;

    setState((prev) => ({
      ...prev,
      isSubmitting: true,
      submitError: null,
    }));

    const submissionContent: SubmissionContent = {
      type: "test_cases",
      test_cases: state.testCaseRows,
    };

    const requestBody: PracticeEvaluateRequest = {
      exercise_id: state.exercise.id,
      submission: submissionContent,
    };

    try {
      const response = await fetch("/api/practice/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Error desconocido al evaluar." }));

        throw new Error(
          typeof errorData.error === "string"
            ? errorData.error
            : `Error ${response.status}: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as PracticeEvaluateResponse;

      if (!data.submission.feedback) {
        throw new Error(
          "La API devolvio una evaluacion sin feedback. Revisa PL-09.",
        );
      }

      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        submitted: true,
        submitError: null,
        evaluateResult: data,
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al evaluar la respuesta.";

      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        submitted: false,
        submitError: message,
      }));

      console.error("[practice/evaluate] Error:", err);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════

  const minRows = state.exercise
    ? extractMinRows(state.exercise.scenario.constraints)
    : 3;

  const completedRows = state.testCaseRows.filter(
    (r) => r.scenario.trim() !== "" && r.expected_result.trim() !== "",
  ).length;

  const canSubmit =
    !state.isSubmitting &&
    !state.submitted &&
    state.exercise !== null &&
    completedRows >= minRows;

  // ═══════════════════════════════════════════════════════════
  // RENDER: Cargando tópico
  // ═══════════════════════════════════════════════════════════

  if (state.isLoadingTopic) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link
            href="/practice"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="h-6 w-48 bg-slate-800 rounded animate-pulse mb-1" />
            <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="h-4 w-full bg-slate-800 rounded animate-pulse mb-3" />
          <div className="h-4 w-3/4 bg-slate-800 rounded animate-pulse mb-3" />
          <div className="h-4 w-1/2 bg-slate-800 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Error al cargar tópico
  // ═══════════════════════════════════════════════════════════

  if (state.topicError || !state.topic) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link
            href="/practice"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Práctica</h1>
        </div>

        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-2">
            ⚠️ Error al cargar el tópico
          </h3>
          <p className="text-sm text-red-300/80 mb-4">
            {state.topicError ?? "No se encontró el tópico."}
          </p>
          <Link
            href="/practice"
            className="
              inline-flex items-center gap-2 px-4 py-2
              text-sm font-medium rounded-lg
              bg-red-500/20 text-red-400
              hover:bg-red-500/30 transition-colors
            "
          >
            <ArrowLeft className="size-4" />
            Volver al Hub
          </Link>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Página completa
  // ═══════════════════════════════════════════════════════════

  const { topic } = state;
  const kLevelPracticeTitle: Record<LevelK, string> = {
    K1: "Laboratorio K1: Identificación de conceptos",
    K2: "Laboratorio K2: Análisis de escenarios",
    K3: "Laboratorio K3: Diseño de casos de prueba",
  };
  const kLevelPracticeDesc: Record<LevelK, string> = {
    K1: "Identifica y clasifica conceptos de testing a partir del escenario. El ejercicio está adaptado a un nivel de reconocimiento.",
    K2: "Analiza el escenario presentado e identifica errores, omisiones o técnicas aplicables.",
    K3: "Aplica técnicas de diseño de pruebas para crear casos desde cero a partir del escenario.",
  };
  const kLevelPracticeAction: Record<LevelK, string> = {
    K1: "Generar practica guiada",
    K2: "Generar practica de analisis",
    K3: "Generar casos de prueba",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Header con navegación ─── */}
      <div className="flex items-center gap-3">
        <Link
          href="/practice"
          className="text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Práctica: {topic.topicCode}
          </h1>
          <p className="text-sm text-slate-400">{topic.topicName}</p>
        </div>
      </div>

      {/* ─── Sección 1: Resumen de la teoría ─── */}
      <TheoryBrief
        topicCode={topic.topicCode}
        topicName={topic.topicName}
        levelK={topic.levelK}
        syllabusText={topic.syllabusText}
      />

      {/* ─── Sección 2: Generar ejercicio ─── */}
      {!state.exercise && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <>
            <h2 className="text-sm font-semibold text-slate-300">
              {kLevelPracticeTitle[topic.levelK]}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              {kLevelPracticeDesc[topic.levelK]}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Bug Report y API Testing tendrán rutas propias cuando se
              implementen PL-11 y PL-12.
            </p>

            <button
              onClick={handleGenerateExercise}
              disabled={state.isGenerating}
              className="
                mt-4 flex items-center gap-2 px-5 py-2.5
                text-sm font-semibold rounded-lg
                bg-emerald-600 text-white
                hover:bg-emerald-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors cursor-pointer
              "
            >
              {state.isGenerating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generando ejercicio...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  {kLevelPracticeAction[topic.levelK]}
                </>
              )}
            </button>
          </>

          {/* Error de generación */}
          {state.generateError && (
            <div className="mt-3 rounded-lg bg-red-950/30 border border-red-900/50 p-3">
              <p className="text-xs text-red-400">{state.generateError}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Sección 3: Ejercicio generado ─── */}
      {state.exercise && (
        <>
          <ExercisePrompt scenario={state.exercise.scenario} />

          {/* ─── Sección 4: TestCaseEditor (solo para test_cases) ─── */}
          {state.exercise.exercise_type === "test_cases" && (
            <>
              <TestCaseEditor
                rows={state.testCaseRows}
                onRowsChange={(rows) =>
                  setState((prev) => ({ ...prev, testCaseRows: rows }))
                }
                minRows={minRows}
                disabled={state.isSubmitting || state.submitted}
              />

              {/* ─── Botones de acción ─── */}
              <div className="flex items-center justify-between">
                {/* Botón generar otro */}
                <button
                  onClick={handleGenerateExercise}
                  disabled={state.isGenerating || state.isSubmitting}
                  className="
                    flex items-center gap-2 px-4 py-2
                    text-xs font-medium rounded-lg
                    bg-slate-800 text-slate-400
                    hover:bg-slate-700 hover:text-slate-300
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors cursor-pointer
                  "
                >
                  <Sparkles className="size-3.5" />
                  Generar otro ejercicio
                </button>

                {/* Botón enviar */}
                {state.submitted ? (
                  <div className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-emerald-400">
                    <CheckCircle2 className="size-4" />
                    Respuesta evaluada
                  </div>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="
                      flex items-center gap-2 px-5 py-2.5
                      text-sm font-semibold rounded-lg
                      bg-brand-600 text-white
                      hover:bg-brand-500
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors cursor-pointer
                    "
                  >
                    {state.isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        Enviar Respuesta
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Nota sobre PL-09 */}
              {/* Error de evaluacion */}
              {state.submitError && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                    <div>
                      <p className="text-sm font-medium text-red-300">
                        No se pudo evaluar tu respuesta
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-red-200/80">
                        {state.submitError}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback post-evaluacion */}
              {state.evaluateResult?.submission.feedback && (
                <>
                  <FeedbackPanel
                    score={state.evaluateResult.submission.score_percent ?? 0}
                    feedback={state.evaluateResult.submission.feedback}
                  />
                  <SolutionCompare
                    solution={state.evaluateResult.solution}
                    submission={state.evaluateResult.submission.content}
                  />

                  <div className="flex justify-center pt-2">
                    <button
                      onClick={handleGenerateExercise}
                      disabled={state.isGenerating || state.isSubmitting}
                      className="
          flex items-center gap-2 rounded-lg px-5 py-2.5
          bg-slate-800 text-sm font-semibold text-slate-300
          transition-colors hover:bg-slate-700 hover:text-white
          disabled:cursor-not-allowed disabled:opacity-50
          cursor-pointer
        "
                    >
                      <Sparkles className="size-4" />
                      Practicar de nuevo
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ─── Para otros tipos de ejercicio (placeholder) ─── */}
          {state.exercise.exercise_type !== "test_cases" && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
              <div className="text-4xl mb-3">🚧</div>
              <h3 className="text-base font-semibold text-slate-300 mb-1">
                Editor para &quot;{state.exercise.exercise_type}&quot; en
                construcción
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                El editor para este tipo de ejercicio se implementará en guías
                futuras (PL-11 para Bug Reports, PL-12 para API Testing).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
