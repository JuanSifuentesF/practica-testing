"use client";

// ============================================================
// app/(dashboard)/practice/page.tsx — Hub de Prácticas
// ============================================================
// TIPO: Client Component ('use client')
//
// RESPONSABILIDADES:
//   1. Obtener el plan de estudio activo del usuario.
//   2. Cargar el documento asociado con sus tópicos (topics_json).
//   3. Cargar los ejercicios de práctica existentes (para conteos).
//   4. Renderizar las 4 cards de resumen por tipo de ejercicio.
//   5. Renderizar los filtros y la lista de tópicos por capítulo.
//   6. Manejar estados de loading, error y vacío.
//
// ¿POR QUÉ CLIENT COMPONENT?
//   1. Necesita useState para filtros interactivos
//   2. Necesita useEffect para fetch de datos al montar
//   3. Necesita useCallback para memoizar funciones
//   Los filtros cambian la lista en tiempo real sin recargar.
//
// PATRÓN: Container Component (mismo que dashboard/page.tsx)
//   Esta página obtiene los datos y los pasa a componentes
//   presentacionales (PracticeFilter, TopicPracticeList) via props.
//
// FUENTE DE DATOS:
//   Supabase Browser Client (createClient de lib/supabase/client).
//   RLS filtra automáticamente por user_id = auth.uid().
//   No necesitamos una API Route adicional para lecturas simples.
// ============================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { LevelK } from "@/types/database";
import type { PracticeExerciseType, ExerciseTypeInfo } from "@/types/practice";
import { PracticeFilter } from "./_components/practice-filter";
import {
  TopicPracticeList,
  type TopicForDisplay,
} from "./_components/topic-practice-list";

// ──────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────

/**
 * Metadata de los 4 tipos de ejercicio para las cards de resumen.
 * Usa el tipo ExerciseTypeInfo definido en PL-03.
 *
 * Cada card muestra un ícono, nombre, descripción y color.
 * Los contadores se calculan dinámicamente desde las queries.
 */
const EXERCISE_TYPES: ExerciseTypeInfo[] = [
  {
    type: "test_cases",
    label: "Test Cases",
    description: "Diseña casos de prueba con particiones y valores límite",
    icon: "🧪",
    colorClass: "from-emerald-500/20 to-emerald-900/5 border-emerald-500/20",
  },
  {
    type: "bug_report",
    label: "Bug Reports",
    description: "Redacta reportes de defecto profesionales",
    icon: "🐛",
    colorClass: "from-amber-500/20 to-amber-900/5 border-amber-500/20",
  },
  {
    type: "api_testing",
    label: "API Testing",
    description: "Valida endpoints con checklists estructurados",
    icon: "🔌",
    colorClass: "from-blue-500/20 to-blue-900/5 border-blue-500/20",
  },
  {
    type: "exploratory",
    label: "Exploratorio",
    description: "Sesiones guiadas de testing exploratorio",
    icon: "🔍",
    colorClass: "from-purple-500/20 to-purple-900/5 border-purple-500/20",
  },
];

// ──────────────────────────────────────────────────────────────
// Tipos internos
// ──────────────────────────────────────────────────────────────

/** Estructura de un tópico extraído de topics_json */
interface TopicEntry {
  text: string;
  level_k: string;
  name: string;
}

/** Estado global de la página */
interface PracticeHubState {
  /** true mientras se cargan los datos iniciales */
  isLoading: boolean;
  /** Mensaje de error (null si no hay error) */
  error: string | null;
  /** ID del documento asociado al plan activo */
  documentId: string | null;
  /** Nombre del archivo PDF subido */
  fileName: string | null;
  /** Tópicos del documento, parseados a TopicForDisplay[] */
  topics: TopicForDisplay[];
  /** Conteos de ejercicios por tipo */
  exerciseCountsByType: Record<PracticeExerciseType, number>;
  /** Total de ejercicios generados (todos los tipos) */
  totalExercises: number;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

/**
 * Extrae el número de capítulo del código de tópico ISTQB.
 * "FL-4.2.1" → "4"
 */
function getChapterFromCode(code: string): string {
  const match = code.match(/^FL-(\d+)/);
  return match ? match[1] : "0";
}

// ──────────────────────────────────────────────────────────────
// Componente Principal
// ──────────────────────────────────────────────────────────────

export default function PracticePage() {
  // ═══════════════════════════════════════════════════════════
  // ESTADO
  // ═══════════════════════════════════════════════════════════

  // Estado principal de datos (cargados desde Supabase)
  const [state, setState] = useState<PracticeHubState>({
    isLoading: true,
    error: null,
    documentId: null,
    fileName: null,
    topics: [],
    exerciseCountsByType: {
      test_cases: 0,
      bug_report: 0,
      api_testing: 0,
      exploratory: 0,
    },
    totalExercises: 0,
  });

  // Estado de filtros (interactivo, cambia sin refetch)
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<LevelK[]>([]);

  // ═══════════════════════════════════════════════════════════
  // FETCH DE DATOS
  // ═══════════════════════════════════════════════════════════

  const fetchPracticeData = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const supabase = createClient();

      // ─── 1. Obtener el plan de estudio activo ────────────
      // Buscamos el plan más reciente con status = 'active'.
      // RLS filtra automáticamente por user_id = auth.uid().
      const { data: plan, error: planError } = await supabase
        .from("study_plans")
        .select("id, document_id")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planError) {
        console.error("[practice] Error al buscar plan activo:", planError);
        throw new Error("Error al buscar tu plan de estudio.");
      }

