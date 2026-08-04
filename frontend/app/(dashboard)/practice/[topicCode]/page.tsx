"use client";

// ============================================================
// app/(dashboard)/practice/[topicCode]/page.tsx
// Página de práctica individual por tópico ISTQB
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
  BugReportData,
  PracticeEvaluateRequest,
  PracticeEvaluateResponse,
  PracticeExercise,
  PracticeExerciseType,
  SubmissionContent,
  TestCaseRow,
} from "@/types/practice";
import { BugReportForm } from "../bug-lab/_components/bug-report-form";
import { ExploratoryForm } from "../_components/exploratory-form";
import {
  EXERCISE_MODALITIES,
  getRecommendedModalities,
} from "@/lib/practice/modalities";
import { FeedbackPanel } from "./_components/feedback-panel";
import { SolutionCompare } from "./_components/solution-compare";
import { TheoryBrief } from "./_components/theory-brief";
import { ExercisePrompt } from "./_components/exercise-prompt";
import { TestCaseEditor } from "./_components/test-case-editor";
import { useAiSession } from "@/components/ai/ai-session-provider";

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

function extractMinRows(constraints: string[]): number {
  for (const c of constraints) {
    const match = c.match(/(?:mínimo|al menos|minimum)\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  return 3;
}

// ──────────────────────────────────────────────────────────────
// Componente Principal
// ──────────────────────────────────────────────────────────────

export default function PracticeTopicPage() {
  const params = useParams<{ topicCode: string }>();
  const searchParams = useSearchParams();
  const { aiFetch } = useAiSession();

  const topicCode = decodeURIComponent(params.topicCode ?? "");
  const documentId = searchParams.get("document_id") ?? "";

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

  const recommendedModalities = getRecommendedModalities(topicCode);
  const [selectedModality, setSelectedModality] = useState<PracticeExerciseType>(
    recommendedModalities[0] ?? "test_cases"
  );

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
          `El tópico "${topicCode}" no existe en el documento. Verifica la URL.`
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

  async function handleGenerateExercise(targetModality?: PracticeExerciseType) {
    if (!state.topic) return;
    const modalityToUse = targetModality ?? selectedModality;

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
      const response = await aiFetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: state.topic.documentId,
          topic_code: state.topic.topicCode,
          level_k: state.topic.levelK,
          exercise_type: modalityToUse,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Error desconocido" }));
        throw new Error(
          errorData.error ?? `Error ${response.status}: ${response.statusText}`
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
      const response = await aiFetch("/api/practice/evaluate", {
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
            : `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as PracticeEvaluateResponse;

      if (!data.submission.feedback) {
        throw new Error("La API devolvió una evaluación sin feedback.");
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
    }
  }

  async function handleSubmitBugReport(reportData: BugReportData) {
    if (!state.exercise) return;

    setState((prev) => ({
      ...prev,
      isSubmitting: true,
      submitError: null,
    }));

    const submissionContent: SubmissionContent = {
      type: "bug_report",
      bug_report: reportData,
    };

    try {
      const response = await aiFetch("/api/practice/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id: state.exercise.id,
          submission: submissionContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Error al evaluar." }));

        throw new Error(
          typeof errorData.error === "string"
            ? errorData.error
            : `Error ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as PracticeEvaluateResponse;

      if (!data.submission.feedback) {
        throw new Error("La API devolvió una evaluación sin feedback.");
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
    }
  }

  async function handleSubmitExploratory(data: { notes: string; findings: string[] }) {
    if (!state.exercise) return;

    setState((prev) => ({
      ...prev,
      isSubmitting: true,
      submitError: null,
    }));

    const submissionContent: SubmissionContent = {
      type: "exploratory",
      notes: data.notes,
      findings: data.findings,
    };

    try {
      const response = await aiFetch("/api/practice/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id: state.exercise.id,
          submission: submissionContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Error al evaluar." }));

        throw new Error(
          typeof errorData.error === "string"
            ? errorData.error
            : `Error ${response.status}: ${response.statusText}`
        );
      }

      const evalData = (await response.json()) as PracticeEvaluateResponse;

      if (!evalData.submission.feedback) {
        throw new Error("La API devolvió una evaluación sin feedback.");
      }

      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        submitted: true,
        submitError: null,
        evaluateResult: evalData,
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
    }
  }

  const minRows = state.exercise
    ? extractMinRows(state.exercise.scenario.constraints)
    : 3;

  const completedRows = state.testCaseRows.filter(
    (r) => r.scenario.trim() !== "" && r.expected_result.trim() !== ""
  ).length;

  const canSubmit =
    !state.isSubmitting &&
    !state.submitted &&
    state.exercise !== null &&
    completedRows >= minRows;

  if (state.isLoadingTopic) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link
            href="/practice"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="h-6 w-48 bg-muted rounded animate-pulse mb-1" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-6">
          <div className="h-4 w-full bg-muted rounded animate-pulse mb-3" />
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-3" />
          <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (state.topicError || !state.topic) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link
            href="/practice"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Práctica</h1>
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

  const { topic } = state;

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Header con navegación ─── */}
      <div className="flex items-center gap-3">
        <Link
          href="/practice"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Práctica: {topic.topicCode}
          </h1>
          <p className="text-sm text-muted-foreground">{topic.topicName}</p>
        </div>
      </div>

      {/* ─── Sección 1: Resumen de la teoría ─── */}
      <TheoryBrief
        topicCode={topic.topicCode}
        topicName={topic.topicName}
        levelK={topic.levelK}
        syllabusText={topic.syllabusText}
      />

      {/* ─── Sección 2: Selección de Modalidad y Generación ─── */}
      {!state.exercise && (
        <div className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Selecciona el tipo de ejercicio a practicar
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Modalidades recomendadas para la experticia pedagógica del capítulo de este tópico:
            </p>
          </div>

          {/* Grid de modalidades recomendadas */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedModalities.map((modType) => {
              const modInfo = EXERCISE_MODALITIES[modType];
              const isSelected = selectedModality === modType;
              return (
                <button
                  key={modType}
                  type="button"
                  onClick={() => setSelectedModality(modType)}
                  className={`
                    flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer
                    ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-950/20 shadow-md shadow-emerald-500/10"
                        : "border-border bg-card/40 hover:border-border hover:bg-card/60"
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{modInfo.icon}</span>
                    <span
                      className={`
                        text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border
                        ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        }
                      `}
                    >
                      {isSelected ? "Seleccionado" : "Disponible"}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {modInfo.label}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {modInfo.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex justify-start">
            <button
              onClick={() => handleGenerateExercise(selectedModality)}
              disabled={state.isGenerating}
              className="
                flex items-center gap-2 px-5 py-2.5
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
                  Generando escenario con IA...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Generar ejercicio ({EXERCISE_MODALITIES[selectedModality].shortLabel})
                </>
              )}
            </button>
          </div>

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

          {/* Editor para test_cases */}
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

              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleGenerateExercise()}
                  disabled={state.isGenerating || state.isSubmitting}
                  className="
                    flex items-center gap-2 px-4 py-2
                    text-xs font-medium rounded-lg
                    bg-muted text-muted-foreground
                    hover:bg-muted hover:text-foreground
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors cursor-pointer
                  "
                >
                  <Sparkles className="size-3.5" />
                  Generar otro ejercicio
                </button>

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
                      border border-transparent
                      bg-primary text-primary-foreground
                      hover:bg-primary/90
                      disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-600
                      disabled:hover:bg-slate-100 disabled:opacity-100 disabled:cursor-not-allowed
                      dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-400
                      dark:disabled:hover:bg-slate-800
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
                      onClick={() => handleGenerateExercise()}
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

          {/* Editor para bug_report */}
          {state.exercise.exercise_type === "bug_report" && (
            <>
              <BugReportForm
                disabled={state.isSubmitting || state.submitted}
                onSubmit={handleSubmitBugReport}
              />

              {state.submitError && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                    <div>
                      <p className="text-sm font-medium text-red-300">
                        No se pudo evaluar tu reporte de defecto
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-red-200/80">
                        {state.submitError}
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                      onClick={() => handleGenerateExercise()}
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

          {/* Editor para exploratory */}
          {state.exercise.exercise_type === "exploratory" && (
            <>
              <ExploratoryForm
                disabled={state.isSubmitting || state.submitted}
                onSubmit={handleSubmitExploratory}
              />

              {state.submitError && (
                <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                    <div>
                      <p className="text-sm font-medium text-red-300">
                        No se pudo evaluar tu bitácora exploratoria
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-red-200/80">
                        {state.submitError}
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                      onClick={() => handleGenerateExercise()}
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

          {/* Placeholder para otras modalidades (API Testing) */}
          {state.exercise.exercise_type !== "test_cases" &&
            state.exercise.exercise_type !== "bug_report" &&
            state.exercise.exercise_type !== "exploratory" && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
                <div className="text-4xl mb-3">🚧</div>
                <h3 className="text-base font-semibold text-slate-300 mb-1">
                  Editor para &quot;{state.exercise.exercise_type}&quot; en construcción
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
                  El motor de generación con la IA ha creado correctamente el escenario de tipo &quot;{state.exercise.exercise_type}&quot;. Puedes practicarlo también desde su hub dedicado.
                </p>
                <button
                  onClick={() => setState((prev) => ({ ...prev, exercise: null }))}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  Volver a seleccionar modalidad
                </button>
              </div>
            )}
        </>
      )}
    </div>
  );
}
