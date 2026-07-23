"use client";

// ============================================================
// components/dashboard/score-chart.tsx — Gráfica de Scores por Sesión
// ============================================================
// TIPO: Client Component ('use client')
//
// ¿POR QUÉ CLIENT COMPONENT?
//   Recharts renderiza SVGs interactivos con event listeners
//   (mouseover para tooltips, click handlers, etc.). Esto
//   requiere acceso al DOM del navegador, imposible en Server
//   Components.
//
// RESPONSABILIDADES:
//   1. Recibir scores_by_session[] como prop
//   2. Renderizar una gráfica de líneas (LineChart)
//   3. Colorear cada punto según action_taken
//   4. Mostrar línea de referencia en 70% (umbral ISTQB)
//   5. Tooltip personalizado con contexto de la sesión
//
// PRINCIPIO DE DISEÑO:
//   Este componente es PURO de presentación. No hace fetches,
//   no maneja autenticación, no conoce rutas de API. Solo
//   recibe datos y los visualiza. Esto facilita testing y
//   reutilización.
//
// FUENTE DE DATOS:
//   Creado en DA-01: GET /api/dashboard/metrics
//   Campo consumido: metrics.scores_by_session (SessionScore[])
// ============================================================

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { SessionScore } from "@/types/dashboard";

// ──────────────────────────────────────────────────────────────
// Props del componente
// ──────────────────────────────────────────────────────────────

interface ScoreChartProps {
  /** Array de scores por sesión, ya ordenado cronológicamente por DA-01 */
  data: SessionScore[];
}

// ──────────────────────────────────────────────────────────────
// Constantes de diseño
// ──────────────────────────────────────────────────────────────

/** Umbral de aprobación del ISTQB — 70% es el estándar internacional */
const PASSING_THRESHOLD = 70;

/**
 * Mapa de colores por acción del sistema adaptativo.
 * Estos colores coinciden con los del FeedbackPanel (SE-08)
 * para mantener consistencia visual en toda la app.
 */
const ACTION_COLORS: Record<string, string> = {
  advance: "#22c55e", // green-500 → aprobó y avanza
  reinforce: "#eab308", // yellow-500 → necesita refuerzo
  restructure: "#ef4444", // red-500 → necesita reestructuración
  default: "#94a3b8", // slate-400 → sin evaluación / legacy
};

/**
 * Etiquetas en español para el tipo de sesión.
 * Se usan en el tooltip para que el usuario entienda
 * qué tipo de sesión fue cada punto.
 */
const SESSION_TYPE_LABELS: Record<string, string> = {
  morning: "🌅 Mañana",
  night: "🌙 Noche",
  reinforcement: "🔄 Refuerzo",
  mock_exam: "📝 Simulacro",
};

/**
 * Etiquetas en español para la acción tomada.
 */
const ACTION_LABELS: Record<string, string> = {
  advance: "✅ Avanzar",
  reinforce: "⚠️ Refuerzo",
  restructure: "🔄 Reestructurar",
};

// ──────────────────────────────────────────────────────────────
// Funciones auxiliares
// ──────────────────────────────────────────────────────────────

/**
 * Obtiene el color del punto según la acción del sistema adaptativo.
 *
 * @param action - La acción tomada (advance, reinforce, restructure, o null)
 * @returns Color hexadecimal para el punto
 */
function getActionColor(action: string | null | undefined): string {
  if (!action) return ACTION_COLORS.default;
  return ACTION_COLORS[action] ?? ACTION_COLORS.default;
}

/**
 * Formatea la etiqueta del eje X.
 * Combina el número de día con el tipo de sesión para
 * dar contexto completo: "D1 AM", "D1 PM", "D2 AM", etc.
 *
 * @param entry - Entrada del dataset
 * @returns Etiqueta corta para el eje X
 */
function formatXAxisLabel(entry: SessionScore): string {
  const dayLabel = `D${entry.day_number}`;
  const typeShort =
    entry.session_type === "morning"
      ? "AM"
      : entry.session_type === "night"
        ? "PM"
        : entry.session_type === "reinforcement"
          ? "RF"
          : "EX";
  return `${dayLabel} ${typeShort}`;
}

/**
 * Formatea una fecha ISO en formato legible en español.
 * "2026-06-28T14:30:00.000Z" → "28 jun 2026, 14:30"
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

// ──────────────────────────────────────────────────────────────
// Tooltip personalizado
// ──────────────────────────────────────────────────────────────

/**
 * Tooltip que aparece al hacer hover sobre un punto de la gráfica.
 *
 * Recharts 3.x inyecta `active` y `payload` al invocar el renderer
 * pasado a `content`. TooltipContentProps describe ese contrato.
 *
 * DISEÑO:
 *   - Fondo oscuro semi-transparente con backdrop-blur (glassmorphism)
 *   - Información jerárquica: score grande → detalles abajo
 *   - Colores consistentes con el tema de la app
 */
