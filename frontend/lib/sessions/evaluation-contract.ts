import "server-only";

import type { ActionTaken, AnswerOption, LevelK, MethodUsed } from "@/types";
import type {
  ErrorPattern,
  EvaluateResponse,
  FailedTopic,
  QuestionResult,
} from "@/types/evaluate";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => expectedKeys.includes(key))
  );
}

function isAction(value: unknown): value is ActionTaken {
  return value === "advance" || value === "reinforce" || value === "restructure";
}

function actionForScore(score: number): ActionTaken {
  if (score >= 70) return "advance";
  if (score >= 50) return "reinforce";
  return "restructure";
}

function isAnswerOption(value: unknown): value is AnswerOption {
  return value === "a" || value === "b" || value === "c" || value === "d";
}

function isLevelK(value: unknown): value is LevelK {
  return value === "K1" || value === "K2" || value === "K3";
}

function isMethodUsed(value: unknown): value is MethodUsed {
  return value === "theory" || value === "examples" || value === "analogies";
}

function readFailedTopic(value: unknown): FailedTopic | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "topic_code",
      "topic_name",
      "questions_failed",
      "questions_total",
    ]) ||
    typeof value.topic_code !== "string" ||
    value.topic_code.trim().length === 0 ||
    typeof value.topic_name !== "string" ||
    value.topic_name.trim().length === 0 ||
    typeof value.questions_failed !== "number" ||
    !Number.isInteger(value.questions_failed) ||
    value.questions_failed < 1 ||
    typeof value.questions_total !== "number" ||
    !Number.isInteger(value.questions_total) ||
    value.questions_total < value.questions_failed
  ) {
    return null;
  }

  return {
    topic_code: value.topic_code,
    topic_name: value.topic_name,
    questions_failed: value.questions_failed,
    questions_total: value.questions_total,
  };
}

function readErrorPattern(value: unknown): ErrorPattern | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["pattern", "frequency", "suggestion"]) ||
    typeof value.pattern !== "string" ||
    value.pattern.trim().length === 0 ||
    value.pattern.length > 500 ||
    (value.frequency !== "alta" &&
      value.frequency !== "media" &&
      value.frequency !== "baja") ||
    typeof value.suggestion !== "string" ||
    value.suggestion.trim().length === 0 ||
    value.suggestion.length > 1_000
  ) {
    return null;
  }

  return {
    pattern: value.pattern,
    frequency: value.frequency,
    suggestion: value.suggestion,
  };
}

function readQuestionResult(value: unknown): QuestionResult | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "question_id",
      "question",
      "options",
      "user_answer",
      "correct",
      "is_correct",
      "explanation",
      "topic_code",
      "level_k",
    ]) ||
    typeof value.question_id !== "number" ||
    !Number.isInteger(value.question_id) ||
    value.question_id < 0 ||
    typeof value.question !== "string" ||
    value.question.trim().length < 10 ||
    !isRecord(value.options) ||
    !hasOnlyKeys(value.options, ["a", "b", "c", "d"]) ||
    typeof value.options.a !== "string" ||
    typeof value.options.b !== "string" ||
    typeof value.options.c !== "string" ||
    typeof value.options.d !== "string" ||
    !isAnswerOption(value.user_answer) ||
    !isAnswerOption(value.correct) ||
    typeof value.is_correct !== "boolean" ||
    value.is_correct !== (value.user_answer === value.correct) ||
    typeof value.explanation !== "string" ||
    value.explanation.trim().length < 20 ||
    typeof value.topic_code !== "string" ||
    value.topic_code.trim().length === 0 ||
    !isLevelK(value.level_k)
  ) {
    return null;
  }

  return {
    question_id: value.question_id,
    question: value.question,
    options: {
      a: value.options.a,
      b: value.options.b,
      c: value.options.c,
      d: value.options.d,
    },
    user_answer: value.user_answer,
    correct: value.correct,
    is_correct: value.is_correct,
    explanation: value.explanation,
    topic_code: value.topic_code,
    level_k: value.level_k,
  };
}

export function readEvaluation(value: unknown): EvaluateResponse | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "score",
      "correct_count",
      "total_questions",
      "action",
      "failed_topics",
      "error_patterns",
      "feedback_message",
      "next_method",
      "reinforcement_minutes",
      "evaluated_at",
      "question_results",
    ]) ||
    typeof value.score !== "number" ||
    !Number.isInteger(value.score) ||
    value.score < 0 ||
    value.score > 100 ||
    typeof value.correct_count !== "number" ||
    !Number.isInteger(value.correct_count) ||
    typeof value.total_questions !== "number" ||
    !Number.isInteger(value.total_questions) ||
    value.total_questions < 10 ||
    value.total_questions > 12 ||
    value.correct_count < 0 ||
    value.correct_count > value.total_questions ||
    value.score !== Math.round((value.correct_count / value.total_questions) * 100) ||
    !isAction(value.action) ||
    value.action !== actionForScore(value.score) ||
    !Array.isArray(value.failed_topics) ||
    !Array.isArray(value.error_patterns) ||
    typeof value.feedback_message !== "string" ||
    value.feedback_message.trim().length === 0 ||
    value.feedback_message.length > 2_000 ||
    !isMethodUsed(value.next_method) ||
    typeof value.reinforcement_minutes !== "number" ||
    !Number.isInteger(value.reinforcement_minutes) ||
    value.reinforcement_minutes !==
      (value.action === "advance" ? 0 : value.action === "reinforce" ? 15 : 30) ||
    typeof value.evaluated_at !== "string" ||
    !Number.isFinite(Date.parse(value.evaluated_at)) ||
    !Array.isArray(value.question_results)
  ) {
    return null;
  }

  const failedTopics: FailedTopic[] = [];
  for (const item of value.failed_topics) {
    const topic = readFailedTopic(item);
    if (!topic) return null;
    failedTopics.push(topic);
  }

  const errorPatterns: ErrorPattern[] = [];
  if (value.error_patterns.length > 5) return null;
  for (const item of value.error_patterns) {
    const pattern = readErrorPattern(item);
    if (!pattern) return null;
    errorPatterns.push(pattern);
  }
  if (value.score === 100 && errorPatterns.length > 0) return null;

  const questionResults: QuestionResult[] = [];
  const questionIds = new Set<number>();
  for (const item of value.question_results) {
    const question = readQuestionResult(item);
    if (!question || questionIds.has(question.question_id)) return null;
    questionIds.add(question.question_id);
    questionResults.push(question);
  }

  if (
    questionResults.length !== value.total_questions ||
    questionResults.filter((question) => question.is_correct).length !==
      value.correct_count
  ) {
    return null;
  }

  return {
    score: value.score,
    correct_count: value.correct_count,
    total_questions: value.total_questions,
    action: value.action,
    failed_topics: failedTopics,
    error_patterns: errorPatterns,
    feedback_message: value.feedback_message,
    next_method: value.next_method,
    reinforcement_minutes: value.reinforcement_minutes,
    evaluated_at: value.evaluated_at,
    question_results: questionResults,
  };
}
