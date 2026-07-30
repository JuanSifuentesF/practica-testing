// ============================================================
// session-card.tsx — Tarjeta visual de una sesión de estudio
// ============================================================
// TIPO: Server Component
//
// RESPONSABILIDAD ÚNICA:
//   Renderizar UNA sesión de estudio con toda su información:
//   - Tipo (mañana/noche) con ícono contextual
//   - Título del plan_json
//   - Badge de dificultad (Fácil/Medio/Difícil)
//   - Duración en minutos
//   - Tópicos como pills/badges
//   - Método de enseñanza
//   - Estado (pendiente/en progreso/completada/saltada)
//   - Hora programada (si existe)
//   - Botón "Empezar sesión" (si es la primera pendiente)
//     con query param session_id para que SE-01 pueda cargar la sesión.
//
// DECISIÓN DE DISEÑO:
//   ¿Por qué NO es Client Component?
//   Aunque tiene un botón "Empezar", ese botón es un <Link> de
//   Next.js (navegación), no un onClick con estado. Los Links
//   funcionan perfectamente en Server Components.
//
// DATOS:
//   Combina datos de la tabla `sessions` (persisted) con datos
//   del `plan_json` (metadata adicional como difficulty y title).
//   Esta combinación se hace en el componente padre (PlanPreview).
// ============================================================

