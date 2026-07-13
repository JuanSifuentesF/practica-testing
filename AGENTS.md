# Reglas del repositorio ISTQB Study Agent

## Fuente única de verdad

- Usar `.agents/skills/istqb-fe-guide-generator/` como skill canónico para generar o auditar guías frontend.
- No tratar copias ubicadas en configuraciones personales de OpenCode, Gemini u otros agentes como fuentes autoritativas.
- Mantener sincronizados roadmap, estado declarado de cada guía y código real.

## Estados de milestones

- `Por iniciar`: no existe guía ni implementación.
- `Guía generada; implementación pendiente`: existe guía, pero faltan entregables o verificaciones.
- `Implementado y verificado`: existen entregables y pasan los checks aplicables.
- No avanzar a la siguiente guía si la anterior está generada pero no implementada.
- No marcar como completado basándose únicamente en la presencia de archivos.

## Generación de guías

- Al generar o auditar guías FE/UP/SE/DA/PL/AI/PR, invocar `$istqb-fe-guide-generator`.
- El flujo pedagógico escribe documentación; no modifica `frontend/`, `backend/` ni `supabase/`.
- Inspeccionar siempre el código real, `frontend/AGENTS.md`, la versión instalada de Next.js y su documentación local antes de proponer snippets.
- Usar español, PowerShell y npm. No revelar secretos ni valores de `.env*`.

## Verificación mínima

- TypeScript: `npx tsc --noEmit --project frontend/tsconfig.json`.
- Build frontend: `npm --prefix frontend run build`.
- Registrar warnings del build; no describir como “limpio” un build con advertencias.
- Para rutas con `(grupo)` o `[param]`, usar `-LiteralPath` en PowerShell.

## Revisión independiente

- Después de generar una guía, hacer una segunda pasada adversarial en una tarea de revisión separada cuando sea posible.
- Revisar exactitud del repo, contratos end-to-end, runtime actual, compilabilidad, pedagogía, alcance, seguridad y verificabilidad.
- La revisión documental no modifica código fuente salvo petición explícita separada del usuario.
