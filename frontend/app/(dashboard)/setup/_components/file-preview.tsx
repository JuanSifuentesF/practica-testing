// ============================================================
// app/(dashboard)/setup/_components/file-preview.tsx
// ============================================================
// Componente que muestra el preview del archivo PDF seleccionado.
// Incluye: icono, nombre, tamaño formateado y botón para eliminar.
//
// TIPO: Client Component — necesita onClick para el botón ×
// ============================================================

"use client";

import { formatFileSize } from "@/lib/format";

// ─── Props del componente ───
// Definimos una interfaz explícita para las props.
// Esto es TypeScript puro y ayuda con el autocompletado.
interface FilePreviewProps {
  /** El objeto File del PDF seleccionado */
  file: File;
  /** Callback que se ejecuta al hacer clic en el botón × */
  onRemove: () => void;
  /** Si está en true, deshabilita el botón de eliminar (durante upload) */
  disabled?: boolean;
}

export function FilePreview({
  file,
  onRemove,
  disabled = false,
}: FilePreviewProps) {
  return (
    // ─── Contenedor principal ───
    // Diseñado como una "tarjeta" compacta con el preview del archivo.
    // El padding, borde y fondo coinciden con el design system de FE-04.
    <div
      className="
        flex items-center justify-between
        rounded-lg
        border border-slate-700
        bg-slate-800/50
        p-4
      "
    >
      {/* ─── Lado izquierdo: Icono + Info ─── */}
      <div className="flex items-center gap-3">
        {/* ─── Icono de PDF ───
            Un cuadrado redondeado con fondo rojo sutil que contiene
            el texto "PDF". Esto da feedback visual inmediato de que
            el archivo es un PDF válido. */}
        <div
          className="
            flex h-10 w-10 items-center justify-center
            rounded-lg
            bg-red-500/10
            text-red-400
            text-xs font-bold
          "
        >
          PDF
        </div>

        {/* ─── Nombre y tamaño del archivo ─── */}
        <div className="flex flex-col">
          {/* Nombre del archivo — truncamos si es muy largo para evitar
              que rompa el layout. max-w-[200px] en mobile, más ancho en desktop. */}
          <span className="text-sm font-medium text-slate-200 truncate max-w-[200px] sm:max-w-[300px]">
            {file.name}
          </span>
          {/* Tamaño formateado — usando nuestra utilidad de lib/format.ts */}
          <span className="text-xs text-slate-500">
            {formatFileSize(file.size)}
          </span>
        </div>
      </div>

      {/* ─── Lado derecho: Botón eliminar ─── */}
      {/* Un botón pequeño con × que permite al usuario deseleccionar
          el archivo y elegir otro. Se deshabilita durante el upload. */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="
          flex h-8 w-8 items-center justify-center
          rounded-md
          text-slate-400
          transition-colors
          hover:bg-slate-700 hover:text-slate-200
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        aria-label="Eliminar archivo seleccionado"
      >
        {/* Icono × usando un SVG inline simple.
            No necesitamos lucide-react para un simple ×. */}
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
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
