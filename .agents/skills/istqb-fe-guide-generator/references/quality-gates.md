# Reglas y gates de calidad

## Contenido

1. Exactitud del repositorio
2. Runtime y Next.js
3. Contratos y datos
4. Código pedagógico
5. Seguridad y alcance
6. Verificación
7. Gate final

## Exactitud del repositorio

- Verificar con herramientas cada path existente, import, export, endpoint y anchor.
- Leer todos los archivos existentes que se modificarían.
- No copiar árboles, componentes o contratos de guías anteriores sin contrastarlos.
- Comprobar símbolos nuevos contra el repositorio para evitar declaraciones paralelas.
- Tratar la guía completa como un solo delta: todos los pasos deben concordar entre sí.
- Para dashboards, revisar juntos `frontend/types/dashboard.ts`, `frontend/app/api/dashboard/metrics/route.ts` y la composición real de la página. Preferir extender el DTO/fetch existente.

## Runtime y Next.js

- Detectar la versión instalada, no solo el rango de `package.json`.
- Leer `frontend/AGENTS.md` y documentación local pertinente de Next.js.
- Verificar `params`/`searchParams` async, `useSearchParams` con Suspense o render dinámico, Server/Client boundaries y APIs deprecadas.
- Registrar advertencias reales del build aunque estén fuera del alcance del milestone; no afirmar “build limpio” si existen warnings.
- Para SDKs Node-only, secretos o clientes LLM, declarar runtime servidor, frontera `server-only`, timeout/cancelación y límite del hosting.
- Con Next.js 16+, migrar la convención `middleware.ts` a `proxy.ts` y el export a `proxy`. Proxy usa Node.js por defecto y no admite configurar `runtime` en ese archivo.
- Al crear un redirect después de refrescar o limpiar sesión, propagar a la respuesta final las cookies acumuladas por el cliente SSR.
- Clasificar rutas por segmentos exactos o hijas reales; evitar `startsWith("/ruta")` sin frontera porque también acepta prefijos ajenos.

## Contratos y datos

- Validar la cadena productor → dominio → runtime guard/normalizador → persistencia/API → consumidor en cada ruta anidada.
- No usar `Record<string, unknown>` ni `as Tipo` como evidencia de compatibilidad.
- Validar discriminantes antes de campos dependientes.
- No convertir un payload incompatible en estado vacío exitoso.
- Definir comportamiento `400` para input inválido y `409` para datos legacy/incompatibles cuando corresponda.
- Mantener auth, RLS, idempotencia, runtime, timeout y cascada de modelos salvo que el milestone posea explícitamente ese cambio.
- Si `Relationships: []`, preferir consultas separadas tipadas antes que joins inferidos.
- Incluir fixtures deterministas válidas e inválidas sin llamadas LLM.

## Código pedagógico

- Usar TypeScript strict, imports/exportaciones reales, alias `@/` vigente y defensas para null/undefined/colecciones vacías.
- No referenciar helpers inexistentes ni usar casts como validadores.
- Formatear como código de producción: nada de JSX minificado ni control flow colapsado.
- Emplear variables intermedias para expresiones no triviales y comentarios solo donde expliquen una decisión.
- Evitar clases Tailwind construidas dinámicamente salvo safelist; usar mapas de clases completas.
- Diferenciar claramente RSC, Client Components y responsabilidades de presentación/datos.
- Para navegación, combinar el estado visual activo con `aria-current="page"` y verificar rutas hijas.

## Seguridad y alcance

- No imprimir ni enseñar a imprimir secretos, valores de `.env*`, cookies o errores crudos de proveedores.
- No exponer provider keys, BYOK ni service-role en cliente, `NEXT_PUBLIC_*`, storage, cookies, logs, capturas o Markdown.
- Declarar archivos que no se tocarán. Un límite “no tocar” no justifica ignorar un contrato roto: reconciliar primero.
- No implementar lógica de milestones futuros.
- No crear endpoints paralelos si existe un contrato canónico extensible.
- No modificar código fuente al generar o auditar la guía.
- No convertir errores de APIs protegidas en redirects HTML desde Proxy. Las páginas pueden redirigir; cada Route Handler debe conservar autorización propia, status `401`/`403` y JSON.

## Verificación

- Usar comandos PowerShell ejecutables desde la raíz y mostrar salida esperada realista.
- Usar `Test-Path -LiteralPath` en rutas con route groups o parámetros dinámicos.
- Ejecutar, cuando proceda, `npx tsc --noEmit --project frontend/tsconfig.json` y `npm --prefix frontend run build`.
- Distinguir error bloqueante de warning no bloqueante y documentar ambos.
- Verificar estados empty, partial/malformed, loading, error, responsive y timezone/fecha.
- No considerar búsquedas de texto como prueba de compilación o comportamiento.
- No marcar roadmap como completado hasta comprobar entregables y checks.
- Cuando sea viable, typecheckear snippets completos mediante un overlay o compilación virtual contra el `tsconfig` real sin editar `frontend/`.
- Probar por separado una ruta UI anónima y una API anónima cuando Proxy participe: exigir redirect UI y respuesta JSON de API.
- `git diff` y `git diff --check` omiten archivos untracked. Revisar su contenido, whitespace y compilabilidad explícitamente antes de cerrar.

## Gate final

Antes de persistir, aprobar todos estos puntos:

- **Exactitud:** paths, anchors, endpoints y árbol coinciden con el workspace.
- **Compilabilidad:** snippets estrictos, completos, legibles y sin símbolos duplicados.
- **Contrato:** productor, validador, persistencia/API y consumidor comparten shape, discriminantes, nullabilidad y errores.
- **Runtime:** decisiones justificadas por Next.js instalado y sus docs locales.
- **Pedagogía:** la guía explica por qué, incluye analogía y pasos ejecutables sin inferencia.
- **Accesibilidad:** estados interactivos relevantes tienen semántica además de color o iconos.
- **Alcance:** solo archivos del milestone; no-touch explícito.
- **Seguridad:** cero secretos o patrones inseguros.
- **Verificabilidad:** fixtures, comandos, outputs, edge cases y warnings reales.
- **Reconciliación:** roadmap, estado declarado, guía e implementación no se contradicen.

Si falla un punto, corregir antes de guardar. Si la corrección exige modificar código existente, mantener bloqueada la guía dependiente y emitir el addendum; no improvisar un workaround downstream.
