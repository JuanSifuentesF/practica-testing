// ============================================================
// app/api/tts/synthesize/route.ts
// API Route — Proxy a Gemini 2.5 Flash TTS
// ============================================================
// PROPÓSITO:
//   Recibe texto + API key del cliente (BYOK), llama a la API
//   de Gemini TTS y devuelve audio base64 (WAV) + timepoints vacíos.
//   El PCM L16 crudo de Gemini se convierte a WAV en servidor
//   añadiendo la cabecera estándar de 44 bytes (sin FFmpeg).
//
// SEGURIDAD:
//   - Requiere autenticación de usuario (getUser()).
//   - Valida longitud máxima de texto para evitar abuso de memoria (DoS).
//   - Sanitiza y codifica la API key (BYOK in-memory).
//   - Valida el nombre de voz contra una lista blanca segura.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 5_000;
const MAX_KEY_LENGTH = 512;

const ALLOWED_VOICES = new Set([
  "Aoede",
  "Leda",
  "Zephyr",
  "Kore",
  "Callirrhoe",
  "Despina",
  "Galatea",
  "Io",
  "Charon",
  "Fenrir",
  "Puck",
  "Orus",
  "Achernar",
]);

/**
 * Convierte un buffer de PCM L16 (s16le, mono) a WAV añadiendo cabecera RIFF.
 * No requiere FFmpeg ni dependencias externas — puro Node.js Buffer.
 */
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16,
): Buffer {
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  // RIFF chunk
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  // fmt sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28);
  header.writeUInt16LE((numChannels * bitsPerSample) / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  // data sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado. Por favor inicia sesión." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { text, voiceName, apiKey } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "El campo 'text' es obligatorio y debe ser texto no vacío." },
        { status: 400 },
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: `El texto supera el límite máximo de ${MAX_TEXT_LENGTH} caracteres.`,
        },
        { status: 400 },
      );
    }

    if (
      !apiKey ||
      typeof apiKey !== "string" ||
      apiKey.trim().length === 0 ||
      apiKey.length > MAX_KEY_LENGTH ||
      /[\r\n]/.test(apiKey)
    ) {
      return NextResponse.json(
        { error: "La API key proporcionada tiene un formato inválido." },
        { status: 400 },
      );
    }

    const sanitizedKey = apiKey.trim();
    const voice =
      typeof voiceName === "string" && ALLOWED_VOICES.has(voiceName)
        ? voiceName
        : "Aoede";

    // ── Llamada a Gemini 2.5 Flash TTS ─────────────────────────────────────
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(
      sanitizedKey,
    )}`;

    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: text.trim() }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
    });

    if (!geminiResponse.ok) {
      let userMessage = "Error al sintetizar audio con Gemini TTS";
      if (geminiResponse.status === 403 || geminiResponse.status === 401) {
        userMessage =
          "API key inválida. Asegúrate de usar una key de Google AI Studio (aistudio.google.com), no de Google Cloud Console.";
      } else if (geminiResponse.status === 429) {
        userMessage = "Cuota de Gemini TTS excedida. Intenta más tarde.";
      } else if (geminiResponse.status === 404) {
        userMessage =
          "Modelo gemini-2.5-flash-preview-tts no disponible con esta key.";
      }

      return NextResponse.json(
        { error: userMessage },
        { status: geminiResponse.status },
      );
    }

    const data = await geminiResponse.json();
    const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!inlineData?.data) {
      return NextResponse.json(
        { error: "Respuesta inesperada de Gemini TTS" },
        { status: 500 },
      );
    }

    // ── Convertir PCM L16 → WAV ─────────────────────────────────────────────
    const mimeType: string = inlineData.mimeType || "audio/L16;rate=24000";
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

    const pcmBuffer = Buffer.from(inlineData.data, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, sampleRate);

    return NextResponse.json({
      audioBase64: wavBuffer.toString("base64"),
      audioEncoding: "WAV",
      timepoints: [],
    });
  } catch (error) {
    console.error("[TTS] Synthesize error:", error);
    return NextResponse.json(
      { error: "Error interno al procesar la solicitud de TTS" },
      { status: 500 },
    );
  }
}
