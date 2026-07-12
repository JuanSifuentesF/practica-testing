// ─────────────────────────────────────────────────────────────────
// lib/supabase/admin.ts
// Cliente de Supabase con service_role key (permisos elevados).
//
// ⚠️  REGLA DE ORO: Este archivo SOLO puede importarse desde
//     código que corre en el SERVIDOR:
//       - Route Handlers (app/api/**/route.ts)
//       - Server Actions
//       - Server Components
//
// 🚫  NUNCA importar desde archivos con 'use client'.
// ─────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

// ─────────────────────────────────────────────────────────────────
// ¿Por qué NO usamos createServerClient de @supabase/ssr aquí?
//
// createServerClient necesita cookies para manejar la sesión del
// usuario. Pero el admin client NO representa a ningún usuario;
// representa al SERVIDOR MISMO con acceso total.
//
// Por eso usamos createClient directamente de @supabase/supabase-js,
// sin cookies, sin SSR — es un cliente "desnudo" con superpoderes.
// ─────────────────────────────────────────────────────────────────

/**
 * Crea un cliente de Supabase con permisos de service_role.
 *
 * Este cliente IGNORA todas las políticas de Row Level Security (RLS).
 * Úsalo solo cuando el Route Handler ya haya verificado la identidad
 * del usuario con `getUser()` y necesites hacer una operación privilegiada
 * como subir archivos al Storage o insertar registros con un user_id
 * que el anon client no permitiría.
 *
 * @example
 * ```typescript
 * const adminClient = createAdminClient();
 * const { data, error } = await adminClient.storage
 *   .from("pdfs")
 *   .upload(path, file);
 * ```
 */
export function createAdminClient() {
  // ─── Validación defensiva ─────────────────────────────────
  // Si las variables no existen, fallamos ruidosamente en lugar
  // de crear un cliente inválido que falle silenciosamente después.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "[Admin Client] NEXT_PUBLIC_SUPABASE_URL no está definida. " +
        "Revisa tu archivo .env.local",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "[Admin Client] SUPABASE_SERVICE_ROLE_KEY no está definida. " +
        "Revisa tu archivo .env.local (esta variable NO lleva prefijo NEXT_PUBLIC_)",
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      // ─── Desactivar la persistencia de sesión ───────────────
      // El admin client no necesita manejar sesiones de usuario.
      // autoRefreshToken y persistSession son para clientes del
      // navegador que necesitan mantener al usuario logueado.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
