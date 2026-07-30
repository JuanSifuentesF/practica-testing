// ============================================================
// lib/onboarding.ts — Servicio de Persistencia y Configuración del Tour
// ============================================================

export const ONBOARDING_STORAGE_KEY = "istqb-onboarding-v1-completed";

export interface OnboardingStep {
  id: string;
  targetSelector: string; // Atributo data-tour (ej: 'ai-config')
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

/**
  * Definición de los pasos del Tour guiado para la app ISTQB Study Agent
  */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "ai-config",
    targetSelector: "ai-config",
    title: "1. Configura tu Conexión de IA",
    description:
      "Haz clic aquí para ingresar tu API Key temporal (Gemini/OpenAI). Es indispensable para generar planes, quizzes y evaluar tus ejercicios prácticos.",
    position: "bottom",
  },
  {
    id: "plan-card",
    targetSelector: "plan-card",
    title: "2. Tu Plan de Estudio Personalizado",
    description:
      "Desde esta sección puedes seguir tu calendario de estudio por días, leer la teoría del syllabus ISTQB CTFL v4.0 y responder quizzes de evaluación.",
    position: "bottom",
  },
  {
    id: "practice-tab",
    targetSelector: "practice-tab",
    title: "3. Practice Lab (Laboratorio Práctico)",
    description:
      "Accede a ejercicios interactivos de diseño de Casos de Prueba, Reportes de Defectos (Bug Lab) y Testing Exploratorio evaluados por IA.",
    position: "bottom",
  },
  {
    id: "user-profile",
    targetSelector: "user-profile",
    title: "4. Perfil y Preferencias",
    description:
      "Consulta la información de tu cuenta, reinicia este tour cuando desees o gestiona tu sesión desde tu avatar.",
    position: "left",
  },
];

/**
  * Verifica si el onboarding ya fue completado u omitido en el cliente
  */
export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
  * Marca el onboarding como completado en localStorage
  * (Abstraído para permitir sincronización futura con backend Supabase/FastAPI)
  */
export function markOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch (err) {
    console.error("Error al guardar el estado de onboarding:", err);
  }
}

/**
  * Reinicia el estado del onboarding para volver a ejecutarlo
  */
export function resetOnboardingState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch (err) {
    console.error("Error al reiniciar el estado de onboarding:", err);
  }
}
