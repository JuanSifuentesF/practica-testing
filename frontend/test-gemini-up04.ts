// scripts/test-gemini-up04.ts
// Test offline que simula exactamente lo que hace /api/plan/generate:
// 1) Construye el prompt real (idéntico al del Route Handler)
// 2) Llama a Gemini vía SDK de OpenAI con baseURL de Gemini
// 3) Valida la respuesta con la misma lógica del validador
//
// Ejecutar: cd frontend && npx tsx ../scripts/test-gemini-up04.ts
import OpenAI from "openai";
import { config } from "dotenv";
import { resolve } from "path";

// Cargar .env.local desde frontend/
config({ path: resolve(__dirname, "../frontend/.env.local") });

const apiKey = process.env.OPENAI_API_KEY!;
const baseURL = process.env.OPENAI_BASE_URL;
const model = process.env.OPENAI_MODEL || "gemini-2.5-flash";

if (!apiKey) {
  console.error("❌ OPENAI_API_KEY no está definida en frontend/.env.local");
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});

// ─── Tópicos sintéticos del ISTQB (mismo formato que FastAPI retorna) ───
const topicsJson = {
  "FL-1.1.1": { level_k: "K1", name: "Identificar objetivos típicos del testing", text: "El testing es un proceso que incluye todas las actividades del ciclo de vida." },
  "FL-1.2.1": { level_k: "K2", name: "Distinguir testing y debugging", text: "Testing y debugging son actividades diferentes aunque complementarias." },
  "FL-1.2.2": { level_k: "K2", name: "Explicar por qué el testing es necesario", text: "El testing ayuda a reducir riesgo y a mejorar la calidad." },
  "FL-2.1.1": { level_k: "K1", name: "Explicar el modelo de desarrollo en V", text: "El modelo en V es un modelo de desarrollo donde las pruebas se planifican en paralelo." },
  "FL-2.2.1": { level_k: "K3", name: "Aplicar testing en iteraciones", text: "En iteraciones cortas se aplican regression testing y smoke testing." },
};

const topicCount = Object.keys(topicsJson).length;
const expectedSessions = 6; // 3 días × 2 sesiones

const systemPrompt = `Eres un planificador ISTQB Foundation Level.
OBJETIVO: Crear un plan con ${expectedSessions} sesiones a partir de los tópicos dados.
REGLAS:
- K1 antes de K2, K2 antes de K3
- Cada sesión: 1-4 topic_codes
- topic_codes deben existir en la lista
- Si omites tópicos, decláralos en coverage.omitted_topic_codes
- Retorna SOLO JSON, sin markdown, sin comentarios fuera del JSON.`;

const topicList = Object.entries(topicsJson)
  .map(([code, t]) => `- ${code} [${t.level_k}]: ${t.name}`)
  .join("\n");

