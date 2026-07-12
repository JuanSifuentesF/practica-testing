"use client";

// ─────────────────────────────────────────────────────────────────
// [topicCode]/_components/exercise-prompt.tsx
// Muestra el escenario del ejercicio generado por la IA.
//
// TIPO: Client Component (presentational).
//
// MUESTRA:
//   - Escenario: descripción del sistema bajo prueba
//   - Tarea: qué debe hacer el estudiante
//   - Restricciones: lista numerada de constraints
//   - Criterios de evaluación: lista de criterios
//
// RECIBE: El objeto ExerciseScenario generado por PL-05.
// ─────────────────────────────────────────────────────────────────

import { Target, ListChecks, AlertCircle, ClipboardList } from "lucide-react";
import type { ExerciseScenario } from "@/types/practice";

// ─── Props ────────────────────────────────────────────────────

export interface ExercisePromptProps {
  /** Escenario completo del ejercicio (viene de PracticeExercise.scenario) */
  scenario: ExerciseScenario;
}

// ─── Componente ───────────────────────────────────────────────

export function ExercisePrompt({ scenario }: ExercisePromptProps) {
  return (
    <div className="rounded-xl border border-brand-500/20 bg-brand-950/20 p-5 space-y-4">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-2">
        <Target className="size-5 text-brand-400" />
        <h2 className="text-base font-semibold text-white">
          Ejercicio Práctico
        </h2>
      </div>

      {/* ─── Escenario (sistema bajo prueba) ─── */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          Escenario
        </h3>
        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
          {scenario.scenario}
        </p>
      </div>

      {/* ─── Tarea (qué debe hacer el estudiante) ─── */}
      <div className="rounded-lg bg-brand-500/10 border border-brand-500/20 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <ClipboardList className="size-4 text-brand-400" />
          <h3 className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
            Tu Tarea
          </h3>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">
          {scenario.task_description}
        </p>
      </div>

      {/* ─── Restricciones ─── */}
      {scenario.constraints.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="size-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Restricciones
            </h3>
          </div>
          <ul className="space-y-1.5">
            {scenario.constraints.map((constraint, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-slate-300"
              >
                <span className="text-amber-500 font-mono text-xs mt-0.5 shrink-0">
                  {index + 1}.
                </span>
                {constraint}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Criterios de evaluación ─── */}
      {scenario.evaluation_criteria.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="size-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Criterios de Evaluación
            </h3>
          </div>
          <ul className="space-y-1.5">
            {scenario.evaluation_criteria.map((criterion, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-slate-300"
              >
                <span className="text-emerald-500 mt-1 shrink-0">•</span>
                {criterion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
