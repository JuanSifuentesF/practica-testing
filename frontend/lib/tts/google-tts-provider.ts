// ============================================================
// lib/tts/google-tts-provider.ts
// Provider client-side para Gemini Text-to-Speech
// ============================================================
// DISEÑO (chunking con pipeline + word tracking estimado):
//   - Divide el texto en chunks de ~550 chars en límites de oración.
//   - Genera y reproduce chunk[0] casi de inmediato (~1-2 s).
//   - Mientras chunk[0] suena, pre-genera chunk[1] en paralelo.
//   - Word tracking: estima la posición de cada palabra en el audio
//     usando duración total / nº de palabras y emite onBoundary
//     via requestAnimationFrame para reproducir el efecto karaoke
//     estilo Edge Immersive Reader.
// ============================================================

import type { TtsTimepoint } from "@/types/tts";

export interface GoogleTtsCallbacks {
  onStart: () => void;
  onEnd: () => void;
  onError: (error: string) => void;
  onBoundary: (charIndex: number, charLength: number) => void;
  onChunkChange: (chunkText: string, chunkIndex: number, totalChunks: number) => void;
}

// Tamaño máximo de cada chunk en caracteres
const CHUNK_SIZE = 550;

/**
 * Divide el texto en chunks respetando límites de oraciones.
 */
function splitIntoChunks(text: string, maxChars = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);

  let current = "";
  for (const para of paragraphs) {
    if ((current + " " + para).trim().length <= maxChars) {
      current = (current + " " + para).trim();
    } else {
      if (current.length > 0) chunks.push(current);
      if (para.length > maxChars) {
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
        current = "";
        for (const sent of sentences) {
          if ((current + " " + sent).trim().length <= maxChars) {
            current = (current + " " + sent).trim();
          } else {
            if (current.length > 0) chunks.push(current);
            current = sent.trim();
          }
        }
      } else {
        current = para;
      }
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Genera timepoints estimados por palabra basados en la duración del audio.
 * Distribuye el tiempo proporcionalmente al número de caracteres de cada palabra
 * (palabras largas reciben más tiempo que cortas).
 */
function estimateWordTimepoints(text: string, duration: number): TtsTimepoint[] {
  // Tokenizar en palabras con sus offsets
  const wordRegex = /\S+/g;
  const words: { word: string; offset: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = wordRegex.exec(text)) !== null) {
    words.push({ word: match[0], offset: match.index });
  }

  if (words.length === 0 || duration <= 0) return [];

  // Calcular peso proporcional por longitud de caracteres
  const totalChars = words.reduce((sum, w) => sum + w.word.length, 0);
  const timepoints: TtsTimepoint[] = [];
  let accumulatedTime = 0;

  for (const w of words) {
    timepoints.push({
      word: w.word,
      textOffset: w.offset,
      wordLength: w.word.length,
      timeSeconds: accumulatedTime,
    });
    // Tiempo proporcional a la longitud de la palabra
    const wordDuration = (w.word.length / totalChars) * duration;
    accumulatedTime += wordDuration;
  }

  return timepoints;
}

/** Llama al API route y devuelve el src del audio listo para reproducir */
async function fetchAudioSrc(
  text: string,
  voiceName: string,
  rate: number,
  apiKey: string
): Promise<string> {
  const response = await fetch("/api/tts/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceName, rate, apiKey }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        `Error ${response.status} al sintetizar audio`
    );
  }

  const data = await response.json();
  const mimeType = data.audioEncoding === "WAV" ? "audio/wav" : "audio/mp3";
  return `data:${mimeType};base64,${data.audioBase64}`;
}

export class GoogleTtsProvider {
  private audio: HTMLAudioElement | null = null;
  private rafId: number | null = null;
  private timepoints: TtsTimepoint[] = [];
  private lastTimepointIdx = -1;
  private callbacks: GoogleTtsCallbacks;
  private _isPaused = false;
  private _isSpeaking = false;
  private stopped = false;
  private trackingEnabled = true;

  // Estado del pipeline de chunks
  private chunks: string[] = [];
  private currentChunkIdx = 0;
  private prefetchedSrc: string | null = null;

  constructor(callbacks: GoogleTtsCallbacks) {
    this.callbacks = callbacks;
  }

  get isSpeaking(): boolean { return this._isSpeaking; }
  get isPaused(): boolean { return this._isPaused; }

  setTrackingEnabled(enabled: boolean): void {
    this.trackingEnabled = enabled;
    if (!enabled) {
      this.stopTimepointSync();
      this.timepoints = [];
      this.lastTimepointIdx = -1;
      return;
    }

    if (this.audio && !this.audio.paused && !this.audio.ended) {
      this.startTimepointSync();
    }
  }

  async speak(
    text: string,
    voiceName: string,
    rate: number,
    apiKey: string
  ): Promise<void> {
    this.stop();
    this.stopped = false;

    this.chunks = splitIntoChunks(text);
    this.currentChunkIdx = 0;
    this.prefetchedSrc = null;

    try {
      await this._playChunk(voiceName, rate, apiKey);
    } catch (error) {
      this._isSpeaking = false;
      this._isPaused = false;
      this.callbacks.onError(
        error instanceof Error ? error.message : "Error desconocido en TTS"
      );
    }
  }

