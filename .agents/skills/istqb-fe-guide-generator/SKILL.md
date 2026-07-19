---
name: istqb-fe-guide-generator
description: Genera, regenera o audita guías frontend en español para el proyecto ISTQB Study Agent. Usar cuando se solicite la siguiente guía, una guía FE/UP/SE/DA/PL-03..PL-14/AI-02..AI-05/PR concreta, la revisión de una guía existente o la reconciliación entre roadmap, documentación y código Next.js real. Detecta dependencias, valida contratos end-to-end y persiste únicamente documentación; no implementa código en frontend.
---

# ISTQB FE Guide Generator

Actuar como Frontend Tech Lead y docente. Crear guías ejecutables, pedagógicas y ajustadas al repositorio real. Permitir que el usuario implemente el código: no editar `frontend/`, `backend/` ni `supabase/` al usar este skill.

## Rutas canónicas

- Roadmap: `docs/roadmap/ISTQB_Guias_Implementacion.md`
- Guías frontend: `docs/guides/fe/`
- Código a inspeccionar: `frontend/`
- Reglas Next.js: `frontend/AGENTS.md`
- Skill canónico: `.agents/skills/istqb-fe-guide-generator/`

No depender de copias del skill situadas en configuraciones de OpenCode, Gemini u otros agentes. Este directorio del repositorio es la fuente única de verdad.

## Seleccionar la operación

1. Si el usuario pide generar o continuar, ejecutar el flujo de generación.
2. Si pide revisar, auditar, corregir o sincronizar una guía, ejecutar el flujo de auditoría y no crear la siguiente.
3. Si proporciona un ID, trabajar únicamente con ese ID tras validar dependencias.
4. Si no proporciona un ID, detectar automáticamente el primer milestone realmente incompleto. No preguntar salvo contradicción material que no pueda resolverse inspeccionando el repositorio.

Antes de redactar o auditar, leer por completo:

- [Estructura obligatoria](references/guide-structure.md)
- [Reglas y gates de calidad](references/quality-gates.md)

## Ejecución eficiente

- Usar `rg` y lecturas dirigidas para localizar milestones, anchors y contratos. Leer completos el skill, sus dos referencias, la guía objetivo si existe y cada archivo que se proponga modificar; no cargar guías históricas completas no relacionadas cuando basten sus secciones o anchors pertinentes.
- Paralelizar inspecciones independientes de roadmap, runtime, Git y archivos del milestone.
- Ejecutar la línea base de TypeScript/build una vez y los gates finales una vez. Repetir un check solo si una corrección posterior puede cambiar su resultado.
- Hacer una única segunda pasada adversarial, separada de la redacción pero dentro de la misma tarea. No usar subagentes por defecto; reservarlos para petición explícita del usuario o una contradicción material de alto riesgo que no pueda resolverse con evidencia local.
- Si el usuario pide `modo eficiente` o `sin subagentes`, respetarlo sin reducir los gates de exactitud, compilabilidad, seguridad o reconciliación.
- Preferir una edición documental coherente y una corrección final concentrada; evitar rondas cosméticas que no cambien un gate.

## Flujo de generación

### 1. Reconciliar el estado antes de elegir una guía

Leer roadmap, guías existentes, código real y Git. Clasificar cada milestone relevante como:

- `Por iniciar`: no existe guía ni implementación.
- `Guía generada; implementación pendiente`: existe guía, pero faltan entregables o verificaciones.
- `Implementado y verificado`: existen entregables y pasan sus checks obligatorios.

El roadmap no es evidencia suficiente por sí solo. Si contradice el código, detener la generación, reconciliar primero la documentación y explicar la evidencia. No marcar un milestone como completado solo porque existen archivos: ejecutar los checks aplicables.

No saltar un milestone cuya guía ya existe pero aún no está implementada.

### 2. Aplicar guardas de capa y dependencias

