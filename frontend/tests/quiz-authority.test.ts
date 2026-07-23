import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postQuiz } from "@/app/api/sessions/[id]/quiz/route";
import { POST as postEvaluate } from "@/app/api/sessions/[id]/evaluate/route";
import { POST as postAdapt } from "@/app/api/sessions/[id]/adapt/route";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  executeAiJson: vi.fn(),
  userId: "00000000-0000-4000-8000-000000000001",
  sessionId: "00000000-0000-4000-8000-000000000002",
  topicCodes: ["FL-1.1.1"],
  topicsJson: {
    "FL-1.1.1": {
      name: "Fundamentos de testing",
      text: "Contenido del syllabus",
      level_k: "K1",
      chapter: 1,
      section: "1.1",
    },
  } as Record<string, Record<string, unknown>>,
}));

const SESSION_ID = mocks.sessionId;
const ATTEMPT_ID = "00000000-0000-4000-8000-000000000003";
const CLAIM_TOKEN = "00000000-0000-4000-8000-000000000004";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    return {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: mocks.userId } },
          error: null,
        })),
      },
      from: vi.fn((table: string) => {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          in: vi.fn(async () => ({ data: [], error: null })),
          maybeSingle: vi.fn(async () => {
            if (table === "sessions") {
              return {
                data: {
                  id: mocks.sessionId,
                  user_id: mocks.userId,
                  study_plan_id: "00000000-0000-4000-8000-000000000010",
                  topic_codes: mocks.topicCodes,
                  day_number: 1,
                  session_type: "morning",
                  attempt_number: 1,
                  status: "active",
                },
                error: null,
              };
            }
            if (table === "study_plans") {
              return {
                data: {
                  id: "00000000-0000-4000-8000-000000000010",
                  document_id: "00000000-0000-4000-8000-000000000011",
                  objective_days: 7,
                  start_date: "2026-07-19",
                  estimated_end_date: "2026-07-26",
                },
                error: null,
              };
            }
            return {
              data: {
                topics_json: mocks.topicsJson,
              },
              error: null,
            };
          }),
        };
        return query;
      }),
    };
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc: mocks.rpc })),
}));

vi.mock("@/lib/ai/execute-json", () => ({
  executeAiJson: mocks.executeAiJson,
}));

function publicQuestions() {
  return Array.from({ length: 10 }, (_, questionId) => ({
    question_id: questionId,
    question: `Pregunta pública número ${questionId} sobre testing`,
    options: {
      a: `Opción A ${questionId}`,
      b: `Opción B ${questionId}`,
      c: `Opción C ${questionId}`,
      d: `Opción D ${questionId}`,
    },
    topic_code: "FL-1.1.1",
    level_k: "K1",
  }));
}

function privateQuestions() {
  return publicQuestions().map((question, questionId) => ({
    ...question,
    correct: questionId % 2 === 0 ? "a" : "b",
    explanation: `Explicación privada suficientemente extensa ${questionId}`,
    topic_name: "Fundamentos de testing",
  }));
}

function selections() {
  return privateQuestions().map((question) => ({
    question_id: question.question_id,
    user_answer: question.correct,
  }));
}

function selectionsWithOneWrong() {
  return selections().map((answer, index) =>
    index === 0 ? { ...answer, user_answer: "b" as const } : answer,
  );
}

function evaluation() {
  return {
    score: 100,
    correct_count: 10,
    total_questions: 10,
    action: "advance",
    failed_topics: [],
    error_patterns: [],
    feedback_message: "Dominio comprobado por el servidor.",
    next_method: "theory",
    reinforcement_minutes: 0,
    evaluated_at: "2026-07-19T20:50:30.000Z",
    question_results: privateQuestions().map((question) => ({
      question_id: question.question_id,
      question: question.question,
      options: question.options,
      user_answer: question.correct,
      correct: question.correct,
      is_correct: true,
      explanation: question.explanation,
      topic_code: question.topic_code,
      level_k: question.level_k,
    })),
  };
}

