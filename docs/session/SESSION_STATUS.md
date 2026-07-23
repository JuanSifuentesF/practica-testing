# Session Status — practica-testing

> **Snapshot histórico, no usar como estado vigente.** Fue supersedido por
> `docs/roadmap/ISTQB_Guias_Implementacion.md` v2.13 y por la traza del
> 19/07/2026. Conserva decisiones antiguas sobre AI-05 y DigitalOcean.
>
> Actualizado: 2026-07-19 — Sesión: AI-04 implementada y verificada. Documentación sincronizada. Siguiente guía: AI-05, sin crearla en esta actualización.

---

## Goal
Completar el plan completo de implementación antes de iniciar la creación de guías, incorporando QA Practice Lab (PL-01..PL-14) y AI Settings & Usage Control (AI-01..AI-05) antes de QA y producción.

## Constraints & Preferences
- `docs/` debe permanecer ignorado por Git (local-only).
- Token de DigitalOcean revocado por exposición; no escribir tokens reales en `.md`.
- La app debe soportar 3 modos de IA en producción: demo (sin LLM), managed (key del servidor con cuotas), byok (key del usuario solo en sesión/request).
- No almacenar API keys de IA en base de datos, localStorage, sessionStorage, cookies, logs, respuestas ni bundle frontend.
- Las guías PL-01, PL-02 y AI-01 pertenecen a base de datos (skill DB). El resto (PL-03..PL-14, AI-02..AI-05, PR-*) pertenecen a frontend (skill FE).
- Skills modificados requieren reinicio de OpenCode para cargar cambios.

---

## Progress

### Done
- Roadmap actualizado de v2.1 → v2.2 con bloque I completo (AI-01..AI-05)
- Tabla de progreso y árbol visual actualizados con orden: DA → PL → AI → QA → PR
- Detalle de cada guía AI-01..AI-05 agregado al roadmap (OBJETIVO, CUBRE, DEPENDENCIAS, CHECKPOINT)
- Grafo de dependencias actualizado: PL → AI → QA → PR con PR-03A como gate final
- Cronograma extendido a 8 semanas (semana 6 AI, semana 7 QA, semana 8 Prod)
- PR-03A reforzado como auditoría final sobre AI-01..AI-05
- QA-03 actualizado para incluir tests de modo IA y Practice Lab
- analysis_practice_lab.md actualizado con addendum v2.2
- Skills actualizados para reconocer PL-*, AI-* y PR-*:
  - istqb-fe-guide-generator: cobertura PL-03..PL-14, AI-02..AI-05, PR-* + layer guard para PL-01/PL-02/AI-01
  - istqb-db-guide-generator: cobertura PL-01/PL-02/AI-01 + automatic guide detection
  - istqb-step-validator: mapeo de capas para PL-01/PL-02/AI-01 (DB) y PL-03+/AI-02+ (FE/PR)
  - istqb-db-validator: tablas AI, constraints, índices, Secret Storage Guard (sin columnas api_key)
  - istqb-llm-response-validator: runtime IA, BYOK, usage contracts, enums alineados con CHECK constraints
