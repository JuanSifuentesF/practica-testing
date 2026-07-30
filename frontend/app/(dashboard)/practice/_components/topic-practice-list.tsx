"use client";

// ─────────────────────────────────────────────────────────────────
// practice/_components/topic-practice-list.tsx
// Lista de tópicos ISTQB agrupada por capítulo.
//
// TIPO: Client Component (usa el PracticeCard interactivo).
// PATRÓN: Presentational — recibe la lista filtrada, la agrupa
//         por capítulo y renderiza secciones con PracticeCards.
//
// AGRUPACIÓN:
//   Los tópicos ISTQB siguen el patrón FL-{capítulo}.{sección}.{subsección}.
//   Este componente extrae el número de capítulo del código del tópico
//   y agrupa los tópicos bajo headers descriptivos:
//     - Cap. 1: Fundamentos del Testing
//     - Cap. 2: Testing en el SDLC
//     - Cap. 3: Testing Estático
//     - Cap. 4: Técnicas de Testing
//     - Cap. 5: Gestión del Testing
//     - Cap. 6: Herramientas de Testing
//
// DISEÑO:
//   - Headers de capítulo con estilo de sección colapsable
//   - Grid responsivo de PracticeCards dentro de cada sección
//   - Animación sutil al cargar la lista
// ─────────────────────────────────────────────────────────────────

import { BookOpen } from "lucide-react";
import { PracticeCard } from "./practice-card";
import type { LevelK } from "@/types/database";

// ─── Tipos ────────────────────────────────────────────────────

/** Datos de un tópico listos para renderizar en el Hub */
export interface TopicForDisplay {
  topicCode: string;
  topicName: string;
  levelK: LevelK;
  exerciseCount: number;
  isUnlocked?: boolean;
  unlockedDay?: number;
}

export interface TopicPracticeListProps {
  /** Lista de tópicos (ya filtrada por el padre) */
  topics: TopicForDisplay[];
  /** ID del documento para pasar a los PracticeCards */
  documentId: string;
}

// ─── Constantes ───────────────────────────────────────────────

/** Nombres descriptivos de los capítulos ISTQB Foundation Level */
const CHAPTER_NAMES: Record<string, string> = {
  "1": "Fundamentos del Testing",
  "2": "Testing a lo Largo del SDLC",
  "3": "Testing Estático",
  "4": "Técnicas de Testing",
  "5": "Gestión del Testing",
  "6": "Herramientas de Testing",
};

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Extrae el número de capítulo del código de tópico ISTQB.
 *
 * Ejemplos:
 *   "FL-1.1.1" → "1"
 *   "FL-4.2.1" → "4"
 *   "FL-6.1.2" → "6"
 *   "UNKNOWN"  → "0" (fallback)
 */
function getChapterNumber(topicCode: string): string {
  const match = topicCode.match(/^FL-(\d+)/);
  return match ? match[1] : "0";
}

/**
 * Agrupa un array de tópicos por capítulo.
 * Retorna un Map ordenado por número de capítulo.
 */
function groupByChapter(
  topics: TopicForDisplay[],
): Map<string, TopicForDisplay[]> {
  const groups = new Map<string, TopicForDisplay[]>();

  for (const topic of topics) {
    const chapter = getChapterNumber(topic.topicCode);
    const existing = groups.get(chapter) ?? [];
    existing.push(topic);
    groups.set(chapter, existing);
  }

  // Ordenar por número de capítulo
  return new Map(
    [...groups.entries()].sort(([a], [b]) => Number(a) - Number(b)),
  );
}

// ─── Componente ───────────────────────────────────────────────

export function TopicPracticeList({
  topics,
  documentId,
}: TopicPracticeListProps) {
  // ─── Estado vacío ───────────────────────────────────────
  if (topics.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          No se encontraron tópicos
        </h3>
        <p className="text-sm text-muted-foreground">
          Prueba ajustando los filtros o verifica que tu documento tiene tópicos
          ISTQB extraídos correctamente.
        </p>
      </div>
    );
  }

  // ─── Agrupar por capítulo ───────────────────────────────
  const chapters = groupByChapter(topics);

  return (
    <div className="space-y-6">
      {[...chapters.entries()].map(([chapterNum, chapterTopics]) => (
        <section key={chapterNum}>
          {/* ─── Header del capítulo ─── */}
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="size-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-foreground">
              Capítulo {chapterNum}
              <span className="text-muted-foreground font-normal ml-1">
                — {CHAPTER_NAMES[chapterNum] ?? `Capítulo ${chapterNum}`}
              </span>
            </h3>
            <span className="text-xs text-muted-foreground ml-auto">
              {chapterTopics.length}{" "}
              {chapterTopics.length === 1 ? "tópico" : "tópicos"}
            </span>
          </div>

          {/* ─── Grid de tarjetas ─── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chapterTopics.map((topic) => (
              <PracticeCard
                key={topic.topicCode}
                topicCode={topic.topicCode}
                topicName={topic.topicName}
                levelK={topic.levelK}
                exerciseCount={topic.exerciseCount}
                documentId={documentId}
                isUnlocked={topic.isUnlocked}
                unlockedDay={topic.unlockedDay}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
