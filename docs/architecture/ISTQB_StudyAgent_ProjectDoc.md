# ISTQB Study Agent — Documento de Proyecto
**Versión:** 1.0  
**Fecha:** Mayo 2026  
**Autor:** Juan Sifuentes Fernandez  
**Estado:** Fase de Implementación (Bloque A y Bloque B completos, Bloque C en curso)

---

## Tabla de Contenidos

1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Herramientas del Desarrollador](#2-herramientas-del-desarrollador)
3. [Stack Tecnológico Confirmado](#3-stack-tecnológico-confirmado)
4. [Arquitectura del Sistema](#4-arquitectura-del-sistema)
5. [Base de Datos](#5-base-de-datos)
6. [Diseño de APIs](#6-diseño-de-apis)
7. [Flujo Principal del Sistema](#7-flujo-principal-del-sistema)
8. [Sistema Adaptativo de Aprendizaje](#8-sistema-adaptativo-de-aprendizaje)
9. [Estructura del Proyecto](#9-estructura-del-proyecto)
10. [Fases de Desarrollo](#10-fases-de-desarrollo)
11. [Estimación de Costos](#11-estimación-de-costos)
12. [Criterios de Éxito](#12-criterios-de-éxito)
13. [Hosting, Dominio y Producción](#13-hosting-dominio-y-producción)

---

## 1. Visión General del Proyecto

### ¿Qué es?
Una web app de estudio adaptativo impulsada por IA, diseñada para preparar al usuario para la certificación **ISTQB® Foundation Level v4.0** en aproximadamente 1 semana, con **180 minutos diarios** divididos en 2 sesiones: mañana y noche, 90 minutos cada una.

### Problema que resuelve
Estudiar para el ISTQB con un PDF estático es pasivo e ineficiente. Este agente convierte el material oficial en un tutor personalizado que:
- Se adapta al rendimiento del usuario
- Detecta patrones de error por tópico (FL-x.x.x)
- Reestructura el plan si el progreso es insuficiente
- Proporciona métricas visuales del aprendizaje

### Usuario objetivo
Desarrolladores o testers que quieren certificarse en ISTQB con tiempo limitado y pueden sostener un sprint intensivo de estudio de ~3 horas al día durante 7-10 días.

---

## 2. Herramientas del Desarrollador

| Herramienta | Detalle | Costo |
|---|---|---|
| **GitHub Copilot Pro+** | 1,500 requests premium/mes, asistencia de código en IDE | $39/mes (ya pagado) |
| **GitHub Spark** | Incluido en Pro+, builder de mini-apps con IA | Incluido |
| **GitHub CLI** | Manejo de repos, PRs, Actions desde terminal | Gratis |
| **OpenCode** | Asistente IA en terminal para codear | Gratis / propio |
| **GitHub Actions** | CI/CD automático para deploy | Gratis (Student) |
| **DigitalOcean** | Hosting FastAPI — $200 créditos activos | $0 (créditos) |
| **Name.com** | Dominio custom `.app`, `.dev` o `.studio` (Student Pack) | $0 |
| **Namecheap** | Dominio `.me` gratis 1 año como fallback/personal | $0 |
| **Vercel** | Deploy Next.js automático desde GitHub | $0 |
| **Supabase** | PostgreSQL + Storage (free tier) | $0 |

> **Nota:** GitHub Copilot Pro+ ya cubre tu asistencia de código. No necesitas pagar por Cursor ni servicios similares adicionales.

---

## 3. Stack Tecnológico Confirmado

```
┌─────────────────────────────────────────────────────────┐
│  CAPA           TECNOLOGÍA          HOSTING             │
├─────────────────────────────────────────────────────────┤
│  Frontend       Next.js 14+         Vercel (gratis)     │
│                 App Router                              │
│                 TypeScript                              │
│                 Tailwind CSS                            │
│                 shadcn/ui                               │
├─────────────────────────────────────────────────────────┤
│  Backend/API    FastAPI (Python)    DigitalOcean        │
│                 pdfplumber          App Platform        │
│                 PyMuPDF             ($200 créditos)     │
├─────────────────────────────────────────────────────────┤
│  Base de datos  PostgreSQL          Supabase            │
│  + Storage      (vía Supabase)      (free tier)         │
├─────────────────────────────────────────────────────────┤
│  IA             OpenAI API          API (pago x uso)    │
│                 modelo configurable ~$2-8 total est.    │
├─────────────────────────────────────────────────────────┤
│  Auth           Supabase Auth       Incluido            │
├─────────────────────────────────────────────────────────┤
│  CI/CD          GitHub Actions      Gratis              │
└─────────────────────────────────────────────────────────┘
```

### Estrategia de hosting y dominio para producción

- **Frontend:** Vercel como hosting principal de Next.js, con dominio custom y SSL automático.
- **Backend:** DigitalOcean App Platform para FastAPI, inicialmente con URL `*.ondigitalocean.app` y opción posterior de `api.istqb-agent.app`.
- **Base de datos/Auth/Storage:** Supabase con RLS, bucket privado y redirect URLs actualizadas al dominio final.
- **Dominio recomendado:** Name.com con `.app` para enfoque de producto o `.dev` para enfoque técnico. Namecheap `.me` queda como fallback si se busca marca personal o si no hay disponibilidad en Name.com.
- **SSL:** gestionado por Vercel para el frontend; no es necesario comprar certificado adicional para el MVP.
- **Plan detallado:** [Plan de Hosting, Dominio y Producción](../production/hosting_domain_plan.md).
- **Inventario de beneficios:** [Beneficios GitHub Student Pack](../production/beneficios_github_student_pack.md).

---

## 4. Arquitectura del Sistema

```
┌──────────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                         │
│                    Next.js — Vercel                          │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Upload PDF │  │ Sesión Study │  │ Dashboard Progreso  │  │
│  │ + Config   │  │ Teoría+Quiz  │  │ Gráficas métricas   │  │
│  └─────┬──────┘  └──────┬───────┘  └──────────┬──────────┘  │
└────────│────────────────│─────────────────────│─────────────┘
         │                │                      │
         │ 1. Sube PDF    │ 3. Quiz results       │ 5. Get metrics
         ▼                ▼                      ▼
┌──────────────────────────────────────────────────────────────┐
│                  Next.js API Routes                          │
│                  (orquestador principal)                     │
│  - Recibe PDF → llama FastAPI                               │
│  - Recibe chunks → llama OpenAI para plan                   │
│  - Recibe quiz answers → llama OpenAI para evaluar          │
│  - Lee/escribe en Supabase                                   │
└───────┬──────────────────────────┬───────────────────────────┘
        │                          │
        │ 2. Extrae PDF            │ 4. Evalúa + adapta
        ▼                          ▼
┌───────────────────┐    ┌─────────────────────────────────────┐
│  FastAPI          │    │  OpenAI API                         │
│  DigitalOcean     │    │                                     │
│                   │    │  - Genera plan 14 sesiones          │
│  POST /extract-pdf│    │  - Presenta teoría adaptada         │
│  - pdfplumber     │    │  - Evalúa quiz en conjunto          │
│  - Detecta FL-x   │    │  - Decide: avanzar/reforzar/        │
│  - Chunking       │    │    reestructurar                    │
│  - Retorna JSON   │    │  - Recalcula fecha estimada         │
└───────────────────┘    └─────────────────────────────────────┘
        │                          │
        └──────────┬───────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                      Supabase                                │
│                                                              │
│  PostgreSQL DB          │  Storage                          │
│  - users                │  - PDFs subidos                   │
│  - documents            │  - Organizado por user_id         │
│  - study_plans          │                                   │
│  - sessions             │                                   │
│  - answers              │                                   │
│  - topic_progress       │                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Base de Datos

### Schema completo

```sql
-- USUARIOS (extendemos Supabase Auth)
CREATE TABLE user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- DOCUMENTOS SUBIDOS
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  extracted_text  TEXT,
  topics_json     JSONB,        -- { "FL-1.1.1": "texto...", ... }
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- PLAN DE ESTUDIO
CREATE TABLE study_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id         UUID REFERENCES documents(id),
  objective_days      INT DEFAULT 7,
  start_date          DATE NOT NULL,
  estimated_end_date  DATE NOT NULL,     -- Se recalcula dinámicamente
  actual_end_date     DATE,
  plan_json           JSONB NOT NULL,
  status              TEXT DEFAULT 'active',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT study_plans_objective_days_chk CHECK (objective_days BETWEEN 1 AND 30),
  CONSTRAINT study_plans_status_chk CHECK (status IN ('active', 'completed', 'abandoned'))
);

-- SESIONES DE ESTUDIO
CREATE TABLE sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_plan_id     UUID REFERENCES study_plans(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id),
  topic_codes       TEXT[] NOT NULL,      -- ["FL-1.1.1", "FL-1.2.1"]
  session_type      TEXT NOT NULL,
  day_number        INT NOT NULL,
  scheduled_at      TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  duration_minutes  INT DEFAULT 90,
  score_percent     NUMERIC(5,2),
  attempt_number    INT DEFAULT 1,
  method_used       TEXT DEFAULT 'theory',
  action_taken      TEXT,
  status            TEXT DEFAULT 'pending',
  theory_content    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sessions_session_type_chk CHECK (session_type IN ('morning', 'night', 'reinforcement', 'mock_exam')),
  CONSTRAINT sessions_method_used_chk CHECK (method_used IN ('theory', 'examples', 'analogies')),
  CONSTRAINT sessions_action_taken_chk CHECK (action_taken IS NULL OR action_taken IN ('advance', 'reinforce', 'restructure')),
  CONSTRAINT sessions_status_chk CHECK (status IN ('pending', 'active', 'completed', 'skipped')),
  CONSTRAINT sessions_duration_chk CHECK (duration_minutes > 0),
  CONSTRAINT sessions_score_chk CHECK (score_percent IS NULL OR score_percent BETWEEN 0 AND 100)
);

-- RESPUESTAS DEL QUIZ
CREATE TABLE answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id),
  question_text   TEXT NOT NULL,
  options_json    JSONB NOT NULL,    -- { "a": "texto", "b": "texto", ... }
  correct_answer  TEXT NOT NULL,
  user_answer     TEXT NOT NULL,
  is_correct      BOOLEAN NOT NULL,
  topic_code      TEXT NOT NULL,
  level_k         TEXT,
  explanation     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT answers_correct_answer_chk CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
  CONSTRAINT answers_user_answer_chk CHECK (user_answer IN ('a', 'b', 'c', 'd')),
  CONSTRAINT answers_level_k_chk CHECK (level_k IS NULL OR level_k IN ('K1', 'K2', 'K3'))
);

-- PROGRESO POR TÓPICO
CREATE TABLE topic_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  study_plan_id   UUID REFERENCES study_plans(id),
  topic_code      TEXT NOT NULL,
  topic_name      TEXT,
  level_k         TEXT,
  attempts        INT DEFAULT 0,
  best_score      NUMERIC(5,2) DEFAULT 0,
  last_score      NUMERIC(5,2) DEFAULT 0,
  status          TEXT DEFAULT 'pending',
  mastered_at     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, study_plan_id, topic_code),
  CONSTRAINT topic_progress_level_k_chk CHECK (level_k IS NULL OR level_k IN ('K1', 'K2', 'K3')),
  CONSTRAINT topic_progress_scores_chk CHECK (
    best_score BETWEEN 0 AND 100 AND last_score BETWEEN 0 AND 100
  ),
  CONSTRAINT topic_progress_status_chk CHECK (status IN ('pending', 'in_progress', 'mastered', 'failed'))
);

-- ÍNDICES
CREATE INDEX idx_sessions_user_status ON sessions(user_id, status);
CREATE INDEX idx_sessions_plan_schedule ON sessions(study_plan_id, scheduled_at);
CREATE INDEX idx_answers_session ON answers(session_id);
CREATE INDEX idx_topic_progress_user ON topic_progress(user_id, study_plan_id);
```

### Seguridad y acceso a datos

- El frontend público usa solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` vive únicamente en API Routes del servidor, scripts de administración o jobs seguros. Nunca se importa en componentes cliente ni se expone con prefijo `NEXT_PUBLIC_`.
- Todas las tablas con datos de usuario tienen RLS habilitado y políticas por `user_id = auth.uid()`.
- Las escrituras sensibles que requieran service role deben validar primero la sesión del usuario y el ownership del recurso.
- Los PDFs se guardan en un bucket privado; el frontend accede mediante URLs firmadas de corta duración.
- Las llamadas a OpenAI ocurren exclusivamente desde el servidor para proteger `OPENAI_API_KEY`.

---

## 6. Diseño de APIs

### FastAPI — Microservicio PDF (DigitalOcean)

```
POST  /extract-pdf
      Body: multipart/form-data { file: PDF }
      Response: {
        topics: { "FL-1.1.1": "texto extraído...", ... },
        total_topics: 40,
        estimated_hours: 8,
        level_distribution: { "K1": 12, "K2": 20, "K3": 8 }
      }

GET   /health
      Response: { status: "ok", version: "1.0" }
```

### Next.js API Routes — Orquestador (Vercel)

```
POST  /api/upload
      Sube PDF → Supabase Storage
      Llama FastAPI → guarda en documents
      Retorna: { document_id }

POST  /api/plan/generate
      Body: { document_id, objective_days, start_date, schedules }
      Llama OpenAI → genera plan de 2 sesiones diarias
      Guarda en study_plans + sessions
      Retorna: { plan_id, sessions[] }

GET   /api/sessions/next
      Retorna próxima sesión pendiente con teoría pre-generada

POST  /api/sessions/:id/theory
      Genera teoría del tópico via GPT
      Retorna: { content, key_concepts[], examples[] }

POST  /api/sessions/:id/quiz
      Genera 10-12 preguntas estilo ISTQB via GPT
      Retorna: { questions[] }

POST  /api/sessions/:id/evaluate
      Body: { answers: [...] }   ← TODAS juntas, no una por una
      Envía a GPT para análisis de patrones
      Retorna: { score, action, feedback, next_method, new_end_date }

GET   /api/dashboard/metrics
      Retorna: {
        score_timeline: [],        ← gráfica línea
        topic_heatmap: {},         ← tópicos por estado
        time_real_vs_estimated: {},
        estimated_exam_date: "",
        mastered_count: 0,
        pending_count: 0
      }
```

---

## 7. Flujo Principal del Sistema

```
[1] ONBOARDING
    Registro con Supabase Auth
    ↓
    Sube PDF del ISTQB
    ↓
    Define: "Quiero estar listo en X días"
    Define horarios: 6:00am y 10:00pm

[2] EXTRACCIÓN (< 5 segundos)
    Next.js → FastAPI /extract-pdf
    pdfplumber detecta tópicos FL-x.x.x + Nivel K
    Retorna JSON estructurado por objetivo

[3] GENERACIÓN DEL PLAN (< 10 segundos)
    Next.js → OpenAI API
    El modelo genera 14 sesiones base para 7 días:
    - K1 primero, K3 al final
    - Agrupación temática lógica
    - 2 sesiones diarias de 90 min (mañana/noche)
    - Estimación de dificultad
    Guardado en Supabase

[4] LOOP DIARIO
    Ver estructura de sesiones abajo

[5] FIN DE SEMANA
    Simulacro completo de 40 preguntas
    Score >= 70% → Listo para el examen real
    Score < 70% → Sesiones de refuerzo adicionales
```

### Estructura de sesión diaria

```
MAÑANA  6:00am - 7:30am (90 min)
────────────────────────────────
  6:00 - 6:05   Recap sesión anterior (5 min)
  6:05 - 6:50   Teoría del agente (45 min)
                  Explicación del tópico FL-x.x.x
                  Ejemplos contextualizados
                  Conexión con otros principios
  6:50 - 7:25   Quiz sin ayuda (45 min)
                  10-12 preguntas estilo ISTQB
                  Usuario responde todo junto
  7:25 - 7:30   Feedback del agente (5 min)
                  Análisis de patrones de error
                  Decisión adaptativa
                  Preview de mañana

NOCHE  10:00pm - 11:30pm (90 min)
────────────────────────────────
  10:00 - 10:15  Repaso de errores del AM (15 min)
  10:15 - 11:00  Nuevo tópico (45 min)
  11:00 - 11:25  Quiz + evaluación (25 min)
  11:25 - 11:30  Feedback + plan de mañana (5 min)
```

---

## 8. Sistema Adaptativo de Aprendizaje

### Árbol de decisión post-quiz

```
¿Cuál fue el score?
       │
   ────┼────────────────────────
   │              │            │
>= 70%         50-69%        < 50%
   │              │            │
ADVANCE       REINFORCE    RESTRUCTURE
   │              │            │
Tópico        +15 min       Cambia método:
"mastered"    repaso en       attempt 1 → theory
              próxima         attempt 2 → examples
Siguiente     sesión          attempt 3 → analogies
tópico del                  │
plan                     Recalcula
                         estimated_end_date
```

### Prompt de evaluación (estructura del payload)

```json
// Request a OpenAI
{
  "context": {
    "attempt_number": 2,
    "previous_scores": [45],
    "session_type": "morning",
    "day_number": 3
  },
  "quiz_results": [
    {
      "topic": "FL-1.1.1",
      "level_k": "K1",
      "user_answer": "a",
      "correct_answer": "c",
      "is_correct": false
    }
  ],
  "topic_content": "... texto del syllabus ..."
}

// Response de OpenAI
{
  "score_percent": 60,
  "action": "reinforce",
  "failed_topics": ["FL-1.1.1", "FL-1.3.1"],
  "error_patterns": "Confunde error, defecto y fallo",
  "feedback_message": "Buen intento...",
  "next_method": "examples",
  "reinforcement_minutes": 15,
  "estimated_ready_date": "2025-05-26",
  "next_session_preview": "Mañana repasaremos con ejemplos reales..."
}
```

---

## 9. Estructura del Proyecto

```
istqb-study-agent/
│
├── frontend/                           # Next.js App
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── dashboard/page.tsx          # Métricas y progreso
│   │   ├── setup/page.tsx              # Upload PDF + configuración
│   │   ├── session/[id]/
│   │   │   ├── theory/page.tsx         # 45 min teoría
│   │   │   ├── quiz/page.tsx           # 45 min quiz
│   │   │   └── feedback/page.tsx       # Resultado + decisión
│   │   └── api/
│   │       ├── upload/route.ts
│   │       ├── plan/generate/route.ts
│   │       ├── sessions/
│   │       │   ├── next/route.ts
│   │       │   └── [id]/
│   │       │       ├── theory/route.ts
│   │       │       ├── quiz/route.ts
│   │       │       └── evaluate/route.ts
│   │       └── dashboard/metrics/route.ts
│   ├── components/
│   │   ├── ui/                         # shadcn/ui
│   │   ├── study/
│   │   │   ├── TheoryPanel.tsx
│   │   │   ├── QuizCard.tsx
│   │   │   ├── FeedbackPanel.tsx
│   │   │   └── SessionTimer.tsx
│   │   └── dashboard/
│   │       ├── ScoreChart.tsx          # Recharts
│   │       ├── TopicHeatmap.tsx
│   │       └── TimelineChart.tsx
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── openai.ts
│   │   └── types.ts
│   └── package.json
│
├── backend/                            # FastAPI Microservicio
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/pdf.py              # POST /extract-pdf
│   │   ├── services/
│   │   │   ├── extractor.py            # lógica pdfplumber
│   │   │   └── topic_detector.py       # detecta FL-x.x.x
│   │   └── models/schemas.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .do/app.yaml                    # DigitalOcean config
│
├── supabase/
│   ├── migrations/001_initial_schema.sql
│   └── seed.sql
│
├── .github/
│   └── workflows/
│       ├── deploy-frontend.yml         # → Vercel
│       └── deploy-backend.yml          # → DigitalOcean
│
└── README.md
```

---

## 10. Fases de Desarrollo

### FASE 0 — Setup del Entorno
```
[x] Crear repositorio en GitHub (monorepo)
[x] Definir .env.example sin secrets reales
[x] Documentar política de secrets: anon key pública, service_role solo servidor
[ ] Inicializar Next.js con TypeScript + Tailwind + shadcn/ui
[ ] Crear proyecto FastAPI con estructura base
[x] Crear proyecto en Supabase (DB Schema y Storage bucket completados)
[ ] Conectar DigitalOcean App Platform con GitHub repo
[ ] Conectar Vercel con GitHub repo
[ ] Configurar variables de entorno en cada servicio
[ ] GitHub Actions básico: push → deploy automático
[ ] Verificar health check de FastAPI en DO
```

### FASE 1 — Extracción de PDF
```
[ ] FastAPI: POST /extract-pdf funcional
[ ] Integrar pdfplumber para extracción de texto
[ ] Algoritmo regex para detectar tópicos FL-x.x.x
[ ] Chunking del texto por objetivo de aprendizaje
[ ] Detectar nivel K (K1/K2/K3) por tópico
[ ] Tests con fixtures derivados del PDF real del ISTQB v4.0
[ ] Validación: detectar desviaciones si no aparecen los tópicos esperados
[ ] Snapshot de salida JSON para evitar regresiones de extracción
[ ] Deploy y prueba en DigitalOcean con Postman
```

### FASE 2 — Upload y Generación del Plan
```
[ ] UI: Página de setup con drag & drop de PDF
[ ] API Route /api/upload → Supabase Storage
[ ] Llamada desde Next.js a FastAPI /extract-pdf
[ ] Guardar resultado en tabla documents
[ ] Diseñar y testear prompt de generación de plan
[ ] API Route /api/plan/generate → OpenAI
[ ] Configurar modelo OpenAI por variable de entorno OPENAI_MODEL
[ ] Validar respuesta del modelo con schema antes de persistir
[ ] Guardar plan en study_plans + sessions
[ ] UI: Mostrar plan generado (calendario visual)
```

### FASE 3 — Sesión de Estudio
```
[ ] UI: Pantalla de teoría con markdown rendering
[ ] API Route /api/sessions/[id]/theory → OpenAI
[ ] UI: Pantalla de quiz (cards con opciones A/B/C/D)
[ ] API Route /api/sessions/[id]/quiz → OpenAI
[ ] UI: Envío de respuestas en conjunto (no una a una)
[ ] API Route /api/sessions/[id]/evaluate → OpenAI
[ ] Lógica: advance | reinforce | restructure
[ ] Actualizar sessions + answers + topic_progress
[ ] UI: Pantalla de feedback con decisión del agente
```

### FASE 4 — Dashboard de Progreso
```
[ ] API Route /api/dashboard/metrics
[ ] UI: Gráfica de score por sesión (Recharts LineChart)
[ ] UI: Heatmap de tópicos por estado
[ ] UI: Tiempo real vs estimado (BarChart)
[ ] UI: Fecha estimada de examen (dinámica)
[ ] UI: Contador tópicos dominados / pendientes / fallidos
```

### FASE 5 — Pulido y Producción
```
[ ] Auth completa: registro + login + logout
[ ] Manejo de errores en todos los endpoints
[ ] Loading states y skeletons en UI
[ ] Dominio custom configurado (Name.com `.app`/`.dev` recomendado; Namecheap `.me` fallback)
[ ] DNS, SSL y Supabase Auth Redirect URLs verificados
[ ] Variables de entorno revisadas en producción
[ ] Prueba end-to-end completa con PDF real
[ ] Simulacro final de 40 preguntas
[ ] README con instrucciones de setup local
```

---

## 11. Estimación de Costos

### Operativos mensuales

| Servicio | Costo | Nota |
|---|---|---|
| Vercel | $0 | Free tier personal |
| DigitalOcean | $0 | $200 créditos (~4-6 meses) |
| Supabase | $0 | 500MB DB + 1GB Storage free |
| OpenAI API | ~$3-8/mes | Uso personal estimado; modelo configurable |
| Dominio custom | $0 | Name.com `.app`/`.dev` recomendado; Namecheap `.me` fallback |
| GitHub Copilot Pro+ | $39/mes | Ya pagado, cubre asistencia de código |
| **Total operativo app** | **~$3-8/mes** | Solo consumo OpenAI |

### Tokens OpenAI por sesión completa

> Los costos son una estimación de planificación. Antes de implementar producción, verificar precios y modelos vigentes en la documentación oficial de OpenAI. El código debe leer el modelo desde `OPENAI_MODEL` para poder cambiarlo sin redeploy complejo.

```
Generación del plan inicial:  ~3,000 tokens  → $0.015
Teoría por sesión:            ~2,000 tokens  → $0.010
Generación quiz (12 preg.):   ~1,500 tokens  → $0.008
Evaluación post-quiz:         ~2,500 tokens  → $0.013
────────────────────────────────────────────────────
Por sesión completa:          ~9,000 tokens  → ~$0.046
14 sesiones base:                            → ~$0.64
Con refuerzos y ajustes:                     → ~$1.50

Costo total para preparar el examen: $2-4 USD
```

---

## 12. Criterios de Éxito

### Funcionales
- [ ] PDF subido → plan generado en menos de 30 segundos
- [ ] Teoría relevante al tópico FL-x.x.x correcto en cada sesión
- [ ] Preguntas de quiz estilo real ISTQB (4 opciones + justificación)
- [ ] Evaluación en conjunto detecta patrones de error
- [ ] Plan se restructura automáticamente cuando score < 50%
- [ ] Dashboard actualizado después de cada sesión completada

### No funcionales
- [ ] Extracción del PDF < 5 segundos
- [ ] Respuestas de API < 3 segundos (excl. generación GPT)
- [ ] App usable desde celular (responsive / mobile-first)
- [ ] Sin cold starts perceptibles (DigitalOcean vs Render free)
- [ ] Ninguna secret key expuesta en bundle frontend, logs o repositorio
- [ ] El backend detecta si la extracción PDF devuelve menos tópicos de los esperados

### De producto
- [ ] Completar material ISTQB en 7-10 días con 180 min/día divididos en mañana/noche
- [ ] Score en simulacro final > 70% (umbral real del examen ISTQB)
- [ ] El usuario siente que aprendió, no solo memorizó

---

## 13. Hosting, Dominio y Producción

### Decisión de despliegue

| Necesidad | Servicio elegido | Motivo |
|---|---|---|
| Hosting frontend | Vercel | Está optimizado para Next.js, despliega desde GitHub y gestiona SSL automático. |
| Hosting backend | DigitalOcean App Platform | Ejecuta FastAPI con Docker y aprovecha los créditos del Student Pack. |
| Base de datos/Auth/Storage | Supabase | PostgreSQL, autenticación, storage privado y RLS en una sola plataforma. |
| Dominio app | Name.com | `istqb-agent.app`, sujeto a disponibilidad. |
| Dominio portafolio | Name.com | `holajuan.dev`, sujeto a disponibilidad. |
| Dominio fallback | Namecheap | Opción `.me` solo si no hay buen nombre disponible en Name.com. |

### Separación de responsabilidades

Name.com o Namecheap funcionan principalmente como **registradores de dominio**: sirven para reservar el nombre público de la web, por ejemplo `istqb-agent.app` para esta app o `holajuan.dev` para el portafolio. Vercel funciona como **hosting del frontend**: sirve los archivos y páginas de Next.js, recibe el tráfico real de usuarios y conecta el dominio con la aplicación.

La relación esperada es:

```text
Name.com / Namecheap  →  DNS del dominio  →  Vercel  →  App Next.js
                                                     →  Supabase / FastAPI
```

### SSL y HTTPS

SSL permite que la app cargue con `https://` en lugar de `http://`. Esto cifra la comunicación entre el navegador y la aplicación, evita advertencias de seguridad en el browser y es necesario para una experiencia confiable de login, formularios, cookies y autenticación.

Para este proyecto no se necesita comprar ni administrar un certificado SSL aparte en el MVP, porque Vercel lo genera y renueva automáticamente cuando el dominio custom queda bien configurado.

### Seguimiento operativo

- Plan detallado de producción: [Plan de Hosting, Dominio y Producción](../production/hosting_domain_plan.md).
- Inventario de beneficios disponibles: [Beneficios GitHub Student Pack](../production/beneficios_github_student_pack.md).
- Roadmap relacionado: Bloque G — Producción (`PR-01` a `PR-05`).

---

## Notas Finales

### GitHub Copilot Pro+ en este proyecto
Con 1,500 requests premium/mes tienes asistencia para todo el desarrollo.
Recomendado para: generar boilerplate de API Routes, queries SQL, componentes React, y los prompts de OpenAI.
OpenCode en terminal es útil para consultas rápidas sin salir del contexto de código.

### Decisión pendiente antes de Fase 0
> ¿El proyecto es solo para ti o planeas abrirlo a más usuarios?
> - **Solo para ti:** Supabase free tier más que suficiente
> - **Multi-usuario futuro:** Planificar upgrade de Supabase a tiempo (Pro: $25/mes)

### Decisiones técnicas fijadas
- Endpoint FastAPI único para extracción: `POST /extract-pdf`.
- Plan base intensivo: 7 días, 14 sesiones, 180 min/día.
- Estados de negocio protegidos con constraints SQL.
- Service role solo en servidor; frontend únicamente con anon key.
- Extracción PDF protegida con fixtures, snapshots y alertas si faltan tópicos.
- Modelo OpenAI configurable por `OPENAI_MODEL`; costos se revisan antes de producción.
- Hosting y dominio documentados en `docs/production/hosting_domain_plan.md`; Name.com `.app`/`.dev` es la recomendación inicial y Namecheap `.me` queda como fallback.

---

*Documento v1.0 — Mayo 2026*
