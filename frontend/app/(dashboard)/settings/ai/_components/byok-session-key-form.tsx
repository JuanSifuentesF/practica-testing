// frontend/app/(dashboard)/settings/ai/_components/byok-session-key-form.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_BYOK_API_KEY_LENGTH } from "@/lib/ai/http-contract";

interface ByokSessionKeyFormProps {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
}

export function ByokSessionKeyForm({
  apiKey,
  onApiKeyChange,
}: ByokSessionKeyFormProps) {
  const [isVisible, setIsVisible] = useState(false);

  function clearKey() {
    setIsVisible(false);
    onApiKeyChange("");
  }

  return (
    <Card className="border-amber-900/50 bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-amber-300">
          API key temporal (BYOK)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-md border border-amber-800/50 bg-amber-950/30 p-3 text-xs text-amber-100/80">
          La key vive solo en memoria React durante esta sesión autenticada. Se
          pierde al recargar, cerrar sesión, salir del dashboard, cambiar de
          modo o cambiar de proveedor. No se guarda en base de datos, storage,
          cookies ni logs.
        </p>
        <div className="space-y-2">
          <Label htmlFor="byok-key" className="text-slate-300">
            API key
          </Label>
          <div className="flex gap-2">
            <Input
              id="byok-key"
              type={isVisible ? "text" : "password"}
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={MAX_BYOK_API_KEY_LENGTH}
              placeholder="Pega tu key aquí"
              className="border-slate-700 bg-slate-950 text-slate-100"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible((visible) => !visible)}
              aria-label={isVisible ? "Ocultar API key" : "Mostrar API key"}
            >
              {isVisible ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
        </div>
        {apiKey.length > 0 ? (
          <Button type="button" variant="ghost" onClick={clearKey}>
            Limpiar key
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