      // Si no hay plan activo, mostrar estado vacío.
      if (!plan) {
        setState({
          isLoading: false,
          error: null,
          documentId: null,
          fileName: null,
          topics: [],
          exerciseCountsByType: {
            test_cases: 0,
            bug_report: 0,
            api_testing: 0,
            exploratory: 0,
          },
          totalExercises: 0,
        });
        return;
      }

      // ─── 2. Obtener el documento con topics_json ─────────
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("id, topics_json, file_name")
        .eq("id", plan.document_id)
        .single();

      if (docError || !doc) {
        console.error("[practice] Error al obtener documento:", docError);
        throw new Error("No se pudo cargar el documento de tu plan.");
      }

      // ─── 3. Obtener ejercicios existentes ────────────────
      // Hacemos SELECT de todos los ejercicios del documento
      // para calcular conteos por tópico y por tipo.
      const { data: exercises, error: exError } = await supabase
        .from("practice_exercises")
        .select("id, topic_code, exercise_type")
        .eq("document_id", plan.document_id);

      if (exError) {
        console.error("[practice] Error al obtener ejercicios:", exError);
        // No es crítico — continuamos con conteos en 0
      }

      // ─── 4. Procesar datos ───────────────────────────────

      // 4a. Parsear topics_json a TopicForDisplay[]
      const topicsJson =
        (doc.topics_json as Record<string, TopicEntry> | null) ?? {};
      const exerciseList = exercises ?? [];

      // 4b. Contar ejercicios por tópico (para el progreso)
      const exercisesByTopic = new Map<string, number>();
      for (const ex of exerciseList) {
        const current = exercisesByTopic.get(ex.topic_code) ?? 0;
        exercisesByTopic.set(ex.topic_code, current + 1);
      }

      // 4c. Contar ejercicios por tipo (para las summary cards)
      const countsByType: Record<PracticeExerciseType, number> = {
        test_cases: 0,
        bug_report: 0,
        api_testing: 0,
        exploratory: 0,
      };
      for (const ex of exerciseList) {
        const exType = ex.exercise_type as PracticeExerciseType;
        if (exType in countsByType) {
          countsByType[exType]++;
        }
      }

      // 4d. Construir array de tópicos para display
      const topicEntries: TopicForDisplay[] = Object.entries(topicsJson)
        .map(([code, data]) => ({
          topicCode: code,
          topicName: data.name || code,
          levelK: (data.level_k || "K1") as LevelK,
          exerciseCount: exercisesByTopic.get(code) ?? 0,
        }))
        // Ordenar por código de tópico (FL-1.1.1 < FL-1.2.1 < FL-2.1.1)
        .sort((a, b) => a.topicCode.localeCompare(b.topicCode));

