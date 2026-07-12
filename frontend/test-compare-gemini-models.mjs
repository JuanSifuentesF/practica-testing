import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const DOCUMENT_ID = "6d5f2dd9-62ad-4ccc-a622-9f60ded283e1";
const DRIVIN_ENV_PATH = "D:\\Drivin\\drivin-repo\\qa-release-5\\.env";
const LOCAL_ENV_PATH = path.resolve(process.cwd(), ".env.local");
const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_SESSION_MINUTES = 90;
const MAX_TOPICS_IN_PROMPT = 90;
const TOPIC_TEXT_PREVIEW_CHARS = 420;

function loadEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

function buildSystemPrompt() {
  return `Eres un planificador de estudio especializado en la certificación ISTQB Foundation Level (CTFL v4.0).

Tu tarea es generar un plan de estudio intensivo y personalizado basado en los tópicos del syllabus ISTQB que se te proporcionarán.

## REGLAS DEL PLAN

1. Cada día tiene exactamente 2 sesiones: una "morning" y una "night".
2. Cada sesión dura ${DEFAULT_SESSION_MINUTES} minutos.
3. Ordena tópicos por nivel K: primero K1, después K2, al final K3.
4. Agrupa tópicos del mismo capítulo: FL-1 juntos, FL-2 juntos, etc.
5. Todas las sesiones usan método "theory".
6. Dificultad: "easy", "medium" o "hard" según nivel K.
7. Distribuye tópicos uniformemente entre sesiones.

## RESTRICCIONES CRÍTICAS

- SOLO usa topic_codes que se proporcionan. NO inventes códigos.
- Cada topic_code debe aparecer en EXACTAMENTE una sesión o en coverage.omitted_topic_codes.
- El total de sesiones debe ser objective_days × 2.

## FORMATO DE SALIDA

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:

{
  "sessions": [
    {
      "day_number": 1,
      "session_type": "morning",
      "topic_codes": ["FL-x.x.x"],
      "method": "theory",
      "estimated_duration_minutes": ${DEFAULT_SESSION_MINUTES},
      "difficulty": "easy",
      "title": "título descriptivo"
    }
  ],
  "total_sessions": 14,
  "total_days": 7,
  "topics_per_level": { "K1": 0, "K2": 0, "K3": 0 },
  "plan_summary": "resumen en español",
  "coverage": {
    "total_topics": 0,
    "covered_topic_codes": ["FL-x.x.x"],
    "omitted_topic_codes": []
  }
}

NO incluyas texto antes ni después del JSON.`;
}

function buildUserPrompt(topics, days, morningTime, nightTime) {
  const promptTopics = Object.entries(topics)
    .sort(([codeA], [codeB]) => codeA.localeCompare(codeB))
    .slice(0, MAX_TOPICS_IN_PROMPT)
    .map(([code, entry]) => ({
      code,
      level_k: entry.level_k,
      name: entry.name || "Sin nombre",
      text_preview: String(entry.text || "").slice(0, TOPIC_TEXT_PREVIEW_CHARS),
    }));

  const availableTopicCodes = Object.keys(topics).sort();
  const levelCounts = { K1: 0, K2: 0, K3: 0 };
  for (const entry of Object.values(topics)) {
    if (entry.level_k in levelCounts) levelCounts[entry.level_k]++;
  }

  const totalTopics = Object.keys(topics).length;
  const totalSessions = days * 2;

  return `## DATOS DEL ESTUDIANTE

- Días disponibles: ${days}
- Sesiones totales: ${totalSessions}
- Horario sesión mañana: ${morningTime}
- Horario sesión noche: ${nightTime}
- Total de tópicos: ${totalTopics}
- Distribución: K1=${levelCounts.K1}, K2=${levelCounts.K2}, K3=${levelCounts.K3}

## TOPIC_CODES VÁLIDOS

${availableTopicCodes.join(", ")}

## TÓPICOS CON CONTEXTO PEDAGÓGICO (${promptTopics.length} de ${totalTopics})

${JSON.stringify(promptTopics, null, 2)}

## INSTRUCCIÓN

Genera el plan de estudio con ${totalSessions} sesiones distribuidas en ${days} días.
Agrupa los tópicos por capítulo y ordénalos por nivel K.
Cada sesión debe tener entre 2 y ${Math.ceil(totalTopics / totalSessions) + 2} tópicos.
Responde SOLO con el JSON.`;
}

