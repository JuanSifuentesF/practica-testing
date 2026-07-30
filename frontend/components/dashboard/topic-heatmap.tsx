"use client";

// ============================================================
// components/dashboard/topic-heatmap.tsx — Heatmap de tópicos
// ============================================================
// TIPO: Client Component ('use client')
//
// RESPONSABILIDADES:
//   1. Recibir metrics.topic_progress desde /api/dashboard/metrics.
//   2. Agrupar tópicos por capítulo del syllabus (FL-1, FL-2...).
//   3. Renderizar celdas coloreadas por status.
//   4. Mostrar tooltip accesible con hover y focus.
//
// NO HACE:
//   - Fetch de datos
//   - Queries a Supabase
//   - Cálculo de métricas globales
// ============================================================

import type { LevelK, TopicHeatmapItem, TopicProgressStatus } from "@/types";

interface TopicHeatmapProps {
  /** Lista sanitizada de tópicos retornada por DashboardMetrics.topic_progress */
  topicProgress: TopicHeatmapItem[];
}

interface ChapterMeta {
  title: string;
  name: string;
  accentClass: string;
}

interface StatusStyle {
  label: string;
  cellClass: string;
  badgeClass: string;
  dotClass: string;
}

interface ChapterGroup {
  key: string;
  meta: ChapterMeta;
  topics: TopicHeatmapItem[];
}

const CHAPTER_META: Record<string, ChapterMeta> = {
  "FL-1": {
    title: "FL-1",
    name: "Fundamentos de la prueba",
    accentClass: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20",
  },
  "FL-2": {
    title: "FL-2",
    name: "Pruebas en el ciclo de vida",
    accentClass: "from-blue-500/20 to-blue-500/5 border-blue-500/20",
  },
  "FL-3": {
    title: "FL-3",
    name: "Pruebas estáticas",
    accentClass: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/20",
  },
  "FL-4": {
    title: "FL-4",
    name: "Técnicas de prueba",
    accentClass: "from-purple-500/20 to-purple-500/5 border-purple-500/20",
  },
  "FL-5": {
    title: "FL-5",
    name: "Gestión de la prueba",
    accentClass: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
  },
  "FL-6": {
    title: "FL-6",
    name: "Herramientas de prueba",
    accentClass: "from-rose-500/20 to-rose-500/5 border-rose-500/20",
  },
};

const STATUS_STYLES: Record<TopicProgressStatus, StatusStyle> = {
  pending: {
    label: "Pendiente",
    cellClass:
      "border-border bg-muted/70 text-foreground hover:bg-muted/90 focus-visible:bg-muted/90",
    badgeClass: "border-border bg-muted text-foreground",
    dotClass: "bg-slate-500",
  },
  in_progress: {
    label: "En progreso",
    cellClass:
      "border-blue-500/70 bg-blue-600/80 text-foreground shadow-blue-500/20 hover:bg-blue-500 focus-visible:bg-blue-500",
    badgeClass: "border-blue-500/40 bg-blue-950/70 text-blue-300 light:border-blue-200 light:bg-blue-50 light:text-blue-800",
    dotClass: "bg-blue-400",
  },
  mastered: {
    label: "Dominado",
    cellClass:
      "border-emerald-400/80 bg-emerald-500/85 text-slate-950 shadow-emerald-500/25 hover:bg-emerald-400 focus-visible:bg-emerald-400",
    badgeClass: "border-emerald-500/40 bg-emerald-950/70 text-emerald-300 light:border-emerald-200 light:bg-emerald-50 light:text-emerald-800",
    dotClass: "bg-emerald-400",
  },
  failed: {
    label: "Fallido",
    cellClass:
      "border-red-400/80 bg-red-500/85 text-foreground shadow-red-500/25 hover:bg-red-400 focus-visible:bg-red-400",
    badgeClass: "border-red-500/40 bg-red-950/70 text-red-300 light:border-red-200 light:bg-red-50 light:text-red-800",
    dotClass: "bg-red-400",
  },
};

function getChapterKey(topicCode: string): string {
  const match = topicCode.match(/^FL-(\d+)/);
  return match ? `FL-${match[1]}` : "OTROS";
}

function getCompactTopicLabel(topicCode: string): string {
  return topicCode.replace(/^FL-\d\./, "");
}

function getLevelClass(level: LevelK | null): string {
  switch (level) {
    case "K3":
      return "border-purple-500/40 bg-purple-950/70 text-purple-300 light:border-purple-200 light:bg-purple-50 light:text-purple-800";
    case "K2":
      return "border-blue-500/40 bg-blue-950/70 text-blue-300 light:border-blue-200 light:bg-blue-50 light:text-blue-800";
    case "K1":
    default:
      return "border-border bg-muted text-foreground";
  }
}