function evaluation90() {
  const base = evaluation();
  return {
    ...base,
    score: 90,
    correct_count: 9,
    failed_topics: [
      {
        topic_code: "FL-1.1.1",
        topic_name: "Fundamentos de testing",
        questions_failed: 1,
        questions_total: 5,
      },
    ],
    question_results: base.question_results.map((question, index) =>
      index === 0
        ? { ...question, user_answer: "b" as const, is_correct: false }
        : question,
    ),
  };
}

function quizRequest() {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}/quiz`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ force: true }),
  });
}

function evaluateRequest(body: unknown) {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}/evaluate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("quiz server authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.topicCodes = ["FL-1.1.1"];
    mocks.topicsJson = {
      "FL-1.1.1": {
        name: "Fundamentos de testing",
        text: "Contenido del syllabus",
        level_k: "K1",
        chapter: 1,
        section: "1.1",
      },
    };
    mocks.executeAiJson.mockResolvedValue({
      ok: true,
      value: {
        error_patterns: [],
        feedback_message: "Dominio comprobado por el servidor.",
        next_method: "theory",
        reinforcement_minutes: 0,
      },
    });
  });

  it("returns a durable public quiz without answer keys", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name !== "get_quiz_attempt_public") {
        throw new Error(`RPC inesperada: ${name}`);
      }
      return {
        data: {
          attempt_id: ATTEMPT_ID,
          state: "open",
          evaluation: null,
          questions: publicQuestions(),
          total_questions: 10,
          generated_at: "2026-07-19T20:50:30.000Z",
          model_provider: "demo",
          model_name: "fixture",
        },
        error: null,
      };
    });

    const response = await postQuiz(quizRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.quiz.attempt_id).toBe(ATTEMPT_ID);
    expect(JSON.stringify(body)).not.toContain('"correct"');
    expect(JSON.stringify(body)).not.toContain('"explanation"');
    expect(mocks.executeAiJson).not.toHaveBeenCalled();
  });

  it("persists the private generation before returning its safe projection", async () => {
    mocks.executeAiJson.mockResolvedValue({
      ok: true,
      value: privateQuestions(),
      provider: "demo",
      model: "fixture",
    });
    mocks.rpc.mockImplementation(
      async (name: string, args: Record<string, unknown>) => {
       if (name === "get_quiz_attempt_public") {
         return { data: null, error: null };
       }
       if (name === "claim_quiz_ai_operation") {
         return {
           data: { outcome: "acquired", claim_token: CLAIM_TOKEN },
           error: null,
         };
       }
       if (name === "store_quiz_attempt_claimed") {
        return {
          data: {
            attempt_id: ATTEMPT_ID,
            state: "open",
            evaluation: null,
            questions: publicQuestions(),
            total_questions: 10,
            generated_at: String(args.p_generated_at),
            model_provider: String(args.p_model_provider),
            model_name: String(args.p_model_name),
            created: true,
          },
          error: null,
         };
       }
      throw new Error(`RPC inesperada: ${name}`);
      },
    );

    const response = await postQuiz(quizRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cached).toBe(false);
    expect(JSON.stringify(body)).not.toContain('"correct"');
    expect(JSON.stringify(body)).not.toContain('"explanation"');

    const storeCall = mocks.rpc.mock.calls.find(
      ([name]) => name === "store_quiz_attempt_claimed",
    );
    expect(storeCall).toBeDefined();
    expect(storeCall![1].p_questions[0]).toHaveProperty("correct");
    expect(storeCall![1].p_questions[0]).toHaveProperty("explanation");
    expect(storeCall![1].p_claim_token).toBe(CLAIM_TOKEN);
  });

  it("does not call the LLM while another generation owns the lease", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "get_quiz_attempt_public") {
        return { data: null, error: null };
      }
      if (name === "claim_quiz_ai_operation") {
        return {
          data: { outcome: "in_progress", claim_token: null },
          error: null,
        };
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    const response = await postQuiz(quizRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(response.status).toBe(409);
    expect(response.headers.get("retry-after")).toBe("2");
    expect(mocks.executeAiJson).not.toHaveBeenCalled();
  });

  it("rejects sessions that are too dense before calling AI", async () => {
    mocks.topicCodes = Array.from({ length: 13 }, (_, index) => `FL-X.${index}`);
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    const response = await postQuiz(quizRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("QUIZ_SESSION_TOO_DENSE");
    expect(mocks.executeAiJson).not.toHaveBeenCalled();
  });

  it("rejects session topics missing from the authoritative document", async () => {
    mocks.topicCodes = ["FL-MISSING"];
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    const response = await postQuiz(quizRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("QUIZ_SESSION_TOPICS_INVALID");
    expect(mocks.executeAiJson).not.toHaveBeenCalled();
  });

  it("rehydrates the persisted evaluation only after completion", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "get_quiz_attempt_public") {
        return {
          data: {
            attempt_id: ATTEMPT_ID,
            state: "completed",
            evaluation: evaluation(),
            questions: publicQuestions(),
            total_questions: 10,
            generated_at: "2026-07-19T20:50:30.000Z",
            model_provider: "demo",
            model_name: "fixture",
          },
          error: null,
        };
      }
      if (name === "apply_session_adaptation_v2") {
        return {
          data: {
            action: "advance",
            reinforcement_session_ids: [],
            new_estimated_end_date: null,
            already_processed: true,
            message: "La adaptación ya estaba aplicada.",
          },
          error: null,
        };
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    const response = await postQuiz(quizRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.evaluation.score).toBe(100);
    expect(body.evaluation.question_results[0].correct).toBe("a");
    expect(body.adaptation.action).toBe("advance");
  });

  it("rejects unexpected persisted evaluation fields before browser exposure", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        attempt_id: ATTEMPT_ID,
        state: "completed",
        evaluation: { ...evaluation(), internal_note: "private" },
        questions: publicQuestions(),
        total_questions: 10,
        generated_at: "2026-07-19T20:50:30.000Z",
        model_provider: "demo",
        model_name: "fixture",
      },
      error: null,
    });

    const response = await postQuiz(quizRequest(), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private");
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("rejects any client-supplied answer key before database access", async () => {
    const tampered = selections().map((answer, index) =>
      index === 0 ? { ...answer, correct: "a" } : answer,
    );

    const response = await postEvaluate(
      evaluateRequest({ attempt_id: ATTEMPT_ID, answers: tampered }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.executeAiJson).not.toHaveBeenCalled();
  });

  it("grades from the private snapshot and sends only selections to the RPC", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "get_quiz_attempt_private") {
        return {
          data: {
            attempt_id: ATTEMPT_ID,
            state: "open",
            method_used: "theory",
            attempt_number: 1,
            canonical_submission: null,
            response: null,
            questions: privateQuestions(),
          },
          error: null,
        };
      }
      if (name === "claim_quiz_ai_operation") {
        return {
          data: { outcome: "acquired", claim_token: CLAIM_TOKEN },
          error: null,
        };
      }
      if (name === "finalize_quiz_and_adapt_claimed") {
        return {
          data: {
            outcome: "finalized",
            evaluation: evaluation90(),
            adaptation: {
              action: "advance",
              reinforcement_session_ids: [],
              new_estimated_end_date: null,
              already_processed: false,
              message: "El plan continúa sin cambios.",
            },
          },
          error: null,
        };
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    const response = await postEvaluate(
      evaluateRequest({
        attempt_id: ATTEMPT_ID,
        answers: selectionsWithOneWrong(),
      }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.score).toBe(90);
    expect(body.question_results[0].correct).toBe("a");
    expect(mocks.executeAiJson).toHaveBeenCalledOnce();

    const finalizeCall = mocks.rpc.mock.calls.find(
      ([name]) => name === "finalize_quiz_and_adapt_claimed",
    );
    expect(finalizeCall).toBeDefined();
    const rpcArgs = finalizeCall![1];
    expect(rpcArgs.p_answers).toEqual(selectionsWithOneWrong());
    for (const answer of rpcArgs.p_answers) {
      expect(Object.keys(answer).sort()).toEqual([
        "question_id",
        "user_answer",
      ]);
    }
    expect(rpcArgs.p_qualitative).not.toHaveProperty("score");
    expect(rpcArgs.p_qualitative).not.toHaveProperty("action");
    expect(rpcArgs.p_claim_token).toBe(CLAIM_TOKEN);
  });

  it("skips qualitative AI for a perfect deterministic score", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "get_quiz_attempt_private") {
        return {
          data: {
            attempt_id: ATTEMPT_ID,
            state: "open",
            method_used: "theory",
            attempt_number: 1,
            canonical_submission: null,
            response: null,
            questions: privateQuestions(),
          },
          error: null,
        };
      }
      if (name === "finalize_quiz_and_adapt") {
        return {
          data: {
            outcome: "finalized",
            evaluation: evaluation(),
            adaptation: {
              action: "advance",
              reinforcement_session_ids: [],
              new_estimated_end_date: null,
              already_processed: false,
              message: "El plan continúa sin cambios.",
            },
          },
          error: null,
        };
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    const response = await postEvaluate(
      evaluateRequest({ attempt_id: ATTEMPT_ID, answers: selections() }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.executeAiJson).not.toHaveBeenCalled();
    expect(
      mocks.rpc.mock.calls.some(([name]) => name === "claim_quiz_ai_operation"),
    ).toBe(false);
  });

  it("releases the evaluation lease when qualitative AI fails", async () => {
    mocks.executeAiJson.mockResolvedValue({
      ok: false,
      status: 503,
      body: {
        error: "Proveedor no disponible.",
        code: "AI_CONFIGURATION_UNAVAILABLE",
      },
    });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "get_quiz_attempt_private") {
        return {
          data: {
            attempt_id: ATTEMPT_ID,
            state: "open",
            method_used: "theory",
            attempt_number: 1,
            canonical_submission: null,
            response: null,
            questions: privateQuestions(),
          },
          error: null,
        };
      }
      if (name === "claim_quiz_ai_operation") {
        return {
          data: { outcome: "acquired", claim_token: CLAIM_TOKEN },
          error: null,
        };
      }
      if (name === "release_quiz_ai_operation") {
        return { data: true, error: null };
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    const response = await postEvaluate(
      evaluateRequest({
        attempt_id: ATTEMPT_ID,
        answers: selectionsWithOneWrong(),
      }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(response.status).toBe(503);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "release_quiz_ai_operation",
      expect.objectContaining({ p_claim_token: CLAIM_TOKEN }),
    );
    expect(
      mocks.rpc.mock.calls.some(([name]) =>
        String(name).startsWith("finalize_quiz_and_adapt"),
      ),
    ).toBe(false);
  });

  it("replays a completed attempt without another LLM request", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "get_quiz_attempt_private") {
        return {
          data: {
            attempt_id: ATTEMPT_ID,
            state: "completed",
            method_used: "theory",
            attempt_number: 1,
            canonical_submission: selections(),
            response: evaluation(),
            questions: privateQuestions(),
          },
          error: null,
        };
      }
      if (name === "finalize_quiz_and_adapt") {
        return {
          data: {
            outcome: "duplicate",
            evaluation: evaluation(),
            adaptation: {
              action: "advance",
              reinforcement_session_ids: [],
              new_estimated_end_date: null,
              already_processed: true,
              message: "La adaptación ya estaba aplicada.",
            },
          },
          error: null,
        };
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    const response = await postEvaluate(
      evaluateRequest({ attempt_id: ATTEMPT_ID, answers: selections() }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.executeAiJson).not.toHaveBeenCalled();
  });

  it("ignores client adaptation choices and delegates to the atomic RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        action: "reinforce",
        reinforcement_session_ids: [
          "00000000-0000-4000-8000-000000000020",
        ],
        new_estimated_end_date: null,
        already_processed: false,
        message: "Se agendó un refuerzo autoritativo.",
      },
      error: null,
    });

    const response = await postAdapt(
      new Request(`http://localhost/api/sessions/${SESSION_ID}/adapt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ next_method: "analogies", score: 100 }),
      }),
      { params: Promise.resolve({ id: SESSION_ID }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_session_adaptation_v2", {
      p_user_id: mocks.userId,
      p_session_id: SESSION_ID,
    });
  });
});
