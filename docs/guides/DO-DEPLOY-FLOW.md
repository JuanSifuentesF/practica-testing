# Flujo de Deploy — DigitalOcean App Platform

Guía visual del ciclo de vida: código local → GitHub → DigitalOcean → health check.

---

## Diagrama del flujo

```
Tú (local)                   GitHub                     DigitalOcean
─────────                    ──────                     ────────────
                              ↑                          │
git add → git commit          │                          ├── 1. DO detecta nuevo commit
         → git push ──────────┘                          ├── 2. Clona el repo
                                                         ├── 3. docker build -f backend/Dockerfile
                                                         ├── 4. Despliega contenedor
                                                         ├── 5. Health check: GET /health
                                                         │      └── {"status":"ok","version":"0.1.0"} ✅
                                                         └── 6. URL pública activa:
                                                             https://squid-app-y364m.ondigitalocean.app
```

---

## Comandos

### Subir cambios a producción

```powershell
git add .
git commit -m "mensaje descriptivo"
git push origin main
```

### Verificar que el backend está vivo

```powershell
Invoke-RestMethod -Uri "https://squid-app-y364m.ondigitalocean.app/health"
```

**Respuesta esperada:**
```json
{"status":"ok","version":"0.1.0"}
```

### Ver documentación interactiva (Swagger UI)

```
https://squid-app-y364m.ondigitalocean.app/docs
```

---

## ¿Qué se despliega?

Según `.do/app.yaml`:

| Campo | Valor |
|---|---|
| Repositorio | `JuanSifuentesF/practica-testing` |
| Branch | `main` |
| Directorio build | `backend/` |
| Dockerfile | `backend/Dockerfile` |
| Auto-deploy | `true` (cada push a main) |
| Puerto | `8000` |
| Instancia | `basic-xxs` (1 vCPU, 256 MB RAM) |
| Región | `nyc` (New York) |

> Solo los cambios en `backend/` afectan el deploy. Modificar `docs/`, `frontend/`, `supabase/` no dispara rebuild.

---

## Health Check

Configurado en `.do/app.yaml`:

| Parámetro | Valor |
|---|---|
| Endpoint | `GET /health` |
| Timeout | 10 segundos |
| Intervalo | 30 segundos |
| Fallos consecutivos para reiniciar | 3 |
| Éxitos para considerar sano | 1 |

Si el health check falla 3 veces seguidas, DigitalOcean **reinicia automáticamente** el contenedor. Si sigue fallando, hace **rollback** al deploy anterior.

---

## Troubleshooting rápido

| Problema | Comando / Acción |
|---|---|
| ¿El backend responde? | `Invoke-RestMethod -Uri "https://squid-app-y364m.ondigitalocean.app/health"` |
| ¿El build falló? | Revisar logs en `cloud.digitalocean.com` → Apps → istqb-study-agent-api → Deployments |
| ¿Cambios no se reflejan? | Verificar que el push fue a `main` y que el deploy en DO se completó |
| Quiero forzar redeploy | `doctl apps create-deployment <APP_ID>` |
