"use client";

import { useEffect, useState, useCallback } from "react";
import { useAiSession } from "@/components/ai/ai-session-provider";
import {
  getApiErrorCode,
  isAiSettingsApiResponse,
  type AiSettingsPreferencesUpdate,
} from "@/lib/ai/settings-contract";
import type { AiProvider, UserAiSettingsRow } from "@/types";

import { ByokSessionKeyForm } from "./byok-session-key-form";
import { ModelSelector } from "./model-selector";
import { TestConnectionCard } from "./test-connection-card";

interface AiSettingsClientProps {
  readonly initialSettings: UserAiSettingsRow;
}

export function AiSettingsClient({ initialSettings }: AiSettingsClientProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const { byokApiKey, setByokApiKey, clearByokApiKey } = useAiSession();

  const save = useCallback(
    async (update: AiSettingsPreferencesUpdate) => {
      if (isSaving) return;
      setIsSaving(true);
      setSaveError(null);

      try {
        const response = await fetch("/api/settings/ai", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        });
        const json: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(getApiErrorCode(json) ?? "SETTINGS_SAVE_FAILED");
        }
        if (!isAiSettingsApiResponse(json)) {
          throw new Error("INVALID_SETTINGS_RESPONSE");
        }

        const providerChanged = json.data.provider !== settings.provider;
        setSettings(json.data);

        if (json.data.mode !== "byok" || providerChanged) {
          clearByokApiKey();
          setIsVerified(false);
        }
      } catch (caught) {
        setSaveError(
          caught instanceof Error
            ? caught.message
            : "No se pudo guardar la configuración.",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, settings.provider, clearByokApiKey],
  );

  // Asegura la migración automática al modo BYOK (costos individuales) 
  // al ingresar a la pantalla de configuración.
  useEffect(() => {
    let active = true;
    if (settings.mode !== "byok") {
      setTimeout(() => {
        if (!active) return;
        void save({ mode: "byok" });
      }, 0);
    }
    return () => {
      active = false;
    };
  }, [settings.mode, save]);

  function handleSelectionChange(provider: AiProvider, modelName: string | null) {
    void save({ provider, model_name: modelName });
  }

  // En modo BYOK, mostramos la selección de proveedor y de modelos preferidos
  // únicamente después de que el usuario haya ingresado y verificado con éxito su clave API.
  const showProviderAndModelSelector = isVerified;

  return (
    <div className="space-y-6">
      {settings.mode === "byok" ? (
        <ByokSessionKeyForm
          apiKey={byokApiKey}
          onApiKeyChange={setByokApiKey}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Migrando configuración al modo BYOK…</p>
      )}
      {showProviderAndModelSelector ? (
        <ModelSelector
          mode={settings.mode}
          selectedProvider={settings.provider}
          selectedModel={settings.model_name}
          isSaving={isSaving}
          onSelectionChange={handleSelectionChange}
        />
      ) : null}
      <TestConnectionCard
        mode={settings.mode}
        provider={settings.provider}
        modelName={settings.model_name}
        byokApiKey={byokApiKey}
        onVerifiedChange={setIsVerified}
      />
      {isSaving ? <p className="text-sm text-muted-foreground">Guardando…</p> : null}
      {saveError ? (
        <p className="text-sm text-red-400" role="alert">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
