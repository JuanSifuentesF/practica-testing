"use client";

// ============================================================
// exam-countdown.tsx — Cuenta regresiva visual al examen
// ============================================================
// TIPO: Client Component ('use client')
//
// ¿POR QUÉ CLIENT COMPONENT?
//   Este componente calcula los días restantes comparando
//   `estimated_end_date` con `new Date()` (la fecha actual).
//
//   Aunque este componente usa 'use client', Next.js puede generar
//   HTML inicial en el servidor. Por eso NO calculamos fechas durante
//   el primer render. Renderizamos un estado estático y luego usamos
//   useEffect() para calcular los días restantes en el navegador.
//
// PROP SERIALIZABLE:
//   Recibe `estimatedEndDate` como STRING, no como Date.
//   Las props que cruzan la frontera Server→Client deben ser
//   serializables (string, number, boolean, array, plain object).
//   Date, Map, Set, Function NO son serializables.
// ============================================================

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { Target, Flame, Clock, Trophy } from "lucide-react";

type ExamCountdownProps = {
  /** Fecha estimada del examen como ISO string (ej. "2026-07-06") */
  estimatedEndDate: string;
};

type CountdownState = {
  daysLeft: number;
  motivational: {
    message: string;
    icon: ComponentType<{ className?: string }>;
    accentColor: string;
  };
};

/**
 * Retorna un mensaje motivacional basado en los días restantes.
 *
 * ¿Por qué una función separada y no inline?
 *   1. Facilita agregar más rangos de mensajes sin ensuciar el JSX
 *   2. Se puede testear unitariamente
 *   3. Sigue el principio de Single Responsibility
 */
function getMotivationalMessage(daysLeft: number): {
  message: string;
  icon: ComponentType<{ className?: string }>;
  accentColor: string;
} {
  if (daysLeft <= 0) {
    return {
      message: "¡Hoy es el día! Confía en tu preparación. 💪",
      icon: Trophy,
      accentColor: "text-amber-400",
    };
  }
  if (daysLeft === 1) {
    return {
      message: "¡Último día! Repasa los conceptos clave y descansa bien.",
      icon: Flame,
      accentColor: "text-orange-400",
    };
  }
  if (daysLeft <= 3) {
    return {
      message: "¡La meta está cerca! Enfócate en las áreas más débiles.",
      icon: Flame,
      accentColor: "text-orange-400",
    };
  }
  if (daysLeft <= 5) {
    return {
      message: "¡Buen ritmo! Mantén la constancia día a día.",
      icon: Target,
      accentColor: "text-emerald-400",
    };
  }
  return {
    message: "Tiempo suficiente para una preparación sólida. ¡Vamos! 🚀",
    icon: Clock,
    accentColor: "text-blue-400",
  };
}

function calculateCountdown(estimatedEndDate: string): CountdownState {
  // ¿Por qué T12:00:00?
  //   Evita que la zona horaria desplace la fecha un día en UTC negativo.
  const endDate = new Date(estimatedEndDate + "T12:00:00");
  const today = new Date();

  // 1 día = 24 * 60 * 60 * 1000 = 86_400_000 milisegundos.
  // Math.ceil: si faltan 4.3 días, mostramos 5 días.
  const diffMs = endDate.getTime() - today.getTime();
  const days = Math.ceil(diffMs / 86_400_000);
  const daysLeft = Math.max(0, days);

  return {
    daysLeft,
    motivational: getMotivationalMessage(daysLeft),
  };
}

export function ExamCountdown({ estimatedEndDate }: ExamCountdownProps) {
  const [countdown, setCountdown] = useState<CountdownState | null>(null);

  useEffect(() => {
    setCountdown(calculateCountdown(estimatedEndDate));
  }, [estimatedEndDate]);

  // Primer render estable: evita HTML dinámico antes de hidratar.
  if (!countdown) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <p className="text-sm font-medium text-slate-300">
          Calculando cuenta regresiva...
        </p>
      </div>
    );
  }

  const { daysLeft, motivational } = countdown;
  const MotivationalIcon = motivational.icon;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-800
                  bg-gradient-to-r from-slate-900 via-slate-900/95 to-emerald-950/30
                  p-6"
    >
      {/* ── Decoración de fondo ──────────────────────────────── */}
      {/*
        Un círculo difuminado como decoración visual.
        absolute + posición negativa lo coloca parcialmente fuera del contenedor.
        opacity-10 lo hace muy sutil (10% de opacidad).
        pointer-events-none evita que bloquee clicks en elementos debajo.
      */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32
                    rounded-full bg-emerald-500 opacity-10 blur-2xl"
      />

      <div className="relative flex flex-col items-center gap-4 md:flex-row md:gap-8">
        {/* ── Número grande: días restantes ─────────────────── */}
        <div className="flex flex-col items-center">
          {/*
            text-6xl + font-black: el número más prominente de toda la página.
            tabular-nums: variante tipográfica que alinea números en tablas.
            Cada dígito ocupa el mismo ancho, evitando "saltos" visuales
            cuando el número cambia (ej. de "10" a "9").
          */}
          <span
            className={`text-6xl font-black tabular-nums leading-none ${motivational.accentColor}`}
          >
            {daysLeft}
          </span>
          <span className="mt-1 text-sm font-medium text-slate-400">
            {daysLeft === 1 ? "día restante" : "días restantes"}
          </span>
        </div>

        {/* ── Separador vertical (solo desktop) ──────────────── */}
        <div className="hidden h-16 w-px bg-slate-700 md:block" />

        {/* ── Mensaje motivacional ─────────────────────────── */}
        <div className="flex items-start gap-3 text-center md:text-left">
          <MotivationalIcon
            className={`mt-0.5 h-5 w-5 shrink-0 ${motivational.accentColor}`}
          />
          <div>
            <p className="text-sm font-semibold text-white">
              Cuenta regresiva al examen
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {motivational.message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
