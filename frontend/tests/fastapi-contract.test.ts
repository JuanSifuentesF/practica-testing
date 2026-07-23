import { describe, expect, it } from "vitest";
import {
  PayloadTooLargeError,
  mapFastApiErrorStatus,
  parseCachedFastApiExtraction,
  parseFastApiError,
  parseFastApiExtraction,
  readResponseWithLimit,
} from "@/lib/api/fastapi-contract";

describe("FastAPI BFF contract", () => {
  it.each([400, 401, 413, 422, 429, 500, 503])(
    "preserves upstream status %i",
    (status) => {
      expect(mapFastApiErrorStatus(status)).toBe(status);
    },
  );

  it.each([403, 404, 418, 502])(
    "maps unsupported upstream status %i to 502",
    (status) => {
      expect(mapFastApiErrorStatus(status)).toBe(502);
    },
  );

  it("accepts only the flat public error shape", () => {
    expect(
      parseFastApiError({ detail: "Archivo inválido", error_code: "INVALID_FILE" }),
    ).toEqual({ detail: "Archivo inválido", error_code: "INVALID_FILE" });
    expect(
      parseFastApiError({
        detail: { detail: "Anidado", error_code: "INVALID_FILE" },
      }),
    ).toBeNull();
    expect(parseFastApiError({ detail: "Sin código" })).toBeNull();
  });

  it("normalizes every field required by the FastAPI topic contract", () => {
    const parsed = parseFastApiExtraction({
      contract_version: 2,
      filename: "syllabus.pdf",
      total_pages: 1,
      extraction_method: "pdfplumber",
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
      warnings: [],
      is_complete: false,
    });

    expect(parsed?.topics["FL-1.1.1"]).toEqual({
      level_k: "K1",
      name: "Objetivos de testing",
      text: "Contenido suficiente",
      chapter: 1,
      section: "1.1",
    });
  });

  it("rejects topics that omit FastAPI-required chapter or section", () => {
    const extraction = {
      contract_version: 2,
      filename: "syllabus.pdf",
      total_pages: 1,
      extraction_method: "pdfplumber",
      topics: {
        "FL-1.1.1": {
          level_k: "K1",
          name: "Objetivos de testing",
          text: "Contenido suficiente",
          chapter: 1,
        },
      },
      total_topics: 1,
      level_distribution: { K1: 1, K2: 0, K3: 0 },
      estimated_study_hours: 0.5,
      warnings: [],
      is_complete: false,
    };

    expect(parseFastApiExtraction(extraction)).toBeNull();
    expect(
      parseFastApiExtraction({
        ...extraction,
        topics: {
          "FL-1.1.1": { ...extraction.topics["FL-1.1.1"], section: "1.1" },
        },
        level_distribution: { K1: 0, K2: 1, K3: 0 },
      }),
    ).toBeNull();
  });

  it("rejects a successful response with no topics", () => {
    expect(
      parseFastApiExtraction({
        contract_version: 2,
        filename: "syllabus.pdf",
        total_pages: 1,
        extraction_method: "pdfplumber",
        topics: {},
        total_topics: 0,
        level_distribution: { K1: 0, K2: 0, K3: 0 },
        estimated_study_hours: 0,
        warnings: [],
        is_complete: false,
      }),
    ).toBeNull();
  });

  it("reconstructs cached extraction only from valid persisted metadata", () => {
    const topics = {
      "FL-1.1.1": {
        level_k: "K1",
        name: "Objetivos de testing",
        text: "Contenido suficiente",
        chapter: 1,
        section: "1.1",
      },
    };
    const metadata = JSON.stringify({
      contract_version: 2,
      filename: "syllabus.pdf",
      total_pages: 1,
      extraction_method: "pdfplumber",
      total_topics: 1,
      level_distribution: { K1: 1, K2: 0, K3: 0 },
      estimated_study_hours: 0.5,
      warnings: ["resultado parcial"],
      is_complete: false,
    });

    expect(parseCachedFastApiExtraction(topics, metadata)).toEqual(
      expect.objectContaining({
        topics,
        total_topics: 1,
        is_complete: false,
        warnings: ["resultado parcial"],
      }),
    );
    expect(parseCachedFastApiExtraction(topics, "not-json")).toBeNull();
    expect(parseCachedFastApiExtraction(topics, null)).toBeNull();
    expect(
      parseCachedFastApiExtraction(
        topics,
        JSON.stringify({ ...JSON.parse(metadata), contract_version: 1 }),
      ),
    ).toBeNull();
  });

  it("reads a response below the configured byte limit", async () => {
    const result = await readResponseWithLimit(
      new Response(new Uint8Array([1, 2, 3])),
      3,
    );
    expect(Array.from(new Uint8Array(result))).toEqual([1, 2, 3]);
  });

  it("rejects declared and streamed payloads over the limit", async () => {
    await expect(
      readResponseWithLimit(
        new Response(new Uint8Array([1]), {
          headers: { "content-length": "4" },
        }),
        3,
      ),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);

    await expect(
      readResponseWithLimit(new Response(new Uint8Array([1, 2, 3, 4])), 3),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });
});
