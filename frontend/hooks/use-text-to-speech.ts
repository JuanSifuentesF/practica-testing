// ============================================================
// hooks/use-text-to-speech.ts — Hook TTS multi-provider
// ============================================================
// TIPO: Client-side hook ("use client" en quien lo consuma)
//
// PROPÓSITO:
//   Envolver múltiples motores de síntesis de voz bajo una
//   interfaz unificada. Soporta:
//   1. "browser" — Web Speech API nativa (gratis, offline)
//   2. "google"  — Google Cloud TTS Neural2/Studio via API route
//
// DISEÑO:
//   - El provider activo se configura con setProvider().
//   - Para "google" se requiere setGoogleApiKey() con la key BYOK.
//   - Todos los providers emiten los mismos campos de highlighting
//     (charIndex, charLength, currentChunkText) para que
//     HighlightableText funcione sin cambios.
//   - Es SSR-safe: todo acceso a window/speechSynthesis está
//     protegido con typeof window !== "undefined".
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TtsProvider } from "@/types/tts";
import { GoogleTtsProvider } from "@/lib/tts/google-tts-provider";

export interface TextToSpeechController {
  /** true si el navegador soporta al menos Web Speech API */
  isSupported: boolean;
  /** Provider activo */
  provider: TtsProvider;
  setProvider: (p: TtsProvider) => void;
  /** API key para Google Cloud TTS (in-memory) */
  googleApiKey: string;
  setGoogleApiKey: (key: string) => void;
  /** Lista de voces del navegador */
  voices: SpeechSynthesisVoice[];
  /** Nombre de la voz seleccionada (browser) o ID de voz (google) */
  selectedVoiceName: string;
  setSelectedVoiceName: (name: string) => void;
  /** Velocidad de reproducción (0.5 - 2) */
  rate: number;
  setRate: (rate: number) => void;
  /** true mientras hay audio reproduciéndose */
  isSpeaking: boolean;
  /** true cuando está en pausa */
  isPaused: boolean;
  /** Índice del fragmento que se está leyendo (0-indexed, -1 si inactivo) */
  currentChunkIndex: number;
  /** Total de fragmentos en cola */
  totalChunks: number;
  /** Texto del fragmento actual que se está leyendo */
  currentChunkText: string;
  /** Índice del carácter dentro del fragmento actual que se pronuncia */
  charIndex: number;
  /** Longitud del carácter/palabra actual */
  charLength: number;
  /** Lee un texto en voz alta (reemplaza lectura anterior) */
  speak: (text: string) => void;
  /** Pausa la lectura actual */
  pause: () => void;
  /** Reanuda la lectura pausada */
  resume: () => void;
  /** Detiene y limpia la cola de lectura */
  stop: () => void;
}

const MAX_CHUNK_CHARS = 200;

function isClientSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickBestVoice(voices: SpeechSynthesisVoice[]): string {
  const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
  const dalia = spanish.find((v) => /dalia/i.test(v.name));
  const natural = spanish.find((v) => /natural|online|google/i.test(v.name));
  const best = dalia ?? natural ?? spanish[0] ?? voices[0];
  return best?.name ?? "";
}

function splitIntoChunks(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~|]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  const sentences = clean
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      const words = sentence.split(/\s+/);
      let line = "";
      for (const word of words) {
        if ((line + " " + word).trim().length > maxChars) {
          if (line) chunks.push(line.trim());
          line = word;
        } else {
          line = (line + " " + word).trim();
        }
      }
      if (line) chunks.push(line.trim());
      continue;
    }

    if ((current + " " + sentence).trim().length > maxChars) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current = (current + " " + sentence).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

