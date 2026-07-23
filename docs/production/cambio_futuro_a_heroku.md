# Plan de Migración: DigitalOcean → Heroku

**Estado:** Plan futuro — no implementado ni auditado contra la oferta vigente  
**Motivo:** Reservar DigitalOcean para otros proyectos y evaluar Heroku como destino del backend.  
**Advertencia:** precios, créditos, tipos de dyno, `heroku.yml`, `Procfile`,
health checks y métodos de deploy de este documento son supuestos históricos
del 07/06/2026. Deben verificarse en documentación oficial antes de PR-02.

---

## Inventario histórico de código/config

> No ejecutar esta tabla sin la auditoría Heroku indicada en el orden final.

| Archivo | Cambio | Impacto |
|---|---|---|
| `.do/app.yaml` | Retirar solo después de validar Heroku y el rollback | Alto |
| Crear `heroku.yml` | Candidato histórico; confirmar si sigue siendo necesario | Alto |
| Crear `Procfile` | Candidato histórico; confirmar proceso y `$PORT` vigentes | Medio |
| `backend/app/core/config.py` | Línea 63: cambiar comentario "En producción (DigitalOcean)..." → "En producción (Heroku)..." | Mínimo |
| `backend/app/routers/health.py` | Línea 7: cambiar comentario "DigitalOcean App Platform..." → "Heroku..." | Mínimo |

### Borrador histórico de `heroku.yml` — no ejecutar

```yaml
build:
  docker:
    web: backend/Dockerfile

run:
  web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Borrador histórico de `Procfile` — no ejecutar

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

---

## Guías BE (las más impactadas)

| Archivo | Cambio | Magnitud |
|---|---|---|
| `BE-02.md` | Reescribir "Paso E" — `.do/app.yaml` → `heroku.yml` | Parcial |
| `BE-03.md` | 3 referencias de paso a `.do/` y DO | Mínimo |
| `BE-04.md` | 2 referencias de paso | Mínimo |
| `BE-05.md` | Sección "Próximo paso" menciona DO | Mínimo |
| `BE-06.md` | **Reescritura completa** — toda la guía es sobre DO | **Total** |

---

## Docs de arquitectura/producción

| Archivo | Secciones a cambiar |
|---|---|
| `ISTQB_StudyAgent_ProjectDoc.md` | Secciones 2 (Herramientas), 3 (Stack), 10 (Fases), 11 (Costos), 13 (Hosting) |
| `hosting_domain_plan.md` | Tabla de decisión, sección "DigitalOcean App Platform", checklist, URLs |
| `ISTQB_Guias_Implementacion.md` | BE-02, BE-06, PR-02 + tabla de progreso + árbol de guías |
| `beneficios_github_student_pack.md` | Cambiar prioridad: Heroku → Alta, DigitalOcean → Media |

---

## Lo que NO cambia

- La migración de proveedor pretende reutilizar `Dockerfile`, pero deben
  validarse contexto, `$PORT` y proceso de arranque en Heroku.
- El hosting por sí solo no exige reescribir la lógica PDF. Sin embargo, antes
  de Heroku el gate productivo sí exige cambios Python: autenticación
  BFF-to-backend, límite de archivo, rate limit, CORS, contrato de errores y
  tests HTTP. "Sin cambios funcionales" no significa "listo para producción".
- El dominio funcional del frontend no cambia por mover el contenedor, pero
  Vercel debe recibir la URL Heroku y una migración opcional de nombre de env
  sí modifica el Route Handler y `.env.example`.
- Supabase sigue siendo el proveedor, pero el gate pre-QA exige una migración
  de ownership compuesto independiente del cambio de hosting.
- Las guías funcionales no se reescriben por Heroku; PR-02, PR-03 y los
  documentos de producción sí deben auditarse.

---

## Diferencias clave DO vs Heroku

| Aspecto | DigitalOcean | Heroku |
|---|---|---|
| Archivo de config | `.do/app.yaml` | `heroku.yml` |
| URL del backend | `*.ondigitalocean.app` | `*.herokuapp.com` |
| Deploy | Detecta push desde GitHub | `git push heroku main` o GitHub Actions |
| Health checks | Nativos en `app.yaml` | Se necesita add-on o endpoint externo |
| Logs | Dashboard web | `heroku logs --tail` (CLI) |
| Variables de entorno | Dashboard (Settings → Env Vars) | Dashboard o `heroku config:set` |
| Precio | $5/mes (basic-xxs) → de créditos | $5/mes (Eco dyno) → de créditos |

---

## Orden de ejecución de la migración

1. Auditar el runtime, plan, costos y método de deploy vigentes de Heroku
2. Definir si se necesitan `heroku.yml`, `Procfile` o ambos
3. Retirar `.do/app.yaml` solo cuando Heroku esté validado y no se necesite rollback
4. Actualizar comentarios en `config.py` y `health.py`
5. Auditar o regenerar PR-02 para Heroku
6. Actualizar `BE-02.md` y reescribir `BE-06.md` como historia de migración
7. Actualizar referencias menores en BE-03, BE-04 y BE-05
8. Actualizar `ISTQB_StudyAgent_ProjectDoc.md`
9. Reconciliar todos los documentos de producción y roadmap

---
*Documento generado el 7 de junio de 2026 como referencia para migración futura.*
