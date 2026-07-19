// frontend/app/(dashboard)/settings/ai/_components/usage-meter.tsx
import type { UsageMeter as UsageMeterValue } from "@/lib/ai/usage-contract";

interface UsageMeterProps {
  label: string;
  unitLabel: string;
  meter: UsageMeterValue;
}

const METER_COLORS = {
  normal: "bg-emerald-500",
  warning: "bg-amber-400",
  reached: "bg-red-500",
} as const;

export function UsageMeter({ label, unitLabel, meter }: UsageMeterProps) {
  // ARIA requiere un máximo positivo; para límite 0 se comunica un medidor
  // completo de 1/1, mientras el texto visible mantiene el 0/0 real.
  const ariaMaximum = meter.limit === 0 ? 1 : meter.limit;
  const ariaCurrent = meter.limit === 0 ? 1 : Math.min(meter.used, meter.limit);
  const description = `${meter.used.toLocaleString("es-PE")} de ${meter.limit.toLocaleString("es-PE")} ${unitLabel}`;

  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-medium text-slate-200">{label}</p>
        <p className="text-sm text-slate-400">{meter.percentage}%</p>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={ariaMaximum}
        aria-valuenow={ariaCurrent}
        aria-valuetext={description}
        className="h-2 overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className={`h-full rounded-full transition-[width] ${METER_COLORS[meter.level]}`}
          style={{ width: `${meter.percentage}%` }}
        />
      </div>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}
