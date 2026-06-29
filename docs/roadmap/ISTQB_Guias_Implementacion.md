# ISTQB Study Agent — Árbol de Guías de Implementación
**Versión:** 1.0  
**Fecha:** Mayo 2026  
**Principio:** Cada guía depende de las anteriores. Nunca saltar una.

---

## 📊 Estado de Progreso de la Implementación

| Bloque | ID | Nombre de la Guía | Estado | Entregable / Progreso |
| :--- | :--- | :--- | :--- | :--- |
| **🗄️ BLOQUE A: Base de Datos** | **DB-01** | Proyecto Supabase + Configuración Inicial | ✅ **Completado** | [Guía DB-01](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/DB-01.md) — *Linked + Started* |
| | **DB-02** | Schema: Tablas, Relaciones y CHECK constraints | ✅ **Completado** | [Guía DB-02](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/DB-02.md) — *Migración aplicada* |
| | **DB-03** | Storage Bucket Privado para PDFs | ✅ **Completado** | [Guía DB-03](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/DB-03.md) — *Bucket y políticas creados* |
| | **DB-04** | Row Level Security (RLS) Policies | ✅ **Completado** | [Guía DB-04](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/DB-04.md) — *Migración aplicada* |
| | **DB-05** | Supabase Auth Configuración | ✅ **Completado** | [Guía DB-05](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/DB-05.md) — *Trigger + Auth configurados* |
| **⚙️ BLOQUE B: Backend** | **BE-01** | Scaffold del proyecto FastAPI | ✅ **Completado** | [Guía BE-01](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/be/BE-01.md) — *Scaffold funcional* |
| | **BE-02** | Dockerfile + config DigitalOcean | ✅ **Completado** | [Guía BE-02](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/be/BE-02.md) — *Dockerfile + app.yaml funcionales* |
| | **BE-03** | Endpoint POST /extract-pdf | ✅ **Completado** | [Guía BE-03](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/be/BE-03.md) — *pdfplumber integrado* |
| | **BE-04** | Algoritmo de detección de tópicos | ✅ **Completado** | [Guía BE-04](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/be/BE-04.md) — *Regex FL-x.x.x funcional* |
| | **BE-05** | Chunking y estructuración JSON | ✅ **Completado** | [Guía BE-05](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/be/BE-05.md) — *JSON estructurado con tópicos* |
| | **BE-06** | Deploy a DigitalOcean + health check | ✅ **Completado** | [Guía BE-06](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/be/BE-06.md) — *API en https://squid-app-y364m.ondigitalocean.app* |
| **🌐 BLOQUE C: Frontend** | **FE-01** | Scaffold Next.js + TS + Tailwind + shadcn/ui | ✅ **Completado** | [Guía FE-01](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/FE-01.md) — *Scaffold funcional* |
| | **FE-02** | Conexión con Supabase | ✅ **Completado** | [Guía FE-02](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/FE-02.md) — *Clientes Supabase creados* |
| | **FE-03** | Auth: login, register, middleware | ✅ **Completado** | [Guía FE-03](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/FE-03.md) — *Auth funcional* |
| | **FE-04** | Layout base + navegación | ✅ **Completado** | [Guía FE-04](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/FE-04.md) — *Layout + header + menú* |
| **📤 BLOQUE D: Upload** | **UP-01** | UI: página de setup (upload PDF + config días/horarios) | ✅ **Completado** | [Guía UP-01](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/UP-01.md) — *Checkpoints verificados* |
| | **UP-02** | API Route `/api/upload` → Supabase Storage | ✅ **Completado** | [Guía UP-02](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/UP-02.md) — *Fix de tipos Supabase v2.108+ aplicado* |
| | **UP-03** | Llamada Next.js → FastAPI `/extract-pdf-full` | ✅ **Completado** | [Guía UP-03](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/UP-03.md) — *Extracción validada con 63 tópicos* |
| | **UP-04** | Prompt de generación de plan + API Route | ✅ **Completado** | [Guía UP-04](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/UP-04.md) — *Multi-proveedor (Gemini + GPT-5) funcional* |
| | **UP-05** | Persistencia del plan en Supabase | ✅ **Completado** | [Guía UP-05](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/UP-05.md) — *study_plans + sessions + topic_progress funcional* |
| | **UP-06** | UI: visualización de plan como calendario | ✅ **Completado** | [Guía UP-06](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/UP-06.md) — *Calendario dinámico funcional con 10 componentes* |
| | **SE-01** | API Routes de sesión + página /session funcional | ✅ **Completado** | [Guía SE-01](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/SE-01.md) — *2 endpoints + página /session funcional* |
| | **SE-02** | Prompt de teoría + API Route `/api/sessions/[id]/theory` | ✅ **Completado** | [Guía SE-02](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/SE-02.md) — *Gemini genera teoría con idempotencia y cache* |
| **📚 BLOQUE E: Sesión** | **SE-03** | UI: TheoryPanel (lectura de teoría + timer) | ✅ **Completado** | [Guía SE-03](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/SE-03.md) — *5 archivos, tsc limpio, 11/11 checkpoints* |
| | **SE-04** | Prompt de quiz + API Route `/api/sessions/[id]/quiz` | 📝 **Guía validada** | [Guía SE-04](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/SE-04.md) — *Pendiente implementación manual* |
| | **SE-05** a **SE-08** | Ciclo de Sesiones de Estudio Adaptativo | ⏳ **Pendiente** | *Por iniciar tras SE-04* |
| **📊 BLOQUE F: Dashboard** | **DA-01** a **DA-05** | Dashboard de Progreso y Métricas | ⏳ **Pendiente** | *Por iniciar* |
| **🧪 BLOQUE QA: Testing** | **QA-01** a **QA-03** | Tests E2E con Cypress | ⏳ **Pendiente** | *Por iniciar* |
| **🚀 BLOQUE G: Prod** | **PR-01** a **PR-05** | Producción, CI/CD y Go Live | ⏳ **Pendiente** | *Por iniciar* |

---

## ¿Cómo usar este documento?

```
1. Completar una guía al 100% antes de abrir la siguiente
2. Cada guía termina con un CHECKPOINT de verificación
3. Si el checkpoint falla → no avanzar hasta resolverlo
4. La IA usará el documento de arquitectura + guías anteriores
   como contexto al generar cada guía nueva
```

