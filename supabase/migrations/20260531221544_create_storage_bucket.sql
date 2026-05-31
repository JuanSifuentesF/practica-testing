-- ============================================================
-- MIGRACIÓN: Storage Bucket para PDFs del ISTQB Study Agent
-- Guía: DB-03
-- Descripción: Crea el bucket privado "pdfs" y configura las
--              políticas de acceso (RLS) para que cada usuario
--              solo pueda leer y escribir sus propios archivos.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- BUCKET: pdfs
-- Propósito: Almacén privado de archivos PDF subidos por los
--            usuarios. Cada usuario tiene su propia carpeta
--            aislada: pdfs/{user_id}/{timestamp}_{filename}.pdf
--
-- Configuración:
--   - Privado (public = false): requiere autenticación.
--   - Tamaño máximo por archivo: 20 MB (20971520 bytes).
--   - Tipos MIME permitidos: solo application/pdf.
-- ──────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdfs',                          -- ID único del bucket (igual al nombre)
  'pdfs',                          -- Nombre visible del bucket
  FALSE,                           -- Privado: no se puede acceder sin autenticación
  20971520,                        -- 20 MB en bytes (20 * 1024 * 1024)
  ARRAY['application/pdf']         -- Solo se permiten archivos PDF
)
ON CONFLICT (id) DO NOTHING;
-- ON CONFLICT: si el bucket ya existe (lo creamos manualmente en Paso A),
-- esta sentencia no falla. Esto hace la migración idempotente.

-- ══════════════════════════════════════════════════════════════
-- POLÍTICAS DE ACCESO PARA EL BUCKET "pdfs"
-- ══════════════════════════════════════════════════════════════
--
-- Supabase Storage usa la tabla storage.objects para almacenar
-- los metadatos de cada archivo. Las políticas se aplican sobre
-- esta tabla, filtrando por bucket_id y por la ruta del archivo.
--
-- PATRÓN DE RUTA: pdfs/{user_id}/{timestamp}_{filename}.pdf
--
-- La función (storage.foldername(name))[1] extrae el primer
-- segmento de la ruta del archivo (la carpeta del usuario).
-- La comparamos con auth.uid()::TEXT para verificar ownership.
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- POLÍTICA 1: SELECT (Lectura/Descarga)
-- Permite a un usuario autenticado DESCARGAR únicamente los
-- archivos que están dentro de su propia carpeta.
--
-- Ejemplo: el usuario con UUID "abc-123" solo puede leer
-- archivos en la ruta pdfs/abc-123/...
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "Users can read own PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ──────────────────────────────────────────────────────────────
-- POLÍTICA 2: INSERT (Subida/Upload)
-- Permite a un usuario autenticado SUBIR archivos únicamente
-- dentro de su propia carpeta.
--
-- Esto evita que un usuario suba archivos a la carpeta de otro
-- (ej. sobreescribir el PDF de otro usuario).
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "Users can upload own PDFs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ──────────────────────────────────────────────────────────────
-- POLÍTICA 3: UPDATE (Actualización de metadatos)
-- Permite a un usuario autenticado ACTUALIZAR los metadatos de
-- sus propios archivos (ej. renombrar).
--
-- En la práctica, raramente se actualiza un objeto en Storage;
-- es más común eliminar y volver a subir. Pero esta política
-- cubre el caso por completitud y seguridad.
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "Users can update own PDFs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ──────────────────────────────────────────────────────────────
-- POLÍTICA 4: DELETE (Eliminación)
-- Permite a un usuario autenticado ELIMINAR únicamente sus
-- propios archivos.
--
-- Caso de uso: el usuario quiere reemplazar un PDF incorrecto.
-- Primero elimina el anterior, luego sube el nuevo.
-- ──────────────────────────────────────────────────────────────
CREATE POLICY "Users can delete own PDFs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );