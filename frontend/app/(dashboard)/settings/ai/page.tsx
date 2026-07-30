// frontend/app/(dashboard)/settings/ai/page.tsx
import { redirect } from "next/navigation";
import { createDefaultAiSettings } from "@/lib/ai/settings-contract";
import { createClient } from "@/lib/supabase/server";

import { AiSettingsClient } from "./_components/ai-settings-client";
import { AiUsageClient } from "./_components/ai-usage-client";
import { SecurityNotice } from "./_components/security-notice";

const SETTINGS_COLUMNS =
  "user_id, mode, provider, model_name, daily_request_limit, monthly_request_limit, daily_token_limit, monthly_token_limit, updated_at";

export default async function AiSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data, error } = await supabase
    .from("user_ai_settings")
    .select(SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  // Ausencia de configuración es válida; una falla de DB o RLS no lo es.
  if (error) throw new Error("AI_SETTINGS_READ_FAILED");

  const settings = data ?? createDefaultAiSettings(user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">
          Configuración de IA (BYOK)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configura tu proveedor y modelo preferido aportando tu clave API temporal. 
          Tus preferencias se guardan automáticamente; las claves BYOK nunca se persisten en el servidor.
        </p>
      </header>
      <AiSettingsClient initialSettings={settings} />
      <AiUsageClient />
      <SecurityNotice />
    </div>
  );
}
