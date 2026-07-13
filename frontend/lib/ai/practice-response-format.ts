import type { PracticeExerciseType } from "@/types/practice";

type JsonSchema = Record<string, unknown>;

const nonEmptyString: JsonSchema = { type: "string", minLength: 1 };
const nonEmptyStringArray: JsonSchema = {
  type: "array",
  minItems: 1,
  items: nonEmptyString,
};

const modelAnswerSchemas: Record<PracticeExerciseType, JsonSchema> = {
  test_cases: {
    type: "object",
    additionalProperties: false,
    required: ["test_cases"],
    properties: {
      test_cases: {
        type: "array",
        minItems: 6,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "scenario", "test_data", "expected_result", "type"],
          properties: {
            id: nonEmptyString,
            scenario: nonEmptyString,
            test_data: nonEmptyString,
            expected_result: nonEmptyString,
            type: { type: "string", enum: ["positive", "negative", "boundary"] },
          },
        },
      },
    },
  },
  bug_report: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "preconditions",
      "steps",
      "actual_result",
      "expected_result",
      "severity",
      "priority",
      "evidence",
    ],
    properties: {
      title: nonEmptyString,
      preconditions: nonEmptyString,
      steps: nonEmptyStringArray,
      actual_result: nonEmptyString,
      expected_result: nonEmptyString,
      severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
      priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
      evidence: nonEmptyString,
    },
  },
  api_testing: {
    type: "object",
    additionalProperties: false,
    required: ["checklist"],
    properties: {
      checklist: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "validation", "checked", "notes"],
          properties: {
            id: nonEmptyString,
            validation: nonEmptyString,
            checked: { type: "boolean" },
            notes: nonEmptyString,
          },
        },
      },
    },
  },
  exploratory: {
    type: "object",
    additionalProperties: false,
    required: ["notes", "findings"],
    properties: {
      notes: nonEmptyString,
      findings: nonEmptyStringArray,
    },
  },
};

export function buildPracticeResponseFormat(exerciseType: PracticeExerciseType) {
  const scenarioProperties: Record<string, JsonSchema> = {
    scenario: { type: "string", minLength: 50 },
    task_description: { type: "string", minLength: 20 },
    constraints: nonEmptyStringArray,
    evaluation_criteria: nonEmptyStringArray,
  };

  const scenarioRequired = [
    "scenario",
    "task_description",
    "constraints",
    "evaluation_criteria",
  ];

  if (exerciseType === "bug_report") {
    scenarioProperties.user_story = nonEmptyString;
    scenarioProperties.business_rule = nonEmptyString;
    scenarioProperties.observed_bug = nonEmptyString;
    scenarioRequired.push("user_story", "business_rule", "observed_bug");
  }

  return {
    type: "json_schema" as const,
    json_schema: {
      name: `practice_${exerciseType}`,
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["scenario", "reference_solution"],
        properties: {
          scenario: {
            type: "object",
            additionalProperties: false,
            required: scenarioRequired,
            properties: scenarioProperties,
          },
          reference_solution: {
            type: "object",
            additionalProperties: false,
            required: ["model_answer", "explanation", "key_points"],
            properties: {
              model_answer: modelAnswerSchemas[exerciseType],
              explanation: { type: "string", minLength: 30 },
              key_points: nonEmptyStringArray,
            },
          },
        },
      },
    },
  };
}
