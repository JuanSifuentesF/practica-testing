// ============================================================
// app/(dashboard)/setup/_components/pdf-dropzone.tsx
// ============================================================
// Zona de drag & drop para seleccionar un archivo PDF.
// Soporta tanto drag & drop como click para abrir el diálogo.
//
// TIPO: Client Component — usa useState, useRef, event handlers
//
// EVENTOS CLAVE:
//   onDragEnter → resaltar la zona
//   onDragOver  → preventDefault (obligatorio para aceptar drop)
//   onDragLeave → restaurar estilo
//   onDrop      → leer archivo + validar
//   onClick     → abrir diálogo nativo del OS
// ============================================================

"use client";

import { useCallback, useRef, useState } from "react";
import {
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
  ACCEPTED_EXTENSIONS,
} from "@/lib/format";

// ─── Props del componente ───
interface PdfDropzoneProps {
  /** Callback que se ejecuta cuando el usuario selecciona un PDF válido */
  onFileSelect: (file: File) => void;
  /** Si ya hay un archivo seleccionado, ocultamos la zona de drop */
  hasFile: boolean;
  /** Si está procesando (upload en progreso), deshabilitamos la interacción */
  disabled?: boolean;
}

export function PdfDropzone({
  onFileSelect,
  hasFile,
  disabled = false,
}: PdfDropzoneProps) {
  // ─── Estado: ¿hay un archivo siendo arrastrado encima? ───
  // Controla el estilo visual de "hover" cuando el usuario
  // arrastra un archivo sobre la zona de drop.
  const [isDragOver, setIsDragOver] = useState(false);

  // ─── Estado: mensaje de error de validación ───
  const [error, setError] = useState<string | null>(null);

  // ─── Ref: input type="file" oculto ───
  // Usamos useRef para poder disparar el diálogo de selección
  // de archivos del sistema operativo programáticamente.
  // El input está hidden y lo "clickeamos" desde JavaScript.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Validar un archivo ───
  // Centralizar la validación evita duplicar lógica entre
  // el handler de drop y el handler del input file.
  const validateFile = useCallback((file: File): string | null => {
    // Verificar tipo MIME
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      return (
        "Solo se aceptan archivos PDF. El archivo seleccionado es de tipo: " +
        file.type
      );
    }

    // Verificar tamaño (máximo 20MB)
    if (file.size > MAX_FILE_SIZE) {
      return `El archivo excede el límite de 20 MB. Tamaño actual: ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    }

    return null; // null = sin errores
  }, []);

  // ─── Handler: procesar archivo (compartido entre drop y click) ───
  const handleFile = useCallback(
    (file: File) => {
      // Limpiar error anterior
      setError(null);

      // Validar
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      // Archivo válido → notificar al componente padre
      onFileSelect(file);
    },
    [onFileSelect, validateFile],
  );

  // ═══════════════════════════════════════════════════════════
  // HANDLERS DE DRAG & DROP
  // ═══════════════════════════════════════════════════════════

  // ─── onDragOver ───
  // CRÍTICO: preventDefault() es OBLIGATORIO aquí.
  // Sin él, el navegador no permite el drop y mostrará un
  // icono de "no permitido" (🚫). El navegador por defecto
  // intenta abrir el archivo directamente.
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled],
  );

  // ─── onDragEnter ───
  // Se dispara cuando el archivo ENTRA en la zona de drop.
  const handleDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled],
  );

  // ─── onDragLeave ───
  // Se dispara cuando el archivo SALE de la zona de drop.
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // ─── onDrop ───
  // Se dispara cuando el archivo se SUELTA en la zona.
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      // e.dataTransfer.files contiene los archivos soltados.
      // Es un FileList (similar a un array pero no es un array).
      const files = e.dataTransfer.files;

      if (files.length === 0) return;

      // Solo aceptamos un archivo a la vez
      if (files.length > 1) {
        setError("Solo puedes subir un archivo a la vez.");
        return;
      }

      handleFile(files[0]);
    },
    [disabled, handleFile],
  );

  // ═══════════════════════════════════════════════════════════
  // HANDLER DE CLICK (alternativa al drag & drop)
  // ═══════════════════════════════════════════════════════════

  // Al hacer clic en la zona, disparamos el input file oculto.
  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  // Cuando el usuario selecciona un archivo desde el diálogo del OS.
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Resetear el input para permitir seleccionar el mismo archivo otra vez.
      // Sin esto, si el usuario selecciona el mismo PDF, onChange no se dispara.
      e.target.value = "";
    },
    [handleFile],
  );

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  // Si ya hay un archivo seleccionado, no mostramos la zona de drop.
  // El componente padre (SetupPage) mostrará FilePreview en su lugar.
  if (hasFile) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* ─── Zona de Drop ─── */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          // Accesibilidad: Enter o Space también abre el diálogo
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        className={`
          flex flex-col items-center justify-center
          gap-4
          rounded-xl
          border-2 border-dashed
          p-12
          text-center
          transition-all duration-200
          cursor-pointer
          ${
            isDragOver
              ? "border-emerald-400 bg-emerald-400/5 scale-[1.01]"
              : "border-slate-700 bg-slate-900/30 hover:border-slate-500 hover:bg-slate-900/50"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {/* ─── Icono de upload ───
            Un SVG de "upload" (flecha hacia arriba con línea base).
            Cambia de color cuando hay drag over para dar feedback visual. */}
        <div
          className={`
            flex h-16 w-16 items-center justify-center
            rounded-full
            transition-colors duration-200
            ${
              isDragOver
                ? "bg-emerald-400/10 text-emerald-400"
                : "bg-slate-800 text-slate-400"
            }
          `}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Flecha hacia arriba */}
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        {/* ─── Texto principal ─── */}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-slate-200">
            {isDragOver
              ? "Suelta el archivo aquí"
              : "Arrastra tu PDF aquí o haz clic para seleccionar"}
          </p>
          <p className="text-xs text-slate-500">
            Solo archivos PDF — Máximo 20 MB
          </p>
        </div>
      </div>

      {/* ─── Input file oculto ───
          Este input nunca se muestra al usuario. Lo usamos como
          puente para abrir el diálogo nativo del sistema operativo.
          La prop accept=".pdf" filtra los archivos visibles en el diálogo. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileInputChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* ─── Mensaje de error ───
          Se muestra debajo de la zona de drop cuando la validación falla.
          Usa un color rojo consistente con el design system. */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-red-400 shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
