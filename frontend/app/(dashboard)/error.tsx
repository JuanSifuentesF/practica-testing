"use client";

// ============================================================
// app/(dashboard)/error.tsx — Error Boundary del Dashboard
// ============================================================
// DIRECTIVA: 'use client' es OBLIGATORIO para error.tsx.
//
// ¿POR QUÉ?
//   React Error Boundaries requieren el método componentDidCatch
//   del ciclo de vida de componentes de clase. Este método solo
//   existe en el entorno del CLIENTE (navegador). Next.js necesita
//   que error.tsx sea un Client Component para poder montar el
//   Error Boundary correctamente.
//
// PROPS AUTOMÁTICAS (Next.js las inyecta):
//   - error: El objeto Error que causó el crash
//     - error.message: Descripción del error
//     - error.digest: Hash corto generado por Next.js para tracking
//   - reset: Función que Next.js proporciona para RE-RENDERIZAR
//     el segmento de ruta que falló. Llama a esta función cuando
//     el usuario quiere "intentar de nuevo".
//
// ALCANCE:
//   Este error boundary captura errores de TODAS las páginas dentro
//   de (dashboard)/: /dashboard, /setup, /session, etc.
//   NO captura errores del layout.tsx (para eso necesitarías
//   un error.tsx en el nivel superior).
//
// LOGGING:
//   En producción, aquí podrías enviar el error a un servicio
//   de monitoreo como Sentry, DataDog o LogRocket.
// ============================================================

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // ─── Logging del error ───
  // useEffect con [error] se ejecuta cada vez que hay un nuevo error.
  // En desarrollo, esto imprime el error en la consola del navegador.
  // En producción, reemplazarías este console.error con una llamada
  // a un servicio de monitoreo (ej: Sentry.captureException(error)).
  useEffect(() => {
    console.error("Unhandled dashboard error:", error);
  }, [error]);

  return (
    // ─── UI de error centrada ───
    // min-h-[50vh] → altura mínima del 50% del viewport
    // (igual que loading.tsx para consistencia visual)
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
      {/* ─── Mensaje de error ─── */}
      <div>
        {/* Título rojo que indica error claramente */}
        <h2 className="text-2xl font-bold text-red-400 mb-2">
          ¡Ups! Algo salió mal.
        </h2>

        {/* Descripción genérica (no mostramos error.message al usuario
            porque podría contener información técnica confusa o sensible) */}
        <p className="text-muted-foreground max-w-md">
          Ha ocurrido un error inesperado al cargar esta página de la
          aplicación. Puedes intentar recargarla.
        </p>

        {/* ─── Digest (solo en desarrollo) ───
            error.digest es un hash corto que Next.js genera para
            correlacionar errores del servidor con los del cliente.
            Útil para debugging pero no para el usuario final. */}
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground">
            Referencia: {error.digest}
          </p>
        )}
      </div>

      {/* ─── Botón de reintento ───
          reset() es una función que Next.js inyecta automáticamente.
          Al llamarla, Next.js RE-RENDERIZA el segmento de ruta que
          falló, intentando ejecutar la página de nuevo.
          Es como hacer "refresh" pero solo del contenido, no de toda
          la app (el layout y el header permanecen intactos). */}
      <Button
        onClick={() => reset()}
        className="bg-muted text-foreground hover:bg-muted/80"
      >
        Intentar de nuevo
      </Button>
    </div>
  );
}
