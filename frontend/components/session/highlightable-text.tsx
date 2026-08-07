// ============================================================
// components/session/highlightable-text.tsx
// Resaltado guiado por oraciones y palabras estilo MS Edge Immersive Reader
// ============================================================
"use client";

import { useEffect, useRef } from "react";

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

export function HighlightableText({
  text,
  currentChunkText,
  charIndex,
  charLength,
  isSpeaking,
  className = "",
}: HighlightableTextProps) {
  const activeSentenceRef = useRef<HTMLSpanElement>(null);

  if (!text) return null;

  if (!isSpeaking || !currentChunkText) {
    return <div className={className}>{text}</div>;
  }

  const sentences = splitSentences(text);
  const cleanChunk = normalize(currentChunkText);

  // Extraer la palabra activa actual según charIndex en currentChunkText
  let activeWord = "";
  if (charIndex >= 0 && charIndex < currentChunkText.length) {
    let start = charIndex;
    while (start > 0 && /\w/.test(currentChunkText[start - 1])) {
      start--;
    }
    let end = charIndex + (charLength || 1);
    while (end < currentChunkText.length && /\w/.test(currentChunkText[end])) {
      end++;
    }
    activeWord = currentChunkText.slice(start, end).trim();
  }

  return (
    <div className={className}>
      {sentences.map((sentence, sIdx) => {
        const cleanSentence = normalize(sentence);

        // Verificar si esta oración específica coincide con el fragmento activo que lee el motor de voz
        const isSentenceMatch =
          cleanChunk.length > 0 &&
          (cleanSentence.includes(cleanChunk) ||
            cleanChunk.includes(cleanSentence) ||
            (cleanSentence.length > 15 &&
              cleanChunk.includes(cleanSentence.slice(0, 15))));

        if (!isSentenceMatch) {
          return <span key={sIdx}>{sentence} </span>;
        }

        // Renderizar ÚNICAMENTE esta oración con el fondo azul de oración activa (Edge Immersive Reader)
        return (
          <ActiveSentenceWrapper
            key={sIdx}
            sentence={sentence}
            activeWord={activeWord}
            charIndex={charIndex}
          />
        );
      })}
    </div>
  );
}

function ActiveSentenceWrapper({
  sentence,
  activeWord,
  charIndex,
}: {
  sentence: string;
  activeWord: string;
  charIndex: number;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (spanRef.current) {
      spanRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [sentence, activeWord]);

  // Si hay una palabra activa, resaltar solo la palabra correspondiente dentro de esta oración
  let renderedContent = <>{sentence}</>;

  if (activeWord && activeWord.length > 1) {
    // Si charIndex coincide con la posición exacta dentro de la oración
    if (
      charIndex >= 0 &&
      charIndex < sentence.length &&
      sentence
        .slice(charIndex, charIndex + activeWord.length)
        .toLowerCase() === activeWord.toLowerCase()
    ) {
      const before = sentence.slice(0, charIndex);
      const word = sentence.slice(charIndex, charIndex + activeWord.length);
      const after = sentence.slice(charIndex + activeWord.length);

      renderedContent = (
        <>
          {before}
          <mark className="bg-amber-300 dark:bg-amber-400 dark:text-black font-bold rounded px-1 py-0.5 shadow-md">
            {word}
          </mark>
          {after}
        </>
      );
    } else {
      // Fallback: buscar la primera coincidencia exacta de activeWord en la oración activa
      const lowerSentence = sentence.toLowerCase();
      const lowerWord = activeWord.toLowerCase();
      const wordIdx = lowerSentence.indexOf(lowerWord);

      if (wordIdx !== -1) {
        const before = sentence.slice(0, wordIdx);
        const word = sentence.slice(wordIdx, wordIdx + activeWord.length);
        const after = sentence.slice(wordIdx + activeWord.length);

        renderedContent = (
          <>
            {before}
            <mark className="bg-amber-300 dark:bg-amber-400 dark:text-black font-bold rounded px-1 py-0.5 shadow-md">
              {word}
            </mark>
            {after}
          </>
        );
      }
    }
  }

  return (
    <span
      ref={spanRef}
      className="inline-block rounded-md bg-sky-100/90 dark:bg-sky-950/70 text-sky-950 dark:text-sky-100 px-1.5 py-0.5 border-l-4 border-sky-500 shadow-sm transition-all duration-200 my-0.5 font-medium"
    >
      {renderedContent}{" "}
    </span>
  );
}
