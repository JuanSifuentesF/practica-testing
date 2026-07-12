"use client";

// ============================================================
// app/supabase-client-test.tsx — Prueba de Supabase desde el navegador
// ============================================================
// 'use client' es OBLIGATORIO aquí porque:
//   - Usamos useState para manejar el estado de la prueba
//   - Usamos useEffect para ejecutar la query al montar
//   - Usamos event handlers (onClick)
//
// Este componente se renderiza en el navegador y usa el cliente
// de lib/supabase/client.ts (que usa document.cookie).
// ============================================================

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// Definimos una interfaz para el estado del test
interface TestResult {
  status: "idle" | "loading" | "success" | "error";
  documentCount: number;
  userEmail: string | null;
  errorMessage: string | null;
}

export function SupabaseClientTest() {
  // Estado local del componente — controla qué se muestra en la UI
  const [result, setResult] = useState<TestResult>({
    status: "idle",
    documentCount: 0,
    userEmail: null,
    errorMessage: null,
  });

  // ─── Función para ejecutar la prueba de conexión ───
  async function runConnectionTest() {
    setResult((prev) => ({ ...prev, status: "loading" }));

    try {
      // Crear una instancia del cliente Supabase para el navegador.
      // Internamente usa document.cookie para leer la sesión.
      const supabase = createClient();

      // 1. Verificar si hay sesión activa
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 2. Intentar leer la tabla documents
      // Si no hay sesión, RLS devuelve array vacío (no error)
      const { data: documents, error } = await supabase
        .from("documents")
        .select("id, file_name, created_at")
        .limit(5);

      if (error) {
        setResult({
          status: "error",
          documentCount: 0,
          userEmail: null,
          errorMessage: `${error.message} (${error.code})`,
        });
        return;
      }

      setResult({
        status: "success",
        documentCount: documents?.length ?? 0,
        userEmail: user?.email ?? null,
        errorMessage: null,
      });
    } catch (err) {
      // Error de red o configuración — no un error de Supabase
      setResult({
        status: "error",
        documentCount: 0,
        userEmail: null,
        errorMessage: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  // ─── Ejecutar la prueba automáticamente al montar ───
  // useEffect con [] se ejecuta UNA vez al montar el componente.
  // Es el equivalente de "cuando el componente aparece en pantalla".
  useEffect(() => {
    runConnectionTest();
  }, []);

  return (
    <div className="mb-8 rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-left">
      <h2 className="mb-4 text-lg font-semibold text-purple-400">
        🌐 Client Component — Conexión desde el navegador
      </h2>

      {/* Estado de la prueba */}
      {result.status === "loading" && (
        <div className="rounded-lg bg-slate-900/50 p-3">
          <p className="text-sm text-slate-400 animate-pulse">
            ⏳ Conectando con Supabase desde el navegador...
          </p>
        </div>
      )}

      {result.status === "error" && (
        <div className="rounded-lg bg-red-900/30 border border-red-700 p-3">
          <p className="text-sm text-red-400">
            <span className="font-medium">Error:</span> {result.errorMessage}
          </p>
        </div>
      )}

      {result.status === "success" && (
        <div className="space-y-3">
          {/* Estado de autenticación */}
          <div className="rounded-lg bg-slate-900/50 p-3">
            <p className="text-sm text-slate-400">
              <span className="font-medium text-slate-300">Sesión activa:</span>{" "}
              {result.userEmail ? (
                <span className="text-emerald-400">{result.userEmail}</span>
              ) : (
                <span className="text-amber-400">
                  No autenticado (normal — auth se configura en FE-03)
                </span>
              )}
            </p>
          </div>

          {/* Resultado de la query */}
          <div className="rounded-lg bg-emerald-900/20 border border-emerald-800 p-3">
            <p className="text-sm text-emerald-400">
              ✅ Conexión exitosa al navegador de Supabase
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Documentos encontrados: {result.documentCount}
              {result.documentCount === 0 &&
                " (tabla vacía o sin sesión — esperado en esta etapa)"}
            </p>
          </div>
        </div>
      )}

      {/* Botón para re-ejecutar la prueba */}
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={runConnectionTest}
          disabled={result.status === "loading"}
          className="border-slate-700 text-slate-300 hover:bg-slate-700"
        >
          🔄 Re-ejecutar test
        </Button>
        <span className="text-xs text-slate-600">
          Este bloque se ejecuta en el navegador — usa JavaScript del bundle del
          cliente.
        </span>
      </div>
    </div>
  );
}
