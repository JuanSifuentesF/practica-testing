// ─────────────────────────────────────────────────────────────────
// app/api/sessions/[id]/theory/route.ts
// Route Handler: genera contenido teórico para una sesión de estudio.
//
// Método: POST
// Auth: Requiere sesión válida (cookie JWT de Supabase)
// Params: id — UUID de la sesión
// Body (opcional):
//   {
//     force?: boolean  // true = regenerar aunque ya exista
//   }
//
// Response (200): { theory: TheoryContent, cached: boolean }
// Response (401): { error: "No autenticado" }
// Response (400): { error: "Descripción del problema" }
// Response (404): { error: "Sesión no encontrada" }
// Response (500): { error: "Error interno del servidor" }
// Response (502): { error: "Error en la generación de teoría" }
//
// IDEMPOTENCIA:
//   Si theory_content ya existe y force !== true, retorna el
//   contenido existente sin llamar al LLM.
//
// SIDE EFFECTS:
//   - Guarda theory_content en la tabla sessions
//   - Cambia status de 'pending' a 'active'
//   - Establece started_at si es la primera vez
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createModelRuntimes,
  getModelErrorStatus,
  isModelTimeout,
} from "@/lib/ai/model-cascade";
import {
  buildTheorySystemPrompt,
  buildTheoryUserPrompt,
} from "@/lib/prompts/theory";
import type { SessionRow, StudyPlanRow, TopicsJson, MethodUsed } from "@/types";
import type { SessionTopic } from "@/types/sessions";
import type { TheoryContent, TheoryTopicContent } from "@/types/theory";

// ─── Forzar Node.js runtime ─────────────────────────────────────
export const runtime = "nodejs";

// ─── Constantes ──────────────────────────────────────────────────
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Timeout para la generación de teoría (más corto que el plan)
// La teoría genera ~3-5K tokens vs ~15K tokens del plan
const THEORY_TIMEOUT_MS = 90_000; // 90 segundos — contenido 3-5K tokens requiere más margen

// ──────────────────────────────────────────────────────────────
// Parser defensivo del response del LLM
// ──────────────────────────────────────────────────────────────

/**
 * Extrae y parsea el JSON del response del LLM.
 *
 * Los LLMs a veces retornan el JSON envuelto en:
 *   - Texto introductorio ("Aquí tienes el contenido:")
 *   - Bloques de código markdown (```json ... ```)
 *   - Texto final ("Espero que esto sea útil")
 *
 * Esta función maneja todos esos casos.
 */
function parseTheoryResponse(rawText: string): TheoryContent["topics"] | null {
  let text = rawText.trim();

  // ─── Intentar extraer de bloque markdown ────────────────
  const markdownMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (markdownMatch) {
    text = markdownMatch[1].trim();
  }

  // ─── Intentar encontrar el JSON delimitado por {} ───────
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(text);

    // Verificar que tiene la estructura esperada
    if (!parsed.topics || !Array.isArray(parsed.topics)) {
      return null;
    }

    return parsed.topics as TheoryTopicContent[];
  } catch {
    return null;
  }
}

/**
 * Valida que los tópicos generados tienen la estructura mínima.
 */
function validateTheoryTopics(
  topics: TheoryTopicContent[],
  expectedCodes: string[],
): string[] {
  const errors: string[] = [];
  const generatedCodes = new Set(topics.map((t) => t.topic_code));

  // Verificar que cada tópico esperado fue generado
  for (const code of expectedCodes) {
    if (!generatedCodes.has(code)) {
      errors.push(`Tópico ${code} no fue generado por el LLM.`);
    }
  }

  // Verificar estructura mínima de cada tópico generado
  for (const topic of topics) {
    if (!topic.introduction || topic.introduction.length < 50) {
      errors.push(
        `${topic.topic_code}: introduction es demasiado corta o falta.`,
      );
    }
    if (!topic.key_concepts || topic.key_concepts.length === 0) {
      errors.push(`${topic.topic_code}: key_concepts está vacío o falta.`);
    }
    if (!topic.summary || topic.summary.length < 30) {
      errors.push(`${topic.topic_code}: summary es demasiado corto o falta.`);
    }
  }

  return errors;
}

