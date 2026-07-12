// ─────────────────────────────────────────────────────────────────
// app/api/extract/route.ts
// Route Handler: descarga el PDF de Supabase Storage, lo envía a
// FastAPI /extract-pdf-full, recibe los tópicos estructurados, y los
// guarda en la tabla documents.
//
// Método: POST
// Content-Type: application/json
// Body:
//   { document_id: string }
//
// Response (200):
//   {
//     topics: { "FL-1.1.1": { level_k, name, text, chapter, section }, ... },
//     total_topics: number,
//     level_distribution: { K1: number, K2: number, K3: number },
//     estimated_study_hours: number,
//     is_complete: boolean,
//     warnings: string[]
//   }
//
// Response (401): { error: "No autenticado" }
// Response (400): { error: "Descripción del problema" }
// Response (404): { error: "Documento no encontrado" }
// Response (502): { error: "Error al comunicar con el servicio de extracción" }
// Response (500): { error: "Error interno del servidor" }
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TopicsJson } from "@/types";

// ─────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────

// ─── URL del backend FastAPI ──────────────────────────────────
// Definida en .env.local como NEXT_PUBLIC_FASTAPI_URL.
// En desarrollo: http://localhost:8000
// En producción: https://squid-app-y364m.ondigitalocean.app
const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL;

// ─── Timeout para la petición a FastAPI ───────────────────────
// El syllabus ISTQB (~135 páginas) tarda entre 3-15 segundos
// en procesarse. Damos 30 segundos como margen generoso.
const FASTAPI_TIMEOUT_MS = 30_000; // 30 segundos

// ─── Duración de la Signed URL ────────────────────────────────
// Solo necesitamos la URL para descargar el PDF una vez.
// 60 segundos es más que suficiente.
const SIGNED_URL_EXPIRY_SECONDS = 60;

// ─────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────

// ─── Tipo del JSON que FastAPI retorna ────────────────────────
// Este tipo refleja FullExtractionResponse del backend
// (backend/app/models/schemas.py). Lo definimos aquí para tener
// type-safety sin crear una dependencia directa entre proyectos.
interface TopicInfo {
  level_k: string;
  name: string;
  text: string;
  chapter: number;
  section: string;
}

interface KLevelDistribution {
  K1: number;
  K2: number;
  K3: number;
}

interface FastApiExtractionResponse {
  filename: string;
  total_pages: number;
  extraction_method: string;
  topics: Record<string, TopicInfo>;
  total_topics: number;
  level_distribution: KLevelDistribution;
  estimated_study_hours: number;
  warnings: string[];
  is_complete: boolean;
}

