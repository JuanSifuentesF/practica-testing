import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan variables server-only de Supabase");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const userId = randomUUID();
const documentId = randomUUID();
const planId = randomUUID();
const sessionId = randomUUID();
const generationFingerprint = "a".repeat(64);
const evaluationFingerprint = "b".repeat(64);
let userCreated = false;

function assertRpc(name, result) {
  if (result.error) {
    throw new Error(`${name}: ${result.error.message}`);
  }
  return result.data;
}

const questions = Array.from({ length: 10 }, (_, questionId) => ({
  question_id: questionId,
  question: `Pregunta remota autoritativa ${questionId} sobre fundamentos de testing`,
  options: {
    a: `Opción correcta ${questionId}`,
    b: `Distractor B ${questionId}`,
    c: `Distractor C ${questionId}`,
    d: `Distractor D ${questionId}`,
  },
  correct: "a",
  explanation: `Explicación remota privada suficientemente extensa para la pregunta ${questionId}.`,
  topic_code: "FL-1.1.1",
  topic_name: "Fundamentos de testing",
  level_k: "K1",
}));
const answers = questions.map((question, index) => ({
  question_id: question.question_id,
  user_answer: index < 7 ? "a" : "b",
}));

try {
  const created = await admin.auth.admin.createUser({
    id: userId,
    email: `quiz-e2e-${randomUUID()}@example.invalid`,
    password: `${randomUUID()}Aa1!`,
    email_confirm: true,
    user_metadata: { full_name: "Quiz E2E Fixture" },
  });
  if (created.error) throw new Error(`createUser: ${created.error.message}`);
  userCreated = true;

  const documentInsert = await admin.from("documents").insert({
    id: documentId,
    user_id: userId,
    file_name: "quiz-e2e.pdf",
    file_url: `quiz-e2e/${documentId}.pdf`,
    topics_json: {
      "FL-1.1.1": {
        name: "Fundamentos de testing",
        text: "Contenido autoritativo del syllabus para el fixture remoto.",
        level_k: "K1",
        chapter: 1,
        section: "1.1",
      },
    },
  });
  if (documentInsert.error) throw new Error(documentInsert.error.message);

  const today = new Date().toISOString().slice(0, 10);
  const planInsert = await admin.from("study_plans").insert({
    id: planId,
    user_id: userId,
    document_id: documentId,
    start_date: today,
    estimated_end_date: today,
    plan_json: {},
  });
  if (planInsert.error) throw new Error(planInsert.error.message);

  const sessionInsert = await admin.from("sessions").insert({
    id: sessionId,
    study_plan_id: planId,
    user_id: userId,
    topic_codes: ["FL-1.1.1"],
    session_type: "morning",
    day_number: 1,
    method_used: "theory",
    attempt_number: 1,
    status: "active",
  });
  if (sessionInsert.error) throw new Error(sessionInsert.error.message);

  const generationClaim = assertRpc(
    "claim generation",
    await admin.rpc("claim_quiz_ai_operation", {
      p_user_id: userId,
      p_session_id: sessionId,
      p_operation: "generate",
      p_request_fingerprint: generationFingerprint,
      p_lease_seconds: 600,
    }),
  );
  if (generationClaim?.outcome !== "acquired" || !generationClaim.claim_token) {
    throw new Error("generation claim inválido");
  }

  const stored = assertRpc(
    "store claimed",
    await admin.rpc("store_quiz_attempt_claimed", {
      p_user_id: userId,
      p_session_id: sessionId,
      p_questions: questions,
      p_model_provider: "demo",
      p_model_name: "remote-fixture",
      p_generated_at: new Date().toISOString(),
      p_request_fingerprint: generationFingerprint,
      p_claim_token: generationClaim.claim_token,
    }),
  );
  if (stored?.created !== true || !stored.attempt_id) {
    throw new Error("snapshot remoto no creado");
  }

  const evaluationClaim = assertRpc(
    "claim evaluation",
    await admin.rpc("claim_quiz_ai_operation", {
      p_user_id: userId,
      p_session_id: sessionId,
      p_operation: "evaluate",
      p_request_fingerprint: evaluationFingerprint,
      p_lease_seconds: 600,
    }),
  );
  if (evaluationClaim?.outcome !== "acquired" || !evaluationClaim.claim_token) {
    throw new Error("evaluation claim inválido");
  }

  const finalized = assertRpc(
    "finalize claimed",
    await admin.rpc("finalize_quiz_and_adapt_claimed", {
      p_user_id: userId,
      p_session_id: sessionId,
      p_attempt_id: stored.attempt_id,
      p_answers: answers,
      p_qualitative: { error_patterns: [] },
      p_request_fingerprint: evaluationFingerprint,
      p_claim_token: evaluationClaim.claim_token,
    }),
  );
  if (
    finalized?.outcome !== "finalized" ||
    finalized.evaluation?.score !== 70 ||
    finalized.evaluation?.action !== "advance" ||
    finalized.adaptation?.action !== "advance"
  ) {
    throw new Error("finalización remota inválida");
  }

  const replay = assertRpc(
    "finalize replay",
    await admin.rpc("finalize_quiz_and_adapt", {
      p_user_id: userId,
      p_session_id: sessionId,
      p_attempt_id: stored.attempt_id,
      p_answers: [...answers].reverse(),
      p_qualitative: { error_patterns: [] },
    }),
  );
  if (replay?.outcome !== "duplicate" || replay.adaptation?.already_processed !== true) {
    throw new Error("replay remoto no idempotente");
  }

  const progress = await admin
    .from("topic_progress")
    .select("attempts, last_score, status")
    .eq("user_id", userId)
    .eq("study_plan_id", planId)
    .eq("topic_code", "FL-1.1.1")
    .maybeSingle();
  if (
    progress.error ||
    progress.data?.attempts !== 1 ||
    progress.data?.last_score !== 70 ||
    progress.data?.status !== "mastered"
  ) {
    throw new Error("progreso remoto inválido");
  }

  console.log(
    JSON.stringify({
      generation_claimed: true,
      snapshot_private: true,
      evaluation_claimed: true,
      score: 70,
      adaptation: "advance",
      replay_idempotent: true,
      progress_attempts: 1,
    }),
  );
} finally {
  if (userCreated) {
    const cleanupErrors = [];
    for (const [table, query] of [
      ["sessions", admin.from("sessions").delete().eq("user_id", userId)],
      [
        "topic_progress",
        admin.from("topic_progress").delete().eq("user_id", userId),
      ],
      ["study_plans", admin.from("study_plans").delete().eq("user_id", userId)],
      ["documents", admin.from("documents").delete().eq("user_id", userId)],
    ]) {
      const cleanup = await query;
      if (cleanup.error) cleanupErrors.push(table);
    }
    const cleanup = await admin.auth.admin.deleteUser(userId);
    if (cleanup.error) cleanupErrors.push("user");
    if (cleanupErrors.length > 0) {
      throw new Error(`cleanup incompleto: ${cleanupErrors.join(",")}`);
    }
  }
}