---

## Árbol completo de guías

```
ISTQB Study Agent
│
├── 🗄️  BLOQUE A — BASE DE DATOS (Supabase)
│   ├── [x] DB-01  Proyecto Supabase + configuración inicial (Completado)
│   ├── [x] DB-02  Schema: tablas y relaciones (Completado)
│   ├── [x] DB-03  Storage bucket para PDFs (Completado)
│   ├── [x] DB-04  Row Level Security (RLS) policies (Completado)
│   └── [x] DB-05  Supabase Auth configuración (Completado)
│
├── ⚙️  BLOQUE B — BACKEND (FastAPI)
│   ├── [x] BE-01  Scaffold del proyecto FastAPI (Completado)
│   ├── [x] BE-02  Dockerfile + config DigitalOcean (Completado)
│   ├── [x] BE-03  Endpoint POST /extract-pdf con pdfplumber (Completado)
│   ├── [x] BE-04  Algoritmo de detección de tópicos FL-x.x.x (Completado)
│   ├── [x] BE-05  Chunking y estructuración del JSON de salida (Completado)
│   └── [x] BE-06  Deploy a DigitalOcean + health check (Completado)
│
├── 🌐  BLOQUE C — FRONTEND BASE (Next.js)
│   ├── [x] FE-01  Scaffold Next.js + TypeScript + Tailwind + shadcn/ui (Completado)
│   ├── [x] FE-02  Conexión con Supabase (cliente + servidor) (Completado)
│   ├── [x] FE-03  Auth: registro, login, logout, middleware (Completado)
│   └── [x] FE-04  Layout base + navegación (Completado)
│
├── 📤  BLOQUE D — FLUJO DE UPLOAD Y PLAN
│   ├── [x] UP-01  UI: página de setup (upload PDF + config días/horarios) (Completado)
│   ├── [x] UP-02  API Route /api/upload → Supabase Storage (Completado)
│   ├── [x] UP-03  Llamada Next.js → FastAPI /extract-pdf-full (Completado)
│   ├── [x] UP-04  Prompt de generación de plan + API Route (Completado — Gemini 2.5 Flash + GPT-5)
│   ├── [x] UP-05  Guardar plan en Supabase (Completado — study_plans + sessions + topic_progress)
│   └── [x] UP-06  UI: visualización del plan generado (Completado — calendario dinámico + placeholder /session)
│
├── 📚  BLOQUE E — SESIÓN DE ESTUDIO
│   ├── [x] SE-01  API Routes de sesión + página /session (Completado — 2 endpoints + vista funcional)
│   ├── [x] SE-02  Prompt de teoría + API Route /api/sessions/[id]/theory (Completado — Gemini + cache + idempotencia)
│   ├── [x] SE-03  UI: TheoryPanel (45 min, JSON estructurado, timer) (Completado — 4 componentes + page.tsx refactorizado)
│   ├── SE-04  Prompt de quiz + API Route /api/sessions/[id]/quiz — Guía validada, pendiente implementación
│   ├── SE-05  UI: QuizCard (opciones A/B/C/D, sin feedback inmediato)
│   ├── SE-06  Envío en conjunto + API Route /api/sessions/[id]/evaluate
│   ├── SE-07  Lógica adaptativa: advance | reinforce | restructure
│   └── SE-08  UI: FeedbackPanel (score, errores, decisión, próxima sesión)
│
├── 📊  BLOQUE F — DASHBOARD DE PROGRESO
│   ├── DA-01  API Route /api/dashboard/metrics
│   ├── DA-02  UI: gráfica de score por sesión (LineChart)
│   ├── DA-03  UI: heatmap de tópicos por estado
│   ├── DA-04  UI: tiempo real vs estimado (BarChart)
│   └── DA-05  UI: fecha estimada de examen + contadores
│
├── 🧪  BLOQUE QA — TESTING E2E
│   ├── QA-01  Configurar Cypress + data-testid en componentes clave
│   ├── QA-02  Tests de auth: login, register, logout, redirects
│   └── QA-03  Tests de flujo completo: upload → plan → sesión → dashboard
│
└── 🚀  BLOQUE G — PRODUCCIÓN
    ├── PR-01  GitHub Actions: CI/CD frontend → Vercel
    ├── PR-02  GitHub Actions: CI/CD backend → DigitalOcean
    ├── PR-03  Variables de entorno en producción
    ├── PR-04  Dominio custom (Name.com/Namecheap) → Vercel
    └── PR-05  Prueba end-to-end completa + simulacro final
```

---

## Detalle de cada guía

---

### 🗄️ BLOQUE A — BASE DE DATOS

---

#### DB-01 — Proyecto Supabase + configuración inicial
```
OBJETIVO:
  Tener el proyecto Supabase creado y las credenciales
  listas para usar en el resto del proyecto.

CUBRE:
  - Crear proyecto en supabase.com
  - Obtener: URL del proyecto, anon key, service_role key
  - Crear .env.example sin valores reales
  - Guardar service_role solo para servidor/API Routes, nunca en cliente
  - Instalar Supabase CLI localmente
  - Conectar CLI al proyecto remoto
  - Estructura de carpetas: /supabase/migrations/

DEPENDENCIAS: ninguna (es la primera)

CHECKPOINT ✅:
  - supabase status muestra proyecto conectado
  - Las 3 credenciales están guardadas en .env.local
  - .env.example existe y no contiene secrets reales
  - Ninguna variable service_role usa prefijo NEXT_PUBLIC_
```

#### DB-02 — Schema: tablas y relaciones
```
OBJETIVO:
  Todas las tablas del sistema creadas y funcionando.

CUBRE:
  - Migration: user_profiles
  - Migration: documents
  - Migration: study_plans
  - Migration: sessions
  - Migration: answers
  - Migration: topic_progress
  - CHECK constraints para status, session_type, method_used, action_taken, level_k y scores
  - Índices de performance
  - Verificación de foreign keys

DEPENDENCIAS: DB-01

CHECKPOINT ✅:
  - supabase db push sin errores
  - Todas las tablas visibles en Supabase Table Editor
  - Insertar y leer un registro de prueba en cada tabla
  - Intentar insertar un status inválido falla por constraint
```

#### DB-03 — Storage bucket para PDFs
```
OBJETIVO:
  Bucket configurado para recibir y servir PDFs.

CUBRE:
  - Crear bucket "pdfs" en Supabase Storage
  - Configurar como privado (solo el dueño accede)
  - Policy: usuario solo puede leer/escribir sus propios PDFs
  - Generar URL firmada de prueba

DEPENDENCIAS: DB-01, DB-02

CHECKPOINT ✅:
  - Subir un PDF de prueba via Supabase dashboard
  - Generar URL firmada y verificar que descarga el PDF
```

#### DB-04 — Row Level Security (RLS) policies
```
OBJETIVO:
  Ningún usuario puede ver datos de otro usuario.

CUBRE:
  - Habilitar RLS en todas las tablas
  - Policy SELECT: user_id = auth.uid()
  - Policy INSERT: user_id = auth.uid()
  - Policy UPDATE: user_id = auth.uid()
  - Policy DELETE: user_id = auth.uid()
  - Policies de Storage para bucket privado `pdfs/{user_id}/...`
  - Reglas para URLs firmadas de corta duración
  - Probar que un usuario B no puede leer datos del usuario A

DEPENDENCIAS: DB-02, DB-03

CHECKPOINT ✅:
  - Con usuario A logueado: ve solo sus datos
  - Con usuario B logueado: no ve nada de A
  - Sin sesión: no ve ningún dato
  - Un usuario no puede descargar PDFs de otro usuario
```

#### DB-05 — Supabase Auth configuración
```
OBJETIVO:
  Sistema de autenticación funcional con email/password.

CUBRE:
  - Habilitar Email/Password provider en Supabase Auth
  - Configurar redirect URLs (localhost + dominio futuro)
  - Template de email de confirmación (personalizar)
  - Trigger: al crear usuario → insertar en user_profiles
  - Probar registro y login via Supabase dashboard

DEPENDENCIAS: DB-01, DB-02, DB-04

CHECKPOINT ✅:
  - Registrar usuario de prueba por API de Supabase
  - Verificar que se crea automáticamente en user_profiles
  - Login retorna access_token válido
```

---

### ⚙️ BLOQUE B — BACKEND (FastAPI)

---

#### BE-01 — Scaffold del proyecto FastAPI
```
OBJETIVO:
  Proyecto FastAPI corriendo localmente con estructura limpia.

CUBRE:
  - Crear carpeta /backend con estructura:
      app/main.py
      app/routers/
      app/services/
      app/models/schemas.py
      app/core/config.py
  - requirements.txt con dependencias base:
      fastapi, uvicorn, pdfplumber, pymupdf, python-multipart
  - Variables de entorno con python-dotenv
  - Endpoint GET /health funcional
  - Correr con: uvicorn app.main:app --reload

DEPENDENCIAS: ninguna (paralelo a DB)

CHECKPOINT ✅:
  - GET http://localhost:8000/health retorna { "status": "ok" }
  - GET http://localhost:8000/docs muestra Swagger UI
```

#### BE-02 — Dockerfile + config DigitalOcean
```
OBJETIVO:
  El proyecto containerizado y listo para deployar.

CUBRE:
  - Dockerfile optimizado para FastAPI
  - .dockerignore
  - Archivo .do/app.yaml para DigitalOcean App Platform
  - Variables de entorno en DO (sin hardcodear secrets)
  - Build local de la imagen Docker para verificar

DEPENDENCIAS: BE-01

CHECKPOINT ✅:
  - docker build . sin errores
  - docker run funciona y responde en localhost:8000
  - app.yaml tiene la configuración correcta de DO
```

#### BE-03 — Endpoint POST /extract-pdf con pdfplumber
```
OBJETIVO:
  Recibir un PDF y extraer su texto completo.

CUBRE:
  - Router: app/routers/pdf.py
  - Aceptar multipart/form-data con UploadFile
  - Leer el PDF en memoria (sin guardar en disco)
  - Extraer texto con pdfplumber página por página
  - Manejar PDFs con watermarks (como el ISTQB)
  - Retornar texto crudo + número de páginas
  - Manejo de errores: PDF corrupto, archivo no PDF

DEPENDENCIAS: BE-01

CHECKPOINT ✅:
  - POST /extract-pdf con el PDF del ISTQB retorna texto
  - El texto incluye contenido de todas las páginas
  - Error claro si se sube un archivo que no es PDF
```

#### BE-04 — Algoritmo de detección de tópicos FL-x.x.x
```
OBJETIVO:
  Del texto extraído, identificar cada objetivo de aprendizaje.

CUBRE:
  - Servicio: app/services/topic_detector.py
  - Regex para detectar patrones: FL-1.1.1, FL-2.3.1, etc.
  - Detectar el Nivel K asociado a cada tópico (K1/K2/K3)
  - Extraer el texto correspondiente a cada tópico
  - Contar tópicos totales y distribución por nivel K
  - Manejar variaciones de formato en el PDF
  - Fixtures de texto extraído para pruebas determinísticas
  - Validación configurable de tópicos esperados por versión del syllabus

DEPENDENCIAS: BE-03

CHECKPOINT ✅:
  - El detector identifica los 40 tópicos del ISTQB v4.0
  - Cada tópico tiene su nivel K correcto
  - El texto asociado a FL-1.1.1 es el correcto
  - Si faltan tópicos, retorna warning/error estructurado y no falla silenciosamente
```

#### BE-05 — Chunking y estructuración del JSON de salida
```
OBJETIVO:
  Retornar un JSON estructurado y consumible por Next.js.

CUBRE:
  - Servicio: app/services/extractor.py
  - Estructurar el output final:
    {
      topics: { "FL-1.1.1": { text, level_k, name }, ... },
      total_topics: 40,
      level_distribution: { K1: 12, K2: 20, K3: 8 },
      estimated_study_hours: 8
    }
  - Schemas Pydantic para validación del response
  - Calcular estimated_study_hours (K1=0.5h, K2=1h, K3=1.5h)
  - Tests del servicio con fixtures del PDF real
  - Snapshot del JSON esperado para detectar regresiones

DEPENDENCIAS: BE-03, BE-04

CHECKPOINT ✅:
  - POST /extract-pdf retorna el JSON estructurado completo
  - Validar con Pydantic que el schema es correcto
  - El JSON es consumible sin transformación desde Next.js
  - Un cambio inesperado en el formato del PDF rompe tests de forma clara
```

