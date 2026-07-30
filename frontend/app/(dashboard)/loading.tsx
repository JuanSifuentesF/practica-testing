// ============================================================
// app/(dashboard)/loading.tsx — Estado de Carga Automático
// ============================================================
// TIPO: Server Component (por defecto, no necesita 'use client')
//
// ¿CÓMO FUNCIONA?
//   Next.js App Router envuelve automáticamente cada página
//   hija en un <Suspense> boundary. Este archivo es el fallback:
//
//   <Suspense fallback={<DashboardLoading />}>
//     <DashboardPage />  ← o SetupPage, SessionPage, etc.
//   </Suspense>
//
// ¿CUÁNDO SE MUESTRA?
//   1. Durante la navegación entre páginas (client-side navigation)
//   2. Mientras un Server Component está haciendo await (data fetching)
//   3. Durante la primera carga de una página que tiene operaciones async
//
// ¿POR QUÉ ES IMPORTANTE?
//   Sin loading.tsx, la pantalla se quedaría en blanco o "congelada"
//   mientras los datos cargan. Con loading.tsx, el usuario ve feedback
//   inmediato ("algo está pasando") que mejora drásticamente la
//   percepción de velocidad (UX).
//
// NOTA: El layout (header, navegación) PERSISTE mientras este
// loading se muestra. Solo el área de contenido (main) muestra
// el spinner. El usuario puede seguir interactuando con el header.
// ============================================================

export default function DashboardLoading() {
  return (
    // ─── Contenedor centrado ───
    // min-h-[50vh] → altura mínima del 50% del viewport
    // Esto centra el spinner visualmente en el área de contenido,
    // no en toda la pantalla (porque el header sigue visible arriba).
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* ─── Spinner CSS puro (sin JavaScript) ───
            h-8 w-8 → 32x32px (tamaño visible pero no invasivo)
            animate-spin → animación de rotación infinita de Tailwind
            rounded-full → hace el div circular
            border-4 → borde de 4px de grosor
            border-emerald-500 → color del borde: verde esmeralda
            border-t-transparent → el borde superior es transparente
            Resultado: un círculo que rota con un "hueco" arriba,
            creando el efecto clásico de spinner de carga. */}
        <div
          className="
            h-8 w-8
            animate-spin
            rounded-full
            border-4
            border-emerald-500
            border-t-transparent
          "
        />

        {/* ─── Texto descriptivo ───
            Mensaje sutil que informa al usuario qué está pasando.
            text-sm → fuente pequeña para no competir con el spinner.
            text-slate-400 → gris claro, discreto. */}
        <p className="text-sm text-muted-foreground">Cargando aplicación...</p>
      </div>
    </div>
  );
}
