// ============================================================
// components/session/highlightable-text.tsx
// Componente de texto con resaltado guiado estilo MS Edge Immersive Reader
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

export function HighlightableText({
  text,
  currentChunkText,
  charIndex,
  charLength,
  isSpeaking,
  className = "",
}: HighlightableTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanText = normalize(text);
  const cleanChunk = normalize(currentChunkText);

  const isMatch =
    isSpeaking &&
    cleanChunk.length > 3 &&
    (cleanText.includes(cleanChunk) ||
      cleanChunk.includes(cleanText) ||
      (cleanChunk.length > 20 && cleanText.includes(cleanChunk.slice(0, 20))));

  // Auto-scroll suave para mantener el bloque activo visible
  useEffect(() => {
    if (isMatch && containerRef.current) {
      containerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [isMatch, currentChunkText]);

  if (!isMatch) {
    return <div className={className}>{text}</div>;
  }

  // Extraer palabra activa desde currentChunkText a partir de charIndex
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

  // Si no pudimos encontrar la palabra por charIndex, intentar la primera palabra larga del chunk
  if (!activeWord && cleanChunk) {
    const firstWord = currentChunkText.split(/\s+/).find((w) => w.length > 3);
    if (firstWord) activeWord = firstWord.replace(/[^\w]/g, "");
  }

  // Si hay palabra activa y está presente en el texto, resaltar la palabra en amarillo
  if (activeWord && activeWord.length > 1) {
    const regex = new RegExp(`\\b(${escapeRegExp(activeWord)})\\b`, "gi");
    const parts = text.split(regex);

    if (parts.length > 1) {
      return (
        <div
          ref={containerRef}
          className={`${className} rounded-md bg-sky-100/90 dark:bg-sky-950/70 text-sky-950 dark:text-sky-100 p-2 border-l-4 border-sky-500 shadow-sm transition-all duration-300`}
        >
          {parts.map((part, i) =>
            part.toLowerCase() === activeWord.toLowerCase() ? (
              <mark
                key={i}
                className="bg-amber-300 dark:bg-amber-400 dark:text-black font-bold rounded px-1 py-0.5 shadow-md"
              >
                {part}
              </mark>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </div>
      );
    }
  }

  // Si no se encuentra la palabra exacta, resaltar el bloque completo en azul/cyan (estilo Edge Reader)
  return (
    <div
      ref={containerRef}
      className={`${className} rounded-md bg-sky-100/90 dark:bg-sky-950/70 text-sky-950 dark:text-sky-100 p-2 border-l-4 border-sky-500 shadow-sm transition-all duration-300`}
    >
      {text}
    </div>
  );
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
