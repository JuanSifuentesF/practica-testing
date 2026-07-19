// frontend/app/(dashboard)/settings/ai/_components/usage-events-table.tsx
import { Badge } from "@/components/ui/badge";
import type { AiUsageDisplayEvent } from "@/lib/ai/usage-contract";

interface UsageEventsTableProps {
  events: readonly AiUsageDisplayEvent[];
}

const FEATURE_LABELS = {
  plan: "Plan",
  theory: "Teoría",
  quiz: "Quiz",
  evaluate: "Evaluación",
  practice_generate: "Práctica: generar",
  practice_evaluate: "Práctica: evaluar",
} as const;

const MODE_LABELS = {
  demo: "Demo",
  managed: "Managed",
  byok: "BYOK",
} as const;

const STATUS_LABELS = {
  success: "Completado",
  blocked: "Bloqueado por cuota",
  pending: "Reserva pendiente",
  error: "No completado",
} as const;

const STATUS_VARIANTS = {
  success: "default",
  blocked: "destructive",
  pending: "secondary",
  error: "outline",
} as const;

function formatEventTime(timestamp: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export function UsageEventsTable({ events }: UsageEventsTableProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <h3 className="text-base font-medium text-slate-100">Últimos eventos</h3>
      <p className="mt-1 text-sm text-slate-400">
        Se muestran como máximo 20 registros propios; las horas están en UTC.
      </p>

      {events.length === 0 ? (
        <p className="mt-4 rounded-md border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
          Aún no hay eventos registrados. AI-05 conectará las rutas que producen
          llamadas reales; este estado vacío es esperado por ahora.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <caption className="sr-only">
              Últimos eventos de consumo de IA
            </caption>
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha UTC</th>
                <th className="px-3 py-2 font-medium">Función</th>
                <th className="px-3 py-2 font-medium">Modo</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">
                  Solicitudes
                </th>
                <th className="px-3 py-2 text-right font-medium">Tokens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatEventTime(event.occurredAt)}
                  </td>
                  <td className="px-3 py-3">{FEATURE_LABELS[event.feature]}</td>
                  <td className="px-3 py-3">{MODE_LABELS[event.mode]}</td>
                  <td className="px-3 py-3">
                    <Badge variant={STATUS_VARIANTS[event.status]}>
                      {STATUS_LABELS[event.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right">{event.requestUnits}</td>
                  <td className="px-3 py-3 text-right">
                    {event.totalTokens.toLocaleString("es-PE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