function validatePlan(plan, topics, expectedDays) {
  const errors = [];
  const originalCodes = new Set(Object.keys(topics));
  const expectedSessions = expectedDays * 2;

  if (!Array.isArray(plan.sessions)) {
    return ["sessions no es array"];
  }

  if (plan.sessions.length !== expectedSessions) {
    errors.push(`sessions=${plan.sessions.length}, esperado=${expectedSessions}`);
  }

  if (plan.total_sessions !== expectedSessions) {
    errors.push(`total_sessions=${plan.total_sessions}, esperado=${expectedSessions}`);
  }

  if (!plan.coverage || typeof plan.coverage !== "object") {
    errors.push("coverage ausente");
  }

  const used = [];
  for (const [index, session] of plan.sessions.entries()) {
    if (!["morning", "night"].includes(session.session_type)) {
      errors.push(`sesión ${index + 1}: session_type inválido`);
    }
    if (!Array.isArray(session.topic_codes) || session.topic_codes.length === 0) {
      errors.push(`sesión ${index + 1}: topic_codes vacío`);
      continue;
    }
    for (const code of session.topic_codes) {
      used.push(code);
      if (!originalCodes.has(code)) {
        errors.push(`código inventado: ${code}`);
      }
    }
  }

  const duplicates = used.filter((code, index) => used.indexOf(code) !== index);
  if (duplicates.length > 0) {
    errors.push(`duplicados: ${Array.from(new Set(duplicates)).join(", ")}`);
  }

  const omitted = new Set(plan.coverage?.omitted_topic_codes ?? []);
  const usedSet = new Set(used);
  const missing = Array.from(originalCodes).filter(
    (code) => !usedSet.has(code) && !omitted.has(code),
  );
  if (missing.length > 0) {
    errors.push(`omitidos sin declarar: ${missing.join(", ")}`);
  }

  const covered = plan.coverage?.covered_topic_codes ?? [];
  if (Array.isArray(covered)) {
    const usedButNotCovered = Array.from(usedSet).filter(
      (code) => !covered.includes(code),
    );
    if (usedButNotCovered.length > 0) {
      errors.push(`usados no listados en coverage: ${usedButNotCovered.join(", ")}`);
    }
  }

  return errors;
}

async function fetchTopics() {
  const localEnv = loadEnvFile(LOCAL_ENV_PATH);
  const supabase = createClient(
    localEnv.NEXT_PUBLIC_SUPABASE_URL,
    localEnv.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data, error } = await supabase
    .from("documents")
    .select("id, topics_json")
    .eq("id", DOCUMENT_ID)
    .single();

  if (error || !data?.topics_json) {
    throw new Error(`No se pudo leer topics_json: ${error?.message || "sin data"}`);
  }

  return data.topics_json;
}

async function runModel(model, apiKey, topics) {
  const client = new OpenAI({
    apiKey,
    baseURL: GEMINI_OPENAI_BASE_URL,
    timeout: 120_000,
    maxRetries: 0,
  });

  const startedAt = Date.now();
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(topics, 7, "06:00", "22:00") },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const elapsedMs = Date.now() - startedAt;
  const raw = completion.choices[0]?.message?.content;
  const finishReason = completion.choices[0]?.finish_reason;
  const parsed = JSON.parse(raw);
  const errors = validatePlan(parsed, topics, 7);

  return {
    model,
    ok: errors.length === 0,
    finishReason,
    elapsedMs,
    tokens: completion.usage?.total_tokens ?? null,
    promptTokens: completion.usage?.prompt_tokens ?? null,
    completionTokens: completion.usage?.completion_tokens ?? null,
    sessions: parsed.sessions?.length ?? 0,
    covered: parsed.coverage?.covered_topic_codes?.length ?? 0,
    omitted: parsed.coverage?.omitted_topic_codes?.length ?? 0,
    summary: parsed.plan_summary || "",
    firstTitle: parsed.sessions?.[0]?.title || "",
    lastTitle: parsed.sessions?.[parsed.sessions.length - 1]?.title || "",
    errors,
  };
}

async function main() {
  const drivinEnv = loadEnvFile(DRIVIN_ENV_PATH);
  const apiKey = drivinEnv.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No hay GEMINI_API_KEY en el .env de Drivin");

  const topics = await fetchTopics();
  console.log(`Documento: ${DOCUMENT_ID}`);
  console.log(`Tópicos reales: ${Object.keys(topics).length}`);

  for (const model of ["gemini-2.5-flash", "gemini-2.5-pro"]) {
    console.log(`\n=== ${model} ===`);
    try {
      const result = await runModel(model, apiKey, topics);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(
        JSON.stringify(
          {
            model,
            ok: false,
            status: error.status ?? null,
            message: error.message,
          },
          null,
          2,
        ),
      );
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
