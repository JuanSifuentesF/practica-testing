// ============================================================
// lib/format.ts — Utilidades de formato
// ============================================================
// Funciones puras para formatear datos para display.
// No dependen de React, ni de hooks, ni del DOM.
// Se pueden usar en Server Components y Client Components.
// ============================================================

/**
 * Convierte un tamaño en bytes a un formato legible por humanos.
 *
 * @param bytes - El tamaño del archivo en bytes
 * @returns String formateado (e.g., "2.3 MB", "456 KB")
 *
 * @example
 * ```ts
 * formatFileSize(0);          // "0 B"
 * formatFileSize(1024);       // "1 KB"
 * formatFileSize(2456789);    // "2.3 MB"
 * formatFileSize(1073741824); // "1 GB"
 * ```
 */
export function formatFileSize(bytes: number): string {
  // Caso especial: 0 bytes
  if (bytes === 0) return "0 B";

  // Factor de conversión: 1 KB = 1024 bytes
  const k = 1024;

  // Unidades ordenadas de menor a mayor
  const sizes = ["B", "KB", "MB", "GB"];

  // Calcular en qué unidad cae el valor:
  // Math.log(bytes) / Math.log(k) nos da el exponente en base 1024.
  // Math.floor() redondea hacia abajo para obtener el índice.
  // Math.min() asegura que no excedamos el array de unidades.
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );

  // Dividir entre k^i para obtener el valor en la unidad correcta.
  // toFixed(1) muestra un decimal (e.g., "2.3").
  // parseFloat() elimina ceros innecesarios (e.g., "1.0" → "1").
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Límite máximo de tamaño de archivo en bytes (20 MB).
 * Usado para validación en PdfDropzone y en la API Route de upload.
 */
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB en bytes

/**
 * Tipos MIME aceptados para upload de PDFs.
 */
export const ACCEPTED_FILE_TYPES = ["application/pdf"];

/**
 * Extensiones de archivo aceptadas (para el atributo `accept` del input).
 */
export const ACCEPTED_EXTENSIONS = ".pdf";