  private async _playChunk(
    voiceName: string,
    rate: number,
    apiKey: string
  ): Promise<void> {
    if (this.stopped) return;

    const idx = this.currentChunkIdx;
    const total = this.chunks.length;
    const chunkText = this.chunks[idx];

    if (this.trackingEnabled) {
      this.callbacks.onChunkChange(chunkText, idx, total);
    }

    // Obtener el src: usar pre-fetcheado si ya está listo, sino fetch ahora
    let audioSrc: string;
    if (this.prefetchedSrc) {
      audioSrc = this.prefetchedSrc;
      this.prefetchedSrc = null;
    } else {
      audioSrc = await fetchAudioSrc(chunkText, voiceName, rate, apiKey);
    }

    if (this.stopped) return;

    // Pre-generar el siguiente chunk en paralelo
    const nextIdx = idx + 1;
    let prefetchPromise: Promise<string> | null = null;
    if (nextIdx < total) {
      prefetchPromise = fetchAudioSrc(
        this.chunks[nextIdx],
        voiceName,
        rate,
        apiKey
      ).catch(() => "");
    }

    // Configurar y reproducir el audio de este chunk
    this.audio = new Audio(audioSrc);
    this.timepoints = []; // Se generan cuando conocemos la duración
    this.lastTimepointIdx = -1;

    this.audio.onplay = () => {
      if (idx === 0) {
        this._isSpeaking = true;
        this._isPaused = false;
        this.callbacks.onStart();
      }
      if (prefetchPromise) {
        prefetchPromise.then((src) => {
          if (src) this.prefetchedSrc = src;
        });
      }
    };

    // Cuando el audio carga sus metadatos y conocemos la duración,
    // generar timepoints estimados y arrancar el sync loop
    this.audio.onloadedmetadata = () => {
      if (!this.audio || this.stopped) return;
      const duration = this.audio.duration;
      if (this.trackingEnabled && duration && isFinite(duration) && duration > 0) {
        this.timepoints = estimateWordTimepoints(chunkText, duration);
        this.startTimepointSync();
      }
    };

    this.audio.onpause = () => {
      if (!this.audio?.ended) {
        this._isPaused = true;
        this.stopTimepointSync();
      }
    };

    this.audio.onended = async () => {
      if (this.stopped) return;
      this.stopTimepointSync();
      const isLast = nextIdx >= total;
      if (isLast) {
        this._isSpeaking = false;
        this._isPaused = false;
        this.callbacks.onEnd();
      } else {
        this.currentChunkIdx = nextIdx;
        try {
          await this._playChunk(voiceName, rate, apiKey);
        } catch (error) {
          this._isSpeaking = false;
          this.callbacks.onError(
            error instanceof Error ? error.message : "Error en chunk de TTS"
          );
        }
      }
    };

    this.audio.onerror = () => {
      if (this.stopped) return;
      this._isSpeaking = false;
      this._isPaused = false;
      this.stopTimepointSync();
      this.callbacks.onError("Error al reproducir el audio sintetizado");
    };

    await this.audio.play();
  }

  pause(): void {
    if (this.audio && this._isSpeaking && !this._isPaused) {
      this.audio.pause();
      this._isPaused = true;
      this.stopTimepointSync();
    }
  }

  resume(): void {
    if (this.audio && this._isPaused) {
      this.audio.play();
      this._isPaused = false;
      if (this.trackingEnabled) {
        this.startTimepointSync();
      }
    }
  }

  stop(): void {
    this.stopped = true;
    this.stopTimepointSync();
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.onplay = null;
      this.audio.onpause = null;
      this.audio.onloadedmetadata = null;
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
    this.chunks = [];
    this.prefetchedSrc = null;
    this.currentChunkIdx = 0;
    this.timepoints = [];
    this.lastTimepointIdx = -1;
    this._isSpeaking = false;
    this._isPaused = false;
  }

  /**
   * Loop de sincronización: compara el currentTime del audio
   * con los timepoints estimados para emitir la palabra activa.
   * Corre a 60fps via requestAnimationFrame para tracking suave.
   */
  private startTimepointSync(): void {
    this.stopTimepointSync();
    if (!this.trackingEnabled) return;
    if (this.timepoints.length === 0) return;

    const sync = () => {
      if (!this.audio || this.audio.paused || this.audio.ended) return;
      const currentTime = this.audio.currentTime;

      // Encontrar el timepoint más reciente que ya pasó
      let activeIdx = -1;
      for (let i = this.timepoints.length - 1; i >= 0; i--) {
        if (this.timepoints[i].timeSeconds <= currentTime) {
          activeIdx = i;
          break;
        }
      }

      // Solo emitir si cambió
      if (activeIdx !== this.lastTimepointIdx && activeIdx >= 0) {
        this.lastTimepointIdx = activeIdx;
        const tp = this.timepoints[activeIdx];
        this.callbacks.onBoundary(tp.textOffset, tp.wordLength);
      }

      this.rafId = requestAnimationFrame(sync);
    };

    this.rafId = requestAnimationFrame(sync);
  }

  private stopTimepointSync(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.stop();
  }
}
