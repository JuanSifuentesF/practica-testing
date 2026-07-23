import type { ActionTaken } from "@/types";
import type { AdaptResponse } from "@/types/adapt";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_ACTIONS: ActionTaken[] = ["advance", "reinforce", "restructure"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readAdaptResponse(value: unknown): AdaptResponse | null {
  if (
    !isRecord(value) ||
    !VALID_ACTIONS.includes(value.action as ActionTaken) ||
    !Array.isArray(value.reinforcement_session_ids) ||
    value.reinforcement_session_ids.some(
      (id) => typeof id !== "string" || !UUID_REGEX.test(id),
    ) ||
    (value.new_estimated_end_date !== null &&
      (typeof value.new_estimated_end_date !== "string" ||
        !DATE_REGEX.test(value.new_estimated_end_date))) ||
    typeof value.already_processed !== "boolean" ||
    typeof value.message !== "string" ||
    value.message.trim().length === 0
  ) {
    return null;
  }

  const action = value.action as ActionTaken;
  const expectedCount = action === "advance" ? 0 : action === "reinforce" ? 1 : 2;
  if (
    value.reinforcement_session_ids.length !== expectedCount ||
    (action === "restructure") !==
      (value.new_estimated_end_date !== null)
  ) {
    return null;
  }

  return {
    action,
    reinforcement_session_ids: value.reinforcement_session_ids as string[],
    new_estimated_end_date: value.new_estimated_end_date as string | null,
    already_processed: value.already_processed,
    message: value.message,
  };
}
