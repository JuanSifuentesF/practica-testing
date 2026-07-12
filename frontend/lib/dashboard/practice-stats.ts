import type { PracticeExerciseType } from "@/types/practice";
import type { PracticeStats } from "@/types/dashboard";

export interface PracticeExerciseMetric {
  id: string;
  exercise_type: PracticeExerciseType;
}

export interface PracticeSubmissionMetric {
  exercise_id: string;
  score_percent: number | null;
}

const PRACTICE_TYPES: readonly PracticeExerciseType[] = [
  "test_cases",
  "bug_report",
  "api_testing",
  "exploratory",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPracticeExerciseMetric(
  value: unknown,
): value is PracticeExerciseMetric {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    PRACTICE_TYPES.includes(value.exercise_type as PracticeExerciseType)
  );
}

export function isPracticeSubmissionMetric(
  value: unknown,
): value is PracticeSubmissionMetric {
  return (
    isRecord(value) &&
    typeof value.exercise_id === "string" &&
    (typeof value.score_percent === "number" || value.score_percent === null)
  );
}

function emptyByType(): Record<PracticeExerciseType, number> {
  return { test_cases: 0, bug_report: 0, api_testing: 0, exploratory: 0 };
}

export function buildPracticeStats(
  exercises: readonly PracticeExerciseMetric[],
  submissions: readonly PracticeSubmissionMetric[],
): PracticeStats {
  const byType = emptyByType();
  for (const exercise of exercises) byType[exercise.exercise_type]++;

  const completedIds = new Set(
    submissions.map((submission) => submission.exercise_id),
  );
  const scores = submissions
    .map((submission) => submission.score_percent)
    .filter(
      (score): score is number =>
        typeof score === "number" && Number.isFinite(score),
    );
  const avgScore =
    scores.length === 0
      ? null
      : Math.round(
          (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100,
        ) / 100;

  let mostPracticedType: PracticeExerciseType | null = null;
  let largestCount = 0;
  for (const type of PRACTICE_TYPES) {
    if (byType[type] > largestCount) {
      mostPracticedType = type;
      largestCount = byType[type];
    }
  }

  return {
    total_exercises: exercises.length,
    completed_exercises: completedIds.size,
    avg_score: avgScore,
    by_type: byType,
    most_practiced_type: mostPracticedType,
  };
}

export function assertPracticeStatsFixtures(): void {
  const valid = buildPracticeStats(
    [
      { id: "exercise-1", exercise_type: "test_cases" },
      { id: "exercise-2", exercise_type: "bug_report" },
    ],
    [
      { exercise_id: "exercise-1", score_percent: 80 },
      { exercise_id: "exercise-2", score_percent: 60 },
    ],
  );
  const empty = buildPracticeStats([], []);
  if (
    valid.total_exercises !== 2 ||
    valid.completed_exercises !== 2 ||
    valid.avg_score !== 70
  )
    throw new Error("Fixture valido de PracticeStats fallo.");
  if (
    isPracticeExerciseMetric({ id: "old", exercise_type: "bug_reports" }) ||
    isPracticeExerciseMetric({ exercise_type: "test_cases" }) ||
    isPracticeExerciseMetric({ id: "bad", exercise_type: "manual" })
  )
    throw new Error("Fixture invalido de PracticeStats fue aceptado.");
  if (
    empty.total_exercises !== 0 ||
    empty.most_practiced_type !== null ||
    empty.avg_score !== null
  )
    throw new Error("Fixture vacio de PracticeStats fallo.");
}