export function useTextToSpeech(): TextToSpeechController {
  const isSupported = isClientSupported();

  // ─── Provider state ─────────────────────────────────────
  const [provider, setProvider] = useState<TtsProvider>("browser");
  const [googleApiKey, setGoogleApiKey] = useState("");

  // ─── Browser TTS refs ───────────────────────────────────
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const chunksRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef("");
  const speakChunkAtRef = useRef<(idx: number) => void>(() => {});

  // ─── Google TTS provider ref ────────────────────────────
  const googleProviderRef = useRef<GoogleTtsProvider | null>(null);

  // ─── Shared UI state ────────────────────────────────────
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceNameState] = useState("");
  const [rate, setRateState] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [totalChunks, setTotalChunks] = useState(0);
  const [currentChunkText, setCurrentChunkText] = useState("");
  const [charIndex, setCharIndex] = useState(-1);
  const [charLength, setCharLength] = useState(0);

  // ─── Initialize browser speech synthesis ────────────────
  useEffect(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    synthRef.current = synth;

    const loadVoices = () => {
      const available = synth.getVoices();
      if (available.length === 0) return;
      setVoices(available);
      setSelectedVoiceNameState((prev) => {
        if (prev && available.find((v) => v.name === prev)) return prev;
        return pickBestVoice(available);
      });
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, [isSupported]);

  // ─── Initialize Google TTS provider ─────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    googleProviderRef.current = new GoogleTtsProvider({
      onStart: () => {
        setIsSpeaking(true);
        setIsPaused(false);
      },
      onEnd: () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentChunkIndex(-1);
        setCurrentChunkText("");
        setCharIndex(-1);
        setCharLength(0);
      },
      onError: (error) => {
        console.error("[GoogleTTS]", error);
        setIsSpeaking(false);
        setIsPaused(false);
      },
      onBoundary: (ci, cl) => {
        setCharIndex(ci);
        setCharLength(cl);
      },
      onChunkChange: (text, idx, total) => {
        setCurrentChunkText(text);
        setCurrentChunkIndex(idx);
        setTotalChunks(total);
      },
    });

    return () => {
      googleProviderRef.current?.destroy();
    };
  }, []);

  // Sync refs
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    voiceRef.current = selectedVoiceName;
  }, [selectedVoiceName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) synthRef.current?.cancel();
      googleProviderRef.current?.destroy();
    };
  }, [isSupported]);

  // ─── Browser TTS: speak chunk at index ──────────────────
  const speakChunkAt = useCallback(
    (idx: number) => {
      const synth = synthRef.current;
      if (!synth) return;
      const chunks = chunksRef.current;
      if (idx >= chunks.length) {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentChunkIndex(-1);
        setTotalChunks(0);
        setCurrentChunkText("");
        setCharIndex(-1);
        setCharLength(0);
        chunksRef.current = [];
        idxRef.current = 0;
        return;
      }
      idxRef.current = idx;
      const chunk = chunks[idx];
      setCurrentChunkIndex(idx);
      setCurrentChunkText(chunk);
      setCharIndex(0);
      setCharLength(0);

      const utterance = new SpeechSynthesisUtterance(chunk);
      const voice = synth.getVoices().find((v) => v.name === voiceRef.current);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "es-MX";
      utterance.rate = rateRef.current;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };
      utterance.onboundary = (event) => {
        if (event.name === "word" || !event.name) {
          setCharIndex(event.charIndex);
          setCharLength(event.charLength || 0);
        }
      };
      utterance.onend = () => {
        speakChunkAtRef.current(idx + 1);
      };
      utterance.onerror = () => {
        window.setTimeout(() => speakChunkAtRef.current(idx + 1), 60);
      };

      synth.speak(utterance);
    },
    []
  );

  useEffect(() => {
    speakChunkAtRef.current = speakChunkAt;
  }, [speakChunkAt]);

  // ─── Unified speak ─────────────────────────────────────
  const speak = useCallback(
    (text: string) => {
      if (provider === "google") {
        // Google Cloud TTS: enviar texto completo al provider
        if (!googleApiKey) {
          console.warn("[TTS] Google Cloud TTS requiere API key");
          return;
        }
        const gProvider = googleProviderRef.current;
        if (!gProvider) return;

        // Dividir en chunks para Google también (evitar textos enormes)
        const chunks = splitIntoChunks(text, 800); // Chunks más grandes para Google
        if (chunks.length === 0) return;

        // Por ahora sintetizamos el texto completo de una vez
        // (Google maneja textos largos mejor que Web Speech API)
        const fullText = chunks.join(" ");
        setTotalChunks(1);
        setCurrentChunkIndex(0);
        setCurrentChunkText(fullText);
        setCharIndex(0);
        setCharLength(0);

        gProvider.speak(fullText, selectedVoiceName, rate, googleApiKey);
        return;
      }

      // Browser Web Speech API
      const synth = synthRef.current;
      if (!synth) return;
      const chunks = splitIntoChunks(text);
      if (chunks.length === 0) return;

      synth.cancel();
      chunksRef.current = chunks;
      idxRef.current = 0;
      setTotalChunks(chunks.length);
      setCurrentChunkIndex(0);
      setCurrentChunkText(chunks[0] ?? "");
      setCharIndex(0);
      setCharLength(0);
      window.setTimeout(() => speakChunkAtRef.current(0), 120);
    },
    [provider, googleApiKey, selectedVoiceName, rate]
  );

  // ─── Unified pause ─────────────────────────────────────
  const pause = useCallback(() => {
    if (provider === "google") {
      googleProviderRef.current?.pause();
      setIsPaused(true);
    } else {
      synthRef.current?.pause();
      setIsPaused(true);
    }
  }, [provider]);

  // ─── Unified resume ────────────────────────────────────
  const resume = useCallback(() => {
    if (provider === "google") {
      googleProviderRef.current?.resume();
      setIsPaused(false);
    } else {
      synthRef.current?.resume();
      setIsPaused(false);
    }
  }, [provider]);

  // ─── Unified stop ──────────────────────────────────────
  const stop = useCallback(() => {
    if (provider === "google") {
      googleProviderRef.current?.stop();
    } else {
      synthRef.current?.cancel();
      chunksRef.current = [];
      idxRef.current = 0;
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentChunkIndex(-1);
    setTotalChunks(0);
    setCurrentChunkText("");
    setCharIndex(-1);
    setCharLength(0);
  }, [provider]);

  const setSelectedVoiceName = useCallback((name: string) => {
    setSelectedVoiceNameState(name);
  }, []);

  const setRate = useCallback((newRate: number) => {
    setRateState(newRate);
  }, []);

  return {
    isSupported,
    provider,
    setProvider,
    googleApiKey,
    setGoogleApiKey,
    voices,
    selectedVoiceName,
    setSelectedVoiceName,
    rate,
    setRate,
    isSpeaking,
    isPaused,
    currentChunkIndex,
    totalChunks,
    currentChunkText,
    charIndex,
    charLength,
    speak,
    pause,
    resume,
    stop,
  };
}