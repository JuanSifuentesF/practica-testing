import "server-only";

import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
export type QuizAiOperation = "generate" | "evaluate";

export type QuizAiClaim =
  | { outcome: "acquired"; claimToken: string }
  | { outcome: "in_progress" | "completed" | "conflict"; claimToken: null };

export function createQuizAiFingerprint(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function claimQuizAiOperation(
  adminClient: AdminClient,
  input: {
    userId: string;
    sessionId: string;
    operation: QuizAiOperation;
    fingerprint: string;
  },
): Promise<QuizAiClaim> {
  const { data, error } = await adminClient.rpc("claim_quiz_ai_operation", {
    p_user_id: input.userId,
    p_session_id: input.sessionId,
    p_operation: input.operation,
    p_request_fingerprint: input.fingerprint,
    p_lease_seconds: 600,
  });

  if (error) throw new Error(error.message);
  if (
    !data ||
    typeof data !== "object" ||
    !("outcome" in data) ||
    !("claim_token" in data)
  ) {
    throw new Error("QUIZ_AI_CLAIM_RESPONSE_INVALID");
  }

  if (
    data.outcome === "acquired" &&
    typeof data.claim_token === "string"
  ) {
    return { outcome: "acquired", claimToken: data.claim_token };
  }

  if (
    (data.outcome === "in_progress" ||
      data.outcome === "completed" ||
      data.outcome === "conflict") &&
    data.claim_token === null
  ) {
    return { outcome: data.outcome, claimToken: null };
  }

  throw new Error("QUIZ_AI_CLAIM_RESPONSE_INVALID");
}

export async function releaseQuizAiOperation(
  adminClient: AdminClient,
  input: {
    userId: string;
    sessionId: string;
    operation: QuizAiOperation;
    fingerprint: string;
    claimToken: string;
  },
): Promise<void> {
  const { error } = await adminClient.rpc("release_quiz_ai_operation", {
    p_user_id: input.userId,
    p_session_id: input.sessionId,
    p_operation: input.operation,
    p_request_fingerprint: input.fingerprint,
    p_claim_token: input.claimToken,
  });
  if (error) throw new Error(error.message);
}
