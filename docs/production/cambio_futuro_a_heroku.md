# Plan de Migración: DigitalOcean → Heroku

**Estado:** Plan futuro — no implementado aún  
**Motivo:** Preservar los $200 de crédito de DigitalOcean para otros proyectos, usando los $13/mes de Heroku del GitHub Student Pack.  
**Costo Heroku:** Eco dyno $5/mes, cubierto por los $13/mes de crédito del Student Pack × 24 meses.

---

## Archivos de código/config

| Archivo | Cambio | Impacto |
|---|---|---|
| `.do/app.yaml` | **ELIMINAR** — es 100% específico de DO | Alto |
| Crear `heroku.yml` | **NUEVO** — equivalente para Heroku | Alto |
| Crear `Procfile` | **NUEVO** — `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT` | Medio |
| `backend/app/core/config.py` | Línea 63: cambiar comentario "En producción (DigitalOcean)..." → "En producción (Heroku)..." | Mínimo |
| `backend/app/routers/health.py` | Línea 7: cambiar comentario "DigitalOcean App Platform..." → "Heroku..." | Mínimo |

### Contenido de `heroku.yml`

```yaml
build:
  docker:
    web: backend/Dockerfile

run:
  web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Contenido de `Procfile`

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

- `Dockerfile` — idéntico en ambas plataformas
- Todo el código Python (`backend/app/`) — cero cambios funcionales
- Frontend, Supabase, Vercel — sin tocar
- Guías DB, FE, UP, SE, DA, PR-01/03/04/05

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

1. Crear `heroku.yml` y `Procfile` en la raíz
2. Eliminar carpeta `.do/` y `app.yaml`
3. Actualizar comentarios en `config.py` y `health.py`
4. Actualizar `BE-02.md` (Paso E)
5. Re-escribir `BE-06.md` completa
6. Actualizar referencias menores en BE-03, BE-04, BE-05
7. Actualizar docs de arquitectura: `ISTQB_StudyAgent_ProjectDoc.md`
8. Actualizar `hosting_domain_plan.md`
9. Actualizar `ISTQB_Guias_Implementacion.md`
10. Actualizar `beneficios_github_student_pack.md`

---
*Documento generado el 7 de junio de 2026 como referencia para migración futura.*
