// frontend/app/(dashboard)/settings/ai/_components/byok-session-key-form.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_BYOK_API_KEY_LENGTH } from "@/lib/ai/http-contract";

interface ByokSessionKeyFormProps {
  readonly apiKey: string;
  readonly onApiKeyChange: (value: string) => void;
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
    <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 backdrop-blur-sm transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold tracking-wide text-amber-700 dark:text-amber-400">
          Clave API Temporal (BYOK)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200 p-3 text-xs leading-relaxed">
          Esta clave vive exclusivamente en la memoria de React durante la sesión. 
          Se borra automáticamente al recargar, cerrar sesión, cambiar de modo o salir del panel.
          Nunca se almacena en base de datos, cookies ni archivos de registro.
        </p>
        <div className="space-y-2">
          <Label htmlFor="byok-key" className="text-sm font-medium text-foreground">
            Clave API de tu Proveedor (Gemini, OpenAI, etc.)
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
              placeholder="Pega tu API Key de Gemini (AIzaSy...) o OpenAI (sk-...)"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsVisible((visible) => !visible)}
              aria-label={isVisible ? "Ocultar API key" : "Mostrar API key"}
              className="border-border bg-secondary text-secondary-foreground hover:bg-muted"
            >
              {isVisible ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
        </div>
        {apiKey.length > 0 ? (
          <Button 
            type="button" 
            variant="ghost" 
            onClick={clearKey}
            className="text-xs text-amber-700 dark:text-amber-400/80 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-500/10 dark:hover:bg-amber-950/20"
          >
            Limpiar key
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