function groupTopicsByChapter(
  topicProgress: TopicHeatmapItem[],
): ChapterGroup[] {
  const groups: Record<string, TopicHeatmapItem[]> = {};

  // Mantener visibles los capítulos oficiales aunque alguno no tenga tópicos.
  for (const key of Object.keys(CHAPTER_META)) {
    groups[key] = [];
  }

  for (const topic of topicProgress) {
    const chapterKey = getChapterKey(topic.topic_code);

    if (!groups[chapterKey]) {
      groups[chapterKey] = [];
    }

    groups[chapterKey].push(topic);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, topics]) => ({
      key,
      meta: CHAPTER_META[key] ?? {
        title: key,
        name: "Tópicos adicionales del plan",
        accentClass: "from-slate-500/20 to-slate-500/5 border-slate-500/20",
      },
      topics: [...topics].sort((a, b) =>
        a.topic_code.localeCompare(b.topic_code, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    }));
}

function countMastered(topics: TopicHeatmapItem[]): number {
  return topics.filter((topic) => topic.status === "mastered").length;
}

function TopicTooltip({ topic }: { topic: TopicHeatmapItem }) {
  const status = STATUS_STYLES[topic.status];
  const bestScoreClass =
    topic.best_score >= 70
      ? "text-emerald-300 light:text-emerald-700"
      : topic.best_score > 0
        ? "text-red-300 light:text-red-700"
        : "text-foreground";

  return (
    <div
      className="
        pointer-events-none absolute left-1/2 top-full z-50 mt-2
        w-72 -translate-x-1/2 rounded-xl border border-border
        bg-card/95 p-4 text-left shadow-2xl shadow-black/40 light:shadow-slate-900/15
        opacity-0 backdrop-blur-md transition-opacity duration-150
        group-hover:opacity-100 group-focus-within:opacity-100
      "
      role="tooltip"
    >
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-mono text-sm font-bold text-foreground">
            {topic.topic_code}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            {topic.topic_name ?? "Tópico del syllabus ISTQB"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold ${getLevelClass(topic.level_k)}`}
        >
          {topic.level_k ?? "K?"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="block text-muted-foreground">Estado</span>
          <span
            className={`mt-1 inline-flex rounded-md border px-2 py-1 ${status.badgeClass}`}
          >
            {status.label}
          </span>
        </div>
        <div>
          <span className="block text-muted-foreground">Intentos</span>
          <span className="mt-1 block font-semibold text-foreground">
            {topic.attempts}
          </span>
        </div>
        <div>
          <span className="block text-muted-foreground">Mejor score</span>
          <span className={`mt-1 block font-semibold ${bestScoreClass}`}>
            {topic.best_score}%
          </span>
        </div>
        <div>
          <span className="block text-muted-foreground">Último score</span>
          <span className="mt-1 block font-semibold text-foreground">
            {topic.last_score}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function TopicHeatmap({ topicProgress }: TopicHeatmapProps) {
  const chapterGroups = groupTopicsByChapter(topicProgress);
  const totalTopics = topicProgress.length;
  const masteredTopics = countMastered(topicProgress);

  if (totalTopics === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Mapa de Tópicos</h2>
        <div className="mt-4 flex h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-center">
          <div className="mb-3 text-4xl">🗺️</div>
          <p className="text-sm text-muted-foreground">No hay tópicos disponibles.</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Esto suele indicar que el plan activo no creó registros en
            topic_progress. Revisa UP-05 o crea un nuevo plan.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-xl shadow-black/10 light:shadow-slate-900/5">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗺️</span>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Mapa de Tópicos por Estado
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Visualiza todos los tópicos del plan activo agrupados por capítulo.
            Los colores siguen el estado real de topic_progress.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <p className="text-muted-foreground">Dominados</p>
          <p className="text-2xl font-bold text-emerald-400 light:text-emerald-700">
            {masteredTopics}
            <span className="text-sm font-normal text-muted-foreground">
              /{totalTopics}
            </span>
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_STYLES).map(([status, config]) => (
          <div key={status} className="flex items-center gap-2 text-foreground">
            <span className={`h-3 w-3 rounded-full ${config.dotClass}`} />
            <span>{config.label}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {chapterGroups.map((chapter) => {
          const masteredInChapter = countMastered(chapter.topics);

          return (
            <article
              key={chapter.key}
              className={`rounded-xl border bg-gradient-to-br p-4 ${chapter.meta.accentClass}`}
            >
              <header className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300 light:text-emerald-700">
                    {chapter.meta.title}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">
                    {chapter.meta.name}
                  </h3>
                </div>
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground">
                  {masteredInChapter}/{chapter.topics.length} ok
                </span>
              </header>

              {chapter.topics.length > 0 ? (
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                  {chapter.topics.map((topic) => {
                    const status = STATUS_STYLES[topic.status];
                    const label = getCompactTopicLabel(topic.topic_code);

                    return (
                      <div key={topic.topic_code} className="group relative">
                        <button
                          type="button"
                          className={`
                            aspect-square w-full rounded-lg border text-[10px]
                            font-bold shadow-sm transition-all duration-150
                            hover:-translate-y-0.5 focus-visible:-translate-y-0.5
                            focus-visible:outline-none focus-visible:ring-2
                            focus-visible:ring-emerald-400/70
                            ${status.cellClass}
                          `}
                          aria-label={`${topic.topic_code}: ${topic.topic_name ?? "Tópico ISTQB"}. Estado: ${status.label}. Mejor score: ${topic.best_score}%.`}
                        >
                          {label}
                        </button>
                        <TopicTooltip topic={topic} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                  Sin tópicos en este capítulo
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
