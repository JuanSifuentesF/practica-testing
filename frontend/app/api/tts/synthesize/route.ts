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
// VOCES DISPONIBLES (Gemini 2.5 Flash TTS):
//   Femeninas: Aoede ⭐, Leda, Zephyr, Kore, Callirrhoe, Despina, Galatea, Io
//   Masculinas: Charon, Fenrir, Puck, Orus, Achernar
//
// SEGURIDAD:
//   La API key viene del cliente (BYOK in-memory) y se usa una
//   sola vez en la llamada a Gemini. Nunca se persiste en servidor.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

/**
 * Convierte un buffer de PCM L16 (s16le, mono) a WAV añadiendo cabecera RIFF.
 * No requiere FFmpeg ni dependencias externas — puro Node.js Buffer.
 */
function pcmToWav(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  // RIFF chunk
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  // fmt sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);                                          // chunk size
  header.writeUInt16LE(1, 20);                                           // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28); // byte rate
  header.writeUInt16LE((numChannels * bitsPerSample) / 8, 32);          // block align
  header.writeUInt16LE(bitsPerSample, 34);
  // data sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceName, rate, apiKey } = body;

    if (!text || !apiKey) {
      return NextResponse.json(
        { error: "Se requieren 'text' y 'apiKey'" },
        { status: 400 }
      );
    }

    // Voz por defecto: Aoede (femenina, cálida, natural en español)
    const voice = (voiceName as string) || "Aoede";
    // Gemini TTS no expone speakingRate — se recibe pero no se usa
    void rate;

    // ── Llamada a Gemini 2.5 Flash TTS ─────────────────────────────────────
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("[TTS] Gemini TTS error:", errorText);

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
        { status: geminiResponse.status }
      );
    }

    const data = await geminiResponse.json();
    const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

    if (!inlineData?.data) {
      console.error(
        "[TTS] Respuesta inesperada de Gemini:",
        JSON.stringify(data).slice(0, 300)
      );
      return NextResponse.json(
        { error: "Respuesta inesperada de Gemini TTS" },
        { status: 500 }
      );
    }

    // ── Convertir PCM L16 → WAV ─────────────────────────────────────────────
    // Gemini devuelve: audio/L16;codec=pcm;rate=24000 (mono, s16le, sin cabecera)
    const mimeType: string = inlineData.mimeType || "audio/L16;rate=24000";
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

    const pcmBuffer = Buffer.from(inlineData.data, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, sampleRate);

    // ── Respuesta (mismo contrato que antes para no romper el cliente) ───────
    // Nota: Gemini TTS no ofrece timepoints por palabra → karaoke desactivado,
    // pero la reproducción de audio funciona correctamente.
    return NextResponse.json({
      audioBase64: wavBuffer.toString("base64"),
      audioEncoding: "WAV",
      timepoints: [],
    });
  } catch (error) {
    console.error("[TTS] Synthesize error:", error);
    return NextResponse.json(
      { error: "Error interno al procesar la solicitud de TTS" },
      { status: 500 }
    );
  }
}