#### BE-06 — Deploy a DigitalOcean + health check
```
OBJETIVO:
  FastAPI corriendo en producción en DigitalOcean.

CUBRE:
  - Push del código a GitHub
  - Configurar App Platform en DO (conectar repo)
  - Configurar variables de entorno en DO dashboard
  - Primer deploy automático
  - Configurar dominio interno de DO
  - Verificar logs del deploy

DEPENDENCIAS: BE-01, BE-02, BE-05

CHECKPOINT ✅:
  - GET https://[tu-app].ondigitalocean.app/health → 200 OK
  - POST /extract-pdf con el PDF del ISTQB desde Postman → responde
  - Los logs en DO no muestran errores
```

---

### 🌐 BLOQUE C — FRONTEND BASE (Next.js)

---

#### FE-01 — Scaffold Next.js + TypeScript + Tailwind + shadcn/ui
```
OBJETIVO:
  Proyecto Next.js corriendo localmente con el stack base.

CUBRE:
  - npx create-next-app con TypeScript + Tailwind + App Router
  - Instalar y configurar shadcn/ui
  - Instalar dependencias clave:
      @supabase/supabase-js
      @supabase/ssr
      openai
      recharts
      react-markdown
  - Estructura de carpetas definida (ver doc de arquitectura)
  - Variables de entorno: .env.local con claves de Supabase y OpenAI
  - Regla: componentes cliente solo pueden usar variables NEXT_PUBLIC_ seguras

DEPENDENCIAS: DB-01 (necesita las credenciales de Supabase)

CHECKPOINT ✅:
  - npm run dev sin errores en http://localhost:3000
  - Un componente de shadcn/ui renderiza correctamente
  - .env.local tiene todas las variables necesarias
  - El bundle frontend no referencia SUPABASE_SERVICE_ROLE_KEY ni OPENAI_API_KEY
```

#### FE-02 — Conexión con Supabase (cliente + servidor)
```
OBJETIVO:
  Next.js puede leer y escribir en Supabase desde cliente y servidor.

CUBRE:
  - lib/supabase/client.ts (para componentes cliente)
  - lib/supabase/server.ts (para API Routes y Server Components)
  - lib/types.ts con tipos TypeScript de todas las tablas
  - Probar: leer tabla documents desde un Server Component
  - Probar: leer tabla documents desde un Client Component

DEPENDENCIAS: FE-01, DB-02, DB-04

CHECKPOINT ✅:
  - Server Component puede hacer SELECT en Supabase
  - Client Component puede hacer SELECT en Supabase
  - Los tipos TypeScript coinciden con el schema de DB
```

#### FE-03 — Auth: registro, login, logout, middleware
```
OBJETIVO:
  Usuario puede registrarse, iniciar sesión y el middleware
  protege las rutas privadas.

CUBRE:
  - Página /login con formulario (email + password)
  - Página /register con formulario
  - Lógica de auth con Supabase Auth SSR
  - middleware.ts: protege rutas /dashboard, /setup, /session
  - Redirect a /login si no hay sesión
  - Redirect a /dashboard si ya hay sesión
  - Logout desde el header

DEPENDENCIAS: FE-01, FE-02, DB-05

CHECKPOINT ✅:
  - Registrar usuario nuevo → redirige a /dashboard
  - Intentar entrar a /dashboard sin sesión → redirige a /login
  - Logout → sesión destruida + redirige a /login
```

#### FE-04 — Layout base + navegación
```
OBJETIVO:
  Shell visual de la app: header, navegación, estructura de páginas.

CUBRE:
  - Layout raíz con header
  - Header: logo, nombre usuario, botón logout
  - Navegación: Dashboard | Mi Plan | Sesión actual
  - Página de inicio /dashboard (placeholder por ahora)
  - Loading UI y error boundaries básicos
  - Responsive: funciona en celular y desktop

DEPENDENCIAS: FE-01, FE-03

CHECKPOINT ✅:
  - La app navega entre páginas sin errores
  - El header muestra el email del usuario logueado
  - En celular (375px) la navegación es usable
```

---

### 📤 BLOQUE D — FLUJO DE UPLOAD Y PLAN

---

#### UP-01 — UI: página de setup
```
OBJETIVO:
  El usuario puede configurar su plan de estudio.

CUBRE:
  - Drag & drop de PDF (con react-dropzone o nativo)
  - Preview del nombre del archivo seleccionado
  - Input: número de días objetivo (default: 7)
  - Selector de horario mañana (default: 6:00am)
  - Selector de horario noche (default: 10:00pm)
  - Botón "Generar mi plan de estudio"
  - Estado de loading mientras procesa

DEPENDENCIAS: FE-04

CHECKPOINT ✅:
  - Se puede seleccionar un PDF con drag & drop y click
  - Los inputs de configuración funcionan
  - El botón muestra loading state al hacer click
```

#### UP-02 — API Route /api/upload
```
OBJETIVO:
  El PDF llega a Supabase Storage y se registra en la DB.

CUBRE:
  - API Route: app/api/upload/route.ts
  - Recibir multipart/form-data con el PDF
  - Subir a Supabase Storage en bucket "pdfs"
  - Path: pdfs/{user_id}/{timestamp}_{filename}
  - Insertar registro en tabla documents
  - Retornar { document_id, file_url }
  - Validar: solo archivos PDF, máximo 20MB
  - Validar sesión del usuario antes de usar service_role
  - Guardar rutas privadas y generar signed URLs solo cuando sean necesarias

DEPENDENCIAS: UP-01, DB-03, FE-02

CHECKPOINT ✅:
  - Subir PDF desde la UI → aparece en Supabase Storage
  - Registro creado en tabla documents con file_url correcto
  - Error claro si el archivo no es PDF o supera 20MB
  - Un usuario no autenticado no puede subir PDFs
  - Un usuario no puede sobreescribir rutas de otro usuario
```

