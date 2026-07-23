// ============================================================
// types/theory.ts — Tipos para el contenido teórico generado
// ============================================================
// Estos tipos definen la estructura del JSON que el LLM retorna
// cuando genera contenido teórico para una sesión de estudio.
//
// La estructura está diseñada para ser directamente renderizable
// en el TheoryPanel (SE-03), donde cada campo corresponde a una
// sección colapsable de la interfaz.
//
// ¿Por qué un tipo separado de sessions.ts?
//   - sessions.ts define la SESIÓN con todo su contexto
//   - theory.ts define el CONTENIDO TEÓRICO generado
//   - La sesión CONTIENE el contenido teórico en theory_content
//   - Separar los tipos mantiene cada archivo enfocado
// ============================================================

import type { LevelK, MethodUsed } from "./database";

// ──────────────────────────────────────────────────────────────
// Concepto clave individual
// ──────────────────────────────────────────────────────────────

/**
 * Un concepto clave explicado por el LLM.
 *
 * Cada concepto tiene un término, su definición, y opcionalmente
 * un ejemplo breve para concretizarlo.
 */
export interface KeyConcept {
  /** Término o concepto (ej. "Defecto (Bug)") */
  term: string;
  /** Definición clara y concisa del término */
  definition: string;
  /** Ejemplo breve que ilustra el concepto (opcional) */
  example?: string;
}

// ──────────────────────────────────────────────────────────────
// Ejemplo práctico
// ──────────────────────────────────────────────────────────────

/**
 * Ejemplo práctico del mundo real del testing.
 *
 * Cuando el método es "examples", el LLM genera más ejemplos
 * y más detallados. Con "theory", genera 1-2 ejemplos breves.
 */
export interface TheoryExample {
  /** Título del ejemplo (ej. "Bug del Therac-25") */
  title: string;
  /** Descripción del escenario */
  description: string;
  /** Lección o moraleja que el ejemplo enseña */
  lesson: string;
}

// ──────────────────────────────────────────────────────────────
// Conexión con otros tópicos
// ──────────────────────────────────────────────────────────────

/**
 * Conexión entre el tópico actual y otro tópico del ISTQB.
 *
 * Estas conexiones ayudan al estudiante a ver el "big picture"
 * y entender cómo los tópicos se relacionan entre sí.
 */
export interface TopicConnection {
  /** Código del tópico relacionado (ej. "FL-2.1.1") */
  related_topic_code: string;
  /** Descripción breve de cómo se relacionan */
  relationship: string;
}

// ──────────────────────────────────────────────────────────────
// Contenido teórico completo de un tópico
// ──────────────────────────────────────────────────────────────

/**
 * Contenido teórico generado para UN tópico de la sesión.
 *
 * Cada sesión puede tener múltiples tópicos (ej. FL-1.1.1, FL-1.1.2).
 * Para cada tópico, el LLM genera un TheoryTopicContent completo.
 */
export interface TheoryTopicContent {
  /** Código del tópico (ej. "FL-1.1.1") */
  topic_code: string;
  /** Nombre del tópico */
  topic_name: string;
  /** Nivel K: K1, K2, o K3 */
  level_k: LevelK;

  /** Introducción al tópico (2-3 párrafos) */
  introduction: string;
  /** Conceptos clave del tópico (3-7 items) */
  key_concepts: KeyConcept[];
  /** Ejemplos prácticos (1-5 items, más si method=examples) */
  examples: TheoryExample[];
  /** Conexiones con otros tópicos del ISTQB (1-3 items) */
  connections: TopicConnection[];
  /** Resumen ejecutivo del tópico (1-2 párrafos) */
  summary: string;
}

// ──────────────────────────────────────────────────────────────
// Contenido teórico completo de la sesión
// ──────────────────────────────────────────────────────────────

/**
 * Contenido teórico COMPLETO de una sesión de estudio.
 *
 * Este es el tipo que se almacena como JSON stringificado en
 * sessions.theory_content y que SE-03 renderiza en la UI.
 */
export interface TheoryContent {
  /** Versión de la extracción autoritativa usada como fuente */
  source_extraction_version: 2;
  /** Array de contenido teórico, uno por tópico de la sesión */
  topics: TheoryTopicContent[];
  /** Método de enseñanza usado para generar este contenido */
  method_used: MethodUsed;
  /** Timestamp ISO de cuándo se generó */
  generated_at: string;
  /** Proveedor LLM que generó el contenido */
  model_provider: string;
  /** Modelo específico usado */
  model_name: string;
}

// ──────────────────────────────────────────────────────────────
// Tipos de la API Response
// ──────────────────────────────────────────────────────────────

/** Response exitoso de POST /api/sessions/[id]/theory */
export interface TheoryResponse {
  /** Contenido teórico generado */
  theory: TheoryContent;
  /** true si se retornó contenido previamente generado */
  cached: boolean;
}