import Link from "next/link";
import {
  Sun,
  Moon,
  RefreshCw,
  FileCheck,
  Clock,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Tipos ────────────────────────────────────────────────────

type SessionCardProps = {
  /** ID de la sesión (UUID) */
  sessionId: string;
  /** Tipo de sesión: "morning" | "night" | "reinforcement" | "mock_exam" */
  sessionType: string;
  /** Título de la sesión (del plan_json) */
  title: string;
  /** Dificultad: "easy" | "medium" | "hard" (del plan_json) */
  difficulty: string | undefined;
  /** Duración en minutos */
  durationMinutes: number;
  /** Códigos de tópicos (ej. ["FL-1.1.1", "FL-1.1.2"]) */
  topicCodes: string[];
  /** Método de enseñanza: "theory" | "examples" | "analogies" */
  methodUsed: string;
  /** Estado: "pending" | "active" | "completed" | "skipped" */
  status: string;
  /** Hora programada (ISO timestamp o null) */
  scheduledAt: string | null;
  /** Puntuación obtenida (0-100 o null si no completada) */
  scorePercent: number | null;
  /** Si esta es la primera sesión pendiente del plan */
  isFirstPending: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Retorna el ícono y la etiqueta para cada tipo de sesión.
 *
 * Los íconos de lucide-react son componentes React. Al retornarlos
 * como parte de un objeto, podemos usarlos dinámicamente:
 *   const { icon: Icon } = getSessionTypeInfo("morning");
 *   <Icon className="h-4 w-4" />
 */
function getSessionTypeInfo(sessionType: string) {
  switch (sessionType) {
    case "morning":
      return {
        label: "Mañana",
        icon: Sun,
        color: "text-amber-400",
      };
    case "night":
      return {
        label: "Noche",
        icon: Moon,
        color: "text-indigo-400",
      };
    case "reinforcement":
      return {
        label: "Refuerzo",
        icon: RefreshCw,
        color: "text-orange-400",
      };
    case "mock_exam":
      return {
        label: "Simulacro",
        icon: FileCheck,
        color: "text-purple-400",
      };
    default:
      return {
        label: sessionType,
        icon: BookOpen,
        color: "text-muted-foreground",
      };
  }
}

/**
 * Retorna los estilos del badge de dificultad.
 * Cada dificultad tiene su paleta de colores única.
 */
function getDifficultyDisplay(difficulty?: string) {
  switch (difficulty) {
    case "easy":
      return {
        label: "Fácil",
        className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      };
    case "medium":
      return {
        label: "Medio",
        className: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      };
    case "hard":
      return {
        label: "Difícil",
        className: "bg-red-500/20 text-red-300 border-red-500/30",
      };
    default:
      return null;
  }
}

/**
 * Retorna el ícono y texto para el estado de la sesión.
 */
function getStatusDisplay(status: string, scorePercent: number | null) {
  switch (status) {
    case "pending":
      return {
        text: "Pendiente",
        emoji: "⏳",
        className: "text-muted-foreground",
      };
    case "active":
      return {
        text: "En progreso",
        emoji: "▶️",
        className: "text-amber-400",
      };
    case "completed":
      return {
        text:
          scorePercent !== null
            ? `Completada (${scorePercent}%)`
            : "Completada",
        emoji: "✅",
        className: "text-emerald-400",
      };
    case "skipped":
      return {
        text: "Saltada",
        emoji: "⏭️",
        className: "text-muted-foreground",
      };
    default:
      return {
        text: status,
        emoji: "❓",
        className: "text-muted-foreground",
      };
  }
}

/**
 * Formatea el método de enseñanza a español.
 */
function getMethodLabel(method: string): string {
  switch (method) {
    case "theory":
      return "Teoría";
    case "examples":
      return "Ejemplos";
    case "analogies":
      return "Analogías";
    default:
      return method;
  }
}

/**
 * Formatea una hora ISO a formato legible (ej. "6:00 AM", "10:00 PM").
 *
 * Usa Intl.DateTimeFormat con hour12: true para formato AM/PM.
 * Si scheduledAt es null, retorna null (sin hora programada).
 */
function formatTime(scheduledAt: string | null): string | null {
  if (!scheduledAt) return null;
  try {
    return new Intl.DateTimeFormat("es-MX", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(scheduledAt));
  } catch {
    return null;
  }
}

// ─── Componente ───────────────────────────────────────────────

export function SessionCard({
  sessionId,
  sessionType,
  title,
  difficulty,
  durationMinutes,
  topicCodes,
  methodUsed,
  status,
  scheduledAt,
  scorePercent,
  isFirstPending,
}: SessionCardProps) {
  // Pre-calcular datos de display antes del JSX.
  // Esto mantiene el template limpio y legible.
  const typeInfo = getSessionTypeInfo(sessionType);
  const difficultyDisplay = getDifficultyDisplay(difficulty);
  const statusDisplay = getStatusDisplay(status, scorePercent);
  const formattedTime = formatTime(scheduledAt);
  const TypeIcon = typeInfo.icon;

  return (
    <article
      className={`
        rounded-xl border p-5 transition-all duration-200
        ${
          isFirstPending
            ? // La primera sesión pendiente tiene un borde brillante y
              // un brillo sutil para atraer la atención del usuario.
              // ring-1 agrega un anillo exterior (como un segundo borde).
              "border-emerald-500/50 bg-emerald-950/20 ring-1 ring-emerald-500/20 hover:border-emerald-400/70"
            : status === "completed"
              ? // Las sesiones completadas tienen un estilo más tenue
                // para indicar que ya no requieren atención.
                "border-border/60 bg-card/30 opacity-75"
              : // Sesiones normales (pendientes que no son la primera).
                "border-border bg-card/50 hover:border-border/80"
        }
      `}
    >
      {/* ── Fila 1: Tipo + Título + Badges ─────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Tipo de sesión con ícono y hora */}
          <div className="flex items-center gap-2">
            <TypeIcon className={`h-4 w-4 ${typeInfo.color}`} />
            <span
              className={`text-xs font-medium uppercase tracking-wide ${typeInfo.color}`}
            >
              {typeInfo.label}
            </span>
            {/* Hora programada (si existe) */}
            {formattedTime && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formattedTime}
                </span>
              </>
            )}
          </div>

          {/* Título de la sesión */}
          <h3 className="mt-1.5 text-base font-semibold text-foreground">{title}</h3>
        </div>

        {/* Badges de dificultad y duración */}
        <div className="flex shrink-0 items-center gap-2">
          {difficultyDisplay && (
            <Badge variant="outline" className={difficultyDisplay.className}>
              {difficultyDisplay.label}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="border-border bg-muted/50 text-muted-foreground"
          >
            {durationMinutes} min
          </Badge>
        </div>
      </div>

      {/* ── Fila 2: Tópicos como pills ─────────────────────── */}
      {/*
        flex-wrap: si los tópicos no caben en una línea,
        saltan a la siguiente línea automáticamente.
        gap-1.5: espacio reducido entre pills para que sean compactas.
      */}
      {topicCodes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {topicCodes.map((code) => (
            <span
              key={code}
              className="rounded-full border border-emerald-900/60
                         bg-emerald-950/40 px-2 py-0.5 text-xs
                         font-medium text-emerald-300"
            >
              {code}
            </span>
          ))}
        </div>
      )}

      {/* ── Fila 3: Método + Estado ────────────────────────── */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Método: {getMethodLabel(methodUsed)}
        </span>
        <span className={statusDisplay.className}>
          {statusDisplay.emoji} {statusDisplay.text}
        </span>
      </div>

      {/* ── Fila 4: Botón de acción (condicional) ─────────────── */}
      {isFirstPending ? (
        <Link
          href={`/session?session_id=${sessionId}`}
          className="mt-4 flex w-full items-center justify-center gap-2
                     rounded-lg bg-emerald-500 px-4 py-2.5 text-sm
                     font-semibold text-slate-950 transition-colors
                     hover:bg-emerald-400"
        >
          {status === "active" ? "Continuar sesión" : "Empezar sesión"}
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : status === "completed" ? (
        <Link
          href={`/session?session_id=${sessionId}`}
          className="mt-4 flex w-full items-center justify-center gap-2
                     rounded-lg border border-border bg-muted/60 px-4 py-2 text-xs
                     font-medium text-muted-foreground transition-colors
                     hover:bg-muted hover:text-foreground"
        >
          Revisar sesión
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </article>
  );
}
