// ─────────────────────────────────────────────────────────────────
// app/api/upload/route.ts
// Route Handler: recibe un PDF del usuario, lo sube a Supabase
// Storage, crea un registro en la tabla `documents`, y retorna
// el document_id al frontend.
//
// Método: POST
// Content-Type: multipart/form-data
// Body:
//   - file: File (PDF, máx 20MB)
//   - objective_days: string (número de días, "1"-"30")
//   - morning_time: string (ej: "6:00 AM")
//   - night_time: string (ej: "10:00 PM")
//
// Response (200):
//   { document_id: string, file_name: string }
//
// Response (401): { error: "No autenticado" }
// Response (400): { error: "Descripción del problema" }
// Response (500): { error: "Error interno del servidor" }
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from "@/lib/format";
import type { DocumentInsert } from "@/types";

// ─────────────────────────────────────────────────────────────────
// ¿Por qué exportamos una función llamada POST?
//
// Next.js App Router usa la convención de funciones nombradas
// para mapear métodos HTTP. Si alguien hace un GET a /api/upload,
// Next.js retornará 405 Method Not Allowed automáticamente.
//
// Métodos soportados: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
// ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ═══════════════════════════════════════════════════════════
    // FASE 1: AUTENTICACIÓN
    // Verificar que el usuario está logueado ANTES de cualquier
    // otra operación. Esto es defensa en profundidad: aunque el
    // middleware ya refresca las cookies, aquí comprobamos que
    // existe un usuario válido.
    // ═══════════════════════════════════════════════════════════

    const supabase = await createClient();

    // ─── ¿Por qué getUser() y no getSession()? ─────────────
    // getSession() lee el JWT del cookie sin verificarlo contra
    // Supabase Auth. Un JWT expirado o manipulado pasaría.
    // getUser() hace una llamada al servidor de auth de Supabase
    // para confirmar que el token es válido y el usuario existe.
    // Es más lento, pero más seguro. Para operaciones sensibles
    // como subir archivos, SIEMPRE usa getUser().
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
    // FASE 2: PARSING DEL FORMDATA
    // El frontend envía multipart/form-data con el archivo PDF
    // y los campos de configuración del plan de estudio.
    // ═══════════════════════════════════════════════════════════

    // ─── ¿Qué es FormData? ──────────────────────────────────
    // FormData es la forma estándar de enviar archivos por HTTP.
    // A diferencia de JSON (que solo puede contener texto/números),
    // FormData puede contener archivos binarios como PDFs.
    //
    // El browser serializa el FormData como multipart/form-data,
    // y request.formData() lo deserializa de vuelta en el servidor.
    const formData = await request.formData();

    // ─── Extraer campos ─────────────────────────────────────
    // formData.get() retorna FormDataEntryValue | null
    // Para archivos: retorna un objeto File
    // Para strings: retorna un string
    const file = formData.get("file") as File | null;
    const objectiveDays = formData.get("objective_days") as string | null;
    const morningTime = formData.get("morning_time") as string | null;
    const nightTime = formData.get("night_time") as string | null;

    // ═══════════════════════════════════════════════════════════
    // FASE 3: VALIDACIÓN
    // NUNCA confíes en la validación del frontend. Un atacante
    // puede enviar requests directamente con curl o Postman,
    // saltándose toda la validación de la UI.
    // ═══════════════════════════════════════════════════════════

    // ─── 3a. ¿Existe el archivo? ────────────────────────────
    if (!file) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo. Selecciona un PDF." },
        { status: 400 },
      );
    }

    // ─── 3b. ¿Es un PDF? ───────────────────────────────────
    // Reutilizamos la constante ACCEPTED_FILE_TYPES de lib/format.ts
    // para mantener consistencia entre la validación del frontend
    // (PdfDropzone) y la del backend (este Route Handler).
    const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
    if (!ACCEPTED_FILE_TYPES.includes(file.type) && !hasPdfExtension) {
      return NextResponse.json(
        {
          error: `Tipo de archivo no válido: "${file.type}". Solo se aceptan archivos PDF.`,
        },
        { status: 400 },
      );
    }

    // ─── 3c. ¿Tamaño dentro del límite? ─────────────────────
    // file.size está en bytes. MAX_FILE_SIZE = 20 * 1024 * 1024 (20MB)
    if (file.size > MAX_FILE_SIZE) {
      const maxMB = MAX_FILE_SIZE / (1024 * 1024);
      const fileMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          error: `El archivo pesa ${fileMB}MB. El máximo permitido es ${maxMB}MB.`,
        },
        { status: 400 },
      );
    }

    // ─── 3d. ¿Tiene nombre? ─────────────────────────────────
    if (!file.name || file.name.trim() === "") {
      return NextResponse.json(
        { error: "El archivo no tiene nombre válido." },
        { status: 400 },
      );
    }

    // ─── 3e. Validar campos de configuración ────────────────
    if (!objectiveDays || !morningTime || !nightTime) {
      return NextResponse.json(
        {
          error:
            "Faltan campos de configuración: objective_days, morning_time y night_time son obligatorios.",
        },
        { status: 400 },
      );
    }

    const days = parseInt(objectiveDays, 10);
    if (isNaN(days) || days < 1 || days > 30) {
      return NextResponse.json(
        { error: "objective_days debe ser un número entre 1 y 30." },
        { status: 400 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 4: SUBIR ARCHIVO A SUPABASE STORAGE
    // Usamos el admin client porque el bucket es privado y las
    // políticas de Storage requieren service_role para upload
    // desde el servidor.
    // ═══════════════════════════════════════════════════════════

    const adminClient = createAdminClient();

    // ─── Generar ruta única en el bucket ─────────────────────
    // Patrón: pdfs/{user_id}/{timestamp}_{filename}
    //
    // ¿Por qué incluir el user_id en la ruta?
    // → Organización: cada usuario tiene su propia "carpeta"
    // → Las RLS policies de Storage verifican que el path
    //   empiece con el user_id del usuario autenticado
    //
    // ¿Por qué incluir un timestamp?
    // → Para evitar colisiones si el usuario sube el mismo
    //   archivo dos veces. Supabase Storage sobreescribe si
    //   la ruta ya existe (a menos que uses upsert: false).
    //
    // sanitizeFileName remueve caracteres problemáticos del
    // nombre del archivo para evitar errores en la URL.
    const timestamp = Date.now();
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_") // Reemplazar caracteres especiales
      .replace(/_{2,}/g, "_"); // Evitar múltiples guiones bajos seguidos

    const storagePath = `${user.id}/${timestamp}_${sanitizedName}`;

    // ─── Convertir File a Buffer ─────────────────────────────
    // Supabase Storage acepta Buffer, Blob, File, o ArrayBuffer.
    // Convertimos a Buffer para máxima compatibilidad con el
    // runtime de Node.js en el servidor de Next.js.
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // ─── Subir al bucket ─────────────────────────────────────
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("pdfs") // Nombre del bucket (creado en DB-03)
      .upload(storagePath, fileBuffer, {
        contentType: file.type, // "application/pdf"
        // ── upsert: false ────────────────────────────────────
        // Si la ruta ya existe, lanza error en lugar de
        // sobreescribir silenciosamente. Con el timestamp en el
        // nombre, esto nunca debería pasar — pero es una red
        // de seguridad contra bugs.
        upsert: false,
      });

    if (uploadError) {
      console.error("[Upload] Error al subir a Storage:", uploadError);
      return NextResponse.json(
        {
          error:
            "Error al subir el archivo al almacenamiento. Por favor intenta de nuevo.",
        },
        { status: 500 },
      );
    }

    // ─── uploadData.path ─────────────────────────────────────
    // Supabase retorna la ruta relativa dentro del bucket:
    // "abc123/1719518400000_syllabus_istqb.pdf"
    //
    // Esta es la ruta que guardaremos en la tabla documents.
    // NO es una URL pública — el bucket es privado. Cuando
    // necesitemos acceder al archivo, generaremos una
    // "signed URL" temporal (se hará en UP-03).

    // ═══════════════════════════════════════════════════════════
    // FASE 5: INSERTAR REGISTRO EN LA TABLA documents
    // Guardamos los metadatos del archivo en la base de datos
    // para que el resto del flujo pueda encontrarlo.
    // ═══════════════════════════════════════════════════════════

    // ─── Construir el objeto de inserción ─────────────────────
    // Usamos el tipo DocumentInsert de types/database.ts para
    // tener autocompletado y validación de TypeScript.
    const documentRecord: DocumentInsert = {
      user_id: user.id,
      file_name: file.name, // Nombre original (para mostrar en la UI)
      file_url: uploadData.path, // Ruta en Storage (relativa al bucket)
      // extracted_text y topics_json se llenarán en UP-03
      // cuando FastAPI procese el PDF.
    };

    const { data: insertData, error: insertError } = await adminClient
      .from("documents")
      .insert(documentRecord)
      .select("id") // Solo necesitamos el ID generado por PostgreSQL
      .single(); // Esperamos exactamente 1 registro

    if (insertError) {
      console.error("[Upload] Error al insertar en documents:", insertError);

      // ─── Limpieza: eliminar el archivo huérfano ────────────
      // Si la inserción en la DB falla, el archivo ya está en
      // Storage pero sin registro. Intentamos eliminarlo para
      // no dejar archivos huérfanos. Si esta limpieza también
      // falla, no es crítico — solo quedaría un archivo sin
      // referencia en la DB.
      await adminClient.storage.from("pdfs").remove([storagePath]);

      return NextResponse.json(
        {
          error:
            "Error al registrar el documento. El archivo fue eliminado. Intenta de nuevo.",
        },
        { status: 500 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 6: RESPUESTA EXITOSA
    // Retornamos el document_id para que el frontend pueda
    // usarlo en el siguiente paso (UP-03: extracción de tópicos).
    // ═══════════════════════════════════════════════════════════

    console.log(
      `[Upload] ✅ Documento creado: ${insertData.id} para usuario: ${user.id}`,
    );

    return NextResponse.json(
      {
        document_id: insertData.id,
        file_name: file.name,
      },
      { status: 200 },
    );
  } catch (error) {
    // ─── Error no controlado ──────────────────────────────────
    // Cualquier excepción no capturada llega aquí. Logueamos
    // el error completo en el servidor (para debugging) pero
    // retornamos un mensaje genérico al cliente (para seguridad).
    console.error("[Upload] Error no controlado:", error);

    return NextResponse.json(
      { error: "Error interno del servidor. Por favor intenta de nuevo." },
      { status: 500 },
    );
  }
}
