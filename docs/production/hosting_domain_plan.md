# Plan de Hosting, Dominio y Producción

**Proyecto:** ISTQB Study Agent  
**Estado:** decisión de arquitectura para fase de producción  
**Referencia principal:** `docs/architecture/ISTQB_StudyAgent_ProjectDoc.md`

---

## Decisión Recomendada

Usar una arquitectura de producción dividida por responsabilidad:

| Capa | Servicio | Decisión |
|---|---|---|
| Frontend | Vercel | Hosting principal de Next.js, dominio custom y SSL automático. |
| Backend | DigitalOcean App Platform | Hosting de FastAPI usando Docker y health check. |
| Base de datos/Auth/Storage | Supabase | PostgreSQL, Auth, Storage privado y RLS. |
| Dominio | Name.com | Opción recomendada si hay disponibilidad de `.app` o `.dev`. |
| Dominio fallback | Namecheap | Usar `.me` si se quiere una URL más personal o si Name.com no tiene una buena opción disponible. |
| CI/CD | GitHub Actions + integraciones nativas | Deploy automatizado desde GitHub. |

**Recomendación de dominio:** priorizar Name.com con `.app` para producto (`istqbstudy.app`, `studyistqb.app`) o `.dev` para perfil técnico (`istqbstudy.dev`). Usar Namecheap `.me` solo si el proyecto se quiere presentar como herramienta personal o portfolio.

---

## Por Qué Name.com Es Mejor Opción Inicial

- `.app` comunica que es una aplicación web, no solo un sitio personal.
- `.dev` comunica proyecto técnico y exige HTTPS por diseño del navegador.
- Vercel gestiona SSL automáticamente, así que el certificado gratis de Namecheap no aporta mucho para este stack.
- Namecheap `.me` sigue siendo válido, pero suena más a marca personal que a producto educativo.

**Decisión práctica:** elegir Name.com si hay un nombre corto, claro y disponible. Si no, usar Namecheap `.me` como fallback sin bloquear el despliegue.

---

## Arquitectura de Producción

```text
Usuario
  |
  | HTTPS
  v
Dominio custom en Name.com o Namecheap
  |
  | DNS hacia Vercel
  v
Frontend Next.js en Vercel
  |
  | API Routes / Server actions
  v
Supabase Auth + PostgreSQL + Storage
  |
  | cuando se requiere extracción PDF
  v
FastAPI en DigitalOcean App Platform
```

---

## Configuración Por Servicio

### Vercel

- Aloja el frontend Next.js.
- Maneja el dominio custom principal.
- Emite y renueva SSL automáticamente.
- Guarda variables públicas y de servidor del frontend.
- Expone la URL final de la app para Supabase Auth redirects.

Variables esperadas:

| Variable | Tipo | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | Puede estar en cliente. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública | Puede estar en cliente. |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor | Nunca usar en componentes cliente. |
| `OPENAI_API_KEY` | Servidor | Solo API Routes / servidor. |
| `OPENAI_MODEL` | Servidor | Modelo configurable sin cambiar código. |
| `FASTAPI_URL` | Servidor | URL del backend en DigitalOcean. |

### DigitalOcean App Platform

- Aloja el microservicio FastAPI.
- Usa el `Dockerfile` de `backend/`.
- Usa `.do/app.yaml` para definir build, runtime y health check.
- Puede iniciar con dominio interno `*.ondigitalocean.app`.
- Solo necesita dominio custom propio si se quiere exponer `api.tudominio.com`.

Variables esperadas:

| Variable | Tipo | Nota |
|---|---|---|
| `ENVIRONMENT` | Servidor | Ejemplo: `production`. |
| `CORS_ALLOWED_ORIGINS` | Servidor | Dominio de Vercel/custom domain si el backend recibe llamadas directas del browser. |

### Supabase

- Mantiene PostgreSQL, Auth y Storage.
- Debe incluir el dominio custom en Auth Redirect URLs.
- Debe mantener PDFs en bucket privado.
- Debe conservar RLS habilitado para datos de usuario.

URLs a registrar cuando exista dominio:

| Uso | URL |
|---|---|
| Site URL | `https://tudominio.app` o dominio elegido |
| Redirect local | `http://localhost:3000/auth/callback` |
| Redirect producción | `https://tudominio.app/auth/callback` |

---

## DNS y SSL

### Dominio Raíz y `www`

Configurar en Vercel siguiendo las instrucciones que entregue el dashboard:

- Dominio raíz: `tudominio.app`
- Alias recomendado: `www.tudominio.app`
- SSL: automático en Vercel

### Backend API

Fase inicial recomendada:

- Mantener FastAPI con URL de DigitalOcean: `https://istqb-study-agent-api-xxxxx.ondigitalocean.app`
- Guardar esa URL en `FASTAPI_URL` en Vercel.

Fase posterior opcional:

- Crear `api.tudominio.app` apuntando a DigitalOcean.
- Configurar SSL del subdominio en DigitalOcean.
- Actualizar `FASTAPI_URL`.

---

## Seguimiento En El Roadmap

Este plan se conecta con el Bloque G del roadmap:

| Guía | Relación con este plan |
|---|---|
| PR-01 | Deploy frontend a Vercel. |
| PR-02 | Deploy backend a DigitalOcean. |
| PR-03 | Variables de entorno de producción. |
| PR-04 | Dominio custom, DNS, SSL y Supabase redirects. |
| PR-05 | Prueba end-to-end completa en producción. |

---

## Checklist De Producción

- [ ] Elegir dominio candidato en Name.com (`.app` recomendado, `.dev` alternativa).
- [ ] Confirmar fallback Namecheap `.me` si Name.com no tiene disponibilidad adecuada.
- [ ] Conectar frontend a Vercel desde GitHub.
- [ ] Conectar backend a DigitalOcean App Platform.
- [ ] Configurar variables de entorno en Vercel.
- [ ] Configurar variables de entorno en DigitalOcean.
- [ ] Registrar dominio custom en Vercel.
- [ ] Configurar DNS del dominio.
- [ ] Verificar SSL activo.
- [ ] Actualizar Supabase Auth Site URL y Redirect URLs.
- [ ] Verificar login/registro con dominio custom.
- [ ] Verificar upload PDF, extracción FastAPI y persistencia en Supabase.
- [ ] Ejecutar prueba completa de sesión y dashboard.

---

## Beneficios Student Pack Que Sí Conviene Activar

| Beneficio | Momento recomendado |
|---|---|
| DigitalOcean | Antes de BE-06. |
| Name.com | Antes de PR-04 o cuando se decida el nombre final. |
| GitHub Actions | PR-01 y PR-02. |
| Vercel | FE-01 en adelante, obligatorio para producción. |
| Sentry | Después de PR-05 si se quiere monitoreo de errores. |
| Codecov | Cuando haya suite de tests estable. |

Inventario completo: [Beneficios GitHub Student Pack](beneficios_github_student_pack.md).

---

## Decisiones Pendientes

- Nombre exacto del dominio.
- Si la app será solo personal o abierta a más usuarios.
- Si el backend necesita subdominio propio (`api.tudominio.app`) o basta con la URL de DigitalOcean.
- Si se activará monitoreo con Sentry después del MVP.
