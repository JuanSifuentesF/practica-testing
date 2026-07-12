"use client";

import { Suspense, useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ScenarioDisplay } from "./_components/scenario-display";
import { BugReportForm } from "./_components/bug-report-form";
import { BugEvaluation } from "./_components/bug-evaluation";
import {
  assertBugReportContractFixtures,
  isBugReportEvaluateResponse,
  isBugReportExercise,
  type BugReportEvaluateResponse,
} from "@/lib/practice/bug-report-contract";
import { createClient } from "@/lib/supabase/client";
import type { BugReportData, BugReportExercise } from "@/types/practice";
import type { LevelK } from "@/types/database";

async function findUnsubmittedExercise(
  supabase: ReturnType<typeof createClient>,
  topic: TopicData,
): Promise<BugReportExercise | null> {
  const { data: exercises } = await supabase
    .from("practice_exercises")
    .select(
      "id, user_id, document_id, study_plan_id, topic_code, level_k, exercise_type, attempt_number, scenario_json, solution_json, created_at",
    )
    .eq("exercise_type", "bug_report")
    .eq("topic_code", topic.code)
    .eq("document_id", topic.documentId)
    .order("created_at", { ascending: false })
    .limit(1);

  const raw = exercises?.[0];
  if (!raw || !isBugReportExercise(raw)) return null;

  const { count } = await supabase
    .from("practice_submissions")
    .select("id", { count: "exact", head: true })
    .eq("exercise_id", raw.id);

  return count === 0 ? raw : null;
}

if (process.env.NODE_ENV === "development") assertBugReportContractFixtures();

interface TopicEntry {
  text: string;
  level_k: string;
  name: string;
}
interface TopicData {
  documentId: string;
  code: string;
  name: string;
  levelK: LevelK;
}
interface State {
  loading: boolean;
  error: string | null;
  topic: TopicData | null;
  exercise: BugReportExercise | null;
  generating: boolean;
  submitting: boolean;
  submitError: string | null;
  result: BugReportEvaluateResponse | null;
}

export default function BugLabPage() {
  return (
    <Suspense
      fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-900" />}
    >
      <BugLabContent />
    </Suspense>
  );
}

function BugLabContent() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("document_id") ?? "";
  const topicCode = searchParams.get("topic_code") ?? "";
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    topic: null,
    exercise: null,
    generating: false,
    submitting: false,
    submitError: null,
    result: null,
  });

  useEffect(() => {
    async function loadTopic() {
      if (!documentId || !topicCode) {
        setState((previous) => ({
          ...previous,
          loading: false,
          error: "Faltan document_id o topic_code en la URL.",
        }));
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from("documents")
        .select("id, topics_json")
        .eq("id", documentId)
        .single();
      const topics =
        (data?.topics_json as Record<string, TopicEntry> | null) ?? {};
      const topic = topics[topicCode];
      if (error || !topic || !["K1", "K2", "K3"].includes(topic.level_k)) {
        setState((previous) => ({
          ...previous,
          loading: false,
          error: "No se pudo cargar un topico valido del documento.",
        }));
        return;
      }
      const topicData: TopicData = {
        documentId,
        code: topicCode,
        name: topic.name || topicCode,
        levelK: topic.level_k as LevelK,
      };

      const existing = await findUnsubmittedExercise(
        supabase,
        topicData,
      );

      setState((previous) => ({
        ...previous,
        loading: false,
        topic: topicData,
        exercise: existing,
      }));
    }
    void loadTopic();
  }, [documentId, topicCode]);

  async function generate() {
    if (!state.topic) return;
    setState((previous) => ({
      ...previous,
      generating: true,
      error: null,
      exercise: null,
      result: null,
      submitError: null,
    }));
    try {
      const response = await fetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: state.topic.documentId,
          topic_code: state.topic.code,
          level_k: state.topic.levelK,
          exercise_type: "bug_report",
        }),
      });
      const payload: unknown = await response.json();
      const exercise =
        typeof payload === "object" && payload !== null && "exercise" in payload
          ? payload.exercise
          : null;
      if (!response.ok || !isBugReportExercise(exercise))
        throw new Error(
          "La API no devolvio un escenario de bug report compatible.",
        );
      setState((previous) => ({ ...previous, generating: false, exercise }));
    } catch (error) {
      setState((previous) => ({
        ...previous,
        generating: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar el escenario.",
      }));
    }
  }

  async function submit(report: BugReportData) {
    if (!state.exercise || state.submitting) return;
    setState((previous) => ({
      ...previous,
      submitting: true,
      submitError: null,
    }));
    try {
      const response = await fetch("/api/practice/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id: state.exercise.id,
          submission: { type: "bug_report", bug_report: report },
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isBugReportEvaluateResponse(payload))
        throw new Error("La evaluacion no devolvio el contrato esperado.");
      setState((previous) => ({
        ...previous,
        submitting: false,
        result: payload,
      }));
    } catch (error) {
      setState((previous) => ({
        ...previous,
        submitting: false,
        submitError:
          error instanceof Error
            ? error.message
            : "No se pudo evaluar el reporte.",
      }));
    }
  }

  if (state.loading)
    return <div className="h-48 animate-pulse rounded-xl bg-slate-900" />;
  if (state.error && !state.topic) return <ErrorState message={state.error} />;
  const scenario = state.exercise?.scenario;
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/practice"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft className="size-4" />
        Volver al hub
      </Link>
      <div>
        <p className="text-sm text-amber-300">
          {state.topic?.code} - {state.topic?.name}
        </p>
        <h1 className="text-2xl font-bold text-white">Bug Report Lab</h1>
      </div>
      {!state.exercise && (
        <button
          onClick={generate}
          disabled={state.generating}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {state.generating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {state.generating ? "Generando escenario..." : "Generar escenario"}
        </button>
      )}
      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-3 text-sm text-rose-300"
        >
          {state.error}
        </p>
      )}
      {scenario && (
        <>
          <ScenarioDisplay scenario={scenario} />
          <BugReportForm
            disabled={state.submitting || state.result !== null}
            onSubmit={submit}
          />
          {state.submitError && (
            <p
              role="alert"
              className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-3 text-sm text-rose-300"
            >
              {state.submitError}
            </p>
          )}
          {state.result && (
            <>
              <BugEvaluation
                score={state.result.submission.score_percent ?? 0}
                feedback={state.result.submission.feedback}
                submission={state.result.submission.content.bug_report}
                solution={state.result.solution}
              />
              <button
                onClick={generate}
                disabled={state.generating}
                className="w-fit rounded-lg border border-amber-500/40 px-4 py-2 text-sm font-semibold text-amber-300 disabled:opacity-50"
              >
                Practicar con otro escenario
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-6">
      <AlertCircle className="size-5 text-rose-400" />
      <p className="mt-2 text-sm text-rose-200">{message}</p>
    </div>
  );
}
