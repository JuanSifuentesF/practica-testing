// ─────────────────────────────────────────────────────────────────
// app/api/plan/generate/route.ts
// Route Handler: lee los tópicos extraídos de un documento, envía
// un prompt a OpenAI para generar un plan de estudio personalizado,
// y retorna el plan al frontend.
//
// Método: POST
// Content-Type: application/json
// Body:
//   {
//     document_id: string,
//     config: {
//       objective_days: number,    // 1-30
//       morning_time: string,      // "HH:MM"
//       night_time: string,        // "HH:MM"
//     }
//   }
//
// Response (200):
//   {
//     plan: { sessions: [...], total_sessions, ... },
//     document_id: string,
//     total_sessions: number,
//     start_date: string,          // ISO date
//     estimated_end_date: string   // ISO date
//   }
//
// Response (401): { error: "No autenticado" }
// Response (400): { error: "Descripción del problema" }
// Response (403): { error: "No tienes permisos" }
// Response (404): { error: "Documento no encontrado" }
// Response (422): { error: "El documento no tiene tópicos extraídos" }
// Response (502): { error: "Error en la generación del plan" }
// Response (500): { error: "Error interno del servidor" }
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { executeAiJson } from "@/lib/ai/execute-json";
import { parseFirstJsonObject } from "@/lib/ai/json-object";
import { MAX_QUIZ_TOPICS_PER_SESSION } from "@/lib/sessions/quiz-limits";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TopicsJson, TopicEntry } from "@/types";

// El SDK de OpenAI y las variables server-only deben ejecutarse en Node.js.
// Declararlo evita sorpresas si el hosting intenta usar Edge Runtime.
export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────
// CONSTANTES Y TIPOS
// ─────────────────────────────────────────────────────────────────

function calcPlanTimeout(objectiveDays: number): number {
  return Math.min(180_000, Math.max(90_000, objectiveDays * 8_000));
}

// ─── Control de tamaño del prompt ────────────────────────────────
// El syllabus puede crecer entre versiones. Enviamos una vista compacta
// de cada tópico para controlar tokens/costo sin perder contexto útil.
const MAX_TOPICS_IN_PROMPT = 90;
const TOPIC_TEXT_PREVIEW_CHARS = 420;
const DEFAULT_SESSION_MINUTES = 90;

// ─── Validación de configuración ─────────────────────────────────
const MIN_DAYS = 1;
const MAX_DAYS = 30;
const MAX_PLAN_COMPLETION_TOKENS = 16_000;
const PLAN_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const PLAN_SESSION_TYPES = ["morning", "night"] as const;
const PLAN_DIFFICULTIES = ["easy", "medium", "hard"] as const;
const PLAN_LEVEL_ORDER = { K1: 1, K2: 2, K3: 3 } as const;

// ─── Tipo del body de la petición ────────────────────────────────
interface GeneratePlanBody {
  document_id: string;
  config: {
    objective_days: number;
    morning_time: string;
    night_time: string;
  };
}

// ─── Tipo de una sesión en el plan generado por OpenAI ────────────
export interface PlanSession {
  day_number: number;
  session_type: "morning" | "night";
  topic_codes: string[];
  method: "theory";
  estimated_duration_minutes: number;
  difficulty: "easy" | "medium" | "hard";
  title: string;
}

// ─── Tipo completo del plan generado por OpenAI ──────────────────
export interface GeneratedPlan {
  sessions: PlanSession[];
  total_sessions: number;
  total_days: number;
  topics_per_level: {
    K1: number;
    K2: number;
    K3: number;
  };
  plan_summary: string;
  coverage: {
    total_topics: number;
    covered_topic_codes: string[];
    omitted_topic_codes: string[];
  };
}

