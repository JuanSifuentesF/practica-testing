// ============================================================
// hooks/use-text-to-speech.ts — Hook TTS con Web Speech API
// ============================================================
// TIPO: Client-side hook ("use client" en quien lo consuma)
//
// PROPÓSITO:
//   Envolver la Web Speech API del navegador (speechSynthesis)
//   para leer texto en voz alta. No requiere backend ni cambios
//   de deploy: corre 100% en el navegador del usuario.
//
// DISEÑO:
//   - Dividimos el texto en fragmentos (chunks) y los encadenamos
//     con utterance.onend. Esto evita el bug conocido de Chrome
//     que corta audios largos (~200-300 caracteres) de golpe.
//   - Usamos refs para que los cambios de voz/velocidad apliquen
//     al siguiente fragmento sin reiniciar toda la lectura.
//   - Es SSR-safe: todo acceso a window/speechSynthesis está
//     protegido con typeof window !== "undefined".
//
// LIMITACIONES Conocidas:
//   1. Los navegadores móviles y Firefox pausan TTS si la pestaña
//      pasa a segundo plano.
//   2. Chrome tiene un bug donde resume() no reactiva tras un
//      stop() completo; por eso stop() reinicia la cola a 0.
// ============================================================

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TextToSpeechController {
  /** true si el navegador soporta speechSynthesis */
  isSupported: boolean;
  /** Lista de voces disponibles */
  voices: SpeechSynthesisVoice[];
  /** Nombre de la voz seleccionada */
  selectedVoiceName: string;
  setSelectedVoiceName: (name: string) => void;
  /** Velocidad de reproducción (0.5 - 2) */
  rate: number;
  setRate: (rate: number) => void;
  /** true mientras hay audio reproduciéndose */
  isSpeaking: boolean;
  /** true cuando está en pausa */
  isPaused: boolean;
  /** Lee un texto en voz alta (reemplaza lectura anterior) */
  speak: (text: string) => void;
  /** Pausa la lectitura actual */
  pause: () => void;
  /** Reanuda la lectitura pausada */
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

  // Dividir en frases respetando .,!,?,... y saltos de línea.
  const sentences = clean
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    // Frase más larga que el máximo: se corta por palabras.
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
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const chunksRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef("");
  const speakChunkAtRef = useRef<(idx: number) => void>(() => {});

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceNameState] = useState("");
  const [rate, setRateState] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

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

  // Mantener refs sincronizadas con el estado.
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    voiceRef.current = selectedVoiceName;
  }, [selectedVoiceName]);

  // Detener al desmontar el componente.
  useEffect(() => {
    return () => {
      if (isSupported) synthRef.current?.cancel();
    };
  }, [isSupported]);

  const speakChunkAt = useCallback(
    (idx: number) => {
      const synth = synthRef.current;
      if (!synth) return;
      const chunks = chunksRef.current;
      if (idx >= chunks.length) {
        setIsSpeaking(false);
        setIsPaused(false);
        chunksRef.current = [];
        idxRef.current = 0;
        return;
      }
      idxRef.current = idx;
      const chunk = chunks[idx];

      const utterance = new SpeechSynthesisUtterance(chunk);
      const voice = synth.getVoices().find((v) => v.name === voiceRef.current);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? "es-MX";
      utterance.rate = rateRef.current;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };
      utterance.onend = () => {
        speakChunkAtRef.current(idx + 1);
      };
      utterance.onerror = () => {
        // Salto de fragmento ante error (no abortar todo).
        window.setTimeout(() => speakChunkAtRef.current(idx + 1), 60);
      };

      synth.speak(utterance);
    },
    []
  );

  // Exponer siempre la última versión del callback para onend.
  useEffect(() => {
    speakChunkAtRef.current = speakChunkAt;
  }, [speakChunkAt]);

  const speak = useCallback((text: string) => {
    const synth = synthRef.current;
    if (!synth) return;
    const chunks = splitIntoChunks(text);
    if (chunks.length === 0) return;

    synth.cancel();
    chunksRef.current = chunks;
    idxRef.current = 0;
    // Pequeño delay: cancel() debe terminar antes del primer speak().
    window.setTimeout(() => speakChunkAtRef.current(0), 120);
  }, []);

  const pause = useCallback(() => {
    synthRef.current?.pause();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    synthRef.current?.resume();
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    synthRef.current?.cancel();
    chunksRef.current = [];
    idxRef.current = 0;
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const setSelectedVoiceName = useCallback((name: string) => {
    setSelectedVoiceNameState(name);
  }, []);

  const setRate = useCallback((newRate: number) => {
    setRateState(newRate);
  }, []);

  return {
    isSupported,
    voices,
    selectedVoiceName,
    setSelectedVoiceName,
    rate,
    setRate,
    isSpeaking,
    isPaused,
    speak,
    pause,
    resume,
    stop,
  };
}