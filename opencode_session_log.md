═══════════════════════════════════════════════════════════
SESIÓN: 2026-07-19 - 2026-07-20 00:39 (America/Lima)
───────────────────────────────────────────────────────────
TEMA: Gates correctivos pre-QA, autoridad de quiz/adaptación y validación DigitalOcean

RESUMEN:
- Validamos el PDF real contra DigitalOcean: HTTP 200, 63 tópicos y persistencia E2E con usuario efímero; el deploy remoto sigue en v0.1.0 sin BFFBearer.
- Endurecimos quiz/evaluate para que answer keys vivan en `private`, el navegador envíe solo IDs/selecciones y grading + adaptación sean atómicos.
- Desplegamos y verificamos las migraciones `20260719205030`, `20260719221300` y `20260719224046`; Local/Remote quedaron alineados 16/16.
- La migración final renumeró 3 intentos históricos y reconoció 3 adaptaciones con 0 cadenas ambiguas y 0 hijos multicandidato.
- Añadimos leases de IA cercados por token; el token vigente se valida dentro del RPC que persiste snapshot o finaliza evaluación/adaptación.
- Limitamos planes a 12 tópicos por sesión, rechazamos densidad imposible antes del LLM y validamos tópicos/niveles K contra `documents.topics_json`.
- Rehidratamos replays y conflictos 409 en QuizCard, refrescando estado y métricas del plan.
- Ejecutamos fixture remoto de quiz: claim, snapshot privado, score 70, adaptación advance, replay idempotente, progreso attempts=1 y cleanup completo.
- Sincronizamos roadmap v2.18 y avisos correctivos de UP-04, SE-04..SE-08, AI-05 y PR-01.

CAMBIOS REALIZADOS:
- `supabase/migrations/20260719224046_finalize_quiz_with_adaptation.sql`
- `supabase/tests/quiz_authority.sql`
- `supabase/tests/session_adaptation.sql`
- `supabase/tests/session_adaptation_upgrade.sql`
- `supabase/tests/core_ownership_integrity.sql`
- `frontend/app/api/sessions/[id]/quiz/route.ts`
- `frontend/app/api/sessions/[id]/evaluate/route.ts`
- `frontend/components/session/quiz-card.tsx`
- `frontend/lib/ai/quiz-operation.ts`
- `frontend/lib/sessions/evaluation-contract.ts`
- `frontend/lib/sessions/quiz-limits.ts`
- `frontend/app/api/plan/generate/route.ts`
- `frontend/types/database.ts`
- `frontend/tests/quiz-authority.test.ts`
- `frontend/tests/plan-contract.test.ts`
- `frontend/scripts/verify-pdf-e2e.mjs`
- `frontend/scripts/verify-quiz-e2e.mjs`
- `frontend/package.json`
- `docs/roadmap/ISTQB_Guias_Implementacion.md`
- `docs/guides/fe/UP-04.md`
- `docs/guides/fe/SE-04.md` a `SE-08.md`
- `docs/guides/fe/AI-05.md`
- `docs/guides/fe/PR-01.md`

DECISIONES CLAVE:
- DB conserva la autoridad académica; score, action, método y answer key no dependen del cliente ni del LLM.
- Un backfill histórico solo acepta hijos con una única fuente dentro de 5 segundos; toda evidencia agregada no conciliada aborta la migración.
- DB se despliega antes del frontend; la firma v1 de adaptación queda como wrapper temporal hacia v2.
- Un lease reduce concurrencia facturable y cerca escrituras, pero un crash después del dispatch externo no puede ofrecer exactly-once absoluto sin soporte idempotente del proveedor.
- DigitalOcean es un backend legado verificable, no el contrato productivo aprobado; el objetivo documentado sigue siendo Heroku.

VERIFICACIÓN:
- `npx supabase test db --local`: 4 archivos / 4 tests, PASS.
- `npx supabase db lint --local --schema public --schema private --level warning`: sin errores.
- `npm run test:quiz`: 13/13; `test:plan`: 9/9; `test:extract`: 29/29.
- Backend Docker pytest: 15/15; módulos offline: 8/8 y 9/9.
- TypeScript, lint global y build Next.js 16.2.9: PASS sin warnings observados.
- `npm run test:ownership`: PASS remoto.
- `npm run verify:quiz-e2e`: PASS remoto con cleanup.
- `supabase migration list --linked`: Local/Remote 16/16.

PRÓXIMOS PASOS:
- Revalidar `/api/plan/save` con el mismo parser estricto de generación.
- Enlazar Bug Lab/API Testing desde Practice Hub y retirar texto futuro obsoleto.
- Desplegar FastAPI endurecido y configurar `FASTAPI_URL`/`BFF_SHARED_SECRET` productivos compartidos.
- Revisar las 2 vulnerabilidades moderadas de `postcss` sin aplicar el downgrade forzado de Next.js.
- Revocar la sesión Supabase cuyo token se expuso y volver a autenticarse.
- Rotar inmediatamente la `SUPABASE_SERVICE_ROLE_KEY` encontrada en la versión
  histórica de BE-06 y sanear el commit `3a0f3e8` del historial remoto/clones.
- Rediseñar QA integral; después completar PR-01, redefinir PR-02 para Heroku y ejecutar PR-03/PR-03A.

SKILLS UTILIZADOS:
- /istqb-fe-guide-generator
- /traza-manual

NOTAS:
- `frontend/.env.development.local` es un puente de desarrollo ignorado por Git, no configuración productiva.
- `doctl` responde 401 por autenticación expirada.
- BE-06 fue reemplazada por una guía redactada; el scan actual de `docs/` da 0
  archivos JWT-like y 0 asignaciones largas de service-role, pero Git history
  conserva el secreto y debe tratarse como comprometido.
- El worktree contiene cambios previos ajenos; no se revirtieron ni se creó commit.
═══════════════════════════════════════════════════════════
