// ============================================================
// app/auth/callback/route.ts — Callback de autenticación
// ============================================================
// Este es un Route Handler de Next.js (equivalente a una API Route).
// Se ejecuta en el SERVIDOR, no en el navegador.
//
// ¿Cuándo se ejecuta?
//   Supabase redirige aquí al usuario después de:
//   1. Confirmar su email (click en el enlace de confirmación)
//   2. Completar un flujo OAuth (Google, GitHub, etc.)
//   3. Hacer click en un "magic link"
//   4. Restablecer su contraseña
//
// ¿Qué hace?
//   1. Lee el parámetro `code` de la URL (código temporal)
//   2. Intercambia el código por una sesión real con Supabase
//   3. Redirige al usuario a la página apropiada
//
// ¿Por qué es un Route Handler y no un Client Component?
//   Porque el intercambio de código por sesión DEBE hacerse
//   en el servidor para que las cookies se establezcan
//   correctamente antes de que el navegador renderice cualquier
//   página protegida.
// ============================================================

import { NextResponse } from "next/server";
// Importamos el cliente de SERVIDOR (no el de browser).
// Este archivo se ejecuta en Node.js, no en el navegador.
import { createClient } from "@/lib/supabase/server";

/**
 * Maneja el GET a /auth/callback.
 *
 * Supabase envía al usuario aquí con un parámetro `code` en la URL.
 * Ejemplo: /auth/callback?code=abc123&next=/dashboard
 *
 * @param request - La petición HTTP entrante con los query params
 */
export async function GET(request: Request) {
  // Parseamos la URL para extraer los parámetros de búsqueda.
  // `searchParams` contiene los query params (?code=xxx&next=yyy)
  // `origin` contiene el protocolo + host (http://localhost:3000)
  const { searchParams, origin } = new URL(request.url);

  // El `code` es un código de autorización temporal generado por Supabase.
  // Es de un solo uso y expira en pocos minutos.
  const code = searchParams.get("code");

  // `next` es un parámetro opcional que indica a dónde redirigir
  // al usuario después de la autenticación exitosa.
  // Si no se proporciona, por defecto va al dashboard.
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    // Crear el cliente de Supabase para el servidor.
    // Necesitamos `await` porque createClient() es async en el servidor.
    const supabase = await createClient();

    // exchangeCodeForSession() hace lo siguiente:
    // 1. Envía el código a los servidores de Supabase Auth
    // 2. Supabase valida el código y genera tokens JWT
    // 3. Los tokens se guardan como cookies en la respuesta
    // 4. A partir de este momento, el usuario tiene sesión
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // ✅ Éxito: el código fue válido y la sesión se estableció.
      // Redirigimos al usuario a la página solicitada.
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // ❌ Error: el código no existía, era inválido, o expiró.
  // Redirigimos al login con un parámetro de error para que
  // la UI pueda mostrar un mensaje apropiado.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