// ─── Type guard simple para validar objetos desconocidos ─────────
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
): value is T {
  return (
    typeof value === "string" && choices.some((choice) => choice === value)
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function calculatePlanDensity(
  totalTopics: number,
  totalSessions: number,
): { min: number; max: number } {
  return {
    min: Math.max(1, Math.floor(totalTopics / totalSessions)),
    max: Math.max(1, Math.ceil(totalTopics / totalSessions)),
  };
}

function getTopicChapter(code: string): number {
  const match = /^FL-(\d+)\./.exec(code);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function compareTopicEntries(
  [codeA, topicA]: [string, TopicEntry],
  [codeB, topicB]: [string, TopicEntry],
): number {
  return (
    getTopicChapter(codeA) - getTopicChapter(codeB) ||
    PLAN_LEVEL_ORDER[topicA.level_k] - PLAN_LEVEL_ORDER[topicB.level_k] ||
    codeA.localeCompare(codeB, undefined, { numeric: true })
  );
}

function getExpectedDifficulty(
  topicCodes: readonly string[],
  topics: TopicsJson,
): PlanSession["difficulty"] {
  const levels = topicCodes.map((code) => topics[code]?.level_k);
  if (levels.includes("K3")) return "hard";
  if (levels.includes("K2")) return "medium";
  return "easy";
}

function isPlanSession(value: unknown): value is PlanSession {
  if (!isRecord(value)) return false;

  return (
    isNonNegativeInteger(value.day_number) &&
    value.day_number >= 1 &&
    isStringChoice(value.session_type, PLAN_SESSION_TYPES) &&
    isStringArray(value.topic_codes) &&
    value.topic_codes.length > 0 &&
    value.method === "theory" &&
    value.estimated_duration_minutes === DEFAULT_SESSION_MINUTES &&
    isStringChoice(value.difficulty, PLAN_DIFFICULTIES) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.trim().length <= 80
  );
}

// ─── Parser dedicado del body ────────────────────────────────────
// Mantener esta lógica separada evita un Route Handler lleno de ifs
// inline y hace más fácil testear la validación en el futuro.
function parseBody(value: unknown): GeneratePlanBody | null {
  if (!isRecord(value)) return null;

  const { document_id, config } = value;
  if (
    typeof document_id !== "string" ||
    document_id.trim().length === 0 ||
    !isRecord(config) ||
    "model_provider" in config ||
    "modelProvider" in config
  ) {
    return null;
  }

  const { objective_days, morning_time, night_time } = config;
  if (
    typeof objective_days !== "number" ||
    !Number.isInteger(objective_days) ||
    objective_days < MIN_DAYS ||
    objective_days > MAX_DAYS ||
    typeof morning_time !== "string" ||
    !PLAN_TIME_PATTERN.test(morning_time) ||
    typeof night_time !== "string" ||
    !PLAN_TIME_PATTERN.test(night_time)
  ) {
    return null;
  }

  return {
    document_id: document_id.trim(),
    config: {
      objective_days,
      morning_time,
      night_time,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────

/**
 * Construye el system prompt para la generación del plan.
 *
 * El system prompt define:
 *   1. Rol del asistente (planificador ISTQB)
 *   2. Reglas del plan (orden K, agrupación, duración)
 *   3. Schema JSON exacto de la salida esperada
 *   4. Restricciones (no inventar tópicos, no mezclar capítulos)
 */
function buildSystemPrompt(): string {
  return `Eres un planificador de estudio especializado en la certificación ISTQB Foundation Level (CTFL v4.0).

Tu tarea es generar un plan de estudio intensivo y personalizado basado en los tópicos del syllabus ISTQB que se te proporcionarán.

## REGLAS DEL PLAN

1. **Sesiones diarias**: Cada día tiene exactamente 2 sesiones: una "morning" y una "night".
2. **Duración**: Cada sesión dura ${DEFAULT_SESSION_MINUTES} minutos (45 min de teoría + 45 min de quiz).
3. **Orden por nivel K dentro de cada capítulo**: Los tópicos deben ordenarse así:
   - Primero: tópicos K1 (recordar) → son los más fáciles
   - Después: tópicos K2 (entender/explicar) → dificultad media
   - Al final: tópicos K3 (aplicar) → los más difíciles
4. **Agrupación temática**: Los tópicos del mismo capítulo deben estar juntos.
   - Los tópicos FL-1.x.x van juntos (Chapter 1: Fundamentals of Testing)
   - Los tópicos FL-2.x.x van juntos (Chapter 2: Testing Throughout SDLC)
   - Y así sucesivamente hasta FL-6.x.x
   - NUNCA mezclar tópicos de capítulos no contiguos (ej: FL-1.x con FL-5.x en la misma sesión)
5. **Método inicial**: Todas las sesiones del plan inicial usan método "theory".
   El sistema adaptativo cambiará el método si el usuario necesita refuerzo.
6. **Dificultad**: Asignar dificultad a cada sesión con una regla determinista:
   - "hard": contiene al menos un tópico K3
   - "medium": no contiene K3 y contiene al menos un tópico K2
   - "easy": contiene únicamente tópicos K1
7. **Distribución equilibrada**: Distribuir los tópicos uniformemente entre las sesiones.
   Usa la densidad indicada en el prompt del usuario. Si hay casi tantas sesiones como tópicos,
   es correcto que muchas sesiones tengan 1 tópico. Nunca dupliques topic_codes para rellenar.
8. **Título descriptivo**: Cada sesión debe tener un título descriptivo en español
   que resuma los tópicos cubiertos (máximo 80 caracteres).

## RESTRICCIONES CRÍTICAS

- SOLO usa topic_codes que se proporcionan en la lista de tópicos. NO inventes códigos.
- Cada topic_code debe aparecer en EXACTAMENTE una sesión. No duplicar ni omitir.
- Cada sesión puede contener como máximo ${MAX_QUIZ_TOPICS_PER_SESSION} topic_codes para que el quiz evalúe todos.
- coverage.covered_topic_codes debe contener todos los códigos recibidos y coverage.omitted_topic_codes debe ser [].
- El número de días debe coincidir exactamente con el parámetro objective_days.
- El total de sesiones = objective_days × 2 (morning + night).

## FORMATO DE SALIDA

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:

{
  "sessions": [
    {
      "day_number": <número del día, empezando en 1>,
      "session_type": "morning" | "night",
      "topic_codes": ["FL-x.x.x", ...],
      "method": "theory",
      "estimated_duration_minutes": ${DEFAULT_SESSION_MINUTES},
      "difficulty": "easy" | "medium" | "hard",
      "title": "<título descriptivo en español>"
    }
  ],
  "total_sessions": <número total de sesiones>,
  "total_days": <número total de días>,
  "topics_per_level": {
    "K1": <cantidad de tópicos K1>,
    "K2": <cantidad de tópicos K2>,
    "K3": <cantidad de tópicos K3>
  },
  "plan_summary": "<resumen del plan en español, 2-3 oraciones>",
  "coverage": {
    "total_topics": <número total de tópicos recibidos>,
    "covered_topic_codes": ["FL-x.x.x", ...],
    "omitted_topic_codes": ["FL-x.x.x", ...]
  }
}

NO incluyas texto antes ni después del JSON. NO uses bloques de código markdown.
Responde SOLO con el JSON puro.`;
}

/**
 * Convierte topics_json en una versión compacta para el prompt.
 *
 * Enviar el texto completo de cada tópico puede disparar el costo de
 * tokens. Para planificar, el modelo necesita código, nivel K, nombre y
 * un preview corto del texto. El texto completo se usará después, en SE-02.
 */
function buildTopicsForPrompt(topics: TopicsJson) {
  return Object.entries(topics)
    .sort(compareTopicEntries)
    .slice(0, MAX_TOPICS_IN_PROMPT)
    .map(([code, entry]: [string, TopicEntry]) => ({
      code,
      level_k: entry.level_k,
      name: entry.name || "Sin nombre",
      text_preview: entry.text.slice(0, TOPIC_TEXT_PREVIEW_CHARS),
    }));
}

/**
 * Construye el user prompt con los datos específicos de esta petición.
 *
 * @param topics      - Tópicos extraídos del PDF
 * @param days        - Número de días objetivo del usuario
 * @param morningTime - Hora de la sesión matutina (HH:MM)
 * @param nightTime   - Hora de la sesión nocturna (HH:MM)
 */
function buildUserPrompt(
  topics: TopicsJson,
  days: number,
  morningTime: string,
  nightTime: string,
): string {
  // ─── Construir versión compacta de tópicos ──────────────────
  // Incluimos text_preview para dar contexto pedagógico sin enviar
  // el texto completo del syllabus en cada llamada a OpenAI.
  const promptTopics = buildTopicsForPrompt(topics);
  const availableTopicCodes = Object.entries(topics)
    .sort(compareTopicEntries)
    .map(([code]) => code);

  // ─── Contar tópicos por nivel K ─────────────────────────────
  const levelCounts = { K1: 0, K2: 0, K3: 0 };
  Object.values(topics).forEach((entry: TopicEntry) => {
    const level = entry.level_k as keyof typeof levelCounts;
    if (level in levelCounts) {
      levelCounts[level]++;
    }
  });

  const totalTopics = Object.keys(topics).length;
  const totalSessions = days * 2;
  const density = calculatePlanDensity(totalTopics, totalSessions);

  return `## DATOS DEL ESTUDIANTE

- **Días disponibles:** ${days} días
- **Sesiones totales:** ${totalSessions} (${days} días × 2 sesiones/día)
- **Horario sesión mañana:** ${morningTime}
- **Horario sesión noche:** ${nightTime}
- **Total de tópicos:** ${totalTopics}
- **Distribución:** K1=${levelCounts.K1}, K2=${levelCounts.K2}, K3=${levelCounts.K3}
- **Límite técnico del prompt:** máximo ${MAX_TOPICS_IN_PROMPT} tópicos con detalle; todos los códigos válidos están listados abajo.

## TOPIC_CODES VÁLIDOS

${availableTopicCodes.join(", ")}

## TÓPICOS CON CONTEXTO PEDAGÓGICO (${promptTopics.length} de ${totalTopics})

${JSON.stringify(promptTopics, null, 2)}

## INSTRUCCIÓN

Genera el plan de estudio con ${totalSessions} sesiones distribuidas en ${days} días.
Agrupa los tópicos por capítulo y, dentro de cada capítulo, ordénalos por nivel K (K1 primero, K3 al final).
Cada sesión debe tener entre ${density.min} y ${density.max} tópico(s).
No dupliques ni omitas topic_codes. Si hay ${totalTopics} tópicos y ${totalSessions} sesiones, la distribución esperada es necesariamente ${density.min}-${density.max} tópico(s) por sesión.
coverage.covered_topic_codes debe contener los ${totalTopics} códigos y coverage.omitted_topic_codes debe ser [].
Responde SOLO con el JSON.`;
}

// ─────────────────────────────────────────────────────────────────
// VALIDACIÓN DEL PLAN GENERADO
// ─────────────────────────────────────────────────────────────────

/**
 * Valida que el plan generado por OpenAI cumple con los requisitos.
 *
 * Verificaciones:
 *   1. Tiene el campo 'sessions' como array no vacío
 *   2. Cada sesión tiene los campos requeridos
 *   3. Todos los topic_codes existen en los tópicos originales
 *   4. No hay topic_codes duplicados
 *   5. Los tópicos omitidos están declarados en coverage.omitted_topic_codes
 *
 * @returns Array de errores. Si está vacío, el plan es válido.
 */
export function validateGeneratedPlan(
  plan: GeneratedPlan,
  originalTopics: TopicsJson,
  expectedDays: number,
): string[] {
  const errors: string[] = [];
  const originalCodes = new Set(Object.keys(originalTopics));
  const expectedSessions = expectedDays * 2;
  const density = calculatePlanDensity(originalCodes.size, expectedSessions);

  // ─── 1. Verificar que sessions existe y es un array ─────────
  if (!plan.sessions || !Array.isArray(plan.sessions)) {
    errors.push("El plan no contiene un array 'sessions' válido.");
    return errors; // No tiene sentido validar más
  }

  if (plan.sessions.length === 0) {
    errors.push("El plan no contiene ninguna sesión.");
    return errors;
  }

  if (plan.sessions.length !== expectedSessions) {
    errors.push(
      `El plan contiene ${plan.sessions.length} sesiones, pero se esperaban ${expectedSessions}.`,
    );
  }

  if (plan.total_sessions !== expectedSessions) {
    errors.push(
      `total_sessions debe ser ${expectedSessions}, pero llegó ${plan.total_sessions}.`,
    );
  }

  // ─── 2. Verificar coverage explícito ────────────────────────
  if (!plan.coverage || typeof plan.coverage !== "object") {
    errors.push("El plan no contiene coverage válido.");
    return errors;
  }

  if (plan.coverage.total_topics !== originalCodes.size) {
    errors.push(
      `coverage.total_topics debe ser ${originalCodes.size}, pero llegó ${plan.coverage.total_topics}.`,
    );
  }

  if (!Array.isArray(plan.coverage.covered_topic_codes)) {
    errors.push("coverage.covered_topic_codes debe ser un array.");
  }

  if (!Array.isArray(plan.coverage.omitted_topic_codes)) {
    errors.push("coverage.omitted_topic_codes debe ser un array.");
  }

  // ─── 3. Verificar campos de cada sesión ─────────────────────
  const allTopicCodes: string[] = [];

  for (let i = 0; i < plan.sessions.length; i++) {
    const session = plan.sessions[i];

    if (typeof session.day_number !== "number" || session.day_number < 1) {
      errors.push(
        `Sesión ${i + 1}: falta day_number válido (debe ser un número >= 1).`,
      );
    }

    if (!["morning", "night"].includes(session.session_type)) {
      errors.push(
        `Sesión ${i + 1}: session_type inválido: "${session.session_type}".`,
      );
    }

    if (
      !session.topic_codes ||
      !Array.isArray(session.topic_codes) ||
      session.topic_codes.length === 0
    ) {
      errors.push(`Sesión ${i + 1}: topic_codes vacío o no es array.`);
      continue;
    }

    if (session.topic_codes.length > MAX_QUIZ_TOPICS_PER_SESSION) {
      errors.push(
        `Sesión ${i + 1}: supera el máximo evaluable de ${MAX_QUIZ_TOPICS_PER_SESSION} tópicos.`,
      );
    }

    if (
      session.topic_codes.length < density.min ||
      session.topic_codes.length > density.max
    ) {
      errors.push(
        `Sesión ${i + 1}: debe contener ${density.min}-${density.max} tópicos, pero contiene ${session.topic_codes.length}.`,
      );
    }

    if (session.method !== "theory") {
      errors.push(`Sesión ${i + 1}: method debe ser "theory".`);
    }

    if (session.estimated_duration_minutes !== DEFAULT_SESSION_MINUTES) {
      errors.push(
        `Sesión ${i + 1}: estimated_duration_minutes debe ser ${DEFAULT_SESSION_MINUTES}.`,
      );
    }

    const titleLength = session.title.trim().length;
    if (titleLength === 0 || titleLength > 80) {
      errors.push(`Sesión ${i + 1}: title debe contener entre 1 y 80 caracteres.`);
    }

    // ─── 3. Verificar que cada topic_code es válido ───────────
    for (const code of session.topic_codes) {
      if (!originalCodes.has(code)) {
        errors.push(
          `Sesión ${i + 1}: topic_code "${code}" no existe en los tópicos originales.`,
        );
      }
      allTopicCodes.push(code);
    }

    const expectedDifficulty = getExpectedDifficulty(
      session.topic_codes,
      originalTopics,
    );
    if (session.difficulty !== expectedDifficulty) {
      errors.push(
        `Sesión ${i + 1}: difficulty debe ser "${expectedDifficulty}" para sus niveles K.`,
      );
    }
  }

  // ─── 4. Verificar duplicados en sesiones ────────────────────
  const codeSet = new Set<string>();
  const duplicates: string[] = [];

  for (const code of allTopicCodes) {
    if (codeSet.has(code)) {
      duplicates.push(code);
    }
    codeSet.add(code);
  }

  if (duplicates.length > 0) {
    errors.push(`Tópicos duplicados en el plan: ${duplicates.join(", ")}`);
  }

  const orderedSessions = [...plan.sessions].sort(
    (sessionA, sessionB) =>
      sessionA.day_number - sessionB.day_number ||
      PLAN_SESSION_TYPES.indexOf(sessionA.session_type) -
        PLAN_SESSION_TYPES.indexOf(sessionB.session_type),
  );
  const highestLevelByChapter = new Map<number, number>();
  let highestChapter = 0;

  for (const session of orderedSessions) {
    for (const code of session.topic_codes) {
      const topic = originalTopics[code];
      const chapterMatch = /^FL-(\d+)\./.exec(code);
      if (!topic || !chapterMatch) continue;

      const chapter = Number(chapterMatch[1]);
      if (chapter < highestChapter) {
        errors.push(
          `El tópico ${code} vuelve al capítulo ${chapter} después del capítulo ${highestChapter}.`,
        );
      }
      highestChapter = Math.max(highestChapter, chapter);

      const levelRank = PLAN_LEVEL_ORDER[topic.level_k];
      const highestLevel = highestLevelByChapter.get(chapter) ?? 0;
      if (levelRank < highestLevel) {
        errors.push(
          `El tópico ${code} (${topic.level_k}) rompe el orden K1 → K2 → K3 del capítulo ${chapter}.`,
        );
      }
      highestLevelByChapter.set(chapter, Math.max(highestLevel, levelRank));
    }
  }

  // ─── 5. Verificar omisiones declaradas explícitamente ───────
  const omittedTopicCodes = Array.isArray(plan.coverage.omitted_topic_codes)
    ? plan.coverage.omitted_topic_codes
    : [];
  const coveredTopicCodes = Array.isArray(plan.coverage.covered_topic_codes)
    ? plan.coverage.covered_topic_codes
    : [];

  const omittedCodes = new Set(omittedTopicCodes);
  const coveredCodes = new Set(coveredTopicCodes);

  if (omittedTopicCodes.length > 0) {
    errors.push("coverage.omitted_topic_codes debe estar vacío.");
  }

  if (coveredCodes.size !== coveredTopicCodes.length) {
    errors.push("coverage.covered_topic_codes contiene duplicados.");
  }

  for (const code of omittedCodes) {
    if (!originalCodes.has(code)) {
      errors.push(
        `coverage.omitted_topic_codes contiene código inexistente: ${code}.`,
      );
    }

    if (codeSet.has(code)) {
      errors.push(
        `coverage.omitted_topic_codes incluye "${code}", pero ese tópico también aparece en una sesión.`,
      );
    }
  }

  for (const code of coveredCodes) {
    if (!originalCodes.has(code)) {
      errors.push(
        `coverage.covered_topic_codes contiene código inexistente: ${code}.`,
      );
    }
  }

  const missingTopics = Array.from(originalCodes).filter(
    (code) => !codeSet.has(code) && !omittedCodes.has(code),
  );

  if (missingTopics.length > 0) {
    errors.push(
      `Tópicos omitidos sin declararse en coverage.omitted_topic_codes: ${missingTopics.join(", ")}`,
    );
  }

  const usedButNotCovered = Array.from(codeSet).filter(
    (code) => !coveredCodes.has(code),
  );

  if (usedButNotCovered.length > 0) {
    errors.push(
      `Tópicos usados en sesiones pero ausentes en coverage.covered_topic_codes: ${usedButNotCovered.join(", ")}`,
    );
  }

  const coveredButNotUsed = Array.from(coveredCodes).filter(
    (code) => !codeSet.has(code),
  );

  if (coveredButNotUsed.length > 0) {
    errors.push(
      `Tópicos declarados como cubiertos pero ausentes de sesiones: ${coveredButNotUsed.join(", ")}`,
    );
  }

  if (codeSet.size !== originalCodes.size) {
    errors.push(
      `Las sesiones deben cubrir exactamente ${originalCodes.size} tópicos únicos, pero cubren ${codeSet.size}.`,
    );
  }

  // ─── 6. Verificar número de días ────────────────────────────
  const maxDayInPlan = Math.max(...plan.sessions.map((s) => s.day_number));

  if (maxDayInPlan > expectedDays) {
    errors.push(
      `El plan tiene sesiones hasta el día ${maxDayInPlan}, pero el objetivo es ${expectedDays} días.`,
    );
  }

  return errors;
}

export function parseGeneratedPlan(
  rawText: string,
  originalTopics: TopicsJson,
  expectedDays: number,
): GeneratedPlan | null {
  const parsed = parseFirstJsonObject(rawText);
  const value =
    parsed && !Array.isArray(parsed.sessions) && isRecord(parsed.plan)
      ? parsed.plan
      : parsed;
  if (
    !value ||
    !Array.isArray(value.sessions) ||
    !value.sessions.every(isPlanSession) ||
    !isNonNegativeInteger(value.total_sessions) ||
    !isNonNegativeInteger(value.total_days) ||
    typeof value.plan_summary !== "string" ||
    !isRecord(value.topics_per_level) ||
    !isNonNegativeInteger(value.topics_per_level.K1) ||
    !isNonNegativeInteger(value.topics_per_level.K2) ||
    !isNonNegativeInteger(value.topics_per_level.K3) ||
    !isRecord(value.coverage) ||
    !isNonNegativeInteger(value.coverage.total_topics) ||
    !isStringArray(value.coverage.covered_topic_codes) ||
    !Array.isArray(value.coverage.omitted_topic_codes) ||
    !value.coverage.omitted_topic_codes.every(
      (item) => typeof item === "string" && item.trim().length > 0,
    )
  ) {
    return null;
  }

  const expectedSessions = expectedDays * 2;
  if (
    value.sessions.length !== expectedSessions ||
    value.total_sessions !== expectedSessions ||
    value.total_days !== expectedDays ||
    value.plan_summary.trim().length === 0
  ) {
    return null;
  }

  const occupiedSlots = new Set<string>();
  for (const session of value.sessions) {
    const slot = String(session.day_number) + ":" + session.session_type;
    if (session.day_number > expectedDays || occupiedSlots.has(slot)) {
      return null;
    }
    occupiedSlots.add(slot);
  }

  for (let day = 1; day <= expectedDays; day += 1) {
    if (
      !occupiedSlots.has(String(day) + ":morning") ||
      !occupiedSlots.has(String(day) + ":night")
    ) {
      return null;
    }
  }

  const expectedTopicsPerLevel = Object.values(originalTopics).reduce(
    (counts, topic) => {
      counts[topic.level_k] += 1;
      return counts;
    },
    { K1: 0, K2: 0, K3: 0 },
  );
  if (
    value.topics_per_level.K1 !== expectedTopicsPerLevel.K1 ||
    value.topics_per_level.K2 !== expectedTopicsPerLevel.K2 ||
    value.topics_per_level.K3 !== expectedTopicsPerLevel.K3
  ) {
    return null;
  }

  const coverageCodes = [
    ...value.coverage.covered_topic_codes,
    ...value.coverage.omitted_topic_codes,
  ];
  if (new Set(coverageCodes).size !== coverageCodes.length) {
    return null;
  }

  const plan: GeneratedPlan = {
    sessions: value.sessions,
    total_sessions: value.total_sessions,
    total_days: value.total_days,
    topics_per_level: {
      K1: value.topics_per_level.K1,
      K2: value.topics_per_level.K2,
      K3: value.topics_per_level.K3,
    },
    plan_summary: value.plan_summary,
    coverage: {
      total_topics: value.coverage.total_topics,
      covered_topic_codes: value.coverage.covered_topic_codes,
      omitted_topic_codes: value.coverage.omitted_topic_codes,
    },
  };

  return validateGeneratedPlan(plan, originalTopics, expectedDays).length === 0
    ? plan
    : null;
}

export function createDemoPlan(
  topics: TopicsJson,
  objectiveDays: number,
): GeneratedPlan {
  const orderedEntries = Object.entries(topics).sort(compareTopicEntries);
  const totalSessions = objectiveDays * 2;
  const density = calculatePlanDensity(orderedEntries.length, totalSessions);
  const largerGroups = orderedEntries.length % totalSessions;
  let topicCursor = 0;
  const groups = Array.from({ length: totalSessions }, (_, index) => {
    const groupSize = index < largerGroups ? density.max : density.min;
    const topicCodes = orderedEntries
      .slice(topicCursor, topicCursor + groupSize)
      .map(([code]) => code);
    topicCursor += groupSize;
    return topicCodes;
  });

  const sessions: PlanSession[] = groups.map((topicCodes, index) => {
    const dayNumber = Math.floor(index / 2) + 1;
    const sessionType = index % 2 === 0 ? "morning" : "night";
    const firstTopic = topics[topicCodes[0]];
    const topicLabel = firstTopic?.name?.trim() || topicCodes[0];
    const title =
      `[MODO DEMO] ${topicLabel}`.slice(0, 80).trim() ||
      "[MODO DEMO] Sesión ISTQB";

    return {
      day_number: dayNumber,
      session_type: sessionType,
      topic_codes: topicCodes,
      method: "theory",
      estimated_duration_minutes: DEFAULT_SESSION_MINUTES,
      difficulty: getExpectedDifficulty(topicCodes, topics),
      title,
    };
  });

  const topicsPerLevel = orderedEntries.reduce(
    (counts, [, topic]) => {
      counts[topic.level_k] += 1;
      return counts;
    },
    { K1: 0, K2: 0, K3: 0 },
  );
  const coveredCodes = sessions.flatMap((session) => session.topic_codes);

  return {
    sessions,
    total_sessions: totalSessions,
    total_days: objectiveDays,
    topics_per_level: topicsPerLevel,
    plan_summary:
      "[MODO DEMO] Plan determinista para validar el flujo sin costo externo.",
    coverage: {
      total_topics: coveredCodes.length,
      covered_topic_codes: coveredCodes,
      omitted_topic_codes: [],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ═══════════════════════════════════════════════════════════
    // FASE 1: AUTENTICACIÓN
    // Verificamos que el usuario está logueado.
    // ═══════════════════════════════════════════════════════════

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado. Por favor inicia sesión." },
        { status: 401 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 2: PARSING Y VALIDACIÓN DEL BODY
    // ═══════════════════════════════════════════════════════════

    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Body inválido. Se espera JSON." },
        { status: 400 },
      );
    }

    const body = parseBody(rawBody);

    if (!body) {
      return NextResponse.json(
        {
          error:
            "Body inválido. Esperado: { document_id, config: { objective_days, morning_time, night_time } }.",
        },
        { status: 400 },
      );
    }

    const { document_id, config } = body;
    const { objective_days, morning_time, night_time } = config;

    // ═══════════════════════════════════════════════════════════
    // FASE 3: OBTENER EL DOCUMENTO CON TÓPICOS
    // ═══════════════════════════════════════════════════════════

    const adminClient = createAdminClient();

    const { data: document, error: docError } = await adminClient
      .from("documents")
      .select("id, user_id, topics_json, file_name")
      .eq("id", document_id)
      .single();

    if (docError || !document) {
      console.error("[Plan] Documento no encontrado:", docError);
      return NextResponse.json(
        { error: "Documento no encontrado." },
        { status: 404 },
      );
    }

    // ─── Ownership check ──────────────────────────────────────
    if (document.user_id !== user.id) {
      console.warn(
        `[Plan] ⚠️ Usuario ${user.id} intentó generar plan para documento de ${document.user_id}`,
      );
      return NextResponse.json(
        { error: "No tienes permisos para acceder a este documento." },
        { status: 403 },
      );
    }

    // ─── Verificar que topics_json existe ─────────────────────
    // Si el documento no tiene tópicos extraídos, no podemos
    // generar un plan. Esto significa que UP-03 no se completó.
    const topicsJson = document.topics_json as TopicsJson | null;

    if (!topicsJson || Object.keys(topicsJson).length === 0) {
      return NextResponse.json(
        {
          error:
            "El documento no tiene tópicos extraídos. " +
            "Primero debes completar la extracción (UP-03).",
        },
        { status: 422 },
      );
    }

    const totalTopics = Object.keys(topicsJson).length;
    console.log(
      `[Plan] Generando plan para ${totalTopics} tópicos, ` +
        `${objective_days} días, horarios ${morning_time}/${night_time}`,
    );

    const totalSessions = objective_days * 2;
    if (totalTopics < totalSessions) {
      return NextResponse.json(
        {
          error:
            "No hay suficientes tópicos para crear dos sesiones no vacías por día. " +
            "Reduce los días objetivo o extrae un documento con más tópicos.",
          code: "PLAN_TOPICS_INSUFFICIENT",
        },
        { status: 422 },
      );
    }

    const minimumDays = Math.ceil(
      totalTopics / (2 * MAX_QUIZ_TOPICS_PER_SESSION),
    );
    if (objective_days < minimumDays) {
      return NextResponse.json(
        {
          error:
            `Se requieren al menos ${minimumDays} días para distribuir ${totalTopics} tópicos ` +
            `en sesiones evaluables de hasta ${MAX_QUIZ_TOPICS_PER_SESSION}.`,
          code: "PLAN_DAYS_INSUFFICIENT_FOR_QUIZ",
          minimum_days: minimumDays,
        },
        { status: 422 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FASE 4: LLAMAR AL PROVEEDOR LLM PARA GENERAR EL PLAN
    // ═══════════════════════════════════════════════════════════

    // ─── Construir los mensajes del prompt ─────────────────────
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(
      topicsJson,
      objective_days,
      morning_time,
      night_time,
    );

    const ai = await executeAiJson<GeneratedPlan>({
      request,
      userId: user.id,
      feature: "plan",
      systemPrompt,
      userPrompts: [userPrompt],
      maxCompletionTokensPerAttempt: MAX_PLAN_COMPLETION_TOKENS,
      timeoutMs: calcPlanTimeout(objective_days),
      parse: (rawText) =>
        parseGeneratedPlan(rawText, topicsJson, objective_days),
      createDemoRaw: () =>
        JSON.stringify(createDemoPlan(topicsJson, objective_days)),
      tuning: (provider) =>
        provider === "gemini"
          ? { response_format: { type: "json_object" }, temperature: 0.3 }
          : { response_format: { type: "json_object" } },
    });

    if (!ai.ok) {
      return NextResponse.json(ai.body, { status: ai.status });
    }

    const plan = ai.value;

    // ═══════════════════════════════════════════════════════════
    // FASE 6: CALCULAR FECHAS Y PREPARAR RESPUESTA
    // ═══════════════════════════════════════════════════════════

    // ─── Calcular fechas ──────────────────────────────────────
    // start_date: hoy (el plan empieza inmediatamente)
    // estimated_end_date: hoy + (objective_days - 1)
    // Si empiezas hoy y estudias 7 días, el día 7 es hoy + 6.
    const today = new Date();
    const startDate = today.toISOString().split("T")[0]; // "YYYY-MM-DD"

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + objective_days - 1);
    const estimatedEndDate = endDate.toISOString().split("T")[0];

    // ─── Log de éxito ─────────────────────────────────────────
    console.log(
      `[Plan] Plan generado exitosamente: ${plan.sessions.length} sesiones, ` +
        `${plan.total_days} días`,
    );

    // ═══════════════════════════════════════════════════════════
    // FASE 7: RESPUESTA EXITOSA
    // ═══════════════════════════════════════════════════════════

    return NextResponse.json({
      plan,
      document_id,
      total_sessions: plan.sessions.length,
      start_date: startDate,
      estimated_end_date: estimatedEndDate,
      model_used: ai.model ?? "fixture-ai05",
      model_provider: ai.provider ?? "demo",
      tokens_used: ai.tokensUsed,
    });
  } catch {
    // ─── Error no controlado ──────────────────────────────────
    console.error("[Plan] Error no controlado durante la generación del plan");

    return NextResponse.json(
      {
        error: "Error interno del servidor. Por favor intenta de nuevo.",
      },
      { status: 500 },
    );
  }
}
