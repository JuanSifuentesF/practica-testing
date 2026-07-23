import type { ReactNode } from "react";
import { Braces, FileUp, Server } from "lucide-react";
import type { EndpointDefinition } from "./checklist-storage";

export function EndpointCard({ endpoint }: { endpoint: EndpointDefinition }) {
  return (
    <section className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-5">
      <div className="flex items-start gap-3">
        <Server className="mt-0.5 size-5 text-blue-300" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
            Caso de estudio BE-05
          </p>
          <h1 className="mt-1 text-xl font-bold text-white">
            <span className="mr-2 rounded bg-emerald-500/20 px-2 py-1 font-mono text-sm text-emerald-300">
              {endpoint.method}
            </span>
            <code>{endpoint.path}</code>
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Checklist educativa: no enviara archivos ni hara llamadas HTTP.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ContractItem
          icon={<FileUp className="size-4 text-sky-300" />}
          label="Request"
          value={`${endpoint.contentType}; campo ${endpoint.requestField}`}
        />
        <ContractItem
          icon={<Server className="size-4 text-amber-300" />}
          label="Autenticación"
          value={endpoint.authentication}
        />
        <ContractItem
          icon={<Braces className="size-4 text-emerald-300" />}
          label="200"
          value={endpoint.successShape}
        />
        <ContractItem
          icon={<Braces className="size-4 text-rose-300" />}
          label="400 / 401 / 413 / 422 / 429 / 500 / 503"
          value={endpoint.errorShape}
        />
      </div>
    </section>
  );
}

function ContractItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
      </div>
      <p className="mt-2 break-words font-mono text-xs text-slate-200">
        {value}
      </p>
    </div>
  );
}
