// ============================================================
// components/session/theory-topic-view.tsx
// Vista de contenido teórico de un tópico individual
// ============================================================
// TIPO: Client Component (importa CollapsibleSection que usa estado)
//
// PROPS:
//   - topic: TheoryTopicContent — El contenido teórico del tópico
//
// DISEÑO:
//   Cada sección del contenido teórico se renderiza como un
//   CollapsibleSection con su ícono y contenido formateado.
//   Las secciones de Introducción y Conceptos Clave se abren
//   por defecto para que el estudiante vea contenido al cargar.
//
// ¿POR QUÉ NO USAR react-markdown AQUÍ?
//   El contenido teórico del LLM viene como JSON estructurado
//   (no como markdown crudo). Cada campo (introduction, summary)
//   es texto plano, y key_concepts es un array de objetos.
//   Renderizamos directamente el JSX en vez de parsear markdown.
//
//   Si en el futuro el LLM envía markdown dentro de introduction
//   o summary, podemos envolver esos campos con <ReactMarkdown>.
// ============================================================

"use client";

import { BookOpen, Lightbulb, Beaker, Link2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "./collapsible-section";
import type { TheoryTopicContent } from "@/types/theory";

interface TheoryTopicViewProps {
  topic: TheoryTopicContent;
}

// ─── Mapeo de level_k a colores de badge ────────────────────
function getLevelBadgeStyle(level: string): string {
  const map: Record<string, string> = {
    K1: "border-sky-700 bg-sky-950/40 text-sky-300",
    K2: "border-amber-700 bg-amber-950/40 text-amber-300",
    K3: "border-rose-700 bg-rose-950/40 text-rose-300",
  };
  return map[level] || "border-slate-700 bg-slate-800 text-slate-300";
}

export function TheoryTopicView({ topic }: TheoryTopicViewProps) {
  return (
    <div className="space-y-3">
      {/* ── Header del tópico ─────────────────────────────── */}
      <div className="flex items-center gap-3 px-1">
        <span className="font-mono text-sm font-semibold text-emerald-400">
          {topic.topic_code}
        </span>
        <Badge variant="outline" className={getLevelBadgeStyle(topic.level_k)}>
          {topic.level_k}
        </Badge>
        <span className="text-sm text-slate-300 truncate">
          {topic.topic_name}
        </span>
      </div>

      {/* ── Sección 1: Introducción ───────────────────────── */}
      <CollapsibleSection
        title="Introducción"
        icon={BookOpen}
        defaultOpen={true}
      >
        <div className="prose-sm text-sm leading-relaxed text-slate-300 whitespace-pre-line">
          {topic.introduction}
        </div>
      </CollapsibleSection>

      {/* ── Sección 2: Conceptos Clave ────────────────────── */}
      <CollapsibleSection
        title="Conceptos Clave"
        icon={Lightbulb}
        defaultOpen={true}
        badge={`${topic.key_concepts.length} conceptos`}
      >
        <div className="space-y-4">
          {topic.key_concepts.map((concept, index) => (
            <div
              key={`concept-${index}`}
              className="rounded-lg border border-slate-800/60 bg-slate-950/30 p-3"
            >
              {/* Término en negrita + color acento */}
              <h4 className="text-sm font-semibold text-emerald-300">
                {concept.term}
              </h4>
              {/* Definición */}
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                {concept.definition}
              </p>
              {/* Ejemplo del concepto (si existe) */}
              {concept.example && (
                <p className="mt-2 border-l-2 border-emerald-800 pl-3 text-xs leading-5 text-slate-400 italic">
                  💡 {concept.example}
                </p>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── Sección 3: Ejemplos Prácticos ─────────────────── */}
      {topic.examples && topic.examples.length > 0 && (
        <CollapsibleSection
          title="Ejemplos Prácticos"
          icon={Beaker}
          badge={`${topic.examples.length} ejemplos`}
        >
          <div className="space-y-4">
            {topic.examples.map((example, index) => (
              <div
                key={`example-${index}`}
                className="rounded-lg border border-slate-800/60 bg-slate-950/30 p-3"
              >
                <h4 className="text-sm font-semibold text-sky-300">
                  {example.title}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">
                  {example.description}
                </p>
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-400/80">
                  <span className="shrink-0 mt-0.5">📌</span>
                  <span className="leading-5">{example.lesson}</span>
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Sección 4: Conexiones ─────────────────────────── */}
      {topic.connections && topic.connections.length > 0 && (
        <CollapsibleSection
          title="Conexiones con otros tópicos"
          icon={Link2}
          badge={`${topic.connections.length}`}
        >
          <div className="space-y-2">
            {topic.connections.map((conn, index) => (
              <div
                key={`conn-${index}`}
                className="flex items-start gap-2 text-sm"
              >
                <span className="shrink-0 font-mono text-xs text-purple-400 mt-0.5">
                  {conn.related_topic_code}
                </span>
                <span className="text-slate-400 leading-relaxed">
                  {conn.relationship}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Sección 5: Resumen ────────────────────────────── */}
      <CollapsibleSection title="Resumen" icon={FileText}>
        <div className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-3">
          <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">
            {topic.summary}
          </p>
        </div>
      </CollapsibleSection>
    </div>
  );
}
