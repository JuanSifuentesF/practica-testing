// ============================================================
// components/session/theory-read-aloud.tsx
// Toolbar TTS para leer el contenido teórico de un tópico
// ============================================================
// TIPO: Client Component (consume useTextToSpeech y useState)
//
// DISEÑO:
//   Construye un texto limpio desde los campos del tópico
//   (introducción, conceptos clave, ejemplos, conexiones, resumen)
//   y lo pasa al hook useTextToSpeech. Ofrece play/pausa/stop,
//   control de velocidad, selección de provider (browser/google)
//   y selección de voz.
// ============================================================

"use client";

import { useMemo } from "react";
import { Volume2, Pause, Play, Square, Sparkles, Globe } from "lucide-react";
import {
  TextToSpeechController,
  useTextToSpeech,
} from "@/hooks/use-text-to-speech";
import type { TheoryTopicContent } from "@/types/theory";
import { GOOGLE_TTS_VOICES } from "@/types/tts";

interface TheoryReadAloudProps {
  topic: TheoryTopicContent;
  controller?: TextToSpeechController;
  readingTrackingEnabled?: boolean;
  showReadingTrackingToggle?: boolean;
  onReadingTrackingEnabledChange?: (enabled: boolean) => void;
}

const RATE_OPTIONS = [0.75, 1, 1.25, 1.5];

function buildSpeechText(topic: TheoryTopicContent): string {
  const blocks: string[] = [];

  blocks.push(`${topic.topic_name}.`);
  blocks.push(`Introducción. ${topic.introduction}`);

  if (topic.key_concepts.length > 0) {
    blocks.push("Conceptos clave.");
    for (const concept of topic.key_concepts) {
      let line = `${concept.term}. ${concept.definition}.`;
      if (concept.example) line += ` Ejemplo. ${concept.example}.`;
      blocks.push(line);
    }
  }

  if (topic.examples.length > 0) {
    blocks.push("Ejemplos prácticos.");
    for (const example of topic.examples) {
      blocks.push(
        `${example.title}. ${example.description}. Lección: ${example.lesson}.`
      );
    }
  }

  if (topic.connections.length > 0) {
    blocks.push("Conexiones con otros tópicos.");
    for (const connection of topic.connections) {
      blocks.push(
        `${connection.related_topic_code}. ${connection.relationship}.`
      );
    }
  }

  blocks.push(`Resumen. ${topic.summary}`);
  return blocks.join("\n\n");
}