#### UP-03 — Llamada Next.js → FastAPI /extract-pdf-full
```
OBJETIVO:
  Next.js obtiene los tópicos estructurados del PDF subido.

CUBRE:
  - Desde la API Route de upload, descargar el PDF de Storage
  - Enviar el PDF a FastAPI POST /extract-pdf-full
  - Recibir el JSON de tópicos estructurados
  - Guardar topics_json en la tabla documents
  - Manejar timeout (FastAPI puede tardar 3-5 seg)
  - Manejar error si FastAPI no está disponible
  - Rechazar o marcar como incompleta la extracción si faltan tópicos esperados

DEPENDENCIAS: UP-02, BE-06

CHECKPOINT ✅:
  - Subir el PDF del ISTQB → topics_json guardado en documents
  - El JSON tiene los 40 tópicos con nivel K
  - Si FastAPI falla → error descriptivo al usuario
  - Si la extracción retorna menos tópicos de los esperados → no se genera el plan automáticamente
```

#### UP-04 — Prompt de generación de plan + API Route (+ Selector Multi-Modelo)
```
OBJETIVO:
  La IA genera el plan intensivo basado en los tópicos y objective_days.
  El usuario puede elegir entre Gemini 2.5 Flash y GPT-5 desde la UI.

CUBRE:
  - lib/openai.ts: cliente OpenAI configurado (mantenido para compatibilidad)
  - Selector de modelo en la UI (study-config.tsx): Gemini 2.5 Flash | GPT-5
  - Backend multi-proveedor: createPlanModelRuntime() según model_provider
  - Gemini via endpoint OpenAI-compatible (GEMINI_API_KEY + GEMINI_OPENAI_BASE_URL)
  - GPT-5 via API OpenAI directa (OPENAI_API_KEY)
  - Diseño del prompt de generación de plan:
      - Input: tópicos + nivel K + días objetivo + horarios
      - Output JSON: objective_days × 2 sesiones con tópicos asignados
      - Plan base configurable: 1-30 días, 2 sesiones diarias, 90 min por sesión
      - Orden: K1 primero, K3 al final
      - Agrupación temática lógica (no mezclar FL-1 con FL-5)
  - API Route: /api/plan/generate
  - Validar el JSON retornado (puede fallar formato o inventar códigos)
  - Validar ownership del document_id antes de generar el plan
  - Página /plan con PlanPreview temporal via sessionStorage (antes de UP-05)
  - Script de comparación: test-compare-gemini-models.mjs

DEPENDENCIAS: UP-03

CHECKPOINT ✅:
  - /api/plan/generate retorna plan con objective_days × 2 sesiones (63 tópicos reales)
  - Las sesiones respetan el orden K1 → K3
  - El JSON tiene la estructura exacta definida en el schema
  - Gemini 2.5 Flash genera plan válido (18,646 tokens, 46s)
  - Gemini 2.5 Pro genera plan válido (14,154 tokens, 43s)
  - GPT-5 requiere cuota/billing en OpenAI — funcionalidad lista, probada al autenticar
  - El selector de modelo en /setup envía model_provider sin exponer API keys
  - /plan muestra el plan temporal hasta que UP-05 lo persista
```

#### UP-05 — Guardar plan en Supabase
```
OBJETIVO:
  El plan y sus sesiones quedan persistidos en la DB.

CUBRE:
  - Insertar en study_plans con el plan_json completo
  - Insertar en sessions una fila por cada sesión del plan
  - Insertar en topic_progress una fila por cada tópico
    (status: 'pending' para todos al inicio)
  - Persistencia consistente con rollback compensatorio en Route Handler
  - Retornar { plan_id } al frontend

DEPENDENCIAS: UP-04, DB-02

CHECKPOINT ✅:
  - study_plans tiene 1 registro del plan
  - sessions tiene objective_days × 2 registros (morning + night)
  - topic_progress tiene ~63 registros en status 'pending'
  - Verificar en Supabase Table Editor
```

#### UP-06 — UI: visualización del plan generado
```
OBJETIVO:
  El usuario ve su plan como calendario antes de empezar, sin importar si eligió 7, 14 o más días.

CUBRE:
  - Mostrar calendario dinámico de objective_days con sesiones mañana/noche
  - Cada sesión muestra: hora, tópicos, nivel K, duración
  - Botón "Empezar primera sesión" con session_id
  - Placeholder temporal /session hasta SE-01 para evitar 404
  - Indicador de dificultad por día (badge: Fácil/Medio/Difícil)
  - Fecha estimada de examen visible

DEPENDENCIAS: UP-05, FE-04

CHECKPOINT ✅:
  - El calendario muestra objective_days × 2 sesiones correctamente
  - Los tópicos de cada sesión coinciden con lo guardado en DB
  - El botón "Empezar" navega a /session?session_id=<id>
```

---

### 📚 BLOQUE E — SESIÓN DE ESTUDIO

---

#### SE-01 — API Routes de sesión + página /session
```
OBJETIVO:
  Obtener la próxima sesión que el usuario debe completar y reemplazar
  el placeholder /session creado en UP-06 por una vista funcional.

CUBRE:
  - Buscar en sessions donde status = 'pending'
  - Considerar sesiones de refuerzo (reinforcement) antes que las regulares
  - Ordenar sesiones regulares por day_number ASC y morning antes que night
  - Retornar sesión completa con tópicos y plan context
  - Exponer GET /api/sessions/next y GET /api/sessions/[id]
  - Mostrar la sesión cargada en /session?session_id=<uuid>

DEPENDENCIAS: UP-06

ESTADO: ✅ Completado — endpoints funcionales (validado 28 junio 2026)

CHECKPOINT ✅:
  - Retorna la sesión morning del día 1 para un plan nuevo
  - Si hay sesión de refuerzo pendiente, la retorna primero
  - Retorna null si no hay sesiones pendientes (plan completado)
  - /session deja de mostrar placeholder y renderiza tópicos enriquecidos
```

