// ============================================================
// types/tts.ts — Tipos para sistema TTS multi-provider
// ============================================================

/** Proveedores de síntesis de voz disponibles */
export type TtsProvider = "browser" | "google";

/** Configuración de voz seleccionada por el usuario */
export interface TtsSettings {
  provider: TtsProvider;
  voiceName: string;
  rate: number;
  /** Solo para Gemini TTS (in-memory, nunca persistida) */
  apiKey?: string;
}

/** Opción de voz para mostrar en el selector */
export interface TtsVoiceOption {
  /** Identificador único de la voz — nombre exacto para Gemini TTS (ej: "Aoede") */
  id: string;
  /** Nombre legible para la UI (ej: "Aoede — Femenina, cálida ⭐") */
  label: string;
  /** Provider al que pertenece */
  provider: TtsProvider;
  /** Código de idioma */
  lang: string;
  /** Género de la voz */
  gender: "female" | "male";
}

/** Request body para POST /api/tts/synthesize */
export interface TtsSynthesizeRequest {
  text: string;
  voiceName: string;
  languageCode: string;
  rate: number;
  apiKey: string;
}

/** Response de POST /api/tts/synthesize */
export interface TtsSynthesizeResponse {
  audioBase64: string;
  audioEncoding: string;
  timepoints: TtsTimepoint[];
}

/** Un timepoint asociado a una palabra en el audio sintetizado */
export interface TtsTimepoint {
  word: string;
  textOffset: number;
  wordLength: number;
  timeSeconds: number;
}

/**
 * Catálogo de voces de Gemini 2.5 Flash TTS.
 * Requiere API key de Google AI Studio: https://aistudio.google.com/apikey
 * El campo `id` es el voiceName exacto que acepta el endpoint de Gemini TTS.
 */
export const GOOGLE_TTS_VOICES: TtsVoiceOption[] = [
  // ── Voces femeninas ────────────────────────────────────────────────────────
  { id: "Aoede",      label: "Aoede — Femenina, cálida y natural ⭐",       provider: "google", lang: "es", gender: "female" },
  { id: "Leda",       label: "Leda — Femenina, suave y juvenil",             provider: "google", lang: "es", gender: "female" },
  { id: "Zephyr",     label: "Zephyr — Femenina, brillante y enérgica",      provider: "google", lang: "es", gender: "female" },
  { id: "Kore",       label: "Kore — Femenina, firme y profesional",         provider: "google", lang: "es", gender: "female" },
  { id: "Callirrhoe", label: "Callirrhoe — Femenina, melódica",              provider: "google", lang: "es", gender: "female" },
  { id: "Despina",    label: "Despina — Femenina, fluida y serena",          provider: "google", lang: "es", gender: "female" },
  { id: "Autonoe",   label: "Autonoe — Femenina, clara y expresiva",        provider: "google", lang: "es", gender: "female" },
  { id: "Iapetus",   label: "Iapetus — Femenina, directa y ágil",           provider: "google", lang: "es", gender: "female" },
  // ── Voces masculinas ───────────────────────────────────────────────────────
  { id: "Charon",     label: "Charon — Masculina, profunda y con autoridad", provider: "google", lang: "es", gender: "male"   },
  { id: "Fenrir",     label: "Fenrir — Masculina, dinámica y segura",        provider: "google", lang: "es", gender: "male"   },
  { id: "Puck",       label: "Puck — Masculina, alegre y expresiva",         provider: "google", lang: "es", gender: "male"   },
  { id: "Orus",       label: "Orus — Masculina, directa y clara",            provider: "google", lang: "es", gender: "male"   },
  { id: "Achernar",   label: "Achernar — Masculina, cálida y reflexiva",     provider: "google", lang: "es", gender: "male"   },
];
