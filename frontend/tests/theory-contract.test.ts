import { describe, expect, it } from "vitest";
import {
  buildTheoryFormatRetryPrompt,
  parseTheoryResponse,
} from "@/app/api/sessions/[id]/theory/route";
import type { SessionTopic } from "@/types/sessions";
import type { TheoryTopicContent } from "@/types/theory";

const topic: SessionTopic = {
  code: "FL-1.1.1",
  name: "Que es testing",
  level_k: "K1",
  syllabus_text: "Contenido del syllabus sobre fundamentos de testing.",
  progress_status: "pending",
  attempts: 0,
  best_score: 0,
};

function validTheoryTopic(
  overrides: Partial<TheoryTopicContent> = {},
): TheoryTopicContent {
  return {
    topic_code: topic.code,
    topic_name: "Nombre generado por el proveedor",
    level_k: topic.level_k,
    introduction:
      "El testing de software ayuda a entregar productos con mayor confianza. " +
      "Permite identificar defectos, reducir riesgos y aportar informacion al equipo antes de liberar.",
    key_concepts: [
      {
        term: "Testing",
        definition:
          "Conjunto de actividades para evaluar un producto y aportar evidencia sobre su calidad.",
        example: "Revisar un flujo de login antes de publicarlo.",
      },
    ],
    examples: [
      {
        title: "Revision de login",
        description:
          "Un equipo ejecuta pruebas para confirmar que usuarios validos pueden entrar.",
        lesson:
          "El resultado esperado debe definirse antes de ejecutar la prueba.",
      },
    ],
    connections: [
      {
        related_topic_code: "FL-1.1.2",
        relationship:
          "La relacion conecta el objetivo del testing con sus beneficios.",
      },
    ],
    summary:
      "El testing aporta evidencia, reduce incertidumbre y permite tomar mejores decisiones sobre la calidad del producto.",
    ...overrides,
  };
}

describe("theory response contract", () => {
  it("accepts a provider response wrapped under theory.topics", () => {
    const parsed = parseTheoryResponse(
      JSON.stringify({
        theory: {
          topics: [validTheoryTopic()],
        },
      }),
      [topic],
    );

    expect(parsed).toHaveLength(1);
    expect(parsed?.[0].topic_code).toBe(topic.code);
    expect(parsed?.[0].topic_name).toBe(topic.name);
    expect(parsed?.[0].level_k).toBe(topic.level_k);
  });

  it("accepts a single topic object when the provider omits the topics wrapper", () => {
    const parsed = parseTheoryResponse(
      JSON.stringify({ topic: validTheoryTopic() }),
      [topic],
    );

    expect(parsed).toHaveLength(1);
    expect(parsed?.[0].key_concepts[0].term).toBe("Testing");
  });

  it("rejects pedagogically incomplete theory", () => {
    const parsed = parseTheoryResponse(
      JSON.stringify({
        topics: [
          validTheoryTopic({
            key_concepts: [],
          }),
        ],
      }),
      [topic],
    );

    expect(parsed).toBeNull();
  });

  it("builds a strict retry prompt for the expected topic", () => {
    const prompt = buildTheoryFormatRetryPrompt("Base", topic);

    expect(prompt).toContain('topic_code "FL-1.1.1"');
    expect(prompt).toContain('"topics" debe ser un array');
    expect(prompt).toContain("No uses nombres alternativos");
  });
});
