import "server-only";

import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type TheoryAiClaim =
  | { outcome: "acquired"; claimToken: string }
  | { outcome: "in_progress"; claimToken: null }
  | { outcome: "conflict"; claimToken: null };

export function createTheoryAiFingerprint(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function claimTheoryAiOperation(
  adminClient: AdminClient,
  input: {
    userId: string;
    sessionId: string;
    fingerprint: string;
  },
): Promise<TheoryAiClaim> {
  const { data, error } = await adminClient.rpc("claim_theory_ai_operation", {
    p_user_id: input.userId,
    p_session_id: input.sessionId,
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
    throw new Error("THEORY_AI_CLAIM_RESPONSE_INVALID");
  }

  if (
    data.outcome === "acquired" &&
    typeof data.claim_token === "string"
  ) {
    return { outcome: "acquired", claimToken: data.claim_token };
  }

  if (
    (data.outcome === "in_progress" || data.outcome === "conflict") &&
    data.claim_token === null
  ) {
    return { outcome: data.outcome, claimToken: null };
  }

  throw new Error("THEORY_AI_CLAIM_RESPONSE_INVALID");
}

export async function releaseTheoryAiOperation(
  adminClient: AdminClient,
  input: {
    userId: string;
    sessionId: string;
    fingerprint: string;
    claimToken: string;
  },
): Promise<void> {
  const { error } = await adminClient.rpc("release_theory_ai_operation", {
    p_user_id: input.userId,
    p_session_id: input.sessionId,
    p_request_fingerprint: input.fingerprint,
    p_claim_token: input.claimToken,
  });
  if (error) throw new Error(error.message);
}
