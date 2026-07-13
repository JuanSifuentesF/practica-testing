// frontend/app/(dashboard)/settings/ai/_components/test-connection-card.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getApiErrorCode,
  isPlainObject,
  parseAiProvider,
  parseAiUsageMode,
} from "@/lib/ai/settings-contract";
import type { AiProvider, AiUsageMode } from "@/types";

interface TestConnectionCardProps {
  mode: AiUsageMode;
  provider: AiProvider;
  byokApiKey: string;
}

type InspectionReason =
  | "BYOK_KEY_REQUIRED"
  | "PROVIDER_CONFIGURATION_ERROR"
  | "SETTINGS_READ_FAILED";

type InspectionResult =
  | { status: "demo"; mode: "demo" }
  | {
      status: "configured";
      mode: "managed" | "byok";
      provider: AiProvider;
      model: string;
      modelWasDefaulted: boolean;
    }
  | { status: "unavailable"; mode: AiUsageMode; reason: InspectionReason };

const REASON_LABELS: Record<InspectionReason, string> = {
  BYOK_KEY_REQUIRED:
    "Ingresa una API key temporal para revisar la configuración BYOK.",
  PROVIDER_CONFIGURATION_ERROR:
    "El servidor no tiene configurada la key del proveedor seleccionado.",
  SETTINGS_READ_FAILED:
    "No se pudo leer la configuración. Intenta nuevamente más tarde.",
};

function isInspectionReason(value: unknown): value is InspectionReason {
  return (
    value === "BYOK_KEY_REQUIRED" ||
    value === "PROVIDER_CONFIGURATION_ERROR" ||
    value === "SETTINGS_READ_FAILED"
  );
}

function isInspectionResult(value: unknown): value is InspectionResult {
  if (!isPlainObject(value)) return false;

  if (value.status === "demo") return value.mode === "demo";

  if (value.status === "configured") {
    const mode = parseAiUsageMode(value.mode);
    return (
      (mode === "managed" || mode === "byok") &&
      parseAiProvider(value.provider) !== null &&
      typeof value.model === "string" &&
      typeof value.modelWasDefaulted === "boolean"
    );
  }

  return (
    value.status === "unavailable" &&
    parseAiUsageMode(value.mode) !== null &&
    isInspectionReason(value.reason)
  );
}

function isInspectionApiResponse(
  value: unknown,
): value is { data: InspectionResult } {
  return isPlainObject(value) && isInspectionResult(value.data);
}

export function TestConnectionCard({
  mode,
  provider,
  byokApiKey,
}: TestConnectionCardProps) {
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Un resultado corresponde a una configuración concreta. Si el usuario
  // modifica modo, proveedor o key, ocultar el resultado anterior.
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [mode, provider, byokApiKey]);

  async function checkConfiguration() {
    if (isChecking) return;
    setIsChecking(true);
    setResult(null);
    setError(null);

    try {
      const body =
        mode === "byok" && byokApiKey.trim().length > 0
          ? { byokApiKey: byokApiKey.trim() }
          : {};
      const response = await fetch("/api/settings/ai/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getApiErrorCode(json) ?? "SETTINGS_INSPECTION_FAILED");
      }
      if (!isInspectionApiResponse(json)) {
        throw new Error("INVALID_INSPECTION_RESPONSE");
      }

      setResult(json.data);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo verificar la configuración.",
      );
    } finally {
      setIsChecking(false);
    }
  }

  const resultClass =
    result?.status === "configured"
      ? "text-emerald-400"
      : result?.status === "demo"
        ? "text-blue-400"
        : "text-amber-400";

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader>
        <CardTitle className="text-lg text-slate-100">
          Verificar configuración
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-400">
          Comprueba la selección local y la disponibilidad de la configuración
          del servidor. No crea un cliente del proveedor, no hace una llamada
          externa y no reserva cuota.
        </p>
        <Button
          type="button"
          onClick={checkConfiguration}
          disabled={isChecking}
        >
          {isChecking ? "Verificando…" : "Verificar configuración"}
        </Button>

        {result ? (
          <div
            className="rounded-md border border-slate-800 bg-slate-950/50 p-4 text-sm"
            aria-live="polite"
          >
            {result.status === "demo" ? (
              <p className={resultClass}>
                Modo demo activo: no se requiere proveedor.
              </p>
            ) : null}
            {result.status === "configured" ? (
              <>
                <p className={resultClass}>
                  Configuración lista para una llamada real futura.
                </p>
                <p className="mt-1 text-slate-400">
                  Proveedor:{" "}
                  <span className="text-slate-200">{result.provider}</span>
                  {" · "}Modelo allowlisted:{" "}
                  <span className="text-slate-200">{result.model}</span>
                  {result.modelWasDefaulted
                    ? " (se usó el default seguro)"
                    : ""}
                </p>
                {result.mode === "byok" ? (
                  <p className="mt-2 text-xs text-amber-300">
                    La key no vacía todavía no ha sido validada por el
                    proveedor; AI-05 lo hará al ejecutar la primera solicitud
                    trazable.
                  </p>
                ) : null}
              </>
            ) : null}
            {result.status === "unavailable" ? (
              <p className={resultClass}>{REASON_LABELS[result.reason]}</p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
