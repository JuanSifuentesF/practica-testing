// ============================================================
// types/dashboard.ts — Tipos para el API de métricas del Dashboard
// ============================================================
// Estos tipos definen la estructura del JSON que retorna
// GET /api/dashboard/metrics.
//
// PRINCIPIO DE DISEÑO:
//   Cada tipo corresponde a una "sección" visual del dashboard:
//   - SessionScore → alimenta la gráfica de scores (DA-02)
//   - TopicStatusCount → alimenta las tarjetas de estado (DA-03)
//   - TimeComparison → alimenta la tabla de tiempos (DA-04)
//   - DashboardMetrics → el contenedor maestro de todo
//
// ¿Por qué tipos separados y no un solo tipo grande?
//   Porque cada componente del dashboard solo necesita UNA parte
//   de las métricas. Tipos granulares permiten tipar los props
//   de cada componente con precisión (ej. LineChart recibe
//   SessionScore[], no todo el DashboardMetrics).
// ============================================================

import type { PracticeExerciseType } from "./practice";

import type {
  SessionType,
  ActionTaken,
  StudyPlanStatus,
  LevelK,
  TopicProgressStatus,
} from "./database";

// ──────────────────────────────────────────────────────────────
// Score de una sesión individual (para la gráfica de líneas)
// ──────────────────────────────────────────────────────────────

/**
 * Representa el score de UNA sesión completada.
 * Se usa en la gráfica de scores por sesión (DA-02).
 *
 * ¿Por qué incluimos topic_codes?
 *   Para que el tooltip de la gráfica pueda mostrar QUÉ tópicos
 *   se evaluaron en esa sesión, dando contexto al score.
 *
 * ¿Por qué action_taken?
 *   Para que la gráfica pueda colorear puntos según la decisión
 *   del sistema adaptativo (verde=advance, amarillo=reinforce,
 *   rojo=restructure).
 */
export interface SessionScore {
  /** UUID de la sesión — útil como key en React */
  session_id: string;

  /** Número de día en el plan (1-based) — eje X de la gráfica */
  day_number: number;

  /** Tipo de sesión — para filtrar o agrupar en la gráfica */
  session_type: SessionType;

  /** Score obtenido (0-100) — eje Y de la gráfica */
  score_percent: number;

  /** Decisión del sistema adaptativo para esta sesión */
  action_taken: ActionTaken | null;

  /** Fecha de completación (ISO string) — tooltip de la gráfica */
  completed_at: string;

  /** Códigos de tópicos evaluados — tooltip contextual */
  topic_codes: string[];
}

// ──────────────────────────────────────────────────────────────
// Conteo de tópicos por estado (para tarjetas y donut chart)
// ──────────────────────────────────────────────────────────────

/**
 * Conteo agregado de tópicos por cada estado posible.
 * Alimenta las tarjetas de resumen y el gráfico circular (DA-03).
 *
 * INVARIANTE: pending + in_progress + mastered + failed === total
 *
 * ¿Por qué un conteo y no el array de tópicos?
 *   Las tarjetas del dashboard solo necesitan NÚMEROS, no los
 *   detalles de cada tópico. Enviar solo conteos reduce el
 *   tamaño del JSON y simplifica el rendering.
 */
export interface TopicStatusCount {
  /** Tópicos que el estudiante aún no ha intentado */
  pending: number;

  /** Tópicos que se están estudiando (al menos 1 intento, no mastered) */
  in_progress: number;

  /** Tópicos que el estudiante ya domina (score ≥ 70 en ISTQB) */
  mastered: number;

  /** Tópicos que el estudiante falló (score bajo, necesita refuerzo) */
  failed: number;

  /** Total de tópicos en el plan (para calcular porcentajes) */
  total: number;
}

// ──────────────────────────────────────────────────────────────
// Tópico individual para el heatmap (DA-03)
// ──────────────────────────────────────────────────────────────

/**
 * DTO público para pintar una celda del heatmap.
 *
 * No es igual a TopicProgressRow porque intencionalmente NO expone:
 * - id
 * - user_id
 * - study_plan_id
 *
 * El componente solo necesita información visual y pedagógica.
 */
export interface TopicHeatmapItem {
  /** Código oficial del tópico. Ej: "FL-4.2.1" */
  topic_code: string;

  /** Nombre legible extraído del syllabus o del PDF */
  topic_name: string | null;

  /** Nivel cognitivo ISTQB: K1, K2 o K3 */
  level_k: LevelK | null;

  /** Número de veces que el estudiante fue evaluado en este tópico */
  attempts: number;

  /** Mejor score histórico del tópico (0-100) */
  best_score: number;

  /** Score más reciente del tópico (0-100) */
  last_score: number;

  /** Estado actual del progreso: pending, in_progress, mastered, failed */
  status: TopicProgressStatus;

  /** Fecha en que se dominó el tópico, si aplica */
  mastered_at: string | null;

  /** Última actualización del progreso */
  updated_at: string;
}

