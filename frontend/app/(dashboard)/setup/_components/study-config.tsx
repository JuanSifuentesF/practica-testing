// ============================================================
// app/(dashboard)/setup/_components/study-config.tsx
// ============================================================
// Formulario de configuración del plan de estudio.
// Contiene:
//   - Input numérico: días objetivo (default: 7, rango: 1-30)
//   - Select: hora de estudio mañana (default: 06:00)
//   - Select: hora de estudio noche (default: 22:00)
//
// TIPO: Client Component — usa useState para inputs controlados
//
// PATRÓN: Controlled Components
//   Cada input tiene su valor controlado por el estado del padre
//   (SetupPage) a través de props. Cuando el usuario cambia un
//   valor, llamamos a onConfigChange() para notificar al padre.
// ============================================================

"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// ─── Tipo de la configuración del plan ───
// Exportamos esta interfaz para que SetupPage la use también.
export interface StudyConfigData {
  /** Número de días para completar el estudio (1-30) */
  objectiveDays: number;
  /** Hora de inicio de la sesión matutina (formato "HH:MM") */
  morningTime: string;
  /** Hora de inicio de la sesión nocturna (formato "HH:MM") */
  nightTime: string;
}

// ─── Valores por defecto ───
// Exportamos para reutilizar en SetupPage al inicializar el estado.
export const DEFAULT_CONFIG: StudyConfigData = {
  objectiveDays: 7,
  morningTime: "06:00",
  nightTime: "22:00",
};

// ─── Opciones de horarios ───
// Generamos las opciones de hora para los selects.
// Horarios de mañana: 5:00 a 12:00 (cada hora)
// Horarios de noche: 18:00 a 23:00 (cada hora)
const MORNING_HOURS = [
  { value: "05:00", label: "5:00 AM" },
  { value: "06:00", label: "6:00 AM" },
  { value: "07:00", label: "7:00 AM" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM" },
];

const NIGHT_HOURS = [
  { value: "18:00", label: "6:00 PM" },
  { value: "19:00", label: "7:00 PM" },
  { value: "20:00", label: "8:00 PM" },
  { value: "21:00", label: "9:00 PM" },
  { value: "22:00", label: "10:00 PM" },
  { value: "23:00", label: "11:00 PM" },
];

// ─── Props del componente ───
interface StudyConfigProps {
  /** Configuración actual */
  config: StudyConfigData;
  /** Callback cuando cambia algún valor */
  onConfigChange: (config: StudyConfigData) => void;
  /** Deshabilitar inputs durante el procesamiento */
  disabled?: boolean;
}

export function StudyConfig({
  config,
  onConfigChange,
  disabled = false,
}: StudyConfigProps) {
  // ─── Handlers de cambio ───
  // Cada handler actualiza solo el campo que cambió,
  // manteniendo los demás valores intactos con el spread.

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convertir el string del input a número.
    // parseInt puede retornar NaN si el input está vacío,
    // en ese caso usamos 1 como mínimo.
    const value = parseInt(e.target.value, 10);
    const days = isNaN(value) ? 1 : Math.min(Math.max(value, 1), 30);

    onConfigChange({
      ...config, // Mantener morningTime y nightTime
      objectiveDays: days, // Actualizar solo los días
    });
  };

  const handleMorningChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({
      ...config,
      morningTime: e.target.value,
    });
  };

  const handleNightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onConfigChange({
      ...config,
      nightTime: e.target.value,
    });
  };

  return (
    // ─── Contenedor del formulario ───
    // Usamos una Card visual pero sin el componente Card de shadcn
    // para mayor control del estilo.
    <div className="flex flex-col gap-6">
      {/* ─── Título de la sección ─── */}
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-foreground">
          ⚙️ Configuración del Plan
        </h3>
        <p className="text-sm text-muted-foreground">
          Ajusta estos parámetros según tu disponibilidad. El agente generará un
          plan personalizado basado en tus preferencias.
        </p>
      </div>

      {/* ─── Grid de inputs ───
          En mobile: una columna (los inputs se apilan)
          En desktop: tres columnas (una por cada input)
          gap-6: espacio de 24px entre inputs */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* ─── Input 1: Días objetivo ─── */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="objective-days"
            className="text-sm font-medium text-foreground"
          >
            📅 Días para estudiar
          </Label>
          <Input
            id="objective-days"
            type="number"
            min={1}
            max={30}
            value={config.objectiveDays}
            onChange={handleDaysChange}
            disabled={disabled}
            className="
              bg-background border-border
              text-foreground placeholder:text-muted-foreground
              focus:border-emerald-500 focus:ring-emerald-500/20
            "
          />
          <p className="text-xs text-muted-foreground">
            Rango: 1-30 días. Default: 7 días (intensivo ISTQB)
          </p>
        </div>

        {/* ─── Input 2: Hora mañana ─── */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="morning-time"
            className="text-sm font-medium text-foreground"
          >
            🌅 Sesión mañana
          </Label>
          {/* Usamos un <select> nativo en lugar de un componente
              shadcn/ui Select porque es más simple para este caso
              y funciona mejor en dispositivos móviles (picker nativo). */}
          <select
            id="morning-time"
            value={config.morningTime}
            onChange={handleMorningChange}
            disabled={disabled}
            className="
              flex h-9 w-full rounded-md border border-border
              bg-background px-3 py-1
              text-sm text-foreground
              transition-colors
              focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            {MORNING_HOURS.map((hour) => (
              <option key={hour.value} value={hour.value}>
                {hour.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Hora preferida para la sesión matutina
          </p>
        </div>

        {/* ─── Input 3: Hora noche ─── */}
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="night-time"
            className="text-sm font-medium text-foreground"
          >
            🌙 Sesión noche
          </Label>
          <select
            id="night-time"
            value={config.nightTime}
            onChange={handleNightChange}
            disabled={disabled}
            className="
              flex h-9 w-full rounded-md border border-border
              bg-background px-3 py-1
              text-sm text-foreground
              transition-colors
              focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            {NIGHT_HOURS.map((hour) => (
              <option key={hour.value} value={hour.value}>
                {hour.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Hora preferida para la sesión nocturna
          </p>
        </div>
      </div>

      {/* ─── Resumen del plan ───
          Muestra un cálculo rápido de lo que el usuario obtendrá.
          Esto da feedback inmediato y reduce la ansiedad de "¿qué pasará?". */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">
          📊{" "}
          <span className="text-foreground font-medium">Resumen estimado:</span>{" "}
          {config.objectiveDays} días × 2 sesiones ={" "}
          <span className="text-emerald-500 font-semibold">
            {config.objectiveDays * 2} sesiones
          </span>{" "}
          de ~90 minutos cada una ({config.morningTime.replace(":00", "")}h y{" "}
          {config.nightTime.replace(":00", "")}h). La configuración de IA se
          toma desde Settings.
        </p>
      </div>
    </div>
  );
}