      // ─── 5. Actualizar estado ────────────────────────────
      setState({
        isLoading: false,
        error: null,
        documentId: doc.id as string,
        fileName: (doc.file_name as string) ?? null,
        topics: topicEntries,
        exerciseCountsByType: countsByType,
        totalExercises: exerciseList.length,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error al cargar los datos.";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // ─── Fetch al montar ────────────────────────────────────
  useEffect(() => {
    fetchPracticeData();
  }, [fetchPracticeData]);

  // ═══════════════════════════════════════════════════════════
  // FILTROS (Computed)
  // ═══════════════════════════════════════════════════════════

  // Lista de capítulos disponibles (derivada de los tópicos)
  const availableChapters = useMemo(() => {
    const chapterSet = new Set<string>();
    for (const topic of state.topics) {
      chapterSet.add(getChapterFromCode(topic.topicCode));
    }
    return [...chapterSet].sort((a, b) => Number(a) - Number(b));
  }, [state.topics]);

  // Tópicos filtrados (derivados del estado + filtros)
  const filteredTopics = useMemo(() => {
    return state.topics.filter((topic) => {
      // Filtro por capítulo
      if (selectedChapter !== null) {
        const chapter = getChapterFromCode(topic.topicCode);
        if (chapter !== selectedChapter) return false;
      }
      // Filtro por nivel K (array vacío = todos)
      if (selectedLevels.length > 0) {
        if (!selectedLevels.includes(topic.levelK)) return false;
      }
      return true;
    });
  }, [state.topics, selectedChapter, selectedLevels]);

  // ═══════════════════════════════════════════════════════════
  // RENDER: Estado de carga
  // ═══════════════════════════════════════════════════════════

  if (state.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {/* Encabezado */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            🔬 Practice Lab
          </h1>
          <p className="text-slate-400">Cargando tus tópicos de práctica...</p>
        </div>

        {/* Skeleton de summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
            >
              <div className="h-10 w-10 bg-slate-800 rounded-lg animate-pulse mb-3" />
              <div className="h-4 w-20 bg-slate-800 rounded animate-pulse mb-2" />
              <div className="h-6 w-12 bg-slate-800 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Skeleton del filtro */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="h-4 w-24 bg-slate-800 rounded animate-pulse mb-3" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-8 w-16 bg-slate-800 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>

        {/* Skeleton de la lista de tópicos */}
        <div className="space-y-4">
          {[1, 2, 3].map((section) => (
            <div key={section}>
              <div className="h-4 w-48 bg-slate-800 rounded animate-pulse mb-3" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((card) => (
                  <div
                    key={card}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
                  >
                    <div className="flex gap-2 mb-2">
                      <div className="h-5 w-16 bg-slate-800 rounded animate-pulse" />
                      <div className="h-5 w-8 bg-slate-800 rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-full bg-slate-800 rounded animate-pulse mb-1" />
                    <div className="h-4 w-2/3 bg-slate-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Estado de error
  // ═══════════════════════════════════════════════════════════

  if (state.error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            🔬 Practice Lab
          </h1>
        </div>

        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-2">
            ⚠️ Error al cargar los datos
          </h3>
          <p className="text-sm text-red-300/80 mb-4">{state.error}</p>
          <button
            onClick={fetchPracticeData}
            className="
              px-4 py-2 text-sm font-medium rounded-lg
              bg-red-500/20 text-red-400
              hover:bg-red-500/30 transition-colors
              cursor-pointer
            "
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Sin plan activo (estado vacío)
  // ═══════════════════════════════════════════════════════════

  if (!state.documentId) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            🔬 Practice Lab
          </h1>
          <p className="text-slate-400">
            Practica con ejercicios de QA generados por IA.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <div className="text-5xl mb-4">📚</div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Necesitas un plan de estudio activo
          </h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            El Practice Lab usa los tópicos de tu syllabus ISTQB para generar
            ejercicios personalizados. Sube tu PDF y crea un plan de estudio
            primero.
          </p>
          <Link
            href="/setup"
            className="
              inline-flex items-center gap-2 px-6 py-3
              rounded-lg font-semibold text-sm
              bg-emerald-600 text-white
              hover:bg-emerald-500 transition-colors
            "
          >
            Crear mi plan de estudio →
          </Link>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER: Hub completo con datos
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Encabezado ─── */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          🔬 Practice Lab
        </h1>
        <p className="text-slate-400">
          Practica con ejercicios de QA generados por IA.
          {state.fileName && (
            <span className="text-slate-500">
              {" "}
              · Basado en{" "}
              <span className="text-slate-400 font-medium">
                {state.fileName}
              </span>
            </span>
          )}
        </p>
      </div>

      {/* ─── Summary Cards (4 tipos de ejercicio) ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {EXERCISE_TYPES.map((exType) => {
          const count = state.exerciseCountsByType[exType.type];
          return (
            <div
              key={exType.type}
              className={`
                rounded-xl border bg-gradient-to-br p-5
                ${exType.colorClass}
              `}
            >
              {/* Ícono grande */}
              <div className="text-3xl mb-3">{exType.icon}</div>

              {/* Label */}
              <h3 className="text-sm font-semibold text-slate-200 mb-0.5">
                {exType.label}
              </h3>

              {/* Descripción */}
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                {exType.description}
              </p>

              {/* Contador */}
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">{count}</span>
                <span className="text-xs text-slate-500">
                  {count === 1 ? "ejercicio" : "ejercicios"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Barra de estadísticas ─── */}
      <div className="flex items-center gap-4 text-sm text-slate-400">
        <span>
          <span className="text-white font-semibold">
            {state.topics.length}
          </span>{" "}
          tópicos disponibles
        </span>
        <span className="text-slate-700">·</span>
        <span>
          <span className="text-white font-semibold">
            {state.totalExercises}
          </span>{" "}
          ejercicios generados
        </span>
        {selectedChapter !== null || selectedLevels.length > 0 ? (
          <>
            <span className="text-slate-700">·</span>
            <span className="text-emerald-400">
              {filteredTopics.length} mostrados
            </span>
          </>
        ) : null}
      </div>

      {/* ─── Filtros ─── */}
      <PracticeFilter
        availableChapters={availableChapters}
        selectedChapter={selectedChapter}
        selectedLevels={selectedLevels}
        onChapterChange={setSelectedChapter}
        onLevelChange={setSelectedLevels}
      />

      {/* ─── Lista de tópicos por capítulo ─── */}
      <TopicPracticeList
        topics={filteredTopics}
        documentId={state.documentId}
      />
    </div>
  );
}
