// ============================================================
// components/session/theory-read-aloud.tsx
// Toolbar TTS para leer el contenido teórico de un tópico
// ============================================================
// TIPO: Client Component (consume useTextToSpeech y useState)
//
// PROPS:
//   - topic: TheoryTopicContent — tópico a leer en voz alta
//
// DISEÑO:
//   Construye un texto limpio desde los campos del tópico
//   (introducción, conceptos clave, ejemplos, conexiones, resumen)
//   y lo pasa al hook useTextToSpeech. Ofrece play/pausa/stop,
//   control de velocidad y selección de voz en español.
//
//   Se oculta por completo en navegadores sin soporte de
//   speechSynthesis para no mostrar UI inútil.
// ============================================================

"use client";

import { useMemo } from "react";
import { Volume2, Pause, Play, Square } from "lucide-react";
import { useTextToSpeech } from "@/hooks/use-text-to-speech";
import type { TheoryTopicContent } from "@/types/theory";

interface TheoryReadAloudProps {
  topic: TheoryTopicContent;
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
      blocks.push(`${connection.related_topic_code}. ${connection.relationship}.`);
    }
  }

  blocks.push(`Resumen. ${topic.summary}`);
  return blocks.join("\n\n");
}

export function TheoryReadAloud({ topic }: TheoryReadAloudProps) {
  const tts = useTextToSpeech();
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

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-emerald-300/40 bg-emerald-500/5 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/10">
      <div className="flex flex-wrap items-center gap-2">
        {!tts.isSpeaking ? (
          <button
            type="button"
            onClick={() => tts.speak(text)}
            className={`${btn} text-emerald-700 dark:text-emerald-300`}
            aria-label="Leer el contenido del tópico en voz alta"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Leer en voz alta
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

        {spanishVoices.length > 0 && (
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
      </div>

      {/* ── Subtítulo de lectura activa y barra de progreso ─────── */}
      {tts.isSpeaking && (
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
            </span>
            <span className="font-mono">{progressPercent}%</span>
          </div>

          {tts.currentChunkText && (
            <p className="text-foreground/90 font-medium leading-relaxed italic bg-background/50 p-2 rounded border border-border/40">
              "{tts.currentChunkText}"
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