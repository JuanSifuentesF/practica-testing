// frontend/app/(dashboard)/settings/ai/_components/usage-summary-cards.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiUsageReport, UsageMeter } from "@/lib/ai/usage-contract";

import { UsageMeter as UsageMeterComponent } from "./usage-meter";

interface UsageSummaryCardsProps {
  report: AiUsageReport;
}

function formatUtc(timestamp: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function QuotaNotice({ report }: UsageSummaryCardsProps) {
  const meters: Array<{ label: string; meter: UsageMeter }> = [
    { label: "Solicitudes diarias", meter: report.quota.daily.requests },
    { label: "Tokens diarios", meter: report.quota.daily.tokens },
    { label: "Solicitudes mensuales", meter: report.quota.month.requests },
    { label: "Tokens mensuales", meter: report.quota.month.tokens },
  ];
  const reached = meters.find(({ meter }) => meter.level === "reached");
  const warning = meters.find(({ meter }) => meter.level === "warning");

  if (reached) {
    return (
      <p
        className="rounded-md border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-200"
        role="alert"
      >
        {reached.label} alcanzó su límite Managed. La próxima llamada Managed
        quedará bloqueada hasta que se abra una nueva ventana UTC o se ajuste el
        límite desde un flujo autorizado.
      </p>
    );
  }

  if (warning) {
    return (
      <p
        className="rounded-md border border-amber-900/70 bg-amber-950/30 p-3 text-sm text-amber-200"
        role="status"
      >
        {warning.label} llegó al 80% o más de la cuota Managed.
      </p>
    );
  }

  return null;
}

export function UsageSummaryCards({ report }: UsageSummaryCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-base text-slate-100">
              Actividad registrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-400">
            <p>
              Hoy:{" "}
              <span className="font-medium text-slate-200">
                {report.activity.today.requests}
              </span>{" "}
              solicitudes ·{" "}
              <span className="font-medium text-slate-200">
                {report.activity.today.tokens.toLocaleString("es-PE")}
              </span>{" "}
              tokens
            </p>
            <p>
              Mes:{" "}
              <span className="font-medium text-slate-200">
                {report.activity.month.requests}
              </span>{" "}
              solicitudes ·{" "}
              <span className="font-medium text-slate-200">
                {report.activity.month.tokens.toLocaleString("es-PE")}
              </span>{" "}
              tokens
            </p>
            <p className="text-xs text-slate-500">
              Incluye eventos Demo, Managed y BYOK para auditoría. Los bloqueos
              no consumen solicitudes ni tokens.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-base text-slate-100">
              Estado del registro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-400">
            <p>
              Bloqueos hoy / mes:{" "}
              <span className="font-medium text-slate-200">
                {report.activity.blockedToday} / {report.activity.blockedMonth}
              </span>
            </p>
            <p>
              Reservas pendientes de finalizar:{" "}
              <span className="font-medium text-slate-200">
                {report.activity.pendingFinalizations}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              Lectura generada: {formatUtc(report.generatedAt)} UTC.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-base text-slate-100">
            Cuota de plataforma Managed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {report.quota.enforcementActive ? (
            <p className="text-sm text-slate-400">
              En esta lectura, Managed estaba activo. Estos límites se aplican a
              llamadas Managed; la actividad BYOK se audita arriba, pero no
              consume este presupuesto.
            </p>
          ) : (
            <p className="rounded-md border border-blue-900/70 bg-blue-950/30 p-3 text-sm text-blue-200">
              En esta lectura, el modo no era Managed. Los medidores muestran el
              consumo histórico de la cuota de plataforma; actualiza esta
              sección después de cambiar de modo para obtener otro snapshot.
            </p>
          )}

          <QuotaNotice report={report} />

          <div className="grid gap-4 md:grid-cols-2">
            <UsageMeterComponent
              label="Solicitudes de hoy"
              unitLabel="solicitudes"
              meter={report.quota.daily.requests}
            />
            <UsageMeterComponent
              label="Tokens de hoy"
              unitLabel="tokens"
              meter={report.quota.daily.tokens}
            />
            <UsageMeterComponent
              label="Solicitudes del mes"
              unitLabel="solicitudes"
              meter={report.quota.month.requests}
            />
            <UsageMeterComponent
              label="Tokens del mes"
              unitLabel="tokens"
              meter={report.quota.month.tokens}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
