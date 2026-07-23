import type { LevelK, TopicsJson } from "@/types";

export interface FastApiErrorResponse {
  detail: string;
  error_code: string;
}

export interface FastApiExtractionResponse {
  contract_version: 2;
  filename: string;
  total_pages: number;
  extraction_method: string;
  topics: TopicsJson;
  total_topics: number;
  level_distribution: { K1: number; K2: number; K3: number };
  estimated_study_hours: number;
  warnings: string[];
  is_complete: boolean;
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super("PAYLOAD_TOO_LARGE");
    this.name = "PayloadTooLargeError";
  }
}

const PRESERVED_ERROR_STATUSES = new Set([400, 401, 413, 422, 429, 500, 503]);
const EXPECTED_CTFL_V4_TOPIC_CODES = new Set([
  "FL-1.1.1",
  "FL-1.1.2",
  "FL-1.2.1",
  "FL-1.2.2",
  "FL-1.2.3",
  "FL-1.3.1",
  "FL-1.4.1",
  "FL-1.4.2",
  "FL-1.4.3",
  "FL-1.4.4",
  "FL-1.4.5",
  "FL-1.5.1",
  "FL-1.5.2",
  "FL-1.5.3",
  "FL-2.1.1",
  "FL-2.1.2",
  "FL-2.1.3",
  "FL-2.1.4",
  "FL-2.1.5",
  "FL-2.1.6",
  "FL-2.2.1",
  "FL-2.2.2",
  "FL-2.2.3",
  "FL-2.3.1",
  "FL-3.1.1",
  "FL-3.1.2",
  "FL-3.1.3",
  "FL-3.2.1",
  "FL-3.2.2",
  "FL-3.2.3",
  "FL-3.2.4",
  "FL-3.2.5",
  "FL-4.1.1",
  "FL-4.2.1",
  "FL-4.2.2",
  "FL-4.2.3",
  "FL-4.2.4",
  "FL-4.3.1",
  "FL-4.3.2",
  "FL-4.3.3",
  "FL-4.4.1",
  "FL-4.4.2",
  "FL-4.4.3",
  "FL-4.5.1",
  "FL-4.5.2",
  "FL-4.5.3",
  "FL-5.1.1",
  "FL-5.1.2",
  "FL-5.1.3",
  "FL-5.1.4",
  "FL-5.1.5",
  "FL-5.1.6",
  "FL-5.1.7",
  "FL-5.2.1",
  "FL-5.2.2",
  "FL-5.2.3",
  "FL-5.2.4",
  "FL-5.3.1",
  "FL-5.3.2",
  "FL-5.3.3",
  "FL-5.4.1",
  "FL-5.5.1",
  "FL-6.1.1",
  "FL-6.2.1",
]);

export function mapFastApiErrorStatus(status: number): number {
  return PRESERVED_ERROR_STATUSES.has(status) ? status : 502;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLevelK(value: unknown): value is LevelK {
  return value === "K1" || value === "K2" || value === "K3";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function parseFastApiError(value: unknown): FastApiErrorResponse | null {
  if (
    !isRecord(value) ||
    typeof value.detail !== "string" ||
    value.detail.trim().length === 0 ||
    typeof value.error_code !== "string" ||
    !/^[A-Z][A-Z0-9_]*$/.test(value.error_code)
  ) {
    return null;
  }
  return { detail: value.detail, error_code: value.error_code };
}

export function parseFastApiExtraction(
  value: unknown,
): FastApiExtractionResponse | null {
  if (
    !isRecord(value) ||
    value.contract_version !== 2 ||
    typeof value.filename !== "string" ||
    !isNonNegativeInteger(value.total_pages) ||
    value.total_pages < 1 ||
    typeof value.extraction_method !== "string" ||
    !isRecord(value.topics) ||
    !isNonNegativeInteger(value.total_topics) ||
    !isRecord(value.level_distribution) ||
    !isNonNegativeInteger(value.level_distribution.K1) ||
    !isNonNegativeInteger(value.level_distribution.K2) ||
    !isNonNegativeInteger(value.level_distribution.K3) ||
    typeof value.estimated_study_hours !== "number" ||
    value.estimated_study_hours < 0 ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((warning) => typeof warning === "string") ||
    typeof value.is_complete !== "boolean"
  ) {
    return null;
  }

  const topics: TopicsJson = {};
  for (const [code, candidate] of Object.entries(value.topics)) {
    if (
      !/^FL-\d+\.\d+\.\d+$/.test(code) ||
      !isRecord(candidate) ||
      !isLevelK(candidate.level_k) ||
      typeof candidate.text !== "string" ||
      candidate.text.trim().length === 0 ||
      typeof candidate.name !== "string" ||
      candidate.name.trim().length < 3 ||
      !isNonNegativeInteger(candidate.chapter) ||
      candidate.chapter < 1 ||
      candidate.chapter > 6 ||
      typeof candidate.section !== "string"
    ) {
      return null;
    }
    topics[code] = {
      level_k: candidate.level_k,
      text: candidate.text,
      name: candidate.name,
      chapter: candidate.chapter,
      section: candidate.section,
    };
  }

  const actualDistribution = { K1: 0, K2: 0, K3: 0 };
  for (const topic of Object.values(topics)) {
    actualDistribution[topic.level_k] += 1;
  }
  if (
    value.total_topics === 0 ||
    Object.keys(topics).length !== value.total_topics ||
    actualDistribution.K1 !== value.level_distribution.K1 ||
    actualDistribution.K2 !== value.level_distribution.K2 ||
    actualDistribution.K3 !== value.level_distribution.K3
  ) {
    return null;
  }

  const topicCodes = Object.keys(topics);
  const hasExactCatalog =
    topicCodes.length === EXPECTED_CTFL_V4_TOPIC_CODES.size &&
    topicCodes.every((code) => EXPECTED_CTFL_V4_TOPIC_CODES.has(code));
  if (value.is_complete !== hasExactCatalog) {
    return null;
  }

  return {
    contract_version: 2,
    filename: value.filename,
    total_pages: value.total_pages,
    extraction_method: value.extraction_method,
    topics,
    total_topics: value.total_topics,
    level_distribution: {
      K1: value.level_distribution.K1,
      K2: value.level_distribution.K2,
      K3: value.level_distribution.K3,
    },
    estimated_study_hours: value.estimated_study_hours,
    warnings: value.warnings,
    is_complete: value.is_complete,
  };
}

export function parseCachedFastApiExtraction(
  topics: unknown,
  extractedText: unknown,
): FastApiExtractionResponse | null {
  if (typeof extractedText !== "string" || extractedText.trim().length === 0) {
    return null;
  }

  try {
    const metadata: unknown = JSON.parse(extractedText);
    if (!isRecord(metadata)) return null;
    return parseFastApiExtraction({ ...metadata, topics });
  } catch {
    return null;
  }
}

export async function readResponseWithLimit(
  response: Response,
  maxBytes: number,
): Promise<ArrayBuffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (!Number.isFinite(declaredLength) || declaredLength > maxBytes) {
      throw new PayloadTooLargeError();
    }
  }
  if (!response.body) throw new Error("RESPONSE_BODY_MISSING");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}
