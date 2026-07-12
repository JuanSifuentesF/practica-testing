// ============================================================
// app/(dashboard)/session/page.tsx — Página de Sesión de Estudio
// ============================================================
// TIPO: Server Component (hace fetch en el servidor)
//
// FLUJO:
//   1. Lee session_id del query param (viene de SessionCard)
//   2. Si hay session_id → busca esa sesión en Supabase
//   3. Si no hay session_id → reabre la sesión active o busca la próxima pending
//   4. Pasa los datos al TheoryPanel (Client Component)
//
// CAMBIOS EN SE-03:
//   - Reemplazado el render estático por <TheoryPanel>
//   - El TheoryPanel se encarga de: timer, fetch de teoría,
//     secciones colapsables, y navegación a quiz
//   - Mantenida toda la lógica de carga de datos del servidor
// ============================================================

import Link from "next/link";
import { BookOpen, ArrowLeft, Trophy, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { SessionWithContext, SessionTopic } from "@/types/sessions";
import { TheoryPanel } from "@/components/session/theory-panel";
import { QuizCard } from "@/components/session/quiz-card";

type SessionPageProps = {
  searchParams: Promise<{
    session_id?: string | string[];
    phase?: string | string[]; // SE-05: "theory" | "quiz"
  }>;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// ─── Orden correcto de sesiones ────────────────────────────────
// Refuerzos primero; luego día ascendente; dentro del día: mañana/noche.
type SessionSortInput = {
  id?: string;
  day_number: number;
  session_type: string;
  status?: string | null;
};

const SAME_DAY_SESSION_ORDER: Record<string, number> = {
  morning: 1,
  night: 2,
  mock_exam: 3,
  reinforcement: 4,
};

function compareSessionsForStudyOrder(
  a: SessionSortInput,
  b: SessionSortInput,
): number {
  const aIsReinforcement = a.session_type === "reinforcement";
  const bIsReinforcement = b.session_type === "reinforcement";

  if (aIsReinforcement !== bIsReinforcement) {
    return aIsReinforcement ? -1 : 1;
  }

  if (a.day_number !== b.day_number) {
    return a.day_number - b.day_number;
  }

  return (
    (SAME_DAY_SESSION_ORDER[a.session_type] ?? 99) -
    (SAME_DAY_SESSION_ORDER[b.session_type] ?? 99)
  );
}

function compareSessionsForCurrentPick(
  a: SessionSortInput,
  b: SessionSortInput,
): number {
  // Si SE-02 ya generó teoría, la sesión queda en status "active".
  // /session sin session_id debe reabrir esa sesión antes de saltar
  // accidentalmente a la siguiente pending.
  const aIsActive = a.status === "active";
  const bIsActive = b.status === "active";

  if (aIsActive !== bIsActive) {
    return aIsActive ? -1 : 1;
  }

  return compareSessionsForStudyOrder(a, b);
}

async function getSessionNumber(
  supabase: SupabaseServerClient,
  planId: string,
  userId: string,
  sessionId: string,
): Promise<number> {
  // Calcular la posición real evita mostrar siempre "completadas + 1"
  // cuando el usuario abre una sesión específica por URL.
  const { data: planSessionsForOrder } = await supabase
    .from("sessions")
    .select("id, day_number, session_type")
    .eq("study_plan_id", planId)
    .eq("user_id", userId);

  const orderedSessions = [...(planSessionsForOrder || [])].sort(
    compareSessionsForStudyOrder,
  );

  const sessionIndex = orderedSessions.findIndex(
    (item) => item.id === sessionId,
  );

  return sessionIndex >= 0 ? sessionIndex + 1 : 1;
}

export default async function SessionPage({ searchParams }: SessionPageProps) {
  // ─── Autenticación ──────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ─── Extraer session_id del query param ─────────────────────
  const params = await searchParams;
  const rawSessionId = params.session_id;
  const sessionId = Array.isArray(rawSessionId)
    ? rawSessionId[0]
    : rawSessionId || null;

  // ─── Carga de la sesión ─────────────────────────────────────
  // En Server Components preferimos consultar Supabase directamente
  // en vez de hacer un fetch HTTP interno a nuestra propia API.
  // Las API Routes quedan disponibles para clientes externos, tests
  // manuales en navegador, y futuras pantallas que necesiten JSON.
  let sessionData: SessionWithContext | null = null;
  let errorMessage: string | null = null;
  let planCompleted = false;

  // SE-05: Leer la fase del quiz desde los query params
  // Si no hay phase o es inválido, default a "theory"
  const rawPhase = params.phase;
  const requestedPhase = Array.isArray(rawPhase) ? rawPhase[0] : rawPhase;
  const phase = requestedPhase === "quiz" ? "quiz" : "theory";

  try {
    if (sessionId) {
      // ── Buscar sesión por ID ──────────────────────────────
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (sessionError || !session) {
        errorMessage = "Sesión no encontrada. Verifica el ID o vuelve a /plan.";
      } else {
        // Obtener plan asociado
        const { data: plan } = await supabase
          .from("study_plans")
          .select(
            "id, document_id, objective_days, start_date, estimated_end_date",
          )
          .eq("id", session.study_plan_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (plan) {
          // Obtener topics_json del documento
          const { data: doc } = await supabase
            .from("documents")
            .select("topics_json")
            .eq("id", plan.document_id)
            .eq("user_id", user.id)
            .maybeSingle();

          const topicsJson = doc?.topics_json || {};

          // Obtener progreso de tópicos
          const { data: progressRows } = await supabase
            .from("topic_progress")
            .select("topic_code, status, attempts, best_score, level_k")
            .eq("study_plan_id", plan.id)
            .eq("user_id", user.id)
            .in("topic_code", session.topic_codes || []);

          const progressMap = new Map();
          if (progressRows) {
            for (const row of progressRows) {
              progressMap.set(row.topic_code, row);
            }
          }

          const topics: SessionTopic[] = (session.topic_codes || []).map(
            (code: string) => {
              const topicData = topicsJson[code];
              const progress = progressMap.get(code);
              return {
                code,
                name: topicData?.name || code,
                level_k: topicData?.level_k || progress?.level_k || "K1",
                syllabus_text: topicData?.text || "",
                progress_status: progress?.status || "pending",
                attempts: progress?.attempts || 0,
                best_score: progress?.best_score || 0,
              };
            },
          );

          // Conteos
          const { count: totalSessions } = await supabase
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("study_plan_id", plan.id);

          const { count: completedSessions } = await supabase
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("study_plan_id", plan.id)
            .eq("status", "completed");

          const sessionNumber = await getSessionNumber(
            supabase,
            plan.id,
            user.id,
            session.id,
          );

          sessionData = {
            id: session.id,
            session_type: session.session_type,
            day_number: session.day_number,
            duration_minutes: session.duration_minutes,
            method_used: session.method_used,
            status: session.status,
            attempt_number: session.attempt_number,
            scheduled_at: session.scheduled_at,
            started_at: session.started_at,
            completed_at: session.completed_at,
            score_percent: session.score_percent,
            action_taken: session.action_taken,
            theory_content: session.theory_content,
            topics,
            plan_context: {
              plan_id: plan.id,
              objective_days: plan.objective_days,
              start_date: plan.start_date,
              estimated_end_date: plan.estimated_end_date,
              total_sessions: totalSessions || 0,
              completed_sessions: completedSessions || 0,
            },
            session_number: sessionNumber,
          };
        } else {
          errorMessage = "No se encontró el plan asociado a esta sesión.";
        }
      }
    } else {
      // ── Reabrir sesión active o buscar próxima pending ─────
      const { data: activePlan } = await supabase
        .from("study_plans")
        .select(
          "id, document_id, objective_days, start_date, estimated_end_date",
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activePlan) {
        errorMessage =
          "No tienes un plan de estudio activo. Ve a /setup para crear uno.";
      } else {
        const { data: candidateSessions } = await supabase
          .from("sessions")
          .select("*")
          .eq("study_plan_id", activePlan.id)
          .eq("user_id", user.id)
          .in("status", ["active", "pending"])
          .order("day_number", { ascending: true });

        if (!candidateSessions || candidateSessions.length === 0) {
          planCompleted = true;
          errorMessage =
            "¡Felicidades! Has completado todas las sesiones de tu plan.";
        } else {
          const sorted = [...candidateSessions].sort(
            compareSessionsForCurrentPick,
          );

          const nextSession = sorted[0];

          // Enriquecer
          const { data: doc } = await supabase
            .from("documents")
            .select("topics_json")
            .eq("id", activePlan.document_id)
            .eq("user_id", user.id)
            .maybeSingle();

          const topicsJson = doc?.topics_json || {};

          const { data: progressRows } = await supabase
            .from("topic_progress")
            .select("topic_code, status, attempts, best_score, level_k")
            .eq("study_plan_id", activePlan.id)
            .eq("user_id", user.id)
            .in("topic_code", nextSession.topic_codes || []);

          const progressMap = new Map();
          if (progressRows) {
            for (const row of progressRows) {
              progressMap.set(row.topic_code, row);
            }
          }

          const topics: SessionTopic[] = (nextSession.topic_codes || []).map(
            (code: string) => {
              const topicData = topicsJson[code];
              const progress = progressMap.get(code);
              return {
                code,
                name: topicData?.name || code,
                level_k: topicData?.level_k || progress?.level_k || "K1",
                syllabus_text: topicData?.text || "",
                progress_status: progress?.status || "pending",
                attempts: progress?.attempts || 0,
                best_score: progress?.best_score || 0,
              };
            },
          );

          const { count: totalSessions } = await supabase
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("study_plan_id", activePlan.id);

          const { count: completedSessions } = await supabase
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("study_plan_id", activePlan.id)
            .eq("status", "completed");

          const sessionNumber = await getSessionNumber(
            supabase,
            activePlan.id,
            user.id,
            nextSession.id,
          );

          sessionData = {
            id: nextSession.id,
            session_type: nextSession.session_type,
            day_number: nextSession.day_number,
            duration_minutes: nextSession.duration_minutes,
            method_used: nextSession.method_used,
            status: nextSession.status,
            attempt_number: nextSession.attempt_number,
            scheduled_at: nextSession.scheduled_at,
            started_at: nextSession.started_at,
            completed_at: nextSession.completed_at,
            score_percent: nextSession.score_percent,
            action_taken: nextSession.action_taken,
            theory_content: nextSession.theory_content,
            topics,
            plan_context: {
              plan_id: activePlan.id,
              objective_days: activePlan.objective_days,
              start_date: activePlan.start_date,
              estimated_end_date: activePlan.estimated_end_date,
              total_sessions: totalSessions || 0,
              completed_sessions: completedSessions || 0,
            },
            session_number: sessionNumber,
          };
        }
      }
    }
  } catch (error) {
    console.error("[session/page] Error al cargar sesión:", error);
    errorMessage = "Error inesperado al cargar la sesión.";
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Estado de plan completado
  // ═══════════════════════════════════════════════════════════
  if (planCompleted) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
              <Trophy className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-emerald-300">
                ¡Plan completado!
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Todas las sesiones finalizadas
              </h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            {errorMessage}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              <Trophy className="h-4 w-4" />
              Ver mi progreso
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Estado de error
  // ═══════════════════════════════════════════════════════════
  if (errorMessage || !sessionData) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
              <AlertTriangle className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-amber-300">
                No se pudo cargar la sesión
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Sesión no disponible
              </h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            {errorMessage || "No se encontraron datos de sesión."}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/plan"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al plan
            </Link>
            <Link
              href="/setup"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              <BookOpen className="h-4 w-4" />
              Generar un plan
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Sesión cargada → delegar a TheoryPanel o QuizCard
  // ═══════════════════════════════════════════════════════════
  // SE-05: Si phase=quiz, renderizar el QuizCard.
  // Si phase=theory (o ausente), renderizar TheoryPanel.
  if (phase === "quiz") {
    return <QuizCard sessionData={sessionData} />;
  }

  return <TheoryPanel sessionData={sessionData} />;
}
