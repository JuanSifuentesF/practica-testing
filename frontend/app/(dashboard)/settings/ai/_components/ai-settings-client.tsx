"use client";

import { useState } from "react";
import { useAiSession } from "@/components/ai/ai-session-provider";
import {
  getApiErrorCode,
  isAiSettingsApiResponse,
  type AiSettingsPreferencesUpdate,
} from "@/lib/ai/settings-contract";
import type { AiProvider, AiUsageMode, UserAiSettingsRow } from "@/types";

import { AiModeSelector } from "./ai-mode-selector";
import { ByokSessionKeyForm } from "./byok-session-key-form";
import { ProviderSelector } from "./provider-selector";
import { TestConnectionCard } from "./test-connection-card";

interface AiSettingsClientProps {
  initialSettings: UserAiSettingsRow;
}

export function AiSettingsClient({ initialSettings }: AiSettingsClientProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { byokApiKey, setByokApiKey, clearByokApiKey } = useAiSession();

  async function save(update: AiSettingsPreferencesUpdate) {
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
  }

  function handleModeChange(mode: AiUsageMode) {
    void save({ mode });
  }

  function handleProviderChange(provider: AiProvider) {
    void save({ provider });
  }

  return (
    <div className="space-y-6">
      <AiModeSelector
        mode={settings.mode}
        isSaving={isSaving}
        onModeChange={handleModeChange}
      />
      <ProviderSelector
        mode={settings.mode}
        provider={settings.provider}
        isSaving={isSaving}
        onProviderChange={handleProviderChange}
      />
      {settings.mode === "byok" ? (
        <ByokSessionKeyForm
          apiKey={byokApiKey}
          onApiKeyChange={setByokApiKey}
        />
      ) : null}
      <TestConnectionCard
        mode={settings.mode}
        provider={settings.provider}
        byokApiKey={byokApiKey}
      />
      {isSaving ? <p className="text-sm text-slate-500">Guardando…</p> : null}
      {saveError ? (
        <p className="text-sm text-red-400" role="alert">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