// ──────────────────────────────────────────────────────────────
// Comparación de tiempo real vs estimado (para tabla de tiempos)
// ──────────────────────────────────────────────────────────────

/**
 * Compara el tiempo estimado vs el tiempo real de cada sesión.
 * Se usa en la tabla de gestión de tiempo (DA-04 futuro).
 *
 * ¿Cómo calculamos actual_minutes?
 *   started_at y completed_at son timestamps ISO en la tabla sessions.
 *   La diferencia en minutos nos da el tiempo real invertido.
 *   Si alguno es null, actual_minutes será null.
 *
 * ¿De dónde viene estimated_minutes?
 *   Del campo duration_minutes de la sesión, que se establece
 *   al crear el plan (valor default: 90 minutos por sesión).
 */
export interface TimeComparison {
  /** UUID de la sesión */
  session_id: string;

  /** Día del plan — para ordenar en la tabla */
  day_number: number;

  /** Tipo de sesión — para agrupar o filtrar */
  session_type: SessionType;

  /** Minutos estimados (de duration_minutes en la sesión) */
  estimated_minutes: number;

  /** Minutos reales invertidos (calculado de started_at → completed_at) */
  actual_minutes: number | null;
}

// ──────────────────────────────────────────────────────────────
// Contenedor maestro: TODAS las métricas del dashboard
// ──────────────────────────────────────────────────────────────

/**
 * Objeto completo que retorna GET /api/dashboard/metrics.
 * Contiene TODO lo que el dashboard necesita en una sola respuesta.
 *
 * PRINCIPIO: "Un fetch, todo el dashboard."
 *   En lugar de hacer 5 fetch desde el frontend (uno por gráfica),
 *   hacemos UNO solo que retorna todo. Esto reduce:
 *   - Latencia (1 roundtrip vs 5)
 *   - Complejidad del estado del frontend
 *   - Posibilidad de datos inconsistentes entre componentes
 *
 * ¿Por qué métricas derivadas (completion_percent, current_streak)?
 *   Calcularlas en el servidor (no en el frontend) garantiza que:
 *   1. La lógica de cálculo está en UN solo lugar (DRY)
 *   2. Todos los clientes (web, mobile futuro) ven los mismos números
 *   3. No enviamos datos crudos innecesarios al navegador
 */
export interface PracticeStats {
  total_exercises: number;
  completed_exercises: number;
  avg_score: number | null;
  by_type: Record<PracticeExerciseType, number>;
  most_practiced_type: PracticeExerciseType | null;
}

export interface DashboardMetrics {
  // ─── Datos de series (arrays) ──────────────────────────────

  /** Scores de todas las sesiones completadas, ordenados cronológicamente */
  scores_by_session: SessionScore[];

  /** Comparación de tiempo real vs estimado por sesión */
  time_comparison: TimeComparison[];

  /** Tópicos detallados para el heatmap por estado (DA-03) */
  topic_progress: TopicHeatmapItem[];

  // ─── Datos agregados ──────────────────────────────────────

  /** Conteo de tópicos por estado */
  topic_status: TopicStatusCount;

  /** Metricas Practice del documento asociado al plan activo. */
  practice_stats: PracticeStats;

  // ─── Datos del plan ────────────────────────────────────────

  /** Fecha estimada de finalización del plan (ISO date string) */
  estimated_end_date: string;

  /** Fecha de inicio del plan (ISO date string) */
  start_date: string;

  /** Número de días objetivo del plan (1-30) */
  objective_days: number;

  /** Estado actual del plan: active, completed, abandoned */
  plan_status: StudyPlanStatus;

  // ─── Métricas derivadas (calculadas en el servidor) ────────

  /** Porcentaje de tópicos mastered sobre el total (0-100) */
  completion_percent: number;

  /** Total de sesiones en el plan (completadas + pendientes + activas) */
  total_sessions: number;

  /** Número de sesiones con status = 'completed' */
  completed_sessions: number;

  /**
   * Racha actual: días consecutivos con al menos 1 sesión completada,
   * contados desde hoy hacia atrás. Si hoy no hay sesión → 0.
   *
   * REGLA DE NEGOCIO:
   *   - Día 5 completado, Día 4 completado, Día 3 sin completar
   *     → streak = 2 (Día 4 y Día 5)
   *   - Si no hay sesiones completadas → streak = 0
   */
  current_streak: number;
}

// ──────────────────────────────────────────────────────────────
// Respuesta del API (wrapper para consistencia)
// ──────────────────────────────────────────────────────────────

/**
 * Respuesta exitosa de GET /api/dashboard/metrics.
 * El wrapper { metrics: ... } permite agregar campos adicionales
 * en el futuro (ej. { metrics, notifications, announcements })
 * sin breaking changes.
 */
export interface DashboardMetricsResponse {
  metrics: DashboardMetrics;
}

/**
 * Respuesta cuando el usuario no tiene un plan activo.
 * El frontend mostrará un estado vacío con call-to-action.
 */
export interface NoPlanResponse {
  metrics: null;
  message: string;
}
