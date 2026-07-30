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
  readonly mode: AiUsageMode;
  readonly provider: AiProvider;
  readonly modelName: string | null;
  readonly byokApiKey: string;
  readonly onVerifiedChange?: (verified: boolean) => void;
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

interface InspectionState {
  mode: AiUsageMode;
  provider: AiProvider;
  byokApiKey: string;
  result: InspectionResult | null;
  error: string | null;
}

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
  modelName,
  byokApiKey,
  onVerifiedChange,
}: TestConnectionCardProps) {
  const [inspection, setInspection] = useState<InspectionState>({
    mode,
    provider,
    byokApiKey,
    result: null,
    error: null,
  });
  const [isChecking, setIsChecking] = useState(false);

  // Un resultado corresponde a una configuración concreta. Si el usuario
  // modifica modo, proveedor o key, reiniciar ese estado de forma segura en un useEffect
  // para evitar llamadas a setState de componentes padres durante el renderizado.
  useEffect(() => {
    let active = true;
    if (
      inspection.mode !== mode ||
      inspection.provider !== provider ||
      inspection.byokApiKey !== byokApiKey
    ) {
      setTimeout(() => {
        if (!active) return;
        setInspection({
          mode,
          provider,
          byokApiKey,
          result: null,
          error: null,
        });
        onVerifiedChange?.(false);
      }, 0);
    }
    return () => {
      active = false;
    };
  }, [mode, provider, byokApiKey, inspection.mode, inspection.provider, inspection.byokApiKey, onVerifiedChange]);

  const { result, error } = inspection;

  async function checkConfiguration() {
    if (isChecking) return;
    const checkedConfiguration = { mode, provider, byokApiKey };
    setIsChecking(true);
    setInspection({
      ...checkedConfiguration,
      result: null,
      error: null,
    });

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

      const isConfigured = json.data.status === "configured";
      setInspection({
        ...checkedConfiguration,
        result: json.data,
        error: null,
      });
      onVerifiedChange?.(isConfigured);
    } catch (caught) {
      setInspection({
        ...checkedConfiguration,
        result: null,
        error:
          caught instanceof Error
            ? caught.message
            : "No se pudo verificar la configuración.",
      });
      onVerifiedChange?.(false);
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

  // Resolver dinámicamente el modelo que se muestra en base a la prop actual
  const isDefaulted = modelName === null;
  const displayedModelName = modelName || (result?.status === "configured" ? result.model : "");

  return (
    <Card className="border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Verificar configuración
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Comprueba la selección local y la disponibilidad de la configuración
          del servidor. No crea un cliente del proveedor, no hace una llamada
          externa y no reserva cuota.
        </p>
        <Button
          type="button"
          onClick={checkConfiguration}
          disabled={isChecking}
          className="border border-border bg-secondary text-secondary-foreground font-semibold px-5 py-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 shadow-md cursor-pointer"
        >
          {isChecking ? "Verificando…" : "Verificar configuración"}
        </Button>

        {result ? (
          <div className="rounded-md border border-border bg-background p-4 text-sm space-y-2" aria-live="polite">
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
                <p className="mt-1 text-muted-foreground">
                  Proveedor:{" "}
                  <span className="text-foreground">{result.provider}</span>
                  {" · "}Modelo allowlisted:{" "}
                  <span className="text-foreground">{displayedModelName}</span>
                  {isDefaulted ? " (se usó el default seguro)" : ""}
                </p>
                {result.mode === "byok" ? (
                  <p className="mt-2 text-xs text-amber-300">
                    La clave no vacía todavía no ha sido validada por el
                    proveedor; el sistema lo hará al ejecutar la primera solicitud
                    de teoría o práctica.
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
