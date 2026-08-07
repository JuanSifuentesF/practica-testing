// ============================================================
// app/api/tts/synthesize/route.ts
// API Route — Proxy a Google Cloud Text-to-Speech
// ============================================================
// PROPÓSITO:
//   Recibe texto + API key del cliente (BYOK), genera SSML con
//   <mark> por cada palabra para obtener timepoints, llama a la
//   API de Google Cloud TTS y devuelve audio base64 + timepoints.
//
// SEGURIDAD:
//   La API key viene del cliente (BYOK in-memory) y se usa una
//   sola vez en la llamada a Google. Nunca se persiste.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

interface GoogleTtsTimepoint {
  markName: string;
  timeSeconds: number;
}

interface GoogleTtsResponse {
  audioContent: string;
  timepoints?: GoogleTtsTimepoint[];
  audioConfig?: { audioEncoding: string };
}

/**
 * Convierte texto plano a SSML con <mark> por cada palabra.
 * Devuelve el SSML y un mapa de markName → { textOffset, wordLength, word }.
 */
function textToSsmlWithMarks(text: string) {
  const words = text.split(/(\s+)/); // Mantener espacios
  let ssml = "<speak>";
  let charOffset = 0;
  const markMap: Record<
    string,
    { textOffset: number; wordLength: number; word: string }
  > = {};
  let wordIdx = 0;

  for (const segment of words) {
    if (/^\s+$/.test(segment)) {
      // Es un espacio: agregar tal cual
      ssml += segment;
      charOffset += segment.length;
    } else if (segment.length > 0) {
      // Es una palabra: insertar <mark> antes
      const markName = `w${wordIdx}`;
      markMap[markName] = {
        textOffset: charOffset,
        wordLength: segment.length,
        word: segment,
      };
      ssml += `<mark name="${markName}"/>${escapeXml(segment)}`;
      charOffset += segment.length;
      wordIdx++;
    }
  }

  ssml += "</speak>";
  return { ssml, markMap };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceName, languageCode, rate, apiKey } = body;

    if (!text || !apiKey) {
      return NextResponse.json(
        { error: "Se requieren 'text' y 'apiKey'" },
        { status: 400 }
      );
    }

    const voice = voiceName || "es-US-Neural2-A";
    const lang = languageCode || voice.slice(0, 5); // "es-US" from "es-US-Neural2-A"
    const speakingRate = Math.max(0.25, Math.min(4, rate || 1));

    // Generar SSML con marks para timepoints
    const { ssml, markMap } = textToSsmlWithMarks(text);

    // Llamar a Google Cloud TTS v1beta1 (soporta enableTimePointing)
    const googleResponse = await fetch(
      `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { ssml },
          voice: {
            languageCode: lang,
            name: voice,
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate,
          },
          enableTimePointing: ["SSML_MARK"],
        }),
      }
    );

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error("[TTS] Google Cloud TTS error:", errorText);

      let userMessage = "Error al sintetizar audio con Google Cloud TTS";
      if (googleResponse.status === 403 || googleResponse.status === 401) {
        userMessage =
          "API key inválida o sin permisos para Cloud Text-to-Speech. Verifica que la API esté habilitada en tu proyecto de Google Cloud.";
      } else if (googleResponse.status === 429) {
        userMessage = "Se excedió la cuota de Google Cloud TTS. Intenta más tarde.";
      }

      return NextResponse.json(
        { error: userMessage },
        { status: googleResponse.status }
      );
    }

    const data: GoogleTtsResponse = await googleResponse.json();

    // Mapear timepoints de Google (markName) a nuestro formato con offsets de texto
    const timepoints = (data.timepoints || []).map((tp) => {
      const info = markMap[tp.markName];
      return {
        word: info?.word ?? tp.markName,
        textOffset: info?.textOffset ?? 0,
        wordLength: info?.wordLength ?? 0,
        timeSeconds: tp.timeSeconds,
      };
    });

    return NextResponse.json({
      audioBase64: data.audioContent,
      audioEncoding: "MP3",
      timepoints,
    });
  } catch (error) {
    console.error("[TTS] Synthesize error:", error);
    return NextResponse.json(
      { error: "Error interno al procesar la solicitud de TTS" },
      { status: 500 }
    );
  }
}