const userPrompt = `CONFIGURACIÓN:
- Días objetivo: 3
- Total sesiones: ${expectedSessions}
- Total tópicos disponibles: ${topicCount}

LISTA DE TÓPICOS (solo usa estos códigos):
${topicList}

FORMATO OBLIGATORIO (retorna SOLO este JSON, sin nada más):
{
  "objective_days": 3,
  "total_sessions": ${expectedSessions},
  "start_date": "2026-06-28",
  "estimated_end_date": "2026-06-30",
  "sessions": [
    {
      "session_number": 1,
      "day_number": 1,
      "session_type": "morning",
      "scheduled_time": "06:00",
      "duration_minutes": 90,
      "topic_codes": ["FL-1.1.1"],
      "method_used": "theory",
      "goal": "Introducción al testing",
      "rationale": "Comenzar con K1 antes de K2"
    }
  ],
  "coverage": {
    "total_topics": ${topicCount},
    "covered_topic_codes": ["FL-1.1.1"],
    "omitted_topic_codes": []
  }
}`;

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("TEST: Gemini vía SDK de OpenAI (UP-04)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`baseURL: ${baseURL}`);
  console.log(`model:   ${model}`);
  console.log(`topics:  ${topicCount} (esperando ${expectedSessions} sesiones)`);
  console.log("");

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
  } catch (err: any) {
    console.error("❌ ERROR llamando a Gemini:");
    console.error(`  status: ${err?.status}`);
    console.error(`  message: ${err?.message}`);
    if (err?.error) console.error(`  body: ${JSON.stringify(err.error, null, 2)}`);
    process.exit(1);
  }

  const raw = completion.choices[0]?.message?.content;
  const finishReason = completion.choices[0]?.finish_reason;
  console.log(`finish_reason: ${finishReason}`);
  console.log(
    `tokens: total=${completion.usage?.total_tokens}, ` +
      `prompt=${completion.usage?.prompt_tokens}, ` +
      `completion=${completion.usage?.completion_tokens}`,
  );
  console.log("--- RESPUESTA CRUDA ---");
  console.log(raw);
  console.log("");

  if (!raw) {
    console.error("❌ Respuesta vacía de Gemini");
    process.exit(1);
  }

  // ─── Parsear JSON ───
  let plan: any;
  try {
    plan = JSON.parse(raw);
  } catch (e) {
    console.error("❌ Gemini retornó JSON inválido");
    process.exit(1);
  }

  // ─── Validar (mismo algoritmo que route.ts) ───
  const errors: string[] = [];
  const originalCodes = new Set(Object.keys(topicsJson));

  if (!Array.isArray(plan.sessions)) errors.push("sessions no es array");
  if (plan.sessions?.length !== expectedSessions) {
    errors.push(`sessions.length=${plan.sessions?.length} esperado ${expectedSessions}`);
  }
  if (!plan.coverage || typeof plan.coverage !== "object") {
    errors.push("coverage no es objeto");
  } else {
    if (plan.coverage.total_topics !== topicCount) {
      errors.push(`coverage.total_topics=${plan.coverage.total_topics} esperado ${topicCount}`);
    }
    if (!Array.isArray(plan.coverage.covered_topic_codes)) {
      errors.push("coverage.covered_topic_codes no es array");
    }
    if (!Array.isArray(plan.coverage.omitted_topic_codes)) {
      errors.push("coverage.omitted_topic_codes no es array");
    }
  }

  // Detectar códigos inventados
  const hallucinated: string[] = [];
  const allUsedCodes: string[] = [];
  for (const s of plan.sessions ?? []) {
    for (const code of s.topic_codes ?? []) {
      allUsedCodes.push(code);
      if (!originalCodes.has(code)) hallucinated.push(code);
    }
  }
  if (hallucinated.length > 0) {
    errors.push(`Códigos inventados: ${hallucinated.join(", ")}`);
  }

  // Cobertura
  const omitted = new Set(plan.coverage?.omitted_topic_codes ?? []);
  const used = new Set(allUsedCodes);
  const missing = Array.from(originalCodes).filter((c) => !used.has(c) && !omitted.has(c));
  if (missing.length > 0) {
    errors.push(`Tópicos omitidos sin declarar: ${missing.join(", ")}`);
  }

  console.log("--- VALIDACIÓN ---");
  if (errors.length === 0) {
    console.log("✅ Plan válido. Sin errores.");
  } else {
    console.log(`❌ ${errors.length} errores:`);
    errors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log("");

  console.log("--- RESUMEN DEL PLAN ---");
  console.log(`Sesiones: ${plan.sessions?.length}`);
  console.log(`Tópicos cubiertos: ${plan.coverage?.covered_topic_codes?.length}`);
  console.log(`Tópicos omitidos: ${plan.coverage?.omitted_topic_codes?.length ?? 0}`);
  if (plan.sessions?.[0]) {
    console.log(`Sesión 1: day=${plan.sessions[0].day_number} ${plan.sessions[0].session_type} → ${plan.sessions[0].topic_codes?.join(", ")}`);
  }
  console.log("");
  console.log(`Tokens usados: ${completion.usage?.total_tokens}`);
  console.log("═══════════════════════════════════════════════════════════");

  if (errors.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
