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
import { createAdminClient } from "@/lib/supabase/admin";
import { executeAiJson } from "@/lib/ai/execute-json";
import { parseFirstJsonObject } from "@/lib/ai/json-object";
import {
  claimTheoryAiOperation,
  createTheoryAiFingerprint,
  releaseTheoryAiOperation,
} from "@/lib/ai/theory-operation";
import { parseCachedFastApiExtraction } from "@/lib/api/fastapi-contract";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLevelK(value: unknown): value is "K1" | "K2" | "K3" {
  return value === "K1" || value === "K2" || value === "K3";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function findTheoryTopicsPayload(value: unknown, depth = 0): unknown[] | null {
  if (!isRecord(value) || depth > 2) return null;

  if (Array.isArray(value.topics)) return value.topics;
  if (isRecord(value.topic)) return [value.topic];
  if (isNonEmptyString(value.topic_code)) return [value];

  for (const key of ["theory", "content", "data", "result", "response"]) {
    const nested = findTheoryTopicsPayload(value[key], depth + 1);
    if (nested) return nested;
  }

  return null;
}

function isKeyConcept(
  value: unknown,
): value is TheoryTopicContent["key_concepts"][number] {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.term) &&
    isNonEmptyString(value.definition) &&
    (value.example === undefined || isNonEmptyString(value.example))
  );
}

function isTheoryExample(
  value: unknown,
): value is TheoryTopicContent["examples"][number] {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.description) &&
    isNonEmptyString(value.lesson)
  );
}

function isTopicConnection(
  value: unknown,
): value is TheoryTopicContent["connections"][number] {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.related_topic_code) &&
    isNonEmptyString(value.relationship)
  );
}

function isTheoryTopic(value: unknown): value is TheoryTopicContent {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.topic_code) &&
    isNonEmptyString(value.topic_name) &&
    (value.level_k === undefined || isLevelK(value.level_k) || typeof value.level_k === "string") &&
    isNonEmptyString(value.introduction) &&
    Array.isArray(value.key_concepts) &&
    value.key_concepts.every(isKeyConcept) &&
    Array.isArray(value.examples) &&
    value.examples.every(isTheoryExample) &&
    Array.isArray(value.connections) &&
    value.connections.every(isTopicConnection) &&
    isNonEmptyString(value.summary)
  );
}

export function parseTheoryResponse(
  rawText: string,
  expectedTopics: SessionTopic[],
): TheoryTopicContent[] | null {
  const value = parseFirstJsonObject(rawText);
  const topicsPayload = findTheoryTopicsPayload(value);
  if (!topicsPayload) {
    return null;
  }

  // Sanitizar nulls en key_concepts.example para que coincidan con la definición opcional de TypeScript
  for (const topic of topicsPayload) {
    if (isRecord(topic) && Array.isArray(topic.key_concepts)) {
      for (const concept of topic.key_concepts) {
        if (
          isRecord(concept) &&
          (concept.example === null || concept.example === "")
        ) {
          delete concept.example;
        }
      }
    }
  }

  if (!topicsPayload.every(isTheoryTopic)) {
    return null;
  }

  const expectedCodes = expectedTopics.map((topic) => topic.code);
  const expectedCodeSet = new Set(expectedCodes);
  const generatedCodes = topicsPayload.map((topic) => topic.topic_code);
  if (
    expectedCodeSet.size !== expectedCodes.length ||
    topicsPayload.length !== expectedCodes.length ||
    new Set(generatedCodes).size !== generatedCodes.length ||
    generatedCodes.some((code) => !expectedCodeSet.has(code))
  ) {
    return null;
  }

  if (validateTheoryTopics(topicsPayload, expectedCodes).length > 0) {
    return null;
  }

  const generatedByCode = new Map(
    topicsPayload.map((topic) => [topic.topic_code, topic]),
  );
  const orderedTopics: TheoryTopicContent[] = [];
  for (const expected of expectedTopics) {
    const generated = generatedByCode.get(expected.code);
    if (!generated) return null;
    orderedTopics.push({
      ...generated,
      topic_name: expected.name,
      level_k: expected.level_k,
    });
  }
  return orderedTopics;
}

