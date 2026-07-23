import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POST,
  calculatePlanDensity,
  createDemoPlan,
  parseGeneratedPlan,
} from "@/app/api/plan/generate/route";
import { POST as savePlan } from "@/app/api/plan/save/route";
import { MODEL_ALLOWLIST } from "@/lib/ai/model-cascade";
import type { TopicsJson } from "@/types";

const runtimeMocks = vi.hoisted(() => ({
  document: null as {
    id: string;
    user_id: string;
    topics_json: TopicsJson;
    file_name: string;
  } | null,
  recordAiUsage: vi.fn(),
  resolveAiRuntime: vi.fn(),
}));

vi.mock("@/lib/ai/runtime", () => ({
  recordAiUsage: runtimeMocks.recordAiUsage,
  resolveAiRuntime: runtimeMocks.resolveAiRuntime,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
        error: null,
      })),
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      single: vi.fn(async () => ({ data: runtimeMocks.document, error: null })),
    };
    return { from: vi.fn(() => query) };
  }),
}));

function createTopics(total = 63): TopicsJson {
  return Object.fromEntries(
    Array.from({ length: total }, (_, index) => {
      const chapter = Math.min(6, Math.floor(index / 11) + 1);
      const position = (index % 11) + 1;
      const levels = ["K1", "K2", "K3"] as const;
      const level = levels[index % levels.length];
      return [
        `FL-${chapter}.${position}.1`,
        {
          text: `Contenido del tópico ${index + 1}`,
          level_k: level,
          name: `Tópico ${index + 1} del capítulo ${chapter}`,
          chapter,
          section: `${chapter}.${position}`,
        },
      ];
    }),
  );
}

function expectedDifficulty(
  topicCodes: readonly string[],
  topics: TopicsJson,
): "easy" | "medium" | "hard" {
  const levels = topicCodes.map((code) => topics[code].level_k);
  if (levels.includes("K3")) return "hard";
  if (levels.includes("K2")) return "medium";
  return "easy";
}

function createPlanRequest(days: number): Request {
  return new Request("http://localhost/api/plan/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      document_id: runtimeMocks.document?.id,
      config: {
        objective_days: days,
        morning_time: "08:00",
        night_time: "20:00",
      },
    }),
  });
}

function createSavePlanRequest(plan: unknown, days: number): Request {
  return new Request("http://localhost/api/plan/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      document_id: runtimeMocks.document?.id,
      plan,
      config: {
        objective_days: days,
        morning_time: "08:00",
        night_time: "20:00",
      },
    }),
  });
}

function readyRuntime(
  eventId: string,
  model: string,
  create: ReturnType<typeof vi.fn>,
) {
  return {
    status: "ready",
    mode: "managed",
    eventId,
    settings: { mode: "managed", provider: "gemini", model_name: model },
    provider: "gemini",
    model,
    modelWasDefaulted: false,
    estimatedPromptTokens: 100,
    maxCompletionTokens: 16_000,
    usage: {
      daily_requests: 0,
      daily_tokens: 0,
      monthly_requests: 0,
      monthly_tokens: 0,
    },
    runtime: {
      provider: "gemini",
      model,
      timeoutMs: 90_000,
      client: { chat: { completions: { create } } },
    },
  };
}

describe("UP-04 plan Demo contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeMocks.resolveAiRuntime.mockImplementation(async ({ eventId }) => ({
      status: "demo",
      mode: "demo",
      eventId,
      settings: { mode: "demo" },
    }));
    runtimeMocks.recordAiUsage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([7, 15, 30])(
    "passes the shared parser for %i days",
    (days) => {
      const topics = createTopics();
      const plan = createDemoPlan(topics, days);
      const parsed = parseGeneratedPlan(JSON.stringify(plan), topics, days);
      const density = calculatePlanDensity(63, days * 2);

      expect(parsed).not.toBeNull();
      expect(plan.sessions).toHaveLength(days * 2);
      expect(plan.coverage.omitted_topic_codes).toEqual([]);
      expect(new Set(plan.coverage.covered_topic_codes).size).toBe(63);

      const sessionCodes = plan.sessions.flatMap(
        (session) => session.topic_codes,
      );
      expect(sessionCodes).toHaveLength(63);
      expect(new Set(sessionCodes).size).toBe(63);
      expect(new Set(sessionCodes)).toEqual(new Set(Object.keys(topics)));

      for (const session of plan.sessions) {
        expect(session.topic_codes.length).toBeGreaterThanOrEqual(density.min);
        expect(session.topic_codes.length).toBeLessThanOrEqual(density.max);
        expect(session.method).toBe("theory");
        expect(session.estimated_duration_minutes).toBe(90);
        expect(session.title.trim().length).toBeGreaterThan(0);
        expect(session.title.trim().length).toBeLessThanOrEqual(80);
        expect(session.difficulty).toBe(
          expectedDifficulty(session.topic_codes, topics),
        );
      }
    },
  );

  it.each([7, 15, 30])(
    "returns HTTP 200 through the real Route Handler for %i days",
    async (days) => {
      const topics = createTopics();
      runtimeMocks.document = {
        id: "00000000-0000-4000-8000-000000000002",
        user_id: "00000000-0000-4000-8000-000000000001",
        topics_json: topics,
        file_name: "syllabus.pdf",
      };
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const response = await POST(createPlanRequest(days));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.plan.sessions).toHaveLength(days * 2);
      expect(body.plan.coverage.covered_topic_codes).toHaveLength(63);
      expect(body.plan.coverage.omitted_topic_codes).toEqual([]);
      expect(body.model_provider).toBe("demo");
      expect(body.tokens_used).toBe(0);
      expect(runtimeMocks.recordAiUsage).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "demo", status: "success" }),
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    },
  );

  it("rejects a plan density that cannot evaluate every topic", async () => {
    runtimeMocks.document = {
      id: "00000000-0000-4000-8000-000000000002",
      user_id: "00000000-0000-4000-8000-000000000001",
      topics_json: createTopics(),
      file_name: "syllabus.pdf",
    };

    const response = await POST(createPlanRequest(1));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.code).toBe("PLAN_DAYS_INSUFFICIENT_FOR_QUIZ");
    expect(body.minimum_days).toBe(3);
    expect(runtimeMocks.resolveAiRuntime).not.toHaveBeenCalled();
  });

  it("rejects a browser-tampered plan before persistence", async () => {
    const days = 7;
    const topics = createTopics();
    const plan = createDemoPlan(topics, days);
    runtimeMocks.document = {
      id: "00000000-0000-4000-8000-000000000002",
      user_id: "00000000-0000-4000-8000-000000000001",
      topics_json: topics,
      file_name: "syllabus.pdf",
    };
    plan.sessions[0] = {
      ...plan.sessions[0],
      method: "examples" as "theory",
    };

    const response = await savePlan(createSavePlanRequest(plan, days));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("contrato de generación");
  });

  it("falls back on availability with one event per candidate", async () => {
    const topics = createTopics();
    const days = 7;
    const firstModel = MODEL_ALLOWLIST.gemini[0];
    const secondModel = MODEL_ALLOWLIST.gemini[1];
    const unavailable = Object.assign(new Error("provider stub unavailable"), {
      name: "APIConnectionError",
    });
    const firstCreate = vi.fn().mockRejectedValue(unavailable);
    const secondCreate = vi.fn().mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify(createDemoPlan(topics, days)) } },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 200 },
    });
    runtimeMocks.document = {
      id: "00000000-0000-4000-8000-000000000002",
      user_id: "00000000-0000-4000-8000-000000000001",
      topics_json: topics,
      file_name: "syllabus.pdf",
    };
    runtimeMocks.resolveAiRuntime.mockImplementation(
      async ({ eventId, modelOverride }) =>
        readyRuntime(
          eventId,
          modelOverride ?? firstModel,
          modelOverride ? secondCreate : firstCreate,
        ),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await POST(createPlanRequest(days));
    const body = await response.json();
    const events = runtimeMocks.recordAiUsage.mock.calls.map(([event]) => event);

    expect(response.status).toBe(200);
    expect(body.model_provider).toBe("gemini");
    expect(body.model_used).toBe(secondModel);
    expect(runtimeMocks.resolveAiRuntime).toHaveBeenCalledTimes(2);
    expect(runtimeMocks.resolveAiRuntime.mock.calls[1][0]).toEqual(
      expect.objectContaining({ modelOverride: secondModel }),
    );
    expect(firstCreate).toHaveBeenCalledTimes(1);
    expect(secondCreate).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(
      expect.objectContaining({
        model: firstModel,
        status: "error",
        errorCode: "AI_PROVIDER_UNAVAILABLE",
      }),
    );
    expect(events[1]).toEqual(
      expect.objectContaining({ model: secondModel, status: "success" }),
    );
    expect(events[0].eventId).not.toBe(events[1].eventId);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not fall back when the provider returns an invalid plan", async () => {
    const topics = createTopics();
    const firstModel = MODEL_ALLOWLIST.gemini[0];
    const invalidCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "{}" } }],
      usage: { prompt_tokens: 100, completion_tokens: 1 },
    });
    runtimeMocks.document = {
      id: "00000000-0000-4000-8000-000000000002",
      user_id: "00000000-0000-4000-8000-000000000001",
      topics_json: topics,
      file_name: "syllabus.pdf",
    };
    runtimeMocks.resolveAiRuntime.mockImplementation(async ({ eventId }) =>
      readyRuntime(eventId, firstModel, invalidCreate),
    );

    const response = await POST(createPlanRequest(7));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.code).toBe("AI_INVALID_RESPONSE");
    expect(runtimeMocks.resolveAiRuntime).toHaveBeenCalledTimes(1);
    expect(invalidCreate).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.recordAiUsage).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: firstModel,
        status: "error",
        errorCode: "AI_INVALID_RESPONSE",
      }),
    );
  });
});