#### SE-02 — Prompt de teoría + API Route
```
OBJETIVO:
  Gemini/OpenAI-compatible genera contenido teórico adaptado al método y tópico.

CUBRE:
  - Prompt de teoría:
      - Input: tópico FL-x.x.x, texto del syllabus, método (theory/examples/analogies)
      - Output: { topics: [{ introduction, key_concepts[], examples[], connections[], summary }] }
  - API Route: /api/sessions/[id]/theory
  - Guardar theory_content en la sesión
  - JSON mode + parser defensivo + validación estricta antes de persistir
  - Idempotencia: segunda llamada retorna cache; force=true regenera
  - El método cambia el estilo de explicación:
      theory    → definiciones formales + principios
      examples  → casos reales del mundo del testing
      analogies → metáforas simples y comparaciones cotidianas

DEPENDENCIAS: SE-01

ESTADO: ✅ Completado — endpoints funcionales (validado 29 junio 2026)

CHECKPOINT ✅:
  - Para FL-1.1.1 con método 'theory': retorna definición de defecto/fallo/error
  - Para FL-1.1.1 con método 'examples': retorna casos reales
  - El JSON tiene la estructura { introduction, key_concepts, examples, summary }
  - theory_content se persiste en sessions y status pasa a active
```

#### SE-03 — UI: TheoryPanel (45 min)
```
OBJETIVO:
  El usuario lee la teoría del agente en una interfaz clara.

CUBRE:
  - Timer visible de 45 minutos (cuenta regresiva)
  - Renderizado del JSON estructurado generado en SE-02 (`TheoryContent.topics[]`)
  - Secciones colapsables: Introducción, Conceptos clave, Ejemplos, Resumen
  - Botón "Listo, ir al quiz" (disponible siempre, no bloquear)
  - Indicador del tópico actual (FL-x.x.x + nombre)
  - Barra de progreso del plan (sesión X de 14)

DEPENDENCIAS: SE-02, FE-04

ESTADO: ✅ Completado — 4 componentes + page.tsx refactorizado, tsc limpio, 11/11 checkpoints (29 junio 2026)

CHECKPOINT ✅:
  - El timer corre correctamente
  - El contenido JSON de teoría renderiza secciones completas por tópico
  - El botón "Ir al quiz" navega al placeholder de quiz (`phase=quiz`)
```

#### SE-04 — Prompt de quiz + API Route
```
OBJETIVO:
  Gemini/OpenAI-compatible genera 10-12 preguntas estilo ISTQB real.

CUBRE:
  - Prompt de generación de quiz:
      - Input: tópico, texto del syllabus, nivel K, historial de errores
      - Output: array de preguntas con { question, options{a,b,c,d}, correct, explanation, topic_code, level_k }
      - Estilo real ISTQB: una correcta, tres distractores plausibles
      - Preguntas K1: recordar definiciones
      - Preguntas K2: explicar/distinguir conceptos
      - Preguntas K3: aplicar en escenario dado
  - API Route: /api/sessions/[id]/quiz
  - Validar que el JSON tiene exactamente el formato esperado

DEPENDENCIAS: SE-02

ESTADO: 📝 Guía validada — pendiente implementación manual (29 junio 2026)

CHECKPOINT ✅:
  - Genera 10 preguntas con 4 opciones cada una
  - La respuesta correcta varía (no siempre es "c")
  - Las preguntas de K3 incluyen un escenario descriptivo
```

#### SE-05 — UI: QuizCard (45 min)
```
OBJETIVO:
  El usuario responde las preguntas sin feedback inmediato.

CUBRE:
  - Una pregunta visible a la vez (con navegación anterior/siguiente)
  - Opciones A/B/C/D como botones seleccionables (toggle)
  - Sin indicación de correcto/incorrecto hasta el final
  - Timer de 45 minutos
  - Indicador de progreso: pregunta X de 12
  - Resumen antes de enviar: preguntas respondidas vs pendientes
  - Botón "Enviar todas las respuestas" (solo si respondió todo)

DEPENDENCIAS: SE-04, FE-04

CHECKPOINT ✅:
  - Se puede navegar entre preguntas libremente
  - Las respuestas seleccionadas se mantienen al volver atrás
  - El botón de envío solo aparece cuando todas están respondidas
  - No hay feedback de correcto/incorrecto durante el quiz
```

#### SE-06 — Envío en conjunto + API Route /evaluate
```
OBJETIVO:
  Todas las respuestas se evalúan juntas por OpenAI.

CUBRE:
  - API Route: /api/sessions/[id]/evaluate
  - Body: array completo de { question_id, user_answer, topic_code, level_k }
  - Prompt de evaluación (ver documento de arquitectura)
  - OpenAI retorna: { score, action, failed_topics, error_patterns,
                      feedback_message, next_method, reinforcement_minutes,
                      estimated_ready_date, next_session_preview }
  - Guardar en tabla answers (una fila por respuesta)
  - Actualizar sessions: score_percent, action_taken, completed_at

DEPENDENCIAS: SE-05, DB-02

CHECKPOINT ✅:
  - Responder 10 preguntas → /evaluate retorna el JSON completo
  - Las respuestas quedan guardadas en tabla answers
  - El score calculado es correcto (respuestas correctas / total × 100)
```

#### SE-07 — Lógica adaptativa: advance | reinforce | restructure
```
OBJETIVO:
  El sistema actúa correctamente según el score obtenido.

CUBRE:
  ADVANCE (score >= 70%):
    - topic_progress: status → 'mastered', mastered_at → NOW()
    - sessions: próxima sesión queda en status 'pending' normal
    - No changes en el plan

  REINFORCE (score 50-69%):
    - topic_progress: status → 'in_progress', attempts + 1
    - Crear nueva sesión de tipo 'reinforcement' para el día siguiente
    - reinforcement_minutes = 15
    - Insertar la sesión de refuerzo antes de la siguiente regular

  RESTRUCTURE (score < 50%):
    - topic_progress: status → 'failed', attempts + 1
    - Cambiar method_used de la sesión fallida
    - Recalcular estimated_end_date en study_plans
    - Crear múltiples sesiones de refuerzo
    - Actualizar plan_json con el nuevo orden

DEPENDENCIAS: SE-06

CHECKPOINT ✅:
  - Score 80% → topic en 'mastered', plan sin cambios
  - Score 60% → sesión de refuerzo creada en DB
  - Score 40% → estimated_end_date extendido + método cambiado
```

