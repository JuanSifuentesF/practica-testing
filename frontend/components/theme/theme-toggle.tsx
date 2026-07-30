"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Cambiar a Modo Claro (Estudio Diurno)" : "Cambiar a Modo Oscuro (Estudio Nocturno)"}
      className="flex size-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 transition-all hover:bg-slate-700 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white light:border-emerald-200 light:bg-white light:text-emerald-700 light:shadow-sm light:hover:-translate-y-px light:hover:border-emerald-300 light:hover:bg-emerald-50 light:hover:text-emerald-800"
    >
      {theme === "dark" ? (
        <Sun className="size-4 text-amber-400" />
      ) : (
        <Moon className="size-4 text-indigo-600" />
      )}
    </button>
  );
}
