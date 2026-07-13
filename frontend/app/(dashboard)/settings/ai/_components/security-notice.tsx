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
    <Card className="border-amber-900/50 bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-amber-300">
          Seguridad de la configuración
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {NOTICES.map((notice) => (
            <li key={notice.title} className="flex gap-3 text-sm">
              <span aria-hidden="true">{notice.icon}</span>
              <p className="text-slate-400">
                <span className="font-medium text-slate-200">
                  {notice.title}:
                </span>{" "}
                {notice.description}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-amber-200/80">
          “Verificar configuración” no envía una petición al proveedor ni
          certifica una key BYOK; esa validación ocurre con la primera llamada
          real y trazable de AI-05.
        </p>
      </CardContent>
    </Card>
  );
}