// ──────────────────────────────────────────────────────────────
// Route Handler: POST
// ──────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ═══════════════════════════════════════════════════════════
    // PASO 1: Extraer y validar parámetros
    // ═══════════════════════════════════════════════════════════
    const { id: sessionId } = await params;

    if (!sessionId || !UUID_REGEX.test(sessionId)) {
      return NextResponse.json(
        { error: "session_id debe ser un UUID válido" },
        { status: 400 },
      );
    }

    // Leer body (opcional — solo para el flag 'force')
    let force = false;
    try {
      const body = await request.json();
      if (body && typeof body.force === "boolean") {
        force = body.force;
      }
    } catch {
      // Body vacío o no-JSON es aceptable — force queda en false
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 2: Autenticación
    // ═══════════════════════════════════════════════════════════
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 3: Buscar la sesión
    // ═══════════════════════════════════════════════════════════
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle<SessionRow>();

    if (sessionError) {
      console.error("[theory] Error al buscar sesión:", sessionError);
      return NextResponse.json(
        { error: "Error al buscar la sesión" },
        { status: 500 },
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: "Sesión no encontrada." },
        { status: 404 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 4: Verificar caché (idempotencia)
    // ═══════════════════════════════════════════════════════════
    if (session.theory_content && !force) {
      // El contenido ya fue generado — retornar sin llamar al LLM
      let cachedTheory: TheoryContent;
      try {
        cachedTheory =
          typeof session.theory_content === "string"
            ? JSON.parse(session.theory_content)
            : session.theory_content;
      } catch {
        // Si el JSON almacenado está corrupto, regenerar
        console.warn("[theory] theory_content corrupto, regenerando...");
        // Continuar al paso 5 (no retornar)
        cachedTheory = null as unknown as TheoryContent;
      }

      if (cachedTheory) {
        return NextResponse.json({
          theory: cachedTheory,
          cached: true,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 5: Obtener datos del plan y tópicos
    // ═══════════════════════════════════════════════════════════
    const { data: plan } = await supabase
      .from("study_plans")
      .select("id, document_id, objective_days, start_date, estimated_end_date")
      .eq("id", session.study_plan_id)
      .eq("user_id", user.id)
      .maybeSingle<
        Pick<
          StudyPlanRow,
          | "id"
          | "document_id"
          | "objective_days"
          | "start_date"
          | "estimated_end_date"
        >
      >();

    if (!plan) {
      return NextResponse.json(
        { error: "No se encontró el plan asociado a esta sesión." },
        { status: 404 },
      );
    }

    // Obtener topics_json del documento
    const { data: doc } = await supabase
      .from("documents")
      .select("topics_json")
      .eq("id", plan.document_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const topicsJson: TopicsJson = doc?.topics_json || {};

    // Obtener progreso de los tópicos de esta sesión
    const { data: progressRows } = await supabase
      .from("topic_progress")
      .select("topic_code, status, attempts, best_score, level_k")
      .eq("study_plan_id", plan.id)
      .eq("user_id", user.id)
      .in("topic_code", session.topic_codes || []);

    const progressMap = new Map();
    if (progressRows) {
      for (const row of progressRows) {
        progressMap.set(row.topic_code, row);
      }
    }

    // Construir array de SessionTopic para el prompt builder
    const sessionTopics: SessionTopic[] = (session.topic_codes || []).map(
      (code: string) => {
        const topicData = topicsJson[code];
        const progress = progressMap.get(code);
        return {
          code,
          name: topicData?.name || code,
          level_k: topicData?.level_k || progress?.level_k || "K1",
          syllabus_text: topicData?.text || "",
          progress_status: progress?.status || "pending",
          attempts: progress?.attempts || 0,
          best_score: progress?.best_score || 0,
        };
      },
    );

    if (sessionTopics.length === 0) {
      return NextResponse.json(
        { error: "La sesión no tiene tópicos asignados." },
        { status: 400 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 6: Construir prompts
    // ═══════════════════════════════════════════════════════════
    const method = session.method_used as MethodUsed;
    const systemPrompt = buildTheorySystemPrompt(method);
    const userPrompt = buildTheoryUserPrompt(
      sessionTopics,
      method,
      session.day_number,
      session.session_type,
      session.attempt_number,
    );

    // ═══════════════════════════════════════════════════════════
    // PASO 7: Llamar al LLM con cascada Gemini → OpenAI
    // ═══════════════════════════════════════════════════════════
    const modelRuntimes = createModelRuntimes({
      timeoutMs: THEORY_TIMEOUT_MS,
      geminiModels: [process.env.GEMINI_THEORY_MODEL],
      openaiModels: [process.env.OPENAI_THEORY_MODEL],
      maxRetries: 2,
    });

    console.log(
      `[theory] Generando teoría para sesión ${sessionId} ` +
        `(${sessionTopics.length} tópicos, método=${method})`,
    );

    const expectedCodes = session.topic_codes || [];
    let parsedTopics: TheoryTopicContent[] | null = null;
    let modelRuntime: (typeof modelRuntimes)[number] | null = null;
    let elapsed = 0;
    let tokensUsed = 0;
    let allAttemptsTimedOut = modelRuntimes.length > 0;

    for (const candidate of modelRuntimes) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), candidate.timeoutMs);
      const startTime = Date.now();

      try {
        const completion = await candidate.client.chat.completions.create(
          {
            model: candidate.model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            // JSON mode reduce respuestas con markdown o texto extra.
            // El prompt ya menciona JSON explícitamente, requisito de OpenAI.
            response_format: { type: "json_object" },
            // Gemini 2.5 Flash y gpt-4o-mini aceptan temperature.
            // No usamos GPT-5 en SE-02 para evitar rechazos por parámetros.
            temperature: 0.7,
          },
          { signal: controller.signal },
        );

        const candidateTopics = parseTheoryResponse(
          completion.choices[0]?.message?.content || "",
        );
        if (!candidateTopics) {
          allAttemptsTimedOut = false;
          continue;
        }

        if (validateTheoryTopics(candidateTopics, expectedCodes).length > 0) {
          allAttemptsTimedOut = false;
          continue;
        }

        parsedTopics = candidateTopics;
        modelRuntime = candidate;
        elapsed = Date.now() - startTime;
        tokensUsed = completion.usage?.total_tokens || 0;
        break;
      } catch (llmError) {
        const status = getModelErrorStatus(llmError);
        if (!isModelTimeout(llmError) && status !== 408 && status !== 504) {
          allAttemptsTimedOut = false;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!parsedTopics || !modelRuntime) {
      return NextResponse.json(
        {
          error:
            allAttemptsTimedOut
              ? "Los modelos de IA agotaron el tiempo de respuesta. Intenta de nuevo."
              : "No se pudo generar teoría válida. Intenta de nuevo.",
        },
        { status: allAttemptsTimedOut ? 504 : 502 },
      );
    }

    console.log(
      `[theory] LLM respondió en ${elapsed}ms, ` +
        `${tokensUsed} tokens, modelo=${modelRuntime.model}`,
    );

    // ═══════════════════════════════════════════════════════════
    // PASO 8: Construir el TheoryContent completo
    // ═══════════════════════════════════════════════════════════
    const theoryContent: TheoryContent = {
      topics: parsedTopics,
      method_used: method,
      generated_at: new Date().toISOString(),
      model_provider: modelRuntime.provider,
      model_name: modelRuntime.model,
    };

    // ═══════════════════════════════════════════════════════════
    // PASO 9: Guardar en Supabase + actualizar estado
    // ═══════════════════════════════════════════════════════════
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      theory_content: JSON.stringify(theoryContent),
    };

    // Si la sesión estaba en 'pending', marcarla como 'active'
    // y registrar la hora de inicio.
    if (session.status === "pending") {
      updateData.status = "active";
      updateData.started_at = now;
    }

    const { error: updateError } = await supabase
      .from("sessions")
      .update(updateData)
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[theory] Error al guardar theory_content:", updateError);
      return NextResponse.json(
        {
          error:
            "La teoría fue generada, pero no se pudo guardar en Supabase. " +
            "Intenta de nuevo antes de continuar.",
        },
        { status: 500 },
      );
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 10: Retornar el contenido teórico
    // ═══════════════════════════════════════════════════════════
    return NextResponse.json({
      theory: theoryContent,
      cached: false,
    });
  } catch {
    console.error("[theory] Error inesperado.");

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
