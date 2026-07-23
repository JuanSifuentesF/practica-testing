// ============================================================
// components/session/session-timer.tsx
// Timer de cuenta regresiva para la sesión de estudio
// ============================================================
// TIPO: Client Component (necesita useState + useEffect + setInterval)
//
// PROPS:
//   - durationMinutes: number — Duración total en minutos (default 45)
//   - onTimeUp?: () => void — Callback cuando el tiempo se agota
//   - autoStart?: boolean — Si el timer empieza automáticamente
//
// COMPORTAMIENTO:
//   - Muestra MM:SS en formato grande
//   - Cambia de color cuando quedan < 5 minutos (amarillo)
//   - Cambia de color cuando quedan < 1 minuto (rojo)
//   - Al llegar a 0:00, muestra "Tiempo agotado" pero NO bloquea
//   - El timer se puede pausar/reanudar con un click
//
// ¿POR QUÉ NO USAR Date.now() EN EL RENDER INICIAL?
//   Porque este componente se renderiza primero en el servidor (SSR).
//   Si usamos Date.now() en el cuerpo del componente, el servidor
//   genera un timestamp diferente al del cliente, causando un
//   "hydration mismatch" error de React.
//
//   Solución: mantener un snapshot estable durante la hidratación y
//   arrancar el intervalo únicamente desde un efecto del cliente.
// ============================================================

"use client";

import {
  useEffect,
  useEffectEvent,
  useState,
  useSyncExternalStore,
} from "react";
import { Clock, Pause, Play, AlertTriangle } from "lucide-react";

interface SessionTimerProps {
  durationMinutes?: number;
  onTimeUp?: () => void;
  autoStart?: boolean;
}

function subscribeToHydration() {
  return () => {};
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

export function SessionTimer({
  durationMinutes = 45,
  onTimeUp,
  autoStart = true,
}: SessionTimerProps) {
  // ─── Estado ───────────────────────────────────────────────
  // secondsLeft: tiempo restante en segundos
  // isRunning: si el timer está corriendo
  // hasFinished: si el timer llegó a 0
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [hasFinished, setHasFinished] = useState(false);
  const isReady = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  // Effect Event mantiene el callback más reciente sin reiniciar el intervalo.
  const notifyTimeUp = useEffectEvent(() => {
    onTimeUp?.();
  });

  // ─── Efecto: countdown ────────────────────────────────────
  // setInterval que decrementa secondsLeft cada segundo.
  // Se limpia automáticamente cuando el componente se desmonta
  // o cuando isRunning cambia a false.
  useEffect(() => {
    if (!isRunning || hasFinished) return;

    const intervalId = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          setIsRunning(false);
          setHasFinished(true);
          // Llamar al callback en el siguiente tick para evitar
          // actualizar estado dentro de un setState
          setTimeout(() => notifyTimeUp(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup: limpiar el interval cuando el efecto se re-ejecuta
    // o el componente se desmonta. Sin esto, tendríamos memory leaks
    // y el timer correría el doble de rápido.
    return () => clearInterval(intervalId);
  }, [isRunning, hasFinished]);

  // ─── Toggle play/pause ────────────────────────────────────
  function toggleTimer() {
    if (!hasFinished) {
      setIsRunning((prev) => !prev);
    }
  }

  // ─── Formatear tiempo ─────────────────────────────────────
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // ─── Calcular progreso para la barra ──────────────────────
  const totalSeconds = durationMinutes * 60;
  const progressPercent = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  // ─── Determinar color según tiempo restante ───────────────
  // Verde → Amarillo (< 5 min) → Rojo (< 1 min) → Gris (terminado)
  let colorClass = "text-emerald-400";
  let barColor = "bg-emerald-500";
  let bgGlow = "";

  if (hasFinished) {
    colorClass = "text-slate-500";
    barColor = "bg-slate-600";
  } else if (secondsLeft < 60) {
    colorClass = "text-red-400";
    barColor = "bg-red-500";
    bgGlow = "shadow-[0_0_15px_rgba(239,68,68,0.2)]";
  } else if (secondsLeft < 300) {
    colorClass = "text-amber-400";
    barColor = "bg-amber-500";
  }

  // ─── Render previo a hidratación ──────────────────────────
  // Mostrar el tiempo inicial estático para evitar hydration mismatch.
  // El timer real empieza solo después de useEffect.
  if (!isReady) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
        <Clock className="h-5 w-5 text-emerald-400" />
        <span className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
          {String(durationMinutes).padStart(2, "0")}:00
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 transition-shadow duration-500 ${bgGlow}`}
    >
      <div className="flex items-center gap-3">
        {/* ── Ícono de estado ──────────────────────────────── */}
        {hasFinished ? (
          <AlertTriangle className="h-5 w-5 text-slate-500 shrink-0" />
        ) : (
          <Clock className={`h-5 w-5 ${colorClass} shrink-0`} />
        )}

        {/* ── Tiempo ──────────────────────────────────────── */}
        <span
          className={`font-mono text-2xl font-bold tabular-nums ${colorClass}`}
        >
          {hasFinished ? "00:00" : formattedTime}
        </span>

        {/* ── Botón pause/play ────────────────────────────── */}
        {!hasFinished && (
          <button
            type="button"
            onClick={toggleTimer}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            aria-label={isRunning ? "Pausar timer" : "Reanudar timer"}
          >
            {isRunning ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* ── Label de estado ─────────────────────────────── */}
        {hasFinished && (
          <span className="ml-auto text-xs text-slate-500">
            Tiempo agotado — puedes seguir leyendo
          </span>
        )}
      </div>

      {/* ── Barra de progreso ─────────────────────────────── */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-linear`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
