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
  /** Solo para Google Cloud TTS (in-memory, nunca persistida) */
  apiKey?: string;
}

/** Opción de voz para mostrar en el selector */
export interface TtsVoiceOption {
  /** Identificador único de la voz (ej: "es-MX-Neural2-A") */
  id: string;
  /** Nombre legible (ej: "Neural2 A — México, femenina") */
  label: string;
  /** Provider al que pertenece */
  provider: TtsProvider;
  /** Código de idioma (ej: "es-MX") */
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
  /** Nombre del mark (generalmente la palabra) */
  word: string;
  /** Offset en el texto original (índice de carácter) */
  textOffset: number;
  /** Longitud de la palabra */
  wordLength: number;
  /** Momento en segundos en el audio donde se pronuncia */
  timeSeconds: number;
}

/** Catálogo de voces de Google Cloud TTS en español */
export const GOOGLE_TTS_VOICES: TtsVoiceOption[] = [
  // España (es-ES)
  { id: "es-ES-Neural2-A", label: "Neural2 A — España, femenina", provider: "google", lang: "es-ES", gender: "female" },
  { id: "es-ES-Neural2-B", label: "Neural2 B — España, masculina", provider: "google", lang: "es-ES", gender: "male" },
  { id: "es-ES-Neural2-C", label: "Neural2 C — España, femenina", provider: "google", lang: "es-ES", gender: "female" },
  { id: "es-ES-Neural2-D", label: "Neural2 D — España, femenina", provider: "google", lang: "es-ES", gender: "female" },
  { id: "es-ES-Neural2-E", label: "Neural2 E — España, masculina", provider: "google", lang: "es-ES", gender: "male" },
  { id: "es-ES-Neural2-F", label: "Neural2 F — España, masculina", provider: "google", lang: "es-ES", gender: "male" },
  { id: "es-ES-Studio-F", label: "Studio F — España, femenina ⭐", provider: "google", lang: "es-ES", gender: "female" },
  // LATAM - US (es-US)
  { id: "es-US-Neural2-A", label: "Neural2 A — LATAM, femenina", provider: "google", lang: "es-US", gender: "female" },
  { id: "es-US-Neural2-B", label: "Neural2 B — LATAM, masculina", provider: "google", lang: "es-US", gender: "male" },
  { id: "es-US-Neural2-C", label: "Neural2 C — LATAM, masculina", provider: "google", lang: "es-US", gender: "male" },
  { id: "es-US-Studio-B", label: "Studio B — LATAM, masculina ⭐", provider: "google", lang: "es-US", gender: "male" },
];
