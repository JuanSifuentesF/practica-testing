// ─────────────────────────────────────────────────────────────────
// lib/openai.ts
// Cliente de OpenAI centralizado para toda la aplicación.
//
// ⚠️  REGLA DE ORO: Este archivo SOLO puede importarse desde
//     código que corre en el SERVIDOR:
//       - Route Handlers (app/api/**/route.ts)
//       - Server Actions
//       - Server Components
//
// 🚫  NUNCA importar desde archivos con 'use client'.
//     OPENAI_API_KEY no debe exponerse al navegador.
// ─────────────────────────────────────────────────────────────────

import OpenAI from "openai";

// ─────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────

// ─── Modelo por defecto ──────────────────────────────────────────
// OPENAI_MODEL se lee de las variables de entorno para permitir
// cambiar el modelo sin modificar código ni hacer redeploy.
//
// Modelos recomendados (junio 2026):
//   - gpt-4o-mini : Rápido, barato (~$0.15/1M input tokens). Ideal
//                   para desarrollo y pruebas. Suficiente para
//                   generar planes de estudio.
//   - gpt-4o      : Más capaz, más caro (~$2.50/1M input tokens).
//                   Usar en producción si la calidad del plan lo
//                   justifica.
//
// ¿Por qué DEFAULT_MODEL como fallback?
// Si alguien borra accidentalmente OPENAI_MODEL del .env.local,
// la app no debería romperse. El fallback garantiza que siempre
// haya un modelo válido.
const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Modelo de OpenAI configurado para la aplicación.
 * Se lee de la variable de entorno OPENAI_MODEL.
 * Fallback: "gpt-4o-mini".
 *
 * @example
 * ```typescript
 * import { OPENAI_MODEL } from "@/lib/openai";
 * console.log(`Usando modelo: ${OPENAI_MODEL}`);
 * ```
 */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || DEFAULT_MODEL;

// ─────────────────────────────────────────────────────────────────
// CLIENTE OPENAI
// ─────────────────────────────────────────────────────────────────

// ─── ¿Por qué validamos OPENAI_API_KEY aquí? ────────────────────
// A diferencia de OPENAI_MODEL (que tiene fallback), la API key
// NO tiene un valor por defecto seguro. Si no existe, fallamos
// ruidosamente con un mensaje claro para que el desarrollador
// sepa exactamente qué configurar.
//
// ─── ¿Por qué creamos la instancia a nivel de módulo? ────────────
// En Node.js (y Next.js Runtime), los módulos se evalúan UNA sola
// vez. Esto significa que openai se crea como singleton: todas las
// importaciones de este archivo comparten la misma instancia.
//
// Beneficios del singleton:
//   1. No se crea un nuevo cliente HTTP por cada petición
//   2. El cliente reutiliza conexiones (HTTP keep-alive)
//   3. Menos overhead de inicialización

/**
 * Crea el cliente de OpenAI como singleton.
 *
 * Esta función se ejecuta UNA sola vez cuando el módulo se importa
 * por primera vez. Todas las importaciones posteriores reciben
 * la misma instancia.
 *
 * @throws {Error} Si OPENAI_API_KEY no está definida
 */
function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "[OpenAI] OPENAI_API_KEY no está definida en las variables de entorno. " +
        "Revisa tu archivo .env.local y asegúrate de que contiene: " +
        "OPENAI_API_KEY=sk-proj-tu-clave-aqui\n" +
        "⚠️  Esta variable NO debe llevar prefijo NEXT_PUBLIC_",
    );
  }

  return new OpenAI({
    apiKey,
    // ─── Base URL opcional ─────────────────────────────────────
    // Si OPENAI_BASE_URL está definida, el SDK habla contra ese
    // endpoint en vez de api.openai.com. Esto permite usar el
    // modo OpenAI-compatible de Gemini u otros proveedores sin
    // cambiar el código que llama al cliente.
    ...(process.env.OPENAI_BASE_URL
      ? { baseURL: process.env.OPENAI_BASE_URL }
      : {}),
    // ─── Timeout por defecto ──────────────────────────────────
    // Si el proveedor no responde en 60 segundos, cancelamos.
    // La generación de un plan toma típicamente 5-15 segundos.
    timeout: 60_000, // 60 segundos
    // ─── Reintentos automáticos ───────────────────────────────
    // El SDK de OpenAI v4+ tiene reintentos integrados.
    // Por defecto reintenta 2 veces con backoff exponencial
    // en errores 429 (rate limit) y 5xx (errores del servidor).
    maxRetries: 2,
  });
}

/**
 * Cliente de OpenAI preconfigurado para toda la aplicación.
 *
 * Importar y usar directamente:
 * ```typescript
 * import { openai, OPENAI_MODEL } from "@/lib/openai";
 *
 * const completion = await openai.chat.completions.create({
 *   model: OPENAI_MODEL,
 *   messages: [...],
 * });
 * ```
 */
export const openai = createOpenAIClient();
