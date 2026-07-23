import { NextResponse } from "next/server";
import {
  PayloadTooLargeError,
  mapFastApiErrorStatus,
  parseCachedFastApiExtraction,
  parseFastApiError,
  parseFastApiExtraction,
  readResponseWithLimit,
} from "@/lib/api/fastapi-contract";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const FASTAPI_URL = process.env.FASTAPI_URL;
const BFF_SHARED_SECRET = process.env.BFF_SHARED_SECRET;
const FASTAPI_TIMEOUT_MS = 30_000;
const STORAGE_TIMEOUT_MS = 10_000;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_EXPIRY_SECONDS = 60;

function jsonError(detail: string, errorCode: string, status: number) {
  return NextResponse.json(
    { detail, error_code: errorCode },
    { status },
  );
}

function parseDocumentId(value: unknown): string | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("document_id" in value) ||
    typeof value.document_id !== "string" ||
    value.document_id.trim().length === 0
  ) {
    return null;
  }
  return value.document_id.trim();
}

function extractionResponse(
  extraction: ReturnType<typeof parseFastApiExtraction> & {},
  warnings = extraction.warnings,
  alreadyExtracted = false,
) {
  return {
    contract_version: extraction.contract_version,
    topics: extraction.topics,
    total_topics: extraction.total_topics,
    level_distribution: extraction.level_distribution,
    estimated_study_hours: extraction.estimated_study_hours,
    is_complete: extraction.is_complete,
    warnings,
    ...(alreadyExtracted ? { already_extracted: true } : {}),
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonError(
        "No autenticado. Por favor inicia sesión.",
        "UNAUTHENTICATED",
        401,
      );
    }

    if (!FASTAPI_URL || !BFF_SHARED_SECRET || BFF_SHARED_SECRET.length < 32) {
      console.error("[Extract] Configuración BFF/FastAPI incompleta");
      return jsonError(
        "El servicio de extracción no está configurado.",
        "SERVICE_CONFIGURATION_ERROR",
        500,
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError("Se esperaba un body JSON válido.", "INVALID_JSON", 400);
    }
    const documentId = parseDocumentId(rawBody);
    if (!documentId) {
      return jsonError(
        "document_id es obligatorio.",
        "INVALID_DOCUMENT_ID",
        400,
      );
    }

    const adminClient = createAdminClient();
    const { data: document, error: documentError } = await adminClient
      .from("documents")
      .select("id, user_id, file_url, file_name, topics_json, extracted_text")
      .eq("id", documentId)
      .single();
    if (documentError || !document) {
      return jsonError("Documento no encontrado.", "DOCUMENT_NOT_FOUND", 404);
    }
    if (document.user_id !== user.id) {
      return jsonError(
        "No tienes permisos para acceder a este documento.",
        "DOCUMENT_FORBIDDEN",
        403,
      );
    }

    const cachedExtraction = parseCachedFastApiExtraction(
      document.topics_json,
      document.extracted_text,
    );
    if (cachedExtraction) {
      return NextResponse.json(
        extractionResponse(cachedExtraction, cachedExtraction.warnings, true),
      );
    }

    const { data: signedUrlData, error: signedUrlError } =
      await adminClient.storage
        .from("pdfs")
        .createSignedUrl(document.file_url, SIGNED_URL_EXPIRY_SECONDS);
    if (signedUrlError || !signedUrlData?.signedUrl) {
      return jsonError(
        "No se pudo acceder al PDF almacenado.",
        "STORAGE_READ_FAILED",
        500,
      );
    }

    const storageController = new AbortController();
    const storageTimeoutId = setTimeout(
      () => storageController.abort(),
      STORAGE_TIMEOUT_MS,
    );
    let storedPdfResponse: Response;
    try {
      storedPdfResponse = await fetch(signedUrlData.signedUrl, {
        signal: storageController.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return jsonError(
          "El almacenamiento no respondió a tiempo.",
          "STORAGE_TIMEOUT",
          504,
        );
      }
      return jsonError(
        "No se pudo descargar el PDF almacenado.",
        "STORAGE_DOWNLOAD_FAILED",
        500,
      );
    } finally {
      clearTimeout(storageTimeoutId);
    }
    if (!storedPdfResponse.ok) {
      return jsonError(
        "No se pudo descargar el PDF almacenado.",
        "STORAGE_DOWNLOAD_FAILED",
        500,
      );
    }

    let pdfArrayBuffer: ArrayBuffer;
    try {
      pdfArrayBuffer = await readResponseWithLimit(
        storedPdfResponse,
        MAX_PDF_BYTES,
      );
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return jsonError(
          "El PDF supera el tamaño máximo permitido.",
          "PAYLOAD_TOO_LARGE",
          413,
        );
      }
      return jsonError(
        "No se pudo leer el PDF almacenado.",
        "STORAGE_READ_FAILED",
        500,
      );
    }

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([pdfArrayBuffer], { type: "application/pdf" }),
      document.file_name,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FASTAPI_TIMEOUT_MS);
    let fastApiResponse: Response;
    try {
      fastApiResponse = await fetch(
        `${FASTAPI_URL.replace(/\/$/, "")}/extract-pdf-full`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${BFF_SHARED_SECRET}` },
          body: formData,
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return jsonError(
          "El servicio de extracción no respondió a tiempo.",
          "FASTAPI_TIMEOUT",
          504,
        );
      }
      return jsonError(
        "No se pudo conectar con el servicio de extracción.",
        "FASTAPI_UNAVAILABLE",
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!fastApiResponse.ok) {
      let parsedError = null;
      try {
        parsedError = parseFastApiError(await fastApiResponse.json());
      } catch {
        parsedError = null;
      }
      if (!parsedError) {
        return jsonError(
          "El backend devolvió un error incompatible.",
          "FASTAPI_INVALID_ERROR",
          502,
        );
      }
      const status = mapFastApiErrorStatus(fastApiResponse.status);
      const headers: Record<string, string> = {};
      const retryAfter = fastApiResponse.headers.get("retry-after");
      if (status === 429 && retryAfter) headers["Retry-After"] = retryAfter;
      console.error(
        `[Extract] FastAPI ${status} ${parsedError.error_code}`,
      );
      return NextResponse.json(parsedError, { status, headers });
    }

    let rawExtraction: unknown;
    try {
      rawExtraction = await fastApiResponse.json();
    } catch {
      return jsonError(
        "El backend devolvió una respuesta incompatible.",
        "FASTAPI_INVALID_RESPONSE",
        502,
      );
    }
    const extraction = parseFastApiExtraction(rawExtraction);
    if (!extraction) {
      return jsonError(
        "El backend devolvió una respuesta incompatible.",
        "FASTAPI_INVALID_RESPONSE",
        502,
      );
    }

    const extractedTextSummary = JSON.stringify({
      contract_version: extraction.contract_version,
      filename: extraction.filename,
      total_pages: extraction.total_pages,
      extraction_method: extraction.extraction_method,
      total_topics: extraction.total_topics,
      level_distribution: extraction.level_distribution,
      estimated_study_hours: extraction.estimated_study_hours,
      is_complete: extraction.is_complete,
      warnings: extraction.warnings,
      extracted_at: new Date().toISOString(),
    });
    const { error: updateError } = await adminClient
      .from("documents")
      .update({
        topics_json: extraction.topics,
        extracted_text: extractedTextSummary,
      })
      .eq("id", documentId)
      .eq("user_id", user.id);

    const warnings = updateError
      ? [
          ...extraction.warnings,
          "La extracción fue exitosa, pero no se guardaron los resultados. Intenta de nuevo.",
        ]
      : extraction.warnings;

    return NextResponse.json({
      ...extractionResponse(extraction, warnings),
      ...(updateError ? { save_error: true } : {}),
    });
  } catch (error) {
    console.error(
      `[Extract] Error no controlado: ${error instanceof Error ? error.name : "Unknown"}`,
    );
    return jsonError(
      "Error interno del servidor. Por favor intenta de nuevo.",
      "INTERNAL_ERROR",
      500,
    );
  }
}
