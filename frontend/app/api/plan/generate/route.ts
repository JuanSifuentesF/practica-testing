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
//       model_provider: string     // "gemini-2.5-flash" | "gpt-5"
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
import {
  createModelRuntimes,
  getModelErrorStatus,
  isModelTimeout,
  type ModelRuntime,
} from "@/lib/ai/model-cascade";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TopicsJson, TopicEntry } from "@/types";

// El SDK de OpenAI y las variables server-only deben ejecutarse en Node.js.
// Declararlo evita sorpresas si el hosting intenta usar Edge Runtime.
export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────
// CONSTANTES Y TIPOS
// ─────────────────────────────────────────────────────────────────

// ─── Timeout para el proveedor LLM ───────────────────────────────
// Escala con objective_days porque más días = más sesiones = más tokens.
// Base:     45s Gemini, 90s GPT-5
// Por día:  +6s Gemini, +8s GPT-5 (cada día agrega 2 sesiones al JSON)
// Cap:      120s Gemini, 180s GPT-5
function calcModelTimeout(provider: PlanModelProvider, objectiveDays: number): number {
  const perDay = provider === "gpt-5" ? 8_000 : 6_000;
  const base = provider === "gpt-5" ? 90_000 : 45_000;
  const cap = provider === "gpt-5" ? 180_000 : 120_000;
  return Math.min(cap, Math.max(base, objectiveDays * perDay));
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
const DEFAULT_MODEL_PROVIDER = "gemini-2.5-flash";

type PlanModelProvider = "gemini-2.5-flash" | "gpt-5";

// ─── Tipo del body de la petición ────────────────────────────────
interface GeneratePlanBody {
  document_id: string;
  config: {
    objective_days: number;
    morning_time: string;
    night_time: string;
    model_provider: PlanModelProvider;
  };
}

// ─── Tipo de una sesión en el plan generado por OpenAI ────────────
interface PlanSession {
  day_number: number;
  session_type: "morning" | "night";
  topic_codes: string[];
  method: "theory" | "examples" | "analogies";
  estimated_duration_minutes: number;
  difficulty: "easy" | "medium" | "hard";
  title: string;
}

// ─── Tipo completo del plan generado por OpenAI ──────────────────
interface GeneratedPlan {
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

function isPlanModelProvider(value: unknown): value is PlanModelProvider {
  return value === "gemini-2.5-flash" || value === "gpt-5";
}

function createPlanModelRuntimes(
  provider: PlanModelProvider,
  objectiveDays: number,
): ModelRuntime[] {
  const timeoutMs = calcModelTimeout(provider, objectiveDays);

  if (provider === "gemini-2.5-flash") {
    return createModelRuntimes({
      timeoutMs,
      // La cascada compartida agrega sus defaults después del override.
      geminiModels: [process.env.GEMINI_PLAN_MODEL],
      providers: ["gemini"],
      maxRetries: 2,
    });
  }

  return createModelRuntimes({
    timeoutMs,
    openaiModels: [
      process.env.OPENAI_PLAN_MODEL,
      "gpt-5",
      "gpt-4o-mini",
    ],
    providers: ["openai"],
    maxRetries: 2,
  });
}

// ─── Parser dedicado del body ────────────────────────────────────
// Mantener esta lógica separada evita un Route Handler lleno de ifs
// inline y hace más fácil testear la validación en el futuro.
function parseBody(value: unknown): GeneratePlanBody | null {
  if (!isRecord(value)) return null;

  const { document_id, config } = value;
  if (typeof document_id !== "string" || document_id.length === 0) return null;
  if (!isRecord(config)) return null;

  const { objective_days, morning_time, night_time } = config;
  const requestedModelProvider = config.model_provider;
  const model_provider = isPlanModelProvider(requestedModelProvider)
    ? requestedModelProvider
    : DEFAULT_MODEL_PROVIDER;

  if (
    typeof objective_days !== "number" ||
    objective_days < MIN_DAYS ||
    objective_days > MAX_DAYS
  ) {
    return null;
  }

  if (typeof morning_time !== "string" || !/^\d{2}:\d{2}$/.test(morning_time)) {
    return null;
  }

  if (typeof night_time !== "string" || !/^\d{2}:\d{2}$/.test(night_time)) {
    return null;
  }

  return {
    document_id,
    config: {
      objective_days,
      morning_time,
      night_time,
      model_provider,
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
3. **Orden por nivel K**: Los tópicos deben ordenarse así:
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
6. **Dificultad**: Asignar dificultad a cada sesión basada en los niveles K de sus tópicos:
   - "easy": solo K1 o mayoría K1
   - "medium": mayoría K2 o mezcla K1+K2
   - "hard": contiene K3 o mayoría K3
7. **Distribución equilibrada**: Distribuir los tópicos uniformemente entre las sesiones.
   No dejar sesiones con 1 tópico y otras con 10. Apuntar a 3-5 tópicos por sesión.
8. **Título descriptivo**: Cada sesión debe tener un título descriptivo en español
   que resuma los tópicos cubiertos (máximo 80 caracteres).

## RESTRICCIONES CRÍTICAS

- SOLO usa topic_codes que se proporcionan en la lista de tópicos. NO inventes códigos.
- Cada topic_code debe aparecer en EXACTAMENTE una sesión o en coverage.omitted_topic_codes. No duplicar.
- Si no puedes cubrir un tópico sin saturar sesiones, decláralo explícitamente en coverage.omitted_topic_codes.
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
    .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
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
  const availableTopicCodes = Object.keys(topics).sort();

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
Agrupa los tópicos por capítulo y ordénalos por nivel K (K1 primero, K3 al final).
Cada sesión debe tener entre 2 y ${Math.ceil(totalTopics / totalSessions) + 2} tópicos.
Si no puedes cubrir todos los tópicos sin saturar sesiones, lista los topic_codes omitidos en coverage.omitted_topic_codes.
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
function validateGeneratedPlan(
  plan: GeneratedPlan,
  originalTopics: TopicsJson,
  expectedDays: number,
): string[] {
  const errors: string[] = [];
  const originalCodes = new Set(Object.keys(originalTopics));
  const expectedSessions = expectedDays * 2;

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

    // ─── 3. Verificar que cada topic_code es válido ───────────
    for (const code of session.topic_codes) {
      if (!originalCodes.has(code)) {
        errors.push(
          `Sesión ${i + 1}: topic_code "${code}" no existe en los tópicos originales.`,
        );
      }
      allTopicCodes.push(code);
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

  // ─── 5. Verificar omisiones declaradas explícitamente ───────
  const omittedTopicCodes = Array.isArray(plan.coverage.omitted_topic_codes)
    ? plan.coverage.omitted_topic_codes
    : [];
  const coveredTopicCodes = Array.isArray(plan.coverage.covered_topic_codes)
    ? plan.coverage.covered_topic_codes
    : [];

  const omittedCodes = new Set(omittedTopicCodes);
  const coveredCodes = new Set(coveredTopicCodes);

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

  // ─── 6. Verificar número de días ────────────────────────────
  const maxDayInPlan = Math.max(...plan.sessions.map((s) => s.day_number));

  if (maxDayInPlan > expectedDays) {
    errors.push(
      `El plan tiene sesiones hasta el día ${maxDayInPlan}, pero el objetivo es ${expectedDays} días.`,
    );
  }

  return errors;
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
    const { objective_days, morning_time, night_time, model_provider } = config;

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
        `${objective_days} días, horarios ${morning_time}/${night_time}, ` +
        `modelo solicitado: ${model_provider}`,
    );

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

    const planModels = createPlanModelRuntimes(
      model_provider,
      objective_days,
    );
    let plan: GeneratedPlan | null = null;
    let planModel: ModelRuntime | null = null;
    let tokensUsed: number | null = null;
    let allAttemptsTimedOut = planModels.length > 0;

    for (const candidate of planModels) {
      console.log(
        `[Plan] Probando modelo ${candidate.model}, timeout: ${candidate.timeoutMs / 1000}s`,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), candidate.timeoutMs);

      try {
        const completion = await candidate.client.chat.completions.create(
          {
            model: candidate.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            // JSON mode se conserva para todos los proveedores OpenAI-compatible.
            response_format: { type: "json_object" },
            ...(candidate.provider === "gemini" ? { temperature: 0.3 } : {}),
          },
          { signal: controller.signal },
        );

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          allAttemptsTimedOut = false;
          console.warn(`[Plan] ${candidate.model} devolvió un plan vacío`);
          continue;
        }

        let candidatePlan: GeneratedPlan;
        try {
          candidatePlan = JSON.parse(content) as GeneratedPlan;
        } catch {
          allAttemptsTimedOut = false;
          console.warn(`[Plan] ${candidate.model} devolvió JSON de plan inválido`);
          continue;
        }

        let validationErrors: string[];
        try {
          validationErrors = validateGeneratedPlan(
            candidatePlan,
            topicsJson,
            objective_days,
          );
        } catch {
          allAttemptsTimedOut = false;
          console.warn(`[Plan] ${candidate.model} devolvió una estructura de plan inválida`);
          continue;
        }

        if (validationErrors.length > 0) {
          allAttemptsTimedOut = false;
          console.warn(`[Plan] ${candidate.model} no superó la validación del plan`);
          continue;
        }

        plan = candidatePlan;
        planModel = candidate;
        tokensUsed = completion.usage?.total_tokens ?? null;
        break;
      } catch (providerError) {
        const timedOut = controller.signal.aborted || isModelTimeout(providerError);
        allAttemptsTimedOut &&= timedOut;
        const status = getModelErrorStatus(providerError);
        console.warn(
          `[Plan] Falló ${candidate.model}; ${timedOut ? "timeout" : `estado ${status}`}. Se probará el siguiente candidato.`,
        );
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!plan || !planModel) {
      return NextResponse.json(
        {
          error: allAttemptsTimedOut
            ? "Los modelos de IA no respondieron a tiempo. Por favor intenta de nuevo."
            : "Error en la generación del plan. Por favor intenta de nuevo.",
        },
        { status: allAttemptsTimedOut ? 504 : 502 },
      );
    }

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
        `[Plan] ✅ Plan generado exitosamente: ` +
          `${plan.sessions.length} sesiones, ` +
          `${plan.total_days} días, ` +
          `modelo: ${planModel.model}, ` +
          `tokens: ${tokensUsed ?? "N/A"}`,
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
      model_used: planModel.model,
      model_provider,
      tokens_used: tokensUsed,
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
