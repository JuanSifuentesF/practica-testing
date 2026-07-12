// ============================================================
// app/(dashboard)/layout.tsx — Dashboard Layout (Shell Principal)
// ============================================================
// TIPO: Server Component (NO tiene 'use client')
//
// RESPONSABILIDADES:
//   1. Obtener la sesión del usuario autenticado
//   2. Consultar el perfil (full_name) desde user_profiles
//   3. Renderizar el header con navegación y menú de usuario
//   4. Renderizar el área de contenido (children)
//   5. Redirigir a /login si la sesión es inválida
//
// ¿POR QUÉ SERVER COMPONENT?
//   - Necesita acceder a cookies del servidor (createClient de server.ts)
//   - Necesita hacer queries a Supabase (await supabase.from(...))
//   - NO necesita interactividad (los componentes hijos se encargan)
//   - 0 KB de JavaScript enviado al navegador por este archivo
//
// PERSISTENCIA:
//   Next.js App Router MANTIENE este layout montado cuando el usuario
//   navega entre /dashboard, /setup, /session, etc.
//   Solo el contenido de {children} cambia. Esto significa que:
//   - El header nunca "parpadea" al cambiar de página
//   - Los Dropdown menus abiertos no se cierran inesperadamente
//   - El rendimiento es mejor porque hay menos DOM que re-renderizar
//
// PROTECCIÓN REDUNDANTE:
//   El middleware (FE-03) ya protege estas rutas. La verificación
//   de sesión aquí es una capa de seguridad adicional (defense in depth).
//   Si por alguna razón el middleware falla, este layout redirige.
// ============================================================