- PR-01 y PR-02 actualizados localmente con soporte docs/ protegido, deploy_on_push: false, DigitalOcean como ruta principal
- Verificación final: git status limpio, docs/ ignorado, skills OK
- **PL-01** completado: Tablas `practice_exercises` (11 cols) y `practice_submissions` (7 cols), FK compuesta, 4 CHECK constraints, 5 índices
- **PL-02 completado**: 7 policies RLS (3 exercises + 4 submissions), ownership cruzado con subqueries EXISTS (document_id, study_plan_id, exercise_id), UPDATE bloqueado en exercises, defensa en profundidad FK+RLS
- **PL-03 completado**: `frontend/types/practice.ts` creado, `frontend/types/database.ts` actualizado con tablas Practice Lab, `frontend/types/index.ts` re-exporta los tipos; `npx tsc --noEmit --project frontend/tsconfig.json` y `npm --prefix frontend run build` pasan correctamente
- **PL-04 completado**: `frontend/lib/prompts/practice-exercise.ts` existe, exporta el Prompt Builder de ejercicios prácticos y mantiene el output `{ scenario, reference_solution }`; `npx tsc --noEmit --project frontend/tsconfig.json` y `npm --prefix frontend run build` pasan correctamente.
- **PL-05 completado**: `frontend/app/api/practice/generate/route.ts` existe, el build lista `ƒ /api/practice/generate`. Validado con POST autenticado 200 desde navegador (`document_id: 4dc4d47f`), ejercicio persistido en `practice_exercises` (`id: 414656d0...`). `solution: null` correcto, `attempt_number: 1`. Seguridad local chequeada: bundle sin keys LLM. Responde `401` sin auth y `400` para UUID inválido.
- **PL-06 completado**: `frontend/app/(dashboard)/practice/page.tsx` existe, implementado y validado con build exitoso.
- **PL-07 completado**: `frontend/app/(dashboard)/practice/[topicCode]/page.tsx` y `test-case-editor.tsx` implementados manualmente. 8 casos de prueba generados con tabla editable 5 columnas. Submit prepara `SubmissionContent` correctamente.
- **PL-08 completado**: `frontend/lib/prompts/practice-evaluate.ts` implementado. `buildPracticeEvaluateSystemPrompt(exerciseType)`, `buildPracticeEvaluateUserPrompt(input)`, `EVALUATE_TEMPERATURE = 0.3` exportados. 8/8 checkpoints validados (tsc+build OK, 5 campos PracticeFeedback, 4 tipos, serializer, truncamiento).
- **PL-09..PL-14 completados** según roadmap v2.9: Practice Lab cerrado antes del Bloque AI.
- **AI-01..AI-03 implementadas y verificadas** según roadmap v2.9: schema/tracking, runtime server-side y pantalla `/settings/ai` con BYOK session-only.
- **AI-04 implementada y verificada**: migración `20260719011944_scope_managed_ai_quota_and_add_usage_summary.sql` alineada en Local/Remote; `GET /api/settings/ai/usage`, UI de consumo en `/settings/ai`, contrato `usage-contract.ts`, componentes y fixture remoto creados. Checks ejecutados: `tsc`, build sin warnings observados, `PASS AI-02` y `PASS AI-04`.

### In Progress
- (ninguno — listo para AI-05 cuando se solicite)

### Blocked
- (ninguno)

---

## Key Decisions
- QA Practice Lab (PL-01..PL-14) se implementa antes de producción por decisión consciente (retrasa go-live).
- Bloque AI (AI-01..AI-05) es obligatorio antes de QA y producción; PR-03A pasa de implementación inicial a auditoría final.
- BYOK session-only: la key del usuario se recibe solo en la request, se usa en memoria y se descarta; no se persiste ni se loggea.
- Ninguna API key de IA puede vivir en columnas de Supabase, NEXT_PUBLIC_*, localStorage, sessionStorage, cookies, logs ni bundle.
- practice_exercises debe incluir document_id y FK compuesta (id, user_id) para evitar ownership cruzado.
- Cronograma extendido: 8 semanas (semana 6 AI, semana 7 QA, semana 8 Prod).

---

## Next Steps
1. No crear AI-05 en esta actualización documental.
2. Cuando se solicite, generar o auditar AI-05: integración del runtime IA con sesiones y Practice Lab.
3. Mantener AI-05 en `Por iniciar` hasta que exista guía y verificación propia.

---

## Critical Context
- Un token DigitalOcean expuesto fue revocado; no conservar prefijos ni
  identificadores de credenciales en documentación.