export function buildTheoryFormatRetryPrompt(
  basePrompt: string,
  topic: SessionTopic,
): string {
  return `${basePrompt}

## REINTENTO ESTRICTO DE FORMATO

El intento anterior no cumplio el contrato JSON requerido por la aplicacion.
Devuelve solo un objeto JSON valido, sin Markdown, sin explicaciones y sin texto adicional.

Contrato obligatorio:
- La raiz debe ser exactamente un objeto con la propiedad "topics".
- "topics" debe ser un array con exactamente 1 elemento.
- El unico elemento debe usar topic_code "${topic.code}", topic_name "${topic.name}" y level_k "${topic.level_k}".
- Incluye introduction, key_concepts, examples, connections y summary con contenido pedagogico completo.
- No uses nombres alternativos como "topic", "theory", "content", "data", "result" o "response" en la raiz.
- No omitas key_concepts ni summary.`;
}

function createDemoTheoryRaw(topics: SessionTopic[]): string {
  const demoTopics: TheoryTopicContent[] = topics.map((topic) => ({
    topic_code: topic.code,
    topic_name: topic.name,
    level_k: topic.level_k,
    introduction:
      "[MODO DEMO] Este contenido explica de forma guiada el objetivo " +
      topic.code +
      " y permite comprobar la navegación sin contactar un proveedor externo.",
    key_concepts: [
      {
        term: topic.name,
        definition:
          "Concepto educativo determinista basado en el tópico seleccionado.",
        example:
          "Relaciona el objetivo con una situación cotidiana de aseguramiento de calidad.",
      },
    ],
    examples: [
      {
        title: "Ejemplo de modo Demo",
        description:
          "Un equipo revisa un criterio verificable antes de liberar una funcionalidad.",
        lesson:
          "La evidencia y el resultado esperado deben definirse antes de ejecutar la prueba.",
      },
    ],
    connections: [
      {
        related_topic_code: topic.code,
        relationship:
          "El fixture conserva el código real para validar el contrato de la sesión.",
      },
    ],
    summary:
      "[MODO DEMO] Repasa la definición, identifica evidencia y aplica el concepto en un caso sencillo.",
  }));

  return JSON.stringify({ topics: demoTopics });
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
  let theoryClaim: {
    userId: string;
    sessionId: string;
    fingerprint: string;
    claimToken: string;
  } | null = null;

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
    if (
      session.theory_content &&
      (!force || session.status === "completed")
    ) {
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

      if (cachedTheory?.source_extraction_version === 2) {
        return NextResponse.json({
          theory: cachedTheory,
          cached: true,
        });
      }

      console.warn("[theory] theory_content desactualizado, regenerando...");
    }

    if (session.status !== "pending" && session.status !== "active") {
      return NextResponse.json(
        { error: "La sesión ya no admite regenerar contenido teórico." },
        { status: 409 },
      );
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
      .select("topics_json, extracted_text")
      .eq("id", plan.document_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const extraction = parseCachedFastApiExtraction(
      doc?.topics_json,
      doc?.extracted_text,
    );
    if (!extraction?.is_complete) {
      return NextResponse.json(
        {
          error:
            "El documento usa una extracción incompleta o desactualizada. " +
            "Vuelve a extraer el PDF y regenera el plan antes de estudiar.",
          code: "EXTRACTION_OUTDATED",
        },
        { status: 409 },
      );
    }

    const topicsJson: TopicsJson = extraction.topics;

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
    const fingerprint = createTheoryAiFingerprint(
      JSON.stringify({
        version: 2,
        sessionId,
        force,
        method,
        attemptNumber: session.attempt_number,
        topicCodes: sessionTopics.map((topic) => topic.code),
      }),
    );
    const adminClient = createAdminClient();
    let claim: Awaited<ReturnType<typeof claimTheoryAiOperation>>;
    try {
      claim = await claimTheoryAiOperation(adminClient, {
        userId: user.id,
        sessionId,
        fingerprint,
      });
    } catch {
      return NextResponse.json(
        {
          error: "No se pudo coordinar la generación de teoría. Intenta de nuevo.",
          code: "THEORY_CLAIM_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    if (claim.outcome === "in_progress") {
      return NextResponse.json(
        {
          error: "La teoría ya se está generando. Espera un momento.",
          code: "THEORY_GENERATION_IN_PROGRESS",
        },
        { status: 409, headers: { "Retry-After": "2" } },
      );
    }
    if (claim.outcome === "conflict") {
      return NextResponse.json(
        {
          error: "Hay otra generación de teoría activa para esta sesión.",
          code: "THEORY_GENERATION_CONFLICT",
        },
        { status: 409, headers: { "Retry-After": "2" } },
      );
    }

    theoryClaim = {
      userId: user.id,
      sessionId,
      fingerprint,
      claimToken: claim.claimToken,
    };

    const systemPrompt = buildTheorySystemPrompt(method);

    // ═══════════════════════════════════════════════════════════
    // PASO 7: Generar con runtime IA centralizado (un tópico a la vez para evitar truncamiento)
    // ═══════════════════════════════════════════════════════════
    console.log(
      `[theory] Generando teoría para sesión ${sessionId} ` +
        `(${sessionTopics.length} tópicos, método=${method})`,
    );

    const topicsContent: TheoryTopicContent[] = [];
    let lastProvider: string | null = null;
    let lastModel: string | null = null;

    for (const topic of sessionTopics) {
      console.log(`[theory] Generando tópico individual: ${topic.code} (${topic.name})`);
      const topicUserPrompt = buildTheoryUserPrompt(
        [topic],
        method,
        session.day_number,
        session.session_type,
        session.attempt_number,
      );

      const ai = await executeAiJson<TheoryTopicContent[]>({
        request,
        userId: user.id,
        feature: "theory",
        systemPrompt,
        userPrompts: [
          topicUserPrompt,
          buildTheoryFormatRetryPrompt(topicUserPrompt, topic),
        ],
        maxCompletionTokensPerAttempt: 4000, // un solo tópico cabe holgadamente con su detalle completo aquí
        timeoutMs: THEORY_TIMEOUT_MS,
        parse: (rawText) => parseTheoryResponse(rawText, [topic]),
        createDemoRaw: () => createDemoTheoryRaw([topic]),
      });

      if (!ai.ok) {
        return NextResponse.json(ai.body, { status: ai.status });
      }

      topicsContent.push(...ai.value);
      if (ai.provider) lastProvider = ai.provider;
      if (ai.model) lastModel = ai.model;
    }

    // ═══════════════════════════════════════════════════════════
    // PASO 8: Construir el TheoryContent completo
    // ═══════════════════════════════════════════════════════════
    const theoryContent: TheoryContent = {
      source_extraction_version: 2,
      topics: topicsContent,
      method_used: method,
      generated_at: new Date().toISOString(),
      model_provider: (lastProvider as TheoryContent["model_provider"]) ?? "demo",
      model_name: lastModel ?? "fixture-ai05",
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

    let updateQuery = adminClient
      .from("sessions")
      .update(updateData)
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .neq("status", "completed");

    if (session.status === "pending") {
      updateQuery = updateQuery.eq("status", "pending");
    }

    const { data: updatedSession, error: updateError } = await updateQuery
      .select("id")
      .maybeSingle();

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

    if (!updatedSession) {
      return NextResponse.json(
        {
          error:
            "La sesión cambió de estado mientras se generaba la teoría. Recarga antes de continuar.",
        },
        { status: 409 },
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
  } finally {
    if (theoryClaim) {
      try {
        await releaseTheoryAiOperation(createAdminClient(), theoryClaim);
      } catch {
        console.error("[theory] No se pudo liberar el lease de generación.");
      }
    }
  }
}
