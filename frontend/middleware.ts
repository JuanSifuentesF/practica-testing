// ============================================================
// middleware.ts — Guardián de rutas del ISTQB Study Agent
// ============================================================
// Este archivo se ejecuta en el Edge Runtime de Next.js ANTES
// de que cualquier petición alcance una página o API Route.
//
// Responsabilidades:
//   1. Refrescar tokens JWT expirados automáticamente
//   2. Proteger rutas privadas (/dashboard, /setup, /session)
//   3. Redirigir usuarios autenticados lejos de /login y /register
//   4. Sincronizar cookies entre la petición y la respuesta
//
// UBICACIÓN CRÍTICA:
//   Este archivo DEBE estar en la RAÍZ de frontend/
//   (al mismo nivel que package.json y next.config.ts).
//   Si lo pones dentro de app/, Next.js NO lo detectará.
//
// EDGE RUNTIME:
//   El middleware se ejecuta en el Edge Runtime (no Node.js).
//   Esto significa que no puedes usar fs, child_process, etc.
//   Pero sí puedes usar fetch, Response, Request, cookies.
// ============================================================

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // ─── PASO 1: Crear la respuesta base ───
  // Inicializamos una respuesta "next()" que continúa con la petición.
  // Si Supabase necesita actualizar tokens, esta respuesta se
  // reemplazará con una nueva que incluya las cookies actualizadas.
  let supabaseResponse = NextResponse.next({
    request: {
      // Pasamos los headers originales para que las páginas downstream
      // puedan acceder a ellos (idioma, user-agent, etc.)
      headers: request.headers,
    },
  });

  // ─── PASO 2: Crear el cliente de Supabase para el middleware ───
  // Este cliente es especial: lee cookies de la petición entrante
  // y puede escribir cookies en la respuesta saliente.
  // Es el "puente" entre el navegador y Supabase Auth.
  const supabase = createServerClient(
    // Variables de entorno que el Edge Runtime puede acceder.
    // El ! (non-null assertion) le dice a TypeScript que sabemos
    // que estas variables existen en .env.local.
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // ─── Leer cookies ───
        // Supabase necesita leer las cookies de sesión de la
        // petición entrante para saber si el usuario tiene
        // un token válido o si necesita refrescarlo.
        getAll() {
          return request.cookies.getAll();
        },

        // ─── Escribir cookies ───
        // Cuando Supabase refresca un token expirado, necesita
        // actualizar las cookies tanto en la petición (para que
        // las páginas downstream vean el token nuevo) como en
        // la respuesta (para que el navegador guarde el token nuevo).
        setAll(cookiesToSet) {
          // Primero: actualizar las cookies en la petición entrante.
          // Esto es necesario para que los Server Components que se
          // ejecutan DESPUÉS del middleware vean los tokens frescos.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          // Segundo: crear una nueva respuesta con la petición actualizada.
          // Esto "conecta" las cookies de la petición con las de la respuesta.
          supabaseResponse = NextResponse.next({
            request,
          });

          // Tercero: establecer las cookies en la respuesta saliente.
          // Esto asegura que el NAVEGADOR del usuario reciba los
          // tokens actualizados y los almacene para futuras peticiones.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // ─── PASO 3: Verificar la identidad del usuario ───
  // CRÍTICO: Usamos getUser() y NO getSession().
  //
  // getUser() hace una llamada real al servidor de Supabase Auth
  // para verificar que el token JWT es válido y no ha sido revocado.
  //
  // getSession() solo lee el JWT de la cookie local sin verificar
  // su firma con el servidor. Un atacante podría modificar el JWT
  // en la cookie y getSession() lo aceptaría como válido.
  //
  // En el middleware, donde tomamos decisiones de seguridad
  // (permitir o denegar acceso), SIEMPRE usamos getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ─── PASO 4: Clasificar la ruta solicitada ───
  // Determinamos si la ruta actual es una ruta de autenticación
  // (login, register) o una ruta protegida (dashboard, etc.)
  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register");

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/setup") ||
    request.nextUrl.pathname.startsWith("/session");

  // ─── PASO 5: Aplicar reglas de acceso ───

  // REGLA 1: Si NO hay usuario y la ruta es protegida → redirigir a /login
  // Ejemplo: Un visitante anónimo intenta ir a /dashboard
  // El middleware lo "rebota" instantáneamente al formulario de login.
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // REGLA 2: Si HAY usuario y la ruta es de auth → redirigir a /dashboard
  // Ejemplo: Un usuario ya logueado intenta ir a /login
  // No tiene sentido mostrar el formulario de login si ya tiene sesión.
  // Lo redirigimos directamente al dashboard.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ─── PASO 6: Si ninguna regla aplica, dejar pasar ───
  // Retornamos la respuesta que puede contener cookies actualizadas
  // por el refresh automático de Supabase.
  return supabaseResponse;
}

// ============================================================
// CONFIGURACIÓN DEL MATCHER — ¿En qué rutas corre el middleware?
// ============================================================
// El matcher es un patrón regex que le dice a Next.js en qué
// rutas debe ejecutar este middleware.
//
// SIN matcher: el middleware correría en TODAS las peticiones,
// incluyendo archivos CSS, imágenes, fuentes — desperdicio.
//
// CON matcher: solo corre en rutas que necesitan protección.
// ============================================================
export const config = {
  matcher: [
    // ─── Explicación del regex ───
    // '/(                    → Empieza desde la raíz
    //   (?!                  → Lookahead negativo: excluir si empieza con...
    //     _next/static|      → Archivos estáticos de Next.js (CSS, JS bundles)
    //     _next/image|       → Optimizador de imágenes de Next.js
    //     favicon.ico|       → Ícono del sitio
    //     .*\\.(?:svg|png|   → Cualquier archivo con extensión de imagen:
    //       jpg|jpeg|gif|    →   SVG, PNG, JPG, JPEG, GIF, WebP
    //       webp)$|          → (el $ ancla al final del string)
    //     auth/callback      → La ruta de callback de Supabase Auth
    //                        → (debe estar EXCLUIDA porque es un API Route
    //                        →  que maneja el intercambio de código→sesión
    //                        →  y no necesita verificación de sesión)
    //   )                    → Fin del lookahead negativo
    //   .*                   → Cualquier otra ruta: INCLUIR
    // )'
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|auth/callback).*)",
  ],
};
