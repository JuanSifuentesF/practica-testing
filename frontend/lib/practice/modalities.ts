import type { PracticeExerciseType } from "@/types/practice";

export interface ExerciseModalityInfo {
  type: PracticeExerciseType;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

export const EXERCISE_MODALITIES: Record<PracticeExerciseType, ExerciseModalityInfo> = {
  test_cases: {
    type: "test_cases",
    label: "Diseño de Casos de Prueba",
    shortLabel: "Test Cases",
    icon: "🧪",
    description: "Diseña casos de prueba paso a paso aplicando particiones de equivalencia y valores límite.",
  },
  bug_report: {
    type: "bug_report",
    label: "Reportes de Defecto (Bug Lab)",
    shortLabel: "Bug Reports",
    icon: "🐛",
    description: "Redacta reportes de defecto profesionales analizando causa raíz, falla y prioridad.",
  },
  api_testing: {
    type: "api_testing",
    label: "Pruebas de API / Endpoints",
    shortLabel: "API Testing",
    icon: "🔌",
    description: "Valida payloads JSON, respuestas HTTP y checklists de integración de componentes.",
  },
  exploratory: {
    type: "exploratory",
    label: "Testing Exploratorio (Charters)",
    shortLabel: "Exploratorio",
    icon: "🔍",
    description: "Diseña sesiones exploratorias estructuradas basadas en Charters y notas de prueba.",
  },
};

/**
 * Retorna las modalidades de práctica recomendadas pedagógicamente
 * para un tópico según su número de capítulo en el Syllabus ISTQB CTFL v4.0.
 */
export function getRecommendedModalities(topicCode: string): PracticeExerciseType[] {
  const match = topicCode.match(/^FL-(\d+)/);
  const chapter = match ? match[1] : "1";

  switch (chapter) {
    case "1":
      return ["bug_report", "exploratory", "test_cases"];
    case "2":
      return ["test_cases", "api_testing"];
    case "3":
      return ["bug_report", "test_cases"];
    case "4":
      return ["test_cases", "api_testing"];
    case "5":
      return ["bug_report", "exploratory"];
    case "6":
      return ["api_testing", "test_cases"];
    default:
      return ["test_cases"];
  }
}
