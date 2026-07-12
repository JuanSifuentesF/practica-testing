// ============================================================
// app/page.tsx — Página principal con prueba de conexión Supabase
// ============================================================
// Esta página demuestra DOS formas de conectar con Supabase:
//
// 1. SERVER COMPONENT (este archivo):
//    - Se ejecuta en Node.js durante el render
//    - Usa createClient() de lib/supabase/server.ts
//    - Los datos llegan como HTML (sin JS en el bundle)
//
// 2. CLIENT COMPONENT (SupabaseClientTest embebido):
//    - Se ejecuta en el navegador del usuario
//    - Usa createClient() de lib/supabase/client.ts
//    - Los datos se cargan después de la hidratación
//
// NOTA: No hay 'use client' aquí → es Server Component por default.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { SupabaseClientTest } from "./supabase-client-test";

export default async function HomePage() {
  // ─── Conexión desde Server Component ───
  // await es necesario porque createClient() del servidor es async
  const supabase = await createClient();

  // Intentar leer la tabla documents.
  // Si no hay usuario autenticado, RLS bloqueará la lectura
  // y data será un array vacío (no un error).
  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, file_name, created_at")
    .limit(5);

  // También verificar si hay una sesión activa
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-2xl px-6 text-center">
        {/* Badge de estado */}
        <div className="mb-8 inline-flex items-center rounded-full border border-slate-700 bg-slate-800/50 px-4 py-1.5 text-sm text-slate-300">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          FE-02 Completado — Supabase conectado
        </div>

        {/* Título principal */}
        <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
          ISTQB{" "}
          <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Study Agent
          </span>
        </h1>

        {/* Subtítulo */}
        <p className="mb-8 text-lg leading-relaxed text-slate-400">
          Tu tutor inteligente para la certificación ISTQB® Foundation Level
          v4.0. Estudio adaptativo impulsado por IA con sesiones personalizadas
          de teoría y quiz.
        </p>

        {/* Stack tecnológico */}
        <div className="mb-10 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
          <span className="rounded-md border border-slate-700 px-3 py-1">
            Next.js 16
          </span>
          <span className="rounded-md border border-slate-700 px-3 py-1">
            TypeScript
          </span>
          <span className="rounded-md border border-slate-700 px-3 py-1">
            Tailwind CSS
          </span>
          <span className="rounded-md border border-slate-700 px-3 py-1">
            shadcn/ui
          </span>
          <span className="rounded-md border border-emerald-700 bg-emerald-900/30 px-3 py-1 text-emerald-400">
            ✓ Supabase
          </span>
          <span className="rounded-md border border-slate-700 px-3 py-1">
            OpenAI
          </span>
        </div>

        {/* ════════════════════════════════════════════════════ */}
        {/* SECCIÓN 1: Resultado del Server Component           */}
        {/* ════════════════════════════════════════════════════ */}
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-left">
          <h2 className="mb-4 text-lg font-semibold text-blue-400">
            🖥️ Server Component — Conexión desde el servidor
          </h2>

          {/* Estado de autenticación */}
          <div className="mb-4 rounded-lg bg-slate-900/50 p-3">
            <p className="text-sm text-slate-400">
              <span className="font-medium text-slate-300">Sesión activa:</span>{" "}
              {user ? (
                <span className="text-emerald-400">{user.email}</span>
              ) : (
                <span className="text-amber-400">
                  No autenticado (normal — auth se configura en FE-03)
                </span>
              )}
            </p>
          </div>

          {/* Resultado de la query */}
          {error ? (
            <div className="rounded-lg bg-red-900/30 border border-red-700 p-3">
              <p className="text-sm text-red-400">
                <span className="font-medium">Error:</span> {error.message}
              </p>
              <p className="mt-1 text-xs text-red-500">
                Código: {error.code} — Detalle: {error.details}
              </p>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-900/20 border border-emerald-800 p-3">
              <p className="text-sm text-emerald-400">
                ✅ Conexión exitosa al servidor de Supabase
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Documentos encontrados: {documents?.length ?? 0}
                {documents?.length === 0 &&
                  " (tabla vacía o sin sesión — esperado en esta etapa)"}
              </p>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-600">
            Este bloque se renderizó en el servidor — cero JavaScript enviado al
            navegador para esta sección.
          </p>
        </div>

        {/* ════════════════════════════════════════════════════ */}
        {/* SECCIÓN 2: Resultado del Client Component           */}
        {/* ════════════════════════════════════════════════════ */}
        <SupabaseClientTest />

        {/* Footer */}
        <div className="mt-16 border-t border-slate-800 pt-8 text-sm text-slate-600">
          <p>ISTQB Study Agent — Bloque C: Frontend Base</p>
          <p className="mt-1">
            Próximo paso: FE-03 — Auth: registro, login, logout, middleware
          </p>
        </div>
      </div>
    </main>
  );
}
