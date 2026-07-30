"use client";

import { HelpCircle } from "lucide-react";
import { resetOnboardingState } from "@/lib/onboarding";

export function OnboardingHelpButton() {
  function handleRestart() {
    resetOnboardingState();
    window.dispatchEvent(new CustomEvent("istqb-restart-onboarding"));
  }

  return (
    <button
      onClick={handleRestart}
      title="Reiniciar tour guiado de la aplicación"
      className="fixed bottom-5 right-5 z-[9980] flex size-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-300 shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:border-emerald-500/50 hover:bg-slate-800 hover:text-emerald-400 cursor-pointer dark:bg-slate-900/90 dark:text-slate-300 light:bg-white/90 light:text-slate-700 light:border-slate-300 light:hover:bg-slate-100"
    >
      <HelpCircle className="size-5" />
    </button>
  );
}