- `PL-01`, `PL-02` y `AI-01` pertenecen a base de datos. Detenerse y dirigir al flujo DB; no generar una guía FE ni saltarlos.
- Para `PL-03`..`PL-14`, exigir `docs/guides/db/PL-01.md` y `PL-02.md` implementadas.
- Para `AI-02`..`AI-05`, exigir `docs/guides/db/AI-01.md` implementada.
- Para milestones backend-only o QA-only, detenerse y dirigir al flujo correspondiente.
- Para un ID no secuencial, comprobar todos sus productores y dependencias antes de continuar.

### 3. Auditar el repositorio real

- Descubrir archivos reales con `rg --files`; no copiar árboles de guías antiguas.
- Leer cada archivo existente que la guía propone modificar y citar anchors reales.
- Leer `frontend/package.json`, `frontend/node_modules/next/package.json`, `frontend/AGENTS.md` y la documentación local relevante en `frontend/node_modules/next/dist/docs/`.
- Derivar la versión mínima de Node del paquete Next.js instalado.
- Verificar `params`, `searchParams`, `useSearchParams`, Suspense/dynamic rendering, límites Server/Client y deprecaciones para la versión instalada.
- Revisar tipos DB y `Relationships`. Si son `[]`, evitar joins tipados inferidos y enseñar consultas planas compatibles.
- Para datos estructurados, construir antes de redactar la matriz productor → tipo de dominio → validador/normalizador runtime → persistencia/API → consumidor.

### 4. Reconciliar contratos incompatibles

Si un productor implementado tiene un contrato obsoleto o incompatible, no enseñar un fallback silencioso en el consumidor. Preservar la guía histórica y añadir `## Addendum Correctivo Obligatorio` con:

1. causa raíz e impacto en datos existentes;
2. archivos y anchors actuales exactos;
3. operaciones agregar/reemplazar/eliminar;
4. snippets completos, imports y símbolos obsoletos a retirar;
5. recorrido productor-consumidor y respuestas `400`/`409` aplicables;
6. fixtures deterministas y comandos de verificación;
7. gate explícito que mantenga bloqueada la guía dependiente.

Evitar interfaces, exports, validadores o rutas paralelas duplicadas. Un cast no cuenta como validación runtime.

### 5. Redactar y persistir

- Escribir en español y seguir exactamente `references/guide-structure.md`.
- Aplicar todas las reglas de `references/quality-gates.md`.
- Crear o actualizar `docs/guides/fe/{ID}.md` y, solo cuando la evidencia cambie, actualizar la fila correspondiente del roadmap.
- No modificar código fuente. Si el usuario solicita también la implementación, terminar primero la guía y pedir una tarea separada o una autorización explícita para salir del sandbox pedagógico.

### 6. Revisión adversarial antes de terminar

Releer la guía una vez como un patch único y buscar activamente rutas fantasma, anchors inexistentes, nombres duplicados, snippets minificados, comentarios narrativos, decorativos, redundantes u obsoletos, contratos divergentes, secretos, comandos no ejecutables y estados de roadmap falsos. Corregir todos los hallazgos documentales antes de entregar.

## Flujo de auditoría

1. Leer el skill y ambas referencias completamente.
2. Comparar la guía objetivo con roadmap, implementación actual, historial Git y documentación local del framework.
3. Ejecutar checks proporcionales: como mínimo TypeScript; incluir build cuando la guía o su estado lo requiera.
4. Clasificar hallazgos por severidad y corregir la documentación autorizada.
5. No editar código fuente durante la auditoría.
6. Actualizar el roadmap solo con evidencia ejecutada en esta sesión o evidencia reproducible ya registrada.
7. Informar comandos, resultados, advertencias no bloqueantes y archivos modificados.

## Límites de seguridad

- Nunca mostrar valores de `.env*`, cookies, tokens, BYOK, claves de proveedor o service-role.
- No colocar secretos en Client Components, `NEXT_PUBLIC_*`, localStorage, sessionStorage, cookies, capturas, logs ni ejemplos Markdown.
- Usar PowerShell y `npm`; preferir comandos desde la raíz.
- Usar `-LiteralPath` para rutas con `(grupo)` o `[param]`.
- No asumir que `Select-String` demuestra comportamiento; usar fixtures o checks ejecutables.
