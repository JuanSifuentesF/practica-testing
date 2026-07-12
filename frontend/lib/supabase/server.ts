// ============================================================
// lib/supabase/server.ts — Cliente Supabase para el SERVIDOR
// ============================================================
// Este cliente se usa en:
//   - Server Components (el default en App Router)
//   - API Routes (app/api/*/route.ts)
//   - Server Actions ('use server')
//
// ¿Cómo maneja la sesión?
//   createServerClient() recibe callbacks personalizados para
//   leer y escribir cookies usando la API de next/headers.
//   Esto es necesario porque en el servidor no existe
//   document.cookie — las cookies vienen en los HTTP headers.
//
// ¿Por qué es async?
//   Porque cookies() de next/headers es asíncrono en Next.js 15+.
//   Devuelve una Promise que resuelve al cookie store.
//
// SEGURIDAD:
//   - Solo usa variables NEXT_PUBLIC_ (anon key)
//   - RLS protege los datos (DB-04)
//   - Para operaciones admin, crear un cliente separado con
//     service_role key (se hará en UP-02)
// ============================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types";

/**
 * Crea un cliente de Supabase para código del servidor.
 * DEBE llamarse con `await` porque accede a cookies asíncronas.
 *
 * @example
 * ```tsx
 * // En un Server Component (app/dashboard/page.tsx)
 * import { createClient } from '@/lib/supabase/server';
 *
 * export default async function DashboardPage() {
 *   const supabase = await createClient();
 *   const { data } = await supabase.from('documents').select();
 *   // ...
 * }
 * ```
 *
 * @example
 * ```typescript
 * // En una API Route (app/api/documents/route.ts)
 * import { createClient } from '@/lib/supabase/server';
 *
 * export async function GET() {
 *   const supabase = await createClient();
 *   const { data, error } = await supabase.from('documents').select();
 *   return Response.json({ data, error });
 * }
 * ```
 */
export async function createClient() {
  // 1. Obtener el cookie store de Next.js.
  //    En Next.js 15+, cookies() retorna una Promise.
  const cookieStore = await cookies();

  // 2. Crear el cliente Supabase con manejo personalizado de cookies.
  //    createServerClient necesita saber CÓMO leer y escribir cookies
  //    en el entorno del servidor, porque cada framework lo hace diferente.
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // ─── Leer todas las cookies ───
        // Supabase llama a getAll() para encontrar sus cookies de sesión
        // (sb-<ref>-auth-token, sb-<ref>-auth-token-code-verifier, etc.)
        getAll() {
          return cookieStore.getAll();
        },

        // ─── Escribir cookies ───
        // Supabase llama a setAll() cuando necesita:
        //   - Guardar un nuevo access_token después de un refresh
        //   - Establecer la sesión después de un login
        //   - Limpiar cookies después de un logout
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ─── ¿Por qué ignoramos el error? ───
            // En Server Components, las cookies son READ-ONLY.
            // Next.js lanza un error si intentas escribir cookies
            // desde un Server Component (solo se pueden escribir
            // desde API Routes, Server Actions o Middleware).
            //
            // Esto es ESPERADO y SEGURO: si Supabase necesita
            // refrescar el token durante un Server Component render,
            // el refresh se completará en la siguiente petición
            // que pase por el Middleware (FE-03).
            //
            // El catch vacío evita que la app crashee en estos
            // casos normales de operación.
          }
        },
      },
    },
  );
}
