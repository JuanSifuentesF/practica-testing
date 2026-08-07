// ============================================================
// lib/tts/google-tts-provider.ts
// Provider client-side para Google Cloud Text-to-Speech
// ============================================================
// PROPÓSITO:
//   Gestiona la síntesis de voz usando Google Cloud TTS a través
//   de la API route /api/tts/synthesize. Reproduce el audio
//   devuelto y sincroniza los timepoints con el reloj de
//   reproducción para emitir charIndex/charLength en tiempo real.
//
// DISEÑO:
//   - Envía texto al backend que genera SSML + timepoints.
//   - Reproduce el audio MP3 base64 via HTMLAudioElement.
//   - Un requestAnimationFrame loop compara currentTime del audio
//     con los timepoints para emitir la palabra activa.
//   - Soporta pausa/resume/stop nativos del <audio>.
// ============================================================

import type { TtsTimepoint } from "@/types/tts";

export interface GoogleTtsCallbacks {
  onStart: () => void;
  onEnd: () => void;
  onError: (error: string) => void;
  onBoundary: (charIndex: number, charLength: number) => void;
  onChunkChange: (chunkText: string, chunkIndex: number, totalChunks: number) => void;
}

export class GoogleTtsProvider {
  private audio: HTMLAudioElement | null = null;
  private timepoints: TtsTimepoint[] = [];
  private rafId: number | null = null;
  private lastTimepointIdx = -1;
  private callbacks: GoogleTtsCallbacks;
  private _isPaused = false;
  private _isSpeaking = false;

  constructor(callbacks: GoogleTtsCallbacks) {
    this.callbacks = callbacks;
  }

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  async speak(
    text: string,
    voiceName: string,
    rate: number,
    apiKey: string
  ): Promise<void> {
    // Detener cualquier reproducción previa
    this.stop();

    try {
      this.callbacks.onChunkChange(text, 0, 1);

      // Llamar al API route para sintetizar
      const response = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceName,
          languageCode: voiceName.slice(0, 5),
          rate,
          apiKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Error ${response.status} al sintetizar audio`
        );
      }

      const data = await response.json();
      this.timepoints = data.timepoints || [];

      // Crear audio element desde base64
      const audioSrc = `data:audio/mp3;base64,${data.audioBase64}`;
      this.audio = new Audio(audioSrc);

      // Configurar eventos del audio
      this.audio.onplay = () => {
        this._isSpeaking = true;
        this._isPaused = false;
        this.callbacks.onStart();
        this.startTimepointSync();
      };

      this.audio.onpause = () => {
        if (!this.audio?.ended) {
          this._isPaused = true;
        }
      };

      this.audio.onended = () => {
        this._isSpeaking = false;
        this._isPaused = false;
        this.stopTimepointSync();
        this.callbacks.onEnd();
      };

      this.audio.onerror = () => {
        this._isSpeaking = false;
        this._isPaused = false;
        this.stopTimepointSync();
        this.callbacks.onError("Error al reproducir el audio sintetizado");
      };

      // Reproducir
      await this.audio.play();
    } catch (error) {
      this._isSpeaking = false;
      this._isPaused = false;
      this.callbacks.onError(
        error instanceof Error ? error.message : "Error desconocido en TTS"
      );
    }
  }

  pause(): void {
    if (this.audio && this._isSpeaking) {
      this.audio.pause();
      this._isPaused = true;
      this.stopTimepointSync();
    }
  }

  resume(): void {
    if (this.audio && this._isPaused) {
      this.audio.play();
      this._isPaused = false;
      this.startTimepointSync();
    }
  }

  stop(): void {
    this.stopTimepointSync();
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
      this.audio = null;
    }
    this.timepoints = [];
    this.lastTimepointIdx = -1;
    this._isSpeaking = false;
    this._isPaused = false;
  }

  /**
   * Loop de sincronización: compara el currentTime del audio
   * con los timepoints para emitir la palabra activa.
   */
  private startTimepointSync(): void {
    this.stopTimepointSync();

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
