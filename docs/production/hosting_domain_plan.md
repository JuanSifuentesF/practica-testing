# Plan de Hosting, Dominio y Producción

**Proyecto:** ISTQB Study Agent  
**Estado:** decisión parcial; backend Heroku pendiente de auditoría detallada  
**Referencia principal:** `docs/roadmap/ISTQB_Guias_Implementacion.md` v2.13;
el documento de arquitectura v1.0 es un baseline histórico.

---

## Decisión Recomendada

Usar una arquitectura de producción dividida por responsabilidad:

| Capa | Servicio | Decisión |
|---|---|---|
| Frontend | Vercel | Hosting principal de Next.js, dominio custom y SSL automático. |
| Backend | Heroku | Destino elegido; plan, runtime y pipeline se auditarán antes de PR-02. |
| Base de datos/Auth/Storage | Supabase | PostgreSQL, Auth, Storage privado y RLS. |
| Dominio app | Name.com | `istqb-agent.app`, sujeto a disponibilidad. |
| Dominio portafolio | Name.com | `holajuan.dev`, sujeto a disponibilidad. |
| Dominio fallback | Namecheap | Usar `.me` solo si no hay una buena opción disponible en Name.com. |
| CI/CD | GitHub Actions + integraciones nativas | Deploy automatizado desde GitHub. |

**Decisión de dominio objetivo:** usar `istqb-agent.app` para la app ISTQB Study Agent y `holajuan.dev` para el portafolio personal. Ambos nombres quedan sujetos a disponibilidad en Name.com antes de reclamarlos.

---

## Por Qué Name.com Es Mejor Opción Inicial

- `.app` comunica que es una aplicación web, no solo un sitio personal.
- `.dev` comunica proyecto técnico y exige HTTPS por diseño del navegador.
- Vercel gestiona SSL automáticamente, así que el certificado gratis de Namecheap no aporta mucho para este stack.
- Namecheap `.me` sigue siendo válido, pero suena más a marca personal que a producto educativo.

**Decisión práctica:** intentar primero con `istqb-agent.app` y `holajuan.dev` en Name.com. Si alguno no está disponible, buscar una variante corta antes de caer en Namecheap `.me` como fallback.

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
FastAPI en Heroku
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
| `GEMINI_API_KEY` | Servidor | Solo runtime IA server-only. |
| `GEMINI_OPENAI_BASE_URL` | Servidor | Endpoint compatible usado solo por el runtime. |
| `NEXT_PUBLIC_FASTAPI_URL` | Pública, contrato actual | Es el nombre que lee hoy `/api/extract`; la URL no es un secreto. |
| `FASTAPI_URL` | Servidor, contrato objetivo | Requiere migrar y probar el Route Handler antes de retirar el nombre actual. |

No configurar `OPENAI_MODEL` como fallback global: Settings y la allowlist
server-only son la autoridad. Los overrides de modelo listados actualmente en
`.env.example` no tienen consumidores runtime y deben retirarse o implementarse
explícitamente durante el gate, nunca asumirse activos.

### Heroku

- Será el destino del microservicio FastAPI cuando se retome producción.
- El plan, método de build, health check, límites y costos se deben confirmar
  contra la documentación vigente de Heroku antes de generar PR-02.
- `backend/Dockerfile` puede reutilizarse solo después de esa auditoría.
- `.do/app.yaml` es infraestructura histórica y no debe aplicarse.
- No se declara una URL productiva nueva hasta completar deploy y QA.

Variables esperadas:

| Variable | Tipo | Nota |
|---|---|---|
| `ENVIRONMENT` | Servidor | Ejemplo: `production`. |
| `FRONTEND_ORIGIN` | Servidor | Dominio exacto de Vercel/custom domain permitido por CORS. |

### Supabase

- Mantiene PostgreSQL, Auth y Storage.
- Debe incluir el dominio custom en Auth Redirect URLs.
- Debe mantener PDFs en bucket privado.
- Debe conservar RLS habilitado para datos de usuario.

URLs a registrar cuando exista dominio:

| Uso | URL |
|---|---|
| Site URL | `https://istqb-agent.app` si el dominio está disponible |
| Redirect local | `http://localhost:3000/auth/callback` |
| Redirect producción | `https://istqb-agent.app/auth/callback` |

---

## DNS y SSL

### Dominio Raíz y `www`

Configurar en Vercel siguiendo las instrucciones que entregue el dashboard:

- Dominio raíz: `istqb-agent.app`
- Alias recomendado: `www.istqb-agent.app`
- SSL: automático en Vercel

### Backend API

Fase inicial recomendada:

- Desplegar FastAPI en Heroku solo después del gate correctivo y QA integral.
- Mientras el código actual siga vigente, guardar la URL en
  `NEXT_PUBLIC_FASTAPI_URL`. Si el Route Handler se migra y prueba como parte
  del mismo cambio, usar después `FASTAPI_URL` server-only.

Fase posterior opcional:

- Crear `api.istqb-agent.app` apuntando a Heroku si el plan elegido lo permite.
- Configurar SSL del subdominio según el contrato vigente de Heroku.
- Actualizar la variable FastAPI que esté realmente consumiendo el build.

---

## Seguimiento En El Roadmap

Este plan se conecta con el Bloque G del roadmap:

| Guía | Relación con este plan |
|---|---|
| PR-01 | Deploy frontend a Vercel. |
| PR-02 | Redefinir CI/CD y deploy backend para Heroku. |
| PR-03 | Variables de entorno de producción. |
| PR-04 | Dominio custom, DNS, SSL y Supabase redirects. |
| PR-05 | Prueba end-to-end completa en producción. |

---

## Checklist De Producción

- [ ] Verificar disponibilidad de `istqb-agent.app` en Name.com.
- [ ] Verificar disponibilidad de `holajuan.dev` en Name.com.
- [ ] Confirmar fallback Namecheap `.me` solo si Name.com no tiene disponibilidad adecuada.
- [ ] Conectar frontend a Vercel desde GitHub.
- [ ] Auditar plan/runtime/costos de Heroku y conectar el backend.
- [ ] Configurar variables de entorno en Vercel.
- [ ] Configurar variables de entorno en Heroku.
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
| DigitalOcean | Beneficio histórico usado en BE-06; no es el destino futuro. |
| Heroku | Confirmar plan, límites y costos vigentes antes de PR-02. |
| Name.com | Antes de PR-04 o cuando se decida el nombre final. |
| GitHub Actions | PR-01 y PR-02. |
| Vercel | FE-01 en adelante, obligatorio para producción. |
| Sentry | Después de PR-05 si se quiere monitoreo de errores. |
| Codecov | Cuando haya suite de tests estable. |

Inventario completo: [Beneficios GitHub Student Pack](beneficios_github_student_pack.md).

---

## Decisiones Pendientes

- Confirmar disponibilidad real de `istqb-agent.app` y `holajuan.dev` antes de reclamarlos.
- Si la app será solo personal o abierta a más usuarios.
- Si el backend necesita subdominio propio (`api.istqb-agent.app`) o basta con la URL generada por Heroku.
- Si se activará monitoreo con Sentry después del MVP.