function CustomTooltip({ active, payload }: TooltipContentProps) {
  // Si el tooltip no está activo o no hay datos, no renderizar nada.
  // Esto es el patrón estándar de Recharts para tooltips personalizados.
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Extraer los datos del primer punto del payload.
  // En una gráfica con una sola línea, payload siempre tiene 1 elemento.
  const data = payload[0]?.payload as SessionScore | undefined;

  if (!data) return null;

  // Obtener la etiqueta y color de la acción
  const actionLabel = data.action_taken
    ? (ACTION_LABELS[data.action_taken] ?? data.action_taken)
    : "Sin evaluar";

  const actionColor = getActionColor(data.action_taken);

  const sessionTypeLabel =
    SESSION_TYPE_LABELS[data.session_type] ?? data.session_type;

  return (
    // ─── Contenedor del tooltip ───
    // Glassmorphism: fondo semi-transparente + blur
    <div
      className="
        rounded-lg border border-slate-700
        bg-slate-900/95 backdrop-blur-sm
        px-4 py-3 shadow-xl
        min-w-[220px]
      "
    >
      {/* Score grande y prominente */}
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <span className="text-2xl font-bold" style={{ color: actionColor }}>
          {data.score_percent}%
        </span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${actionColor}20`,
            color: actionColor,
          }}
        >
          {actionLabel}
        </span>
      </div>

      {/* Detalles de la sesión */}
      <div className="space-y-1 text-xs text-slate-400">
        <div className="flex justify-between">
          <span>Sesión:</span>
          <span className="text-slate-200">
            Día {data.day_number} — {sessionTypeLabel}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Fecha:</span>
          <span className="text-slate-200">
            {formatDate(data.completed_at)}
          </span>
        </div>

        {/* Tópicos evaluados (si hay) */}
        {data.topic_codes.length > 0 && (
          <div className="pt-1 border-t border-slate-700/50">
            <span className="text-slate-500">Tópicos:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {data.topic_codes.map((code) => (
                <span
                  key={code}
                  className="
                    text-[10px] font-mono px-1.5 py-0.5
                    rounded bg-slate-800 text-slate-300
                  "
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Dot personalizado (punto de cada sesión en la línea)
// ──────────────────────────────────────────────────────────────

/**
 * Renderiza un punto (dot) personalizado en cada data point de la línea.
 *
 * Recharts pasa las coordenadas (cx, cy) y el payload completo
 * como props. Usamos el payload para determinar el color según
 * action_taken.
 *
 * DISEÑO:
 *   - Punto sólido con borde blanco para contraste
 *   - Tamaño más grande que el default (r=5 vs r=3)
 *   - Color semántico según la acción del sistema adaptativo
 */
interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: SessionScore;
}

function CustomDot({ cx, cy, payload }: CustomDotProps) {
  // Defensivo: Recharts puede llamar sin coordenadas válidas
  if (cx === undefined || cy === undefined || !payload) {
    return null;
  }

  const fillColor = getActionColor(payload.action_taken);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={fillColor}
      stroke="#1e293b"
      strokeWidth={2}
    />
  );
}

/**
 * Dot más grande que se muestra al hacer hover (activeDot).
 * Crea un efecto visual de "selección" sobre el punto.
 */
function ActiveDot({ cx, cy, payload }: CustomDotProps) {
  if (cx === undefined || cy === undefined || !payload) {
    return null;
  }

  const fillColor = getActionColor(payload.action_taken);

  return (
    <g>
      {/* Halo exterior semi-transparente (efecto glow) */}
      <circle cx={cx} cy={cy} r={10} fill={fillColor} fillOpacity={0.2} />
      {/* Punto principal más grande */}
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={fillColor}
        stroke="#f8fafc"
        strokeWidth={2}
      />
    </g>
  );
}

// ──────────────────────────────────────────────────────────────
// Componente principal: ScoreChart
// ──────────────────────────────────────────────────────────────

export function ScoreChart({ data }: ScoreChartProps) {
  // ─── Estado vacío ─────────────────────────────────────────
  // Si no hay datos, mostrar un placeholder elegante.
  // Esto ocurre cuando el usuario tiene plan pero no ha
  // completado ninguna sesión todavía.
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          📈 Evolución de Scores
        </h3>
        <div
          className="
            flex flex-col items-center justify-center
            h-[300px] text-center
          "
        >
          <div className="text-4xl mb-3">📊</div>
          <p className="text-slate-400 text-sm">
            Aún no tienes sesiones completadas.
          </p>
          <p className="text-slate-500 text-xs mt-1">
            Completa tu primera sesión de estudio para ver la gráfica de
            progreso.
          </p>
        </div>
      </div>
    );
  }

  // ─── Preparar datos para Recharts ────────────────────────
  // Recharts espera un array de objetos con las propiedades
  // que usaremos en los ejes y la línea. Nuestros SessionScore
  // ya tienen la forma correcta, pero agregamos la etiqueta
  // formateada para el eje X.
  const chartData = data.map((entry) => ({
    ...entry,
    // Etiqueta del eje X: "D1 AM", "D1 PM", "D2 AM", etc.
    label: formatXAxisLabel(entry),
  }));

  return (
    <div className="w-full rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      {/* ─── Encabezado de la sección ─── */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          📈 Evolución de Scores
        </h3>
        {/* Leyenda compacta de colores */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: ACTION_COLORS.advance }}
            />
            Avanzar
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: ACTION_COLORS.reinforce }}
            />
            Refuerzo
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: ACTION_COLORS.restructure }}
            />
            Reestructurar
          </span>
        </div>
      </div>

      {/* ─── Gráfica ─── */}
      {/* ResponsiveContainer adapta el ancho al 100% del padre.
          La altura es fija (300px) para consistencia visual.
          width="100%" es redundante con ResponsiveContainer pero
          TypeScript de Recharts lo requiere para el tipo. */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
        >
          {/* ─── Grid de fondo ─── */}
          {/* strokeDasharray="3 3" crea líneas punteadas sutiles.
              stroke con opacidad baja para no distraer de los datos. */}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#334155"
            strokeOpacity={0.5}
          />

          {/* ─── Eje X (sesiones) ─── */}
          {/* dataKey="label" usa las etiquetas que generamos arriba.
              tick con estilo personalizado para el tema oscuro.
              angle=-45 rota las etiquetas para que no se solapen
              cuando hay muchas sesiones. */}
          <XAxis
            dataKey="label"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={{ stroke: "#475569" }}
            axisLine={{ stroke: "#475569" }}
            angle={-45}
            textAnchor="end"
            height={60}
          />

          {/* ─── Eje Y (score 0-100%) ─── */}
          {/* domain={[0, 100]} fija el rango del eje.
              tickFormatter agrega "%" al número.
              Esto asegura que la escala siempre es la misma,
              incluso con pocos datos. */}
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={{ stroke: "#475569" }}
            axisLine={{ stroke: "#475569" }}
            tickFormatter={(value: number) => `${value}%`}
          />

          {/* ─── Línea de referencia en 70% ─── */}
          {/* El umbral de aprobación del ISTQB es 65% (el examen real),
              pero nuestro sistema usa 70% como umbral de "advance".
              La línea es roja punteada para ser visible pero no
              dominante. */}
          <ReferenceLine
            y={PASSING_THRESHOLD}
            stroke="#ef4444"
            strokeDasharray="8 4"
            strokeOpacity={0.6}
            label={{
              value: "70% — Umbral",
              position: "insideTopRight",
              fill: "#ef4444",
              fontSize: 11,
              fontWeight: 500,
            }}
          />

          {/* ─── Tooltip personalizado ─── */}
          {/* content={<CustomTooltip />} reemplaza el tooltip
              default de Recharts por nuestro componente personalizado.
              cursor={{ stroke: ... }} muestra una línea vertical
              al hacer hover. */}
          <Tooltip
            content={CustomTooltip}
            cursor={{
              stroke: "#64748b",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
          />

          {/* ─── Línea principal de datos ─── */}
          {/* type="monotone" crea curvas suaves entre puntos.
              dataKey="score_percent" conecta con la propiedad del dato.
              stroke="#3b82f6" es el color de la línea (blue-500).
              strokeWidth=2 para buena visibilidad.
              dot y activeDot usan nuestros componentes personalizados
              para colorear cada punto según action_taken. */}
          <Line
            type="monotone"
            dataKey="score_percent"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={<ActiveDot />}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* ─── Leyenda mobile (solo visible < sm) ─── */}
      <div className="flex sm:hidden items-center justify-center gap-3 mt-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: ACTION_COLORS.advance }}
          />
          Avanzar
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: ACTION_COLORS.reinforce }}
          />
          Refuerzo
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: ACTION_COLORS.restructure }}
          />
          Reestructurar
        </span>
      </div>
    </div>
  );
}