#### SE-08 — UI: FeedbackPanel
```
OBJETIVO:
  El usuario ve el resultado y entiende qué sigue.

CUBRE:
  - Score grande y visible (ej: "7/10 — 70%")
  - Badge de decisión: ✅ Avanzas | ⚠️ Refuerzo | 🔄 Reestructurando
  - Lista de tópicos fallidos con la explicación correcta
  - Mensaje de feedback del agente (texto natural de GPT)
  - Preview de la próxima sesión
  - Fecha estimada de examen actualizada
  - Botón "Ver mi progreso" → dashboard
  - Botón "Siguiente sesión" (si la hay)

DEPENDENCIAS: SE-07, FE-04

CHECKPOINT ✅:
  - El score y la decisión se muestran correctamente
  - La explicación de cada pregunta fallida es visible
  - La fecha estimada refleja los cambios del sistema adaptativo
```

---

### 📊 BLOQUE F — DASHBOARD DE PROGRESO

---

#### DA-01 — API Route /api/dashboard/metrics
```
OBJETIVO:
  Un solo endpoint que retorna todas las métricas del dashboard.

CUBRE:
  - Leer de sessions: score por sesión ordenado por fecha
  - Leer de topic_progress: conteo por status
  - Calcular tiempo real vs estimado
  - Leer estimated_end_date de study_plans
  - Retornar JSON completo con todas las métricas

DEPENDENCIAS: SE-07, DB-02

CHECKPOINT ✅:
  - Retorna JSON con todas las métricas después de 2+ sesiones completadas
  - Los scores son correctos según lo guardado en sessions
  - El conteo de tópicos mastered/pending/failed es correcto
```

#### DA-02 — UI: gráfica de score por sesión
```
OBJETIVO:
  Línea de tiempo del rendimiento del usuario.

CUBRE:
  - LineChart con Recharts
  - Eje X: sesiones (Día 1 AM, Día 1 PM, Día 2 AM...)
  - Eje Y: score 0-100%
  - Línea de referencia en 70% (umbral de aprobación)
  - Tooltip con: fecha, tópico, score, acción tomada
  - Puntos coloreados: verde (advance), amarillo (reinforce), rojo (restructure)

DEPENDENCIAS: DA-01, FE-04

CHECKPOINT ✅:
  - La gráfica muestra correctamente el historial de scores
  - La línea de referencia 70% es visible
  - El tooltip muestra información correcta al hacer hover
```

#### DA-03 — UI: heatmap de tópicos
```
OBJETIVO:
  Visualización del estado de todos los tópicos FL-x.x.x.

CUBRE:
  - Grid de todos los tópicos (40 celdas)
  - Color por estado: gris (pending), azul (in_progress), verde (mastered), rojo (failed)
  - Tooltip al hover: nombre del tópico, intentos, mejor score
  - Leyenda de colores
  - Agrupado por sección (FL-1.x, FL-2.x, etc.)

DEPENDENCIAS: DA-01, FE-04

CHECKPOINT ✅:
  - Los 40 tópicos aparecen en el grid
  - Los colores coinciden con el status real en topic_progress
  - Al hacer hover se muestra el nombre del tópico
```

#### DA-04 — UI: tiempo real vs estimado
```
OBJETIVO:
  BarChart comparando tiempo planificado vs tiempo real por sesión.

CUBRE:
  - BarChart agrupado (Recharts)
  - Barra azul: tiempo estimado por sesión (siempre 90 min)
  - Barra verde: tiempo real (duration_minutes de sessions)
  - Solo sesiones completadas
  - Promedio de tiempo real visible

DEPENDENCIAS: DA-01, FE-04

CHECKPOINT ✅:
  - El chart muestra barras para sesiones completadas
  - Los tiempos son correctos según sessions.duration_minutes
```

#### DA-05 — UI: fecha estimada + contadores
```
OBJETIVO:
  Resumen ejecutivo del progreso en la parte superior del dashboard.

CUBRE:
  - Fecha estimada de examen (grande, con días restantes)
  - 4 contadores: Tópicos dominados | En progreso | Pendientes | Fallidos
  - Porcentaje de completitud del plan
  - Racha de días estudiando (streak)
  - Mensaje motivacional del agente (generado según el progreso)

DEPENDENCIAS: DA-01, DA-02, DA-03, DA-04

CHECKPOINT ✅:
  - La fecha estimada coincide con study_plans.estimated_end_date
  - Los contadores suman exactamente 40 tópicos
  - El porcentaje de completitud es correcto
```

---

### 🧪 BLOQUE QA — TESTING E2E (Cypress)

---

#### QA-01 — Configurar Cypress + data-testid
```
OBJETIVO:
  Tener Cypress instalado y componentes marcados para tests.

CUBRE:
  - Instalar Cypress en frontend/
  - Convención: todos los elementos interactivos deben tener data-testid
  - Agregar data-testid en: botones, inputs, enlaces, formularios, avatar
  - Configurar tsconfig para soporte de tipos Cypress
  - Scripts en package.json: "cypress:open", "cypress:run"

DEPENDENCIAS: FE-04 (frontend base completo)

CHECKPOINT ✅:
  - npx cypress open abre el test runner
  - Al menos 10 componentes clave tienen data-testid
```

#### QA-02 — Tests de Auth
```
OBJETIVO:
  Validar que registro, login, logout y redirects funcionan.

CUBRE:
  - Test: visitar /dashboard sin sesión → redirect a /login
  - Test: login con credenciales válidas → redirect a /dashboard
  - Test: login con credenciales inválidas → mensaje de error
  - Test: registro → redirect a /dashboard
  - Test: logout → redirect a /login
  - Test: visitar /login con sesión activa → redirect a /dashboard

DEPENDENCIAS: QA-01, FE-03

CHECKPOINT ✅:
  - Los 6 tests pasan en Cypress
  - Los data-testid cubren inputs, botones y formularios de auth
```

#### QA-03 — Test de Flujo Completo
```
OBJETIVO:
  Validar el flujo crítico de principio a fin.

CUBRE:
  - Test: upload de PDF → aparece en documentos
  - Test: generar plan → objective_days × 2 sesiones creadas
  - Test: completar teoría → botón ir al quiz visible
  - Test: responder quiz y enviar → feedback visible
  - Test: dashboard muestra métricas actualizadas
  - Test responsive: mobile (375px) y desktop (1280px)

DEPENDENCIAS: QA-02, UP-06, SE-08, DA-05

CHECKPOINT ✅:
  - Todo el flujo crítico pasa en Cypress
  - Tests responsive pasan en ambas resoluciones
  - < 30 segundos por test (rendimiento aceptable)
```