// ─────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ═══════════════════════════════════════════════════════════
    // FASE 1: VALIDACIÓN DE CONFIGURACIÓN
    // Verificar que la URL de FastAPI está configurada antes de
    // hacer cualquier otra cosa.
    // ═══════════════════════════════════════════════════════════

    if (!FASTAPI_URL) {
      console.error(
        "[Extract] NEXT_PUBLIC_FASTAPI_URL no está definida en .env.local",
      );
      return NextResponse.json(
        {
          error:
            "Error de configuración del servidor. Contacta al administrador.",
        },
        { status: 500 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 2: AUTENTICACIÓN
    // Verificamos que el usuario está logueado con getUser()
    // (verificación contra Supabase Auth, no solo JWT local).
    // ═══════════════════════════════════════════════════════════

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado. Por favor inicia sesión." },
        { status: 401 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 3: PARSING DEL BODY
    // Esperamos un JSON con { document_id: string }
    // ═══════════════════════════════════════════════════════════

    // ─── ¿Por qué JSON y no FormData? ─────────────────────────
    // A diferencia de /api/upload que recibe un archivo binario,
    // este endpoint solo recibe un ID. JSON es más apropiado
    // para datos estructurados sin archivos binarios.
    const body = await request.json();
    const { document_id } = body;

    if (!document_id || typeof document_id !== "string") {
      return NextResponse.json(
        { error: "document_id es requerido y debe ser un string." },
        { status: 400 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 4: OBTENER EL DOCUMENTO DE LA BASE DE DATOS
    // Verificamos que el documento existe Y pertenece al usuario
    // autenticado (ownership check).
    // ═══════════════════════════════════════════════════════════

    const adminClient = createAdminClient();

    // ─── ¿Por qué adminClient y no supabase (anon)? ────────────
    // Usamos adminClient porque necesitamos acceso a Storage con
    // service_role para generar Signed URLs de un bucket privado.
    // Pero ANTES verificamos ownership manualmente.
    const { data: document, error: docError } = await adminClient
      .from("documents")
      .select("id, user_id, file_url, file_name, topics_json")
      .eq("id", document_id)
      .single();

    if (docError || !document) {
      console.error("[Extract] Documento no encontrado:", docError);
      return NextResponse.json(
        { error: "Documento no encontrado." },
        { status: 404 },
      );
    }

    // ─── Ownership check ──────────────────────────────────────
    // Aunque las RLS policies de DB-04 protegen los datos,
    // nosotros estamos usando adminClient (que bypasea RLS).
    // Por eso DEBEMOS verificar manualmente que el usuario
    // autenticado es el dueño del documento.
    if (document.user_id !== user.id) {
      console.warn(
        `[Extract] ⚠️ Usuario ${user.id} intentó extraer documento de ${document.user_id}`,
      );
      return NextResponse.json(
        { error: "No tienes permisos para acceder a este documento." },
        { status: 403 },
      );
    }

    // ─── ¿Ya se extrajeron los tópicos? ────────────────────────
    // Si topics_json ya tiene datos, no necesitamos re-extraer.
    // Retornamos los datos existentes directamente.
    // Esto evita llamadas innecesarias a FastAPI y acelera la UX.
    if (document.topics_json && Object.keys(document.topics_json).length > 0) {
      console.log(
        `[Extract] Documento ${document_id} ya tiene tópicos. Retornando datos existentes.`,
      );
      return NextResponse.json({
        topics: document.topics_json,
        total_topics: Object.keys(document.topics_json).length,
        is_complete: true,
        already_extracted: true,
      });
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 5: DESCARGAR EL PDF DE SUPABASE STORAGE
    // Generamos una Signed URL temporal y descargamos el archivo.
    // ═══════════════════════════════════════════════════════════

    // ─── Generar Signed URL ───────────────────────────────────
    // createSignedUrl genera una URL temporal con un token de
    // acceso incluido como query parameter. Solo funciona por
    // SIGNED_URL_EXPIRY_SECONDS (60 segundos).
    const { data: signedUrlData, error: signedUrlError } =
      await adminClient.storage
        .from("pdfs")
        .createSignedUrl(document.file_url, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[Extract] Error al generar Signed URL:", signedUrlError);
      return NextResponse.json(
        { error: "Error al acceder al archivo PDF en el almacenamiento." },
        { status: 500 },
      );
    }

    // ─── Descargar el PDF ─────────────────────────────────────
    // Usamos fetch() para descargar el PDF como un Buffer.
    // Esta es una petición server-to-server (Next.js → Supabase),
    // no pasa por el browser del usuario.
    const pdfResponse = await fetch(signedUrlData.signedUrl);

    if (!pdfResponse.ok) {
      console.error(
        `[Extract] Error al descargar PDF: ${pdfResponse.status} ${pdfResponse.statusText}`,
      );
      return NextResponse.json(
        { error: "Error al descargar el archivo PDF del almacenamiento." },
        { status: 500 },
      );
    }

    // ─── Convertir a Buffer ───────────────────────────────────
    // arrayBuffer() retorna un ArrayBuffer con los bytes del PDF.
    // Lo convertimos a Buffer de Node.js para enviarlo como
    // multipart/form-data a FastAPI.
    const pdfArrayBuffer = await pdfResponse.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);

    // ═══════════════════════════════════════════════════════════
    // FASE 6: ENVIAR EL PDF A FASTAPI
    // Creamos un FormData con el PDF y lo enviamos al endpoint
    // POST /extract-pdf-full de FastAPI.
    // ═══════════════════════════════════════════════════════════

    // ─── Construir FormData para FastAPI ────────────────────────
    // FastAPI espera multipart/form-data con un campo "file"
    // de tipo UploadFile (configurado en BE-03).
    //
    // ¿Por qué usamos Blob en lugar de File?
    // En Node.js server-side, la clase File no está disponible
    // en todas las versiones. Blob + nombre en FormData.append()
    // funciona universalmente.
    const fastApiFormData = new FormData();
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    fastApiFormData.append("file", pdfBlob, document.file_name);

    // ─── AbortController para timeout ──────────────────────────
    // AbortController es la forma estándar de cancelar fetch()
    // después de un tiempo determinado. Si FastAPI no responde
    // en 30 segundos, abortamos la petición.
    //
    // ¿Por qué no usar un simple setTimeout?
    // setTimeout solo ejecuta código después del delay, pero no
    // cancela la petición HTTP en curso. AbortController sí
    // cancela la conexión TCP, liberando recursos del servidor.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FASTAPI_TIMEOUT_MS);

    let fastApiResponse: Response;

    try {
      fastApiResponse = await fetch(`${FASTAPI_URL}/extract-pdf-full`, {
        method: "POST",
        body: fastApiFormData,
        signal: controller.signal,
        // ─── No setear Content-Type manualmente ───────────────
        // Al igual que en el browser, fetch() calcula el
        // Content-Type con el boundary correcto automáticamente
        // cuando el body es FormData.
      });
    } catch (fetchError) {
      // ─── Manejar timeout y errores de red ───────────────────
      // Si AbortController abortó la petición, el error tiene
      // la propiedad name === "AbortError".
      // Otros errores (red caída, DNS, etc.) también caen aquí.
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error(
          `[Extract] ⏰ Timeout: FastAPI no respondió en ${FASTAPI_TIMEOUT_MS / 1000}s`,
        );
        return NextResponse.json(
          {
            error: `El servicio de extracción no respondió en ${FASTAPI_TIMEOUT_MS / 1000} segundos. El PDF podría ser demasiado grande. Por favor intenta de nuevo.`,
          },
          { status: 504 },
        );
      }

      console.error("[Extract] Error de red al contactar FastAPI:", fetchError);
      return NextResponse.json(
        {
          error:
            "No se pudo conectar con el servicio de extracción. Verifica que el backend está disponible.",
        },
        { status: 502 },
      );
    } finally {
      // ─── Siempre limpiar el timeout ──────────────────────────
      // Si la petición completó antes del timeout, cancelamos
      // el setTimeout para evitar un abort innecesario.
      clearTimeout(timeoutId);
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 7: PROCESAR LA RESPUESTA DE FASTAPI
    // Verificar que la respuesta es válida y tiene el formato
    // esperado (FullExtractionResponse).
    // ═══════════════════════════════════════════════════════════

    if (!fastApiResponse.ok) {
      // ─── FastAPI retornó un error ───────────────────────────
      // Intentamos parsear el error para dar un mensaje útil.
      let errorDetail = "Error desconocido en el servicio de extracción.";

      try {
        const errorBody = await fastApiResponse.json();
        // FastAPI usa { detail: string } para errores (ErrorResponse)
        errorDetail = errorBody.detail || errorBody.error || errorDetail;
      } catch {
        // Si no se puede parsear el body, usamos el status text
        errorDetail = `FastAPI respondió con error ${fastApiResponse.status}: ${fastApiResponse.statusText}`;
      }

      console.error(
        `[Extract] FastAPI error ${fastApiResponse.status}:`,
        errorDetail,
      );
      return NextResponse.json(
        { error: `Error en la extracción: ${errorDetail}` },
        { status: 502 },
      );
    }

    // ─── Parsear el JSON de respuesta ──────────────────────────
    const extractionData: FastApiExtractionResponse =
      await fastApiResponse.json();

    // ─── Validación básica del response ─────────────────────────
    // Verificamos que los campos críticos existen y tienen el
    // formato esperado. Esto nos protege contra cambios
    // inesperados en la API de FastAPI.
    if (!extractionData.topics || typeof extractionData.topics !== "object") {
      console.error(
        "[Extract] Respuesta de FastAPI sin campo 'topics' válido:",
        extractionData,
      );
      return NextResponse.json(
        {
          error:
            "La respuesta del servicio de extracción no tiene el formato esperado.",
        },
        { status: 502 },
      );
    }

    if (extractionData.total_topics === 0) {
      console.warn("[Extract] ⚠️ FastAPI no detectó ningún tópico en el PDF");
      return NextResponse.json(
        {
          error:
            "No se detectaron tópicos ISTQB en el PDF. Verifica que es el syllabus correcto (CTFL v4.0 o v4.0.1).",
        },
        { status: 400 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 8: GUARDAR RESULTADOS EN SUPABASE
    // Actualizamos el registro en documents con los tópicos
    // extraídos. Esto completa los campos que UP-02 dejó vacíos.
    // ═══════════════════════════════════════════════════════════

    // ─── Construir topics_json para la DB ──────────────────────
    // El formato de topics_json en la DB (definido en FE-02,
    // types/database.ts) es:
    //   Record<string, { text: string, level_k: LevelK, name?: string }>
    //
    // FastAPI retorna un formato ligeramente más rico (con chapter
    // y section). Guardamos TODO el JSON de FastAPI para no perder
    // información. Los campos extra simplemente se ignoran al
    // tipar como TopicsJson, pero se preservan en el JSONB.
    //
    // El cast a `as unknown as TopicsJson` es necesario porque
    // TopicInfo.level_k es `string` y TopicEntry.level_k es
    // `LevelK` (union "K1"|"K2"|"K3"). En runtime los valores
    // son válidos, pero TypeScript no puede inferirlo.
    const topicsJsonForDb = extractionData.topics as unknown as TopicsJson;

    // ─── Construir extracted_text (resumen del texto) ──────────
    // No guardamos el full_text completo (~200KB) en la DB porque:
    // 1. Ya tenemos el texto por tópico en topics_json.
    // 2. El texto completo está disponible re-extrayendo el PDF.
    // 3. Guardamos un resumen con metadatos útiles.
    const extractedTextSummary = JSON.stringify({
      filename: extractionData.filename,
      total_pages: extractionData.total_pages,
      extraction_method: extractionData.extraction_method,
      total_topics: extractionData.total_topics,
      level_distribution: extractionData.level_distribution,
      estimated_study_hours: extractionData.estimated_study_hours,
      is_complete: extractionData.is_complete,
      warnings: extractionData.warnings,
      extracted_at: new Date().toISOString(),
    });

    const { error: updateError } = await adminClient
      .from("documents")
      .update({
        topics_json: topicsJsonForDb,
        extracted_text: extractedTextSummary,
      })
      .eq("id", document_id)
      .eq("user_id", user.id); // Doble verificación de ownership

    if (updateError) {
      console.error("[Extract] Error al actualizar documents:", updateError);
      // ─── No retornamos 500 aquí ──────────────────────────────
      // La extracción fue exitosa, solo falló el guardado.
      // Retornamos los datos al frontend (que puede reintentar
      // el guardado) con un warning.
      return NextResponse.json(
        {
          topics: extractionData.topics,
          total_topics: extractionData.total_topics,
          level_distribution: extractionData.level_distribution,
          estimated_study_hours: extractionData.estimated_study_hours,
          is_complete: extractionData.is_complete,
          warnings: [
            ...extractionData.warnings,
            "⚠️ La extracción fue exitosa pero no se pudieron guardar los resultados en la base de datos. Intenta de nuevo.",
          ],
          save_error: true,
        },
        { status: 200 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 9: RESPUESTA EXITOSA
    // Retornamos los datos de extracción al frontend.
    // ═══════════════════════════════════════════════════════════

    console.log(
      `[Extract] ✅ Extracción completada para documento ${document_id}: ` +
        `${extractionData.total_topics} tópicos detectados ` +
        `(K1:${extractionData.level_distribution.K1}, ` +
        `K2:${extractionData.level_distribution.K2}, ` +
        `K3:${extractionData.level_distribution.K3})`,
    );

    return NextResponse.json({
      topics: extractionData.topics,
      total_topics: extractionData.total_topics,
      level_distribution: extractionData.level_distribution,
      estimated_study_hours: extractionData.estimated_study_hours,
      is_complete: extractionData.is_complete,
      warnings: extractionData.warnings,
    });
  } catch (error) {
    // ─── Error no controlado ──────────────────────────────────
    console.error("[Extract] Error no controlado:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Por favor intenta de nuevo." },
      { status: 500 },
    );
  }
}
