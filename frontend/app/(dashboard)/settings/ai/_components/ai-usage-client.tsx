// frontend/app/(dashboard)/settings/ai/_components/ai-usage-client.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  isAiUsageApiResponse,
  type AiUsageReport,
} from "@/lib/ai/usage-contract";

import { UsageEventsTable } from "./usage-events-table";
import { UsageSummaryCards } from "./usage-summary-cards";

export function AiUsageClient() {
  const [report, setReport] = useState<AiUsageReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUsage() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/settings/ai/usage", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const json: unknown = await response.json().catch(() => null);

        if (!response.ok || !isAiUsageApiResponse(json)) {
          throw new Error("USAGE_FETCH_FAILED");
        }

        if (!cancelled) setReport(json.data);
      } catch {
        if (!cancelled) {
          // El código técnico permanece en consola/telemetría del servidor;
          // al usuario se le comunica una acción recuperable.
          setError("No se pudo cargar el consumo. Intenta actualizarlo.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadUsage();
    return () => {
      // Una respuesta de una instancia anterior no puede sobrescribir un
      // refresco más reciente ni actualizar un componente desmontado.
      cancelled = true;
    };
  }, [refreshNonce]);

  function refresh() {
    setRefreshNonce((current) => current + 1);
  }

  if (!report && isLoading) {
    return (
      <Card aria-busy="true" className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-slate-100">
            Consumo de IA
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400">
          Cargando consumo y límites…
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="border-red-900/60 bg-red-950/20">
        <CardHeader>
          <CardTitle className="text-lg text-red-200">
            Consumo no disponible
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-red-200/80" role="alert">
            {error ?? "No se pudo cargar el consumo."}
          </p>
          <Button type="button" variant="outline" onClick={refresh}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="ai-usage-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="ai-usage-title"
            className="text-xl font-semibold text-slate-100"
          >
            Consumo de IA
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Actividad registrada y cuota de plataforma medida en UTC.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          disabled={isLoading}
        >
          {isLoading ? "Actualizando…" : "Actualizar consumo"}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-amber-300" role="status">
          No se pudo actualizar la lectura; se conservan los datos anteriores.
        </p>
      ) : null}

      <UsageSummaryCards report={report} />
      <UsageEventsTable events={report.lastEvents} />
    </section>
  );
}
