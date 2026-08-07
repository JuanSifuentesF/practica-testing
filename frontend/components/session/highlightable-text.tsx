// ============================================================
// components/session/highlightable-text.tsx
// Resaltado guiado estilo MS Edge Immersive Reader
// ============================================================
// DISEÑO:
//   - El texto se divide en oraciones y se renderiza SIEMPRE como
//     <span> inline sin cambios de padding/margin/border.
//   - La oración activa recibe solo un background-color via CSS
//     transition, sin alterar el layout del documento.
//   - La palabra activa se resalta con un background más fuerte
//     y un border-bottom animado.
//   - El texto fuera de la oración activa se atenúa (opacity 0.45)
//     creando un "focus corridor" que guía la vista.
//   - El scroll SOLO ocurre cuando la oración activa está fuera
//     del viewport visible, y se ejecuta de forma suave y mínima.
// ============================================================
"use client";

import { useEffect, useRef, useCallback } from "react";

interface HighlightableTextProps {
  text: string;
  currentChunkText: string;
  charIndex: number;
  charLength: number;
  isSpeaking: boolean;
  className?: string;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Verifica si el elemento está fuera del área visible del viewport
 * con un margen de tolerancia para evitar scrolls innecesarios.
 */
function isOutOfView(el: HTMLElement, margin = 80): boolean {
  const rect = el.getBoundingClientRect();
  return rect.bottom > window.innerHeight - margin || rect.top < margin;
}

export function HighlightableText({
  text,
  currentChunkText,
  charIndex,
  charLength,
  isSpeaking,
  className = "",
}: HighlightableTextProps) {
  if (!text) return null;

  // Cuando no está leyendo, renderizar texto plano sin procesamiento
  if (!isSpeaking || !currentChunkText) {
    return <div className={className}>{text}</div>;
  }

  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return <div className={className}>{text}</div>;
  }

  const cleanChunk = normalize(currentChunkText);

  // Extraer la palabra activa desde el charIndex del chunk TTS
  let activeWord = "";
  if (charIndex >= 0 && charIndex < currentChunkText.length) {
    let start = charIndex;
    while (start > 0 && /\S/.test(currentChunkText[start - 1])) {
      start--;
    }
    let end = charIndex + (charLength || 1);
    while (end < currentChunkText.length && /\S/.test(currentChunkText[end])) {
      end++;
    }
    activeWord = currentChunkText.slice(start, end).replace(/^[^\wáéíóúñü]+|[^\wáéíóúñü]+$/gi, "");
  }

  // Determinar qué oración coincide con el chunk que se está leyendo
  let matchIdx = -1;
  for (let i = 0; i < sentences.length; i++) {
    const cs = normalize(sentences[i]);
    if (
      cleanChunk.length > 0 &&
      (cs.includes(cleanChunk) ||
        cleanChunk.includes(cs) ||
        (cs.length > 15 && cleanChunk.includes(cs.slice(0, 15))))
    ) {
      matchIdx = i;
      break;
    }
  }

  return (
    <div className={className}>
      {sentences.map((sentence, sIdx) => {
        const isActive = sIdx === matchIdx;

        if (isActive) {
          return (
            <ActiveSentence
              key={sIdx}
              sentence={sentence}
              activeWord={activeWord}
            />
          );
        }

        // Texto inactivo: se atenúa suavemente para crear el "focus corridor"
        return (
          <span
            key={sIdx}
            className="transition-opacity duration-500"
            style={{ opacity: matchIdx >= 0 ? 0.4 : 1 }}
          >
            {sentence}{" "}
          </span>
        );
      })}
    </div>
  );
}

// ─── Oración activa ──────────────────────────────────────────
// Renderiza inline sin cambios de layout. Solo background-color.
function ActiveSentence({
  sentence,
  activeWord,
}: {
  sentence: string;
  activeWord: string;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const hasScrolled = useRef(false);

  // Scroll SOLO cuando la oración activa sale del viewport
  // y solo la primera vez que se activa esta oración.
  const checkScroll = useCallback(() => {
    if (!spanRef.current) return;
    if (!hasScrolled.current && isOutOfView(spanRef.current)) {
      spanRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      hasScrolled.current = true;
    }
  }, []);

  useEffect(() => {
    hasScrolled.current = false;
    // Pequeño delay para que el render se estabilice antes de verificar
    const timer = setTimeout(checkScroll, 50);
    return () => clearTimeout(timer);
  }, [sentence, checkScroll]);

  // Renderizar la palabra activa resaltada dentro de la oración
  const content = renderWithActiveWord(sentence, activeWord);

  return (
    <span
      ref={spanRef}
      className="tts-active-sentence transition-[background-color] duration-300 ease-in-out rounded-sm"
      style={{
        backgroundColor: "rgba(14, 165, 233, 0.15)", // sky-500 al 15%
      }}
    >
      {content}{" "}
    </span>
  );
}

// ─── Renderizar palabra activa ───────────────────────────────
// Busca la palabra activa en la oración y la envuelve en un <mark>
// sin cambiar el layout (solo background + border-bottom).
function renderWithActiveWord(
  sentence: string,
  activeWord: string
): React.ReactNode {
  if (!activeWord || activeWord.length < 2) {
    return <>{sentence}</>;
  }

  // Buscar la palabra en la oración (case-insensitive)
  const lower = sentence.toLowerCase();
  const lowerWord = activeWord.toLowerCase();
  const idx = lower.indexOf(lowerWord);

  if (idx === -1) {
    return <>{sentence}</>;
  }

  const before = sentence.slice(0, idx);
  const word = sentence.slice(idx, idx + activeWord.length);
  const after = sentence.slice(idx + activeWord.length);

  return (
    <>
      {before}
      <mark
        className="tts-active-word rounded-sm transition-[background-color] duration-150 ease-out"
        style={{
          backgroundColor: "rgba(251, 191, 36, 0.45)", // amber-400 al 45%
          color: "inherit",
          borderBottom: "2px solid rgba(245, 158, 11, 0.8)", // amber-500
          padding: 0,
        }}
      >
        {word}
      </mark>
      {after}
    </>
  );
}
