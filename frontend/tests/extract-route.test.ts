import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_SECRET = "test-only-shared-secret-with-at-least-32-characters";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  document: {} as Record<string, unknown>,
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
      update: vi.fn(() => query),
      eq: vi.fn(() => query),
      single: vi.fn(async () => ({
        data: mocks.document,
        error: null,
      })),
    };
    return {
      from: vi.fn(() => query),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(async () => ({
            data: { signedUrl: "https://storage.invalid/signed-pdf" },
            error: null,
          })),
        })),
      },
    };
  }),
}));

let postExtract: (request: Request) => Promise<Response>;

describe("Next.js extract BFF", () => {
  beforeAll(async () => {
    vi.stubEnv("FASTAPI_URL", "https://fastapi.invalid");
    vi.stubEnv("BFF_SHARED_SECRET", TEST_SECRET);
    vi.stubGlobal("fetch", mocks.fetch);
    ({ POST: postExtract } = await import("@/app/api/extract/route"));
  });

  beforeEach(() => {
    mocks.fetch.mockReset();
    mocks.document = {
      id: "00000000-0000-4000-8000-000000000002",
      user_id: "00000000-0000-4000-8000-000000000001",
      file_url: "user/document/syllabus.pdf",
      file_name: "syllabus.pdf",
      topics_json: null,
      extracted_text: null,
    };
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([400, 401, 413, 422, 429, 500, 503])(
    "preserves FastAPI status %i and sends the private BFF credential",
    async (status) => {
      mocks.fetch
        .mockResolvedValueOnce(
          new Response(new TextEncoder().encode("%PDF-valid"), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              detail: "Error público estable",
              error_code: "TEST_ERROR",
            }),
            {
              status,
              headers: {
                "content-type": "application/json",
                ...(status === 429 ? { "retry-after": "30" } : {}),
              },
            },
          ),
        );

      const response = await postExtract(
        new Request("http://localhost/api/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            document_id: "00000000-0000-4000-8000-000000000002",
          }),
        }),
      );

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({
        detail: "Error público estable",
        error_code: "TEST_ERROR",
      });
      const fastApiCall = mocks.fetch.mock.calls[1];
      expect(fastApiCall[0]).toBe(
        "https://fastapi.invalid/extract-pdf-full",
      );
      expect(fastApiCall[1]).toEqual(
        expect.objectContaining({
          method: "POST",
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        }),
      );
      if (status === 429) expect(response.headers.get("retry-after")).toBe("30");
    },
  );

  it("returns the same extraction fields from a validated cache", async () => {
    mocks.document = {
      ...mocks.document,
      topics_json: {
        "FL-1.1.1": {
          level_k: "K1",
          name: "Objetivos de testing",
          text: "Contenido suficiente",
          chapter: 1,
          section: "1.1",
        },
      },
      extracted_text: JSON.stringify({
        contract_version: 2,
        filename: "syllabus.pdf",
        total_pages: 1,
        extraction_method: "pdfplumber",
        total_topics: 1,
        level_distribution: { K1: 1, K2: 0, K3: 0 },
        estimated_study_hours: 0.5,
        warnings: ["resultado parcial"],
        is_complete: false,
      }),
    };

    const response = await postExtract(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          document_id: "00000000-0000-4000-8000-000000000002",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      contract_version: 2,
      topics: {
        "FL-1.1.1": {
          level_k: "K1",
          name: "Objetivos de testing",
          text: "Contenido suficiente",
          chapter: 1,
          section: "1.1",
        },
      },
      total_topics: 1,
      level_distribution: { K1: 1, K2: 0, K3: 0 },
      estimated_study_hours: 0.5,
      is_complete: false,
      warnings: ["resultado parcial"],
      already_extracted: true,
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
