// frontend/app/(dashboard)/settings/ai/_components/security-notice.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NOTICES = [
  {
    title: "Demo",
    icon: "🎓",
    description: "No llama a un proveedor externo ni consume cuota.",
  },
  {
    title: "Managed",
    icon: "🏢",
    description:
      "Usa keys exclusivas del servidor y AI-02 reserva cuota solo durante llamadas reales.",
  },
  {
    title: "BYOK",
    icon: "🔑",
    description:
      "La key vive únicamente en memoria de esta página; no se escribe en Supabase, cookies ni almacenamiento del navegador.",
  },
] as const;

export function SecurityNotice() {
  return (
    <Card className="border-amber-200 bg-amber-500/5 dark:border-amber-900/50 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-amber-700 dark:text-amber-300">
          Seguridad de la configuración
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {NOTICES.map((notice) => (
            <li key={notice.title} className="flex gap-3 text-sm">
              <span aria-hidden="true">{notice.icon}</span>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {notice.title}:
                </span>{" "}
                {notice.description}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-amber-800/90 dark:text-amber-200/80">
          “Verificar configuración” no envía una petición al proveedor ni
          certifica una key BYOK; esa validación ocurre con la primera llamada
          real y trazable de AI-05.
        </p>
      </CardContent>
    </Card>
  );
}
