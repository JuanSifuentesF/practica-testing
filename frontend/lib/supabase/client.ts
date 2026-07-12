// ============================================================
// lib/supabase/client.ts — Cliente Supabase para el NAVEGADOR
// ============================================================
// Este cliente se usa EXCLUSIVAMENTE en Client Components
// (archivos marcados con 'use client').
//
// ¿Cómo maneja la sesión?
//   createBrowserClient() lee y escribe cookies directamente
//   en el navegador usando document.cookie. Supabase almacena
//   el access_token y refresh_token como cookies httpOnly
//   que se envían automáticamente en cada petición.
//
// ¿Por qué es una función y no una constante?
//   Porque cada componente que necesite Supabase debe llamar
//   a createClient() para obtener una instancia fresca.
//   @supabase/ssr implementa internamente un singleton para
//   evitar crear múltiples conexiones innecesarias.
//
// SEGURIDAD:
//   - Solo usa variables NEXT_PUBLIC_ (seguras para el navegador)
//   - NUNCA importar SUPABASE_SERVICE_ROLE_KEY aquí
//   - Las queries están protegidas por RLS (DB-04)
// ============================================================

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types";

/**
 * Crea un cliente de Supabase para componentes del navegador.
 *
 * @example
 * ```tsx
 * 'use client';
 * import { createClient } from '@/lib/supabase/client';
 *
 * export default function MiComponente() {
 *   const supabase = createClient();
 *   // ... usar supabase.from('documents').select()
 * }
 * ```
 */
export function createClient() {
  // createBrowserClient<Database>() hace dos cosas:
  // 1. Crea la conexión con tu proyecto Supabase usando URL + anon key
  // 2. Pasa el tipo Database como generic para que TypeScript
  //    conozca las tablas y columnas al hacer queries
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