- `.do/app.yaml` debe tener `deploy_on_push: false` para que GitHub Actions sea el gate real.
- `frontend/` sigue ignorado en `.gitignore` actual; requiere liberarse en PR-01 para Vercel.
- No existen workflows en `.github/workflows/` todavía.
- Backend tiene Dockerfile multi-stage, tests, FastAPI con /health, config con pydantic-settings.
- App usa Gemini 2.5 Flash + GPT-5 como proveedores LLM, ambos solo desde servidor.
- Skills no existen en `.gemini/config/`; solo en `.config/opencode/skills/`.
- `docs/guides/fe/PL-04.md` ya existe; `frontend/lib/prompts/practice-exercise.ts` ya existe y compila.
- `docs/guides/fe/PL-05.md` ya existe; `frontend/app/api/practice/generate/route.ts` ya existe, compila, validada con 200 OK autenticado + persistencia.
- `docs/guides/fe/PL-06.md` ya existe y `frontend/app/(dashboard)/practice/page.tsx` está implementado.
- `docs/guides/fe/PL-07.md` ya existe y fue implementado manualmente por el usuario.
- En la verificación de AI-04, `npm --prefix frontend run build` no mostró warnings y listó `ƒ Proxy (Middleware)`.
- Durante la sesión se expusieron credenciales/cookies/tokens en el chat; no repetirlas en documentación ni logs. Recomendado revocar sesión/cambiar contraseña si no se hizo todavía.

---

## Relevant Files
- `docs/roadmap/ISTQB_Guias_Implementacion.md` — v2.2, roadmap completo con bloques A-I (DA → PL → AI → QA → PR)
- `docs/guides/fe/PR-01.md` — Guía CI/CD frontend → Vercel (actualizada con protección docs/)
- `docs/guides/fe/PR-02.md` — Guía CI/CD backend → DigitalOcean (actualizada sin autodeploy directo)
- `docs/guides/analysis_practice_lab.md` — Análisis original + addenda v2.1 y v2.2
- `docs/guides/fe/PL-03.md` — Tipos TypeScript del QA Practice Lab (implementado)
- `docs/guides/fe/PL-04.md` — Prompt Builder de ejercicios prácticos (implementado y validado con tsc/build)
- `docs/guides/fe/PL-05.md` — API Route `/api/practice/generate` (completada y validada)
- `docs/guides/fe/PL-06.md` — UI Hub de prácticas `/practice` (completada)
- `docs/guides/fe/PL-07.md` — UI TestCaseEditor (completada, implementación manual)
- `docs/guides/fe/PL-08.md` — Guía generada, Prompt Builder implementado y validado
- `docs/guides/fe/AI-04.md` — UI/API de consumo IA implementada y verificada
- `frontend/lib/ai/usage-contract.ts` — Contrato y guards de consumo AI-04
- `frontend/app/api/settings/ai/usage/route.ts` — Route Handler privado de consumo AI-04
- `frontend/scripts/verify-ai04-usage.mjs` — Fixture remoto AI-04 con BYOK/Managed, finalización, RLS y GRANTs
- `frontend/lib/prompts/practice-exercise.ts` — Prompt Builder PL-04 implementado
- `frontend/app/api/practice/generate/route.ts` — API Route PL-05 implementada
- `.gitignore` — Contiene docs/ y frontend/ (PR-01 modificará para liberar frontend/)
- `.do/app.yaml` — Debe cambiar `deploy_on_push: true` → `false`
- `.config/opencode/skills/istqb-{fe,db}-guide-generator/SKILL.md` — Skills actualizados con cobertura PL/AI/PR
- `.config/opencode/skills/istqb-step-validator/SKILL.md` — Validador actualizado con capas PL, AI, PR
- `.config/opencode/skills/istqb-db-validator/SKILL.md` — Validador DB con tablas AI y Secret Storage Guard
- `.config/opencode/skills/istqb-llm-response-validator/SKILL.md` — Validador LLM con runtime IA, BYOK y usage contracts