---

### 🚀 BLOQUE G — PRODUCCIÓN

---

#### PR-01 — GitHub Actions: CI/CD frontend → Vercel
```
OBJETIVO:
  Cada push a main deploya el frontend automáticamente.

CUBRE:
  - .github/workflows/deploy-frontend.yml
  - Trigger: push a branch main
  - Steps: checkout → install → build → deploy a Vercel
  - Vercel CLI o integración nativa con GitHub
  - Variables de entorno en Vercel dashboard

DEPENDENCIAS: FE-04 (frontend funcionando)

CHECKPOINT ✅:
  - Push a main → deploy automático en menos de 3 minutos
  - La URL de Vercel muestra la app correctamente
```

#### PR-02 — GitHub Actions: CI/CD backend → DigitalOcean
```
OBJETIVO:
  Cada push a main deploya el backend automáticamente.

CUBRE:
  - .github/workflows/deploy-backend.yml
  - Trigger: push a main (solo cambios en /backend)
  - DigitalOcean App Platform detecta cambios del repo
  - Verificar que el deploy no rompe el health check

DEPENDENCIAS: BE-06

CHECKPOINT ✅:
  - Push con cambio en /backend → DO redeploya automáticamente
  - Health check pasa después del deploy
```

#### PR-03 — Variables de entorno en producción
```
OBJETIVO:
  Todos los secrets configurados correctamente en producción.

CUBRE:
  - Vercel: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, OPENAI_MODEL, FASTAPI_URL
  - DigitalOcean: (variables del .env de FastAPI si las hubiera)
  - Verificar que ningún secret está en el código fuente
  - Verificar .gitignore incluye .env.local
  - Verificar que service_role y OPENAI_API_KEY solo existen en entornos servidor
  - Revisar precios/modelos vigentes antes de fijar OPENAI_MODEL final

DEPENDENCIAS: PR-01, PR-02

CHECKPOINT ✅:
  - La app en producción se conecta a Supabase correctamente
  - La app en producción se conecta a OpenAI correctamente
  - La app en producción se conecta a FastAPI en DO correctamente
  - No hay secrets expuestos en el repositorio de GitHub
  - No hay secrets expuestos en el bundle frontend de Vercel
```

#### PR-04 — Dominio custom (Name.com/Namecheap) → Vercel
```
OBJETIVO:
  La app es accesible desde un dominio propio con SSL y Auth funcionando.

CUBRE:
  - Revisar docs/production/hosting_domain_plan.md antes de elegir dominio
  - Reclamar dominio en Name.com (.app/.dev recomendado) o Namecheap (.me fallback)
  - Configurar DNS del registrador apuntando a Vercel
  - Agregar dominio custom en Vercel dashboard
  - Certificado SSL automático (Vercel lo maneja)
  - Actualizar redirect URLs en Supabase Auth

DEPENDENCIAS: PR-01, PR-03

CHECKPOINT ✅:
  - https://istqb-agent.app o el dominio final elegido carga la app correctamente
  - El certificado SSL está activo (candado en el browser)
  - El login/registro funciona con el dominio custom
```

#### PR-05 — Prueba end-to-end completa + simulacro final
```
OBJETIVO:
  El flujo completo funciona en producción de principio a fin.

CUBRE:
  - Registrar usuario nuevo en producción
  - Subir el PDF del ISTQB
  - Generar un plan configurable (ej. 7 o 14 días)
  - Completar una sesión morning completa (teoría + quiz + feedback)
  - Verificar que el dashboard se actualiza
  - Ejecutar el simulacro de 40 preguntas (sesión especial)
  - Verificar que el sistema adaptativo funciona (forzar score bajo)

DEPENDENCIAS: todas las anteriores

CHECKPOINT ✅ FINAL:
  - El flujo completo funciona sin errores en producción
  - El sistema adaptativo toma decisiones correctas
  - El dashboard muestra métricas reales
  - La app es usable desde celular
  - Listo para estudiar el ISTQB de verdad 🎓
```

---

## Resumen de dependencias

```
DB-01
 └── DB-02
      └── DB-03
           └── DB-04
                └── DB-05

BE-01
 └── BE-02
      └── BE-06 (necesita también BE-05)
 └── BE-03
      └── BE-04
           └── BE-05
                └── BE-06

FE-01 (necesita DB-01 para credenciales)
 └── FE-02 (necesita DB-02, DB-04)
      └── FE-03 (necesita DB-05)
           └── FE-04
                └── UP-01
                     └── UP-02 (necesita DB-03, FE-02)
                          └── UP-03 (necesita BE-06)
                               └── UP-04
                                    └── UP-05 (necesita DB-02)
                                         └── UP-06
                                              └── SE-01...SE-08
                                                    └── DA-01...DA-05
                                                         └── QA-01...QA-03
                                                              └── PR-01...PR-05
```

---

## Orden de ejecución recomendado

```
SEMANA 1 (setup + extracción)
  Día 1:  DB-01, DB-02, DB-03
  Día 2:  DB-04, DB-05
  Día 3:  BE-01, BE-02, FE-01
  Día 4:  BE-03, BE-04
  Día 5:  BE-05, BE-06

SEMANA 2 (upload + plan + auth)
  Día 6:  FE-02, FE-03
  Día 7:  FE-04, UP-01
  Día 8:  UP-02, UP-03
  Día 9:  UP-04 (✅ completado), UP-05 (✅ completado)
  Día 10: UP-06 (✅ completado)

SEMANA 3 (sesión de estudio)
  Día 11: SE-01 (✅ completado), SE-02 (✅ completado)
  Día 12: SE-03, SE-04
  Día 13: SE-05, SE-06
  Día 14: SE-07, SE-08

SEMANA 4 (dashboard + producción)
  Día 15: DA-01, DA-02
  Día 16: DA-03, DA-04, DA-05
  Día 17: PR-01, PR-02
  Día 18: PR-03, PR-04
  Día 19: PR-05 — ¡Go live! 🚀
```

---

*Árbol de guías v1.0 — Mayo 2026*
*Usar junto con: ISTQB_StudyAgent_ProjectDoc.md*
