// ============================================================
// types/adapt.ts — Tipos para la lógica adaptativa
// ============================================================
// Define el contrato entre QuizCard y POST /api/sessions/[id]/adapt.
//
// SEPARACIÓN DE RESPONSABILIDADES:
//   - /evaluate  → mide (score, acción, feedback)
//   - /adapt     → actúa (actualiza topic_progress, crea sesiones)
//
// QuizCard llama primero a /evaluate, y si recibe 200, llama
// automáticamente a /adapt con los datos necesarios.
// ============================================================

import type { ActionTaken } from "./database";

// ──────────────────────────────────────────────────────────────
// Response: Lo que el servidor retorna después de adaptar
// ──────────────────────────────────────────────────────────────

/**
 * Respuesta de la adaptación del plan.
 *
 * Incluye los IDs de sesiones creadas (si las hubo) y la nueva
 * fecha estimada de fin (si el plan fue extendido). Estos datos
 * son usados por SE-08 para mostrar el FeedbackPanel completo.
 */
export interface AdaptResponse {
  /** Acción que se ejecutó */
  action: ActionTaken;
  /**
   * IDs de sesiones de refuerzo creadas (vacío si action=advance).
   * Puede haber 1 (reinforce) o 2+ (restructure).
   */
  reinforcement_session_ids: string[];
  /**
   * Nueva fecha estimada de fin del plan (ISO string).
   * Solo presente si action=restructure y el plan fue extendido.
   */
  new_estimated_end_date: string | null;
  /** true si /adapt detectó que ya había aplicado estos cambios antes */
  already_processed: boolean;
  /** Mensaje descriptivo del resultado de la adaptación */
  message: string;
}
