"use client";

import { X, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import type { OnboardingStep } from "@/lib/onboarding";

interface OnboardingCardProps {
  step: OnboardingStep;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
  positionStyle?: React.CSSProperties;
}

export function OnboardingCard({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onFinish,
  positionStyle,
}: OnboardingCardProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;
  const progressPercent = Math.round(((currentIndex + 1) / totalSteps) * 100);

  return (
    <div
      style={positionStyle}
      className="fixed z-[9999] w-[340px] sm:w-[380px] rounded-2xl border border-slate-700/80 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in zoom-in-95 text-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 light:border-slate-200 light:bg-white light:text-slate-900"
    >
      {/* ── Top Bar: Progreso + Botón Omitir ── */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 dark:border-slate-800 light:border-slate-100">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800 dark:bg-slate-800 light:bg-slate-200">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 light:text-slate-500">
            {currentIndex + 1} / {totalSteps}
          </span>
        </div>

        <button
          onClick={onSkip}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer dark:hover:bg-slate-800 dark:hover:text-white light:hover:bg-slate-100 light:hover:text-slate-800"
        >
          <span>Omitir tour</span>
          <X className="size-3.5" />
        </button>
      </div>

      {/* ── Contenido Principal ── */}
      <div className="space-y-2 mb-5">
        <h3 className="text-base font-bold text-emerald-400 dark:text-emerald-400 light:text-emerald-600">
          {step.title}
        </h3>
        <p className="text-xs leading-relaxed text-slate-300 dark:text-slate-300 light:text-slate-600">
          {step.description}
        </p>
      </div>

      {/* ── Footer / Acciones ── */}
      <div className="flex items-center justify-between pt-1">
        <div>
          {!isFirst ? (
            <button
              onClick={onPrev}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer dark:text-slate-300 dark:hover:bg-slate-800 light:text-slate-600 light:hover:bg-slate-100"
            >
              <ArrowLeft className="size-3.5" />
              Anterior
            </button>
          ) : (
            <button
              onClick={onSkip}
              className="text-xs font-medium text-slate-500 hover:text-slate-400 transition-colors cursor-pointer dark:text-slate-500 light:text-slate-400"
            >
              Saltar
            </button>
          )}
        </div>

        <div>
          {!isLast ? (
            <button
              onClick={onNext}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition-colors cursor-pointer"
            >
              <span>Siguiente</span>
              <ArrowRight className="size-3.5" />
            </button>
          ) : (
            <button
              onClick={onFinish}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="size-3.5" />
              <span>¡Entendido!</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
