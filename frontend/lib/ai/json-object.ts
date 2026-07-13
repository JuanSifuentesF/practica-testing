function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extrae el primer objeto JSON balanceado sin confundirse con llaves dentro
 * de strings. Permite recuperar una respuesta válida aunque el proveedor
 * agregue texto u otro fragmento después del objeto principal.
 */
export function extractFirstJsonObject(rawText: string): string | null {
  const start = rawText.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < rawText.length; index += 1) {
    const character = rawText[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return rawText.slice(start, index + 1);
    }
  }

  return null;
}

export function parseFirstJsonObject(
  rawText: string,
): Record<string, unknown> | null {
  const text = rawText.trim();

  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed)) return parsed;
  } catch {
    // El extractor balanceado maneja texto adicional o bloques markdown.
  }

  const candidate = extractFirstJsonObject(text);
  if (!candidate) return null;

  try {
    const parsed: unknown = JSON.parse(candidate);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