import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Importar los Client Components que renderizará este layout.
// Un Server Component PUEDE importar Client Components y renderizarlos.
// Los datos se pasan de Server → Client vía props.
import { UserMenu } from "./_components/user-menu";
import { MainNav } from "./_components/main-nav";
import { MobileNav } from "./_components/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // ═══════════════════════════════════════════════════════════
  // PASO 1: Instanciar el cliente de Supabase para el servidor
  // ═══════════════════════════════════════════════════════════
  // createClient() es async porque necesita leer las cookies
  // de next/headers. Retorna un cliente tipado con Database.
  const supabase = await createClient();

  // ═══════════════════════════════════════════════════════════
  // PASO 2: Obtener el usuario autenticado
  // ═══════════════════════════════════════════════════════════
  // getUser() valida el JWT contra el servidor de Supabase.
  // Es más seguro que getSession() porque getSession() solo
  // lee el JWT localmente sin verificar si fue revocado.
  //
  // Esta verificación es REDUNDANTE con el middleware, pero
  // implementa el principio de "defense in depth" (defensa
  // en profundidad): si el middleware falla por alguna razón,
  // este layout también protege las páginas hijas.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Si no hay sesión válida, redirigir al login.
  // redirect() de next/navigation lanza una excepción especial
  // que Next.js captura para hacer la redirección del servidor.
  // NO USES router.push() aquí — eso es para Client Components.
  if (error || !user) {
    redirect("/login");
  }

  // ═══════════════════════════════════════════════════════════
  // PASO 3: Obtener el perfil del usuario (nombre completo)
  // ═══════════════════════════════════════════════════════════
  // La tabla user_profiles fue creada en DB-02 y se llena
  // automáticamente con el trigger de DB-05 al registrarse.
  //
  // NOTA: Usamos .maybeSingle() en lugar de .single() para
  // manejar el caso donde el perfil aún no existe (por ejemplo,
  // si el trigger de DB-05 falló o si es un usuario creado
  // directamente en el panel de Supabase sin pasar por el trigger).
  // .maybeSingle() retorna null en lugar de lanzar un error
  // cuando no hay resultados.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null }>();

  // ─── Calcular valores de display ───
  // Prioridad del nombre mostrado:
  // 1. full_name de user_profiles (lo ideal, viene del registro)
  // 2. Parte local del email (antes del @) como fallback
  // 3. "Usuario" como último recurso
  const displayName =
    profile?.full_name || user.email?.split("@")[0] || "Usuario";

  // Email para mostrar en el menú de usuario.
  // Siempre debería existir, pero TypeScript requiere el fallback.
  const email = user.email || "";

  // ═══════════════════════════════════════════════════════════
  // PASO 4: Renderizar el Shell visual
  // ═══════════════════════════════════════════════════════════
  return (
    // ─── Contenedor raíz del dashboard ───
    // flex min-h-screen → el contenedor ocupa al menos 100vh
    // flex-col → los hijos (header y main) se apilan verticalmente
    // bg-slate-950 → fondo oscuro casi negro (#020617)
    // text-slate-50 → texto claro por defecto (#f8fafc)
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      {/* ════════════════════════════════════════════════════ */}
      {/* HEADER SUPERIOR — Persistente en todas las páginas   */}
      {/* ════════════════════════════════════════════════════ */}
      <header
        className="
          sticky top-0           
          z-40                   
          w-full                 
          border-b border-slate-800
          bg-slate-950/80        
          backdrop-blur          
          supports-[backdrop-filter]:bg-slate-950/60
        "
      >
        {/* sticky top-0 → el header se "pega" al tope al hacer scroll.
            No desaparece cuando el usuario scrollea hacia abajo.

            z-40 → z-index: 40. Asegura que el header se renderice
            POR ENCIMA del contenido de la página al hacer scroll.
            Los modales y sheets usan z-50 para estar encima del header.

            w-full → ocupa el 100% del ancho del viewport.

            border-b border-slate-800 → línea gris sutil en el borde inferior
            que separa visualmente el header del contenido.

            bg-slate-950/80 → fondo oscuro con 80% de opacidad.
            El 20% de transparencia permite ver una silueta del contenido
            detrás del header al hacer scroll.

            backdrop-blur → aplica un efecto blur (desenfoque) al contenido
            que está DETRÁS del header. Combinado con la transparencia,
            crea el efecto "glass" (vidrio esmerilado) moderno.

            supports-[backdrop-filter]:bg-slate-950/60 → esta es una
            PROGRESSIVE ENHANCEMENT. Si el navegador soporta backdrop-filter
            (la mayoría modernos lo hacen), reduce la opacidad a 60% para
            que el efecto blur sea más visible. Si no lo soporta, mantiene
            el 80% de opacidad que sigue viéndose bien. */}

        {/* ─── Contenedor interior con ancho máximo ─── */}
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* container → ancho máximo responsivo (por defecto max-width por breakpoint)
              mx-auto → centra el container horizontalmente
              flex → los hijos se disponen en fila horizontal
              h-16 → altura fija de 64px para el header (estándar de diseño)
              items-center → centra verticalmente los elementos
              justify-between → distribuye el espacio: logo+nav a la izquierda, avatar a la derecha
              px-4 → padding horizontal de 16px en cada lado */}

          {/* ─── LADO IZQUIERDO: Logo + Navegación ─── */}
          <div className="flex items-center gap-6 md:gap-10">
            {/* gap-6 → espacio de 24px entre logo y nav en mobile
                md:gap-10 → espacio de 40px en desktop (más holgado) */}

            {/* ─── Hamburguesa (solo mobile) ─── */}
            <MobileNav />

            {/* ─── Logotipo ─── */}
            <Link href="/dashboard" className="flex items-center space-x-2">
              <span className="inline-block font-bold text-xl tracking-tight">
                ISTQB <span className="text-emerald-400">Agent</span>
              </span>
              {/* tracking-tight → reduce el espacio entre letras (letter-spacing)
                  para que el logotipo se vea más compacto y profesional.
                  text-emerald-400 → el verde esmeralda es el color acento
                  de nuestra marca, consistente con el login y la landing. */}
            </Link>

            {/* ─── Navegación Desktop ─── */}
            <MainNav />
          </div>

          {/* ─── LADO DERECHO: Menú de Usuario ─── */}
          {/* Le pasamos las props calculadas en el servidor.
              El UserMenu es un Client Component que recibe estos datos
              como props estáticas — no necesita hacer queries propias. */}
          <UserMenu email={email} name={displayName} />
        </div>
      </header>

      {/* ════════════════════════════════════════════════════ */}
      {/* CONTENIDO PRINCIPAL — Cambia según la página         */}
      {/* ════════════════════════════════════════════════════ */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* flex-1 → el main ocupa todo el espacio vertical restante
            después del header. Esto empuja el contenido a llenar
            la pantalla completa incluso cuando hay poco contenido.

            container mx-auto → ancho máximo centrado (responsive)
            px-4 → padding horizontal de 16px
            py-8 → padding vertical de 32px

            {children} es donde Next.js inyecta la página actual.
            Al navegar entre /dashboard, /setup, /session, etc.,
            solo este {children} cambia. El header y su contenido
            permanecen intactos (no se re-renderizan). */}
        {children}
      </main>
    </div>
  );
}