export function TheoryReadAloud({
  topic,
  controller,
  readingTrackingEnabled = false,
  showReadingTrackingToggle = true,
  onReadingTrackingEnabledChange,
}: TheoryReadAloudProps) {
  const defaultTts = useTextToSpeech();
  const tts = controller ?? defaultTts;
  const text = useMemo(() => buildSpeechText(topic), [topic]);


  const spanishVoices = useMemo(
    () => tts.voices.filter((v) => v.lang.toLowerCase().startsWith("es")),
    [tts.voices]
  );

  if (!tts.isSupported) return null;

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted/70 disabled:opacity-40 disabled:cursor-not-allowed";

  const progressPercent =
    tts.totalChunks > 0
      ? Math.round(((tts.currentChunkIndex + 1) / tts.totalChunks) * 100)
      : 0;

  const isGoogleReady = tts.provider === "google" && tts.googleApiKey.length > 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-emerald-300/40 bg-emerald-500/5 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/10">
      {/* ── Selector de Provider ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <span className="text-[11px] text-muted-foreground font-medium">Motor:</span>
        <button
          type="button"
          onClick={() => {
            tts.stop();
            tts.setProvider("browser");
          }}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
            tts.provider === "browser"
              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
          }`}
        >
          <Globe className="h-3 w-3" />
          Navegador
        </button>
        <button
          type="button"
          onClick={() => {
            tts.stop();
            tts.setProvider("google");
            // Setear voz por defecto de Gemini si no hay una seleccionada
            if (!GOOGLE_TTS_VOICES.find((v) => v.id === tts.selectedVoiceName)) {
              tts.setSelectedVoiceName(GOOGLE_TTS_VOICES[0].id);
            }
          }}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
            tts.provider === "google"
              ? "bg-sky-500/20 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/40"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
          }`}
        >
          <Sparkles className="h-3 w-3" />
          Gemini TTS
        </button>
        {showReadingTrackingToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={readingTrackingEnabled}
            onClick={() =>
              onReadingTrackingEnabledChange?.(!readingTrackingEnabled)
            }
            className={`ml-auto inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
              readingTrackingEnabled
                ? "bg-emerald-500/20 text-emerald-700 ring-1 ring-emerald-500/40 dark:text-emerald-300"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
            }`}
            title="Muestra u oculta resaltado, subtítulos, barra de avance y auto-scroll de lectura"
          >
            <span
              className={`relative h-4 w-7 rounded-full transition-colors ${
                readingTrackingEnabled ? "bg-emerald-500" : "bg-slate-500/50"
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                  readingTrackingEnabled
                    ? "translate-x-3.5"
                    : "translate-x-0.5"
                }`}
              />
            </span>
            Seguimiento {readingTrackingEnabled ? "ON" : "OFF"}
          </button>
        )}
      </div>

      {/* ── Aviso si no hay key configurada en Settings ─── */}
      {tts.provider === "google" && !tts.googleApiKey && (
        <div className="rounded-md border border-amber-300/40 bg-amber-500/5 dark:bg-amber-950/20 p-2.5 flex items-center gap-2">
          <span className="text-amber-500 text-sm">⚠️</span>
          <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
            Configura tu API key de Gemini en{" "}
            <a
              href="/settings/ai"
              className="font-semibold text-sky-600 dark:text-sky-400 underline underline-offset-2 hover:text-sky-500"
            >
              Configuración de IA
            </a>
            {" "}para usar Gemini TTS. La key se comparte con todos los módulos.
          </p>
        </div>
      )}

      {/* ── Controles de reproducción ────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {!tts.isSpeaking ? (
          <button
            type="button"
            onClick={() => tts.speak(text)}
            disabled={tts.provider === "google" && !isGoogleReady}
            className={`${btn} text-emerald-700 dark:text-emerald-300`}
            aria-label="Leer el contenido del tópico en voz alta"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Leer en voz alta
            {tts.provider === "google" && (
              <span className="ml-0.5 text-[9px] bg-sky-500/20 text-sky-600 dark:text-sky-400 px-1 rounded-full">
                Neural
              </span>
            )}
          </button>
        ) : (
          <>
            {tts.isPaused ? (
              <button
                type="button"
                onClick={tts.resume}
                className={btn}
                aria-label="Reanudar la lectura"
              >
                <Play className="h-3.5 w-3.5" />
                Reanudar
              </button>
            ) : (
              <button
                type="button"
                onClick={tts.pause}
                className={btn}
                aria-label="Pausar la lectura"
              >
                <Pause className="h-3.5 w-3.5" />
                Pausar
              </button>
            )}
            <button
              type="button"
              onClick={tts.stop}
              className={btn}
              aria-label="Detener la lectura"
            >
              <Square className="h-3.5 w-3.5" />
              Detener
            </button>
          </>
        )}

        {/* Velocidad */}
        <div className="flex items-center gap-1 ml-auto">
          <label
            htmlFor={`tts-rate-${topic.topic_code}`}
            className="text-xs text-muted-foreground"
          >
            Velocidad
          </label>
          <select
            id={`tts-rate-${topic.topic_code}`}
            value={tts.rate}
            onChange={(e) => tts.setRate(Number(e.target.value))}
            className="rounded-md border border-border/60 bg-background px-1.5 py-1 text-xs"
          >
            {RATE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </div>

        {/* Selector de voz */}
        {tts.provider === "browser" && spanishVoices.length > 0 && (
          <div className="flex items-center gap-1">
            <label
              htmlFor={`tts-voice-${topic.topic_code}`}
              className="text-xs text-muted-foreground"
            >
              Voz
            </label>
            <select
              id={`tts-voice-${topic.topic_code}`}
              value={tts.selectedVoiceName}
              onChange={(e) => tts.setSelectedVoiceName(e.target.value)}
              className="max-w-[11rem] rounded-md border border-border/60 bg-background px-1.5 py-1 text-xs truncate"
            >
              {spanishVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        )}

        {tts.provider === "google" && (
          <div className="flex items-center gap-1">
            <label
              htmlFor={`tts-gvoice-${topic.topic_code}`}
              className="text-xs text-muted-foreground"
            >
              Voz
            </label>
            <select
              id={`tts-gvoice-${topic.topic_code}`}
              value={tts.selectedVoiceName}
              onChange={(e) => tts.setSelectedVoiceName(e.target.value)}
              className="max-w-[14rem] rounded-md border border-border/60 bg-background px-1.5 py-1 text-xs truncate"
            >
              {GOOGLE_TTS_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Link discreto a Settings si Gemini activo */}
        {tts.provider === "google" && tts.googleApiKey && (
          <a
            href="/settings/ai"
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            title="Gestionar API key en Configuración de IA"
          >
            🔑
          </a>
        )}
      </div>

      {/* ── Subtítulo de lectura activa y barra de progreso ── */}
      {readingTrackingEnabled && tts.isSpeaking && tts.totalChunks > 0 && (
        <div className="mt-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 dark:bg-emerald-950/40 text-xs space-y-1.5 transition-all">
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {!tts.isPaused && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {tts.isPaused ? "Lectura en pausa" : "Leyendo en voz alta..."} (
              {tts.currentChunkIndex + 1} de {tts.totalChunks})
              {tts.provider === "google" && (
                <span className="text-[9px] bg-sky-500/20 text-sky-600 dark:text-sky-400 px-1.5 rounded-full font-medium">
                  Gemini TTS
                </span>
              )}
            </span>
            <span className="font-mono">{progressPercent}%</span>
          </div>

          {tts.currentChunkText && tts.provider === "browser" && (
            <p className="text-foreground/90 font-medium leading-relaxed italic bg-background/50 p-2 rounded border border-border/40">
              &quot;{tts.currentChunkText}&quot;
            </p>
          )}

          {/* Barra visual de avance */}
          <div className="w-full bg-emerald-200/50 dark:bg-emerald-900/40 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
