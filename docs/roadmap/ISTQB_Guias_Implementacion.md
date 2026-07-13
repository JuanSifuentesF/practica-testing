# ISTQB Study Agent — Árbol de Guías de Implementación
**Versión:** 2.4
**Fecha:** Julio 2026  
**Principio:** Cada guía depende de las anteriores. Nunca saltar una.

**Nota de alcance v2.2:** El Bloque H (QA Practice Lab) se implementa antes de producción por decisión consciente del proyecto. Antes de QA y producción se agrega el Bloque I (**AI Settings & Usage Control**) para configurar modos de IA, BYOK session-only, tracking de uso/tokens, cuotas y prevención de costos inesperados. La guía **PR-03A** queda como auditoría final de seguridad IA antes del go-live.

**Nota de reconciliación v2.3:** La rehidratación de Bug Lab pertenece a PL-11, no a PL-14. En esa versión, PL-02/05/09/11 mantenían gates correctivos abiertos hasta verificación runtime/remota. AI-01 incorporó separación entre RLS y privilegios, cuotas administradas, eventos inmutables para cliente y el requisito de reserva atómica antes de habilitar modo managed.

**Nota de cierre v2.4:** Los gates PL-02/05/09/11 quedaron verificados en runtime y remoto el 12/07/2026. Tambien se endurecio `handle_new_user()` en DB-05. AI-01 implementada y validada (12/07/2026): migracion desplegada, 13 CHECK constraints probados con valores validos e invalidos, RLS + privilegios verificados.

---

## 📊 Estado de Progreso de la Implementación

| Bloque | ID | Nombre de la Guía | Estado | Entregable / Progreso |
| :--- | :--- | :--- | :--- | :--- |
| **🗄️ BLOQUE A: Base de Datos** | **DB-01** | Proyecto Supabase + Configuración Inicial | ✅ **Completado** | [Guía DB-01](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/DB-01.md) — *Linked + Started* |
| | **DB-02** | Schema: Tablas, Relaciones y CHECK constraints | ✅ **Completado** | [Guía DB-02](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/DB-02.md) — *Migración aplicada* |
| | **DB-03** | Storage Bucket Privado para PDFs | ✅ **Completado** | [Guía DB-03](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/DB-03.md) — *Bucket y políticas creados* |
| | **DB-04** | Row Level Security (RLS) Policies | ✅ **Completado** | [Guía DB-04](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/DB-04.md) — *Migración aplicada* |
| | **DB-05** | Supabase Auth Configuración | ✅ **Implementado y verificado** | [Guía DB-05](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/DB-05.md) — *Trigger endurecido, migración remota y alta de perfil verificadas* |
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
| | **SE-04** | Prompt de quiz + API Route `/api/sessions/[id]/quiz` | ✅ **Completado** | [Guía SE-04](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/SE-04.md) — *3 archivos + tsc limpio, 10/10 checkpoints* |
| | **SE-05** | UI: QuizCard (opciones A/B/C/D, sin feedback inmediato) | ✅ **Completado** | [Guía SE-05](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/SE-05.md) — *4 archivos + 1 modificado, tsc limpio, build OK, 11/11 checkpoints* |
| | **SE-06** | Envío en conjunto + API Route `/api/sessions/[id]/evaluate` | ✅ **Completado** | [Guía SE-06](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/SE-06.md) — *3 archivos nuevos + 2 modificados, tsc limpio, build OK, /evaluate funcional* |
| | **SE-07** | Lógica adaptativa: advance, reinforce, restructure | ✅ **Completado** | [Guía SE-07](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/SE-07.md) — *2 archivos nuevos + 2 modificados, tsc limpio, build OK, RESTRUCTURE verificado* |
| | **SE-08** | UI: FeedbackPanel (score, errores, decisión, próxima sesión) | ✅ **Completado** | [Guía SE-08](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/SE-08.md) — *1 archivo nuevo + 1 modificado, tsc limpio, build OK, FeedbackPanel conectado* |
| **📊 BLOQUE F: Dashboard** | ✅ **DA-01** | API Route `/api/dashboard/metrics` | ✅ **Completado** | [Guía DA-01](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/DA-01.md) — *2 archivos nuevos + 1 modificado, tsc limpio, build OK, endpoint responde JSON con métricas reales* |
| | **DA-02** | UI: gráfica de score por sesión (LineChart) | ✅ **Completado** | [Guía DA-02](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/DA-02.md) — *ScoreChart implementado + integrado en dashboard* |
| | **DA-03** | UI: heatmap de tópicos por estado | ✅ **Completado** | [Guía DA-03](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/DA-03.md) — *TopicHeatmap implementado + API enriquecida + 63 tópicos validados* |
| | **DA-04** | UI: tiempo real vs estimado (BarChart) | ✅ **Completado** | [Guía DA-04](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/DA-04.md) — *TimeComparisonChart + tsc limpio + build OK* |
| | **DA-05** | UI: fecha estimada de examen + contadores | ✅ **Completado** | [Guía DA-05](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/DA-05.md) — *DashboardSummaryCards + tsc limpio + build OK* |
| **🔬 BLOQUE H: Practice Lab** | **PL-01** | Schema: tablas practice_exercises + practice_submissions | ✅ **Completado** | [Guía PL-01](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/PL-01.md) — *Migración aplicada y constraints verificados* |
| | **PL-02** | RLS policies para tablas de práctica | ✅ **Implementado y verificado** | [Guía PL-02](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/PL-02.md) — *RLS y privilegio de columna de solution_json aplicados y verificados* |
| | **PL-03** | Tipos TypeScript de práctica | ✅ **Completado** | [Guía PL-03](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-03.md) — *Tipos Practice Lab implementados, tsc limpio y build OK* |
| | **PL-04** | Prompt: generar ejercicio por tópico + nivel K | ✅ **Implementado y verificado** | [Guía PL-04](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-04.md) — *Prompt semántico sincronizado; schema ejecutable delegado a PL-05* |
| | **PL-05** | API Route `/api/practice/generate` | ✅ **Implementado y verificado** | [Guía PL-05](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-05.md) — *Structured Outputs, parser balanceado, cascada y POST autenticado verificados* |
| | **PL-06** | UI: Hub de prácticas (`/practice`) | ✅ **Completado** | [Guía PL-06](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-06.md) — *4 componentes, tsc limpio, build OK, 8/8 checkpoints* |
| | **PL-07** | UI: TestCaseEditor (tabla editable interactiva) | ✅ **Completado** | [Guía PL-07](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-07.md) — *Implementado manualmente: tabla 5 columnas, 8 casos de prueba funcionales* |
| | **PL-08** | Prompt: evaluar respuesta del usuario | ✅ **Completado** | [Guía PL-08](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-08.md) — *Prompt Builder implementado, validado con 8/8 checkpoints* |
| | **PL-09** | API Route `/api/practice/evaluate` | ✅ **Implementado y verificado** | [Guía PL-09](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-09.md) — *Lectura server-only, ownership, idempotencia y persistencia verificadas* |
| | **PL-10** | UI: Feedback de práctica + comparar con solución | ✅ **Completado** | [Guía PL-10](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-10.md) — *Flujo K1/K2/K3 validado: generación con fallback, evaluación con reintento JSON, feedback y solución modelo* |
| | **PL-11** | UI: Bug Report Lab (escenario + formulario) | ✅ **Implementado y verificado** | [Guía PL-11](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-11.md) — *Rehidratación antes del envío y descarte posterior verificados* |
| | **PL-12** | UI: API Testing Checklist | ✅ **Completado** | [Guía PL-12](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-12.md) — *4 archivos, localStorage versionado, 5 fixtures, zero HTTP, tsc+build OK* |
| | **PL-13** | Integración Dashboard (métricas de práctica) | ✅ **Completado** | [Guía PL-13](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-13.md) — *practice_stats en DA-01 + PracticeProgressCard + tsc+build OK* |
| | **PL-14** | Navegación + protección: agregar "Práctica" y migrar a `proxy.ts` | ✅ **Implementado y verificado** | [Guía PL-14](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PL-14.md) — *proxy.ts + MainNav/MobileNav con Práctica + tsc/build OK; la rehidratación pertenece a PL-11* |
| **🤖 BLOQUE I: AI Settings & Usage Control** | **AI-01** | Schema: preferencias IA + tracking de uso/tokens | ✅ **Implementado y verificado** | [Guía AI-01](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/db/AI-01.md) — *Migracion desplegada, 20/20 checkpoints, 13 CHECK constraints, 3 indices, RLS + privilegios* |
| | **AI-02** | Runtime server-side: resolver proveedor, modo y cuota | ⏳ **Pendiente** | *Por iniciar* |
| | **AI-03** | UI Settings: Demo / Managed / BYOK session-only | ⏳ **Pendiente** | *Por iniciar* |
| | **AI-04** | UI/API: consumo de tokens, llamadas y límites | ⏳ **Pendiente** | *Por iniciar* |
| | **AI-05** | Integración del runtime IA con sesiones y Practice Lab | ⏳ **Pendiente** | *Por iniciar* |
| **🧪 BLOQUE QA: Testing** | **QA-01** a **QA-03** | Tests E2E con Cypress | ⏳ **Pendiente** | *Por iniciar* |
| **🚀 BLOQUE G: Prod** | **PR-01** | GitHub Actions: CI/CD frontend → Vercel | ⏳ **Pendiente** | [Guía PR-01](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PR-01.md) — *Guía generada, por implementar* |
| | **PR-02** | GitHub Actions: CI/CD backend → DigitalOcean | ⏳ **Pendiente** | [Guía PR-02](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/guides/fe/PR-02.md) — *Guía generada, por implementar* |
| | **PR-03**, **PR-03A**, **PR-04**, **PR-05** | Variables, seguridad IA/costos, dominio y simulación | ⏳ **Pendiente** | *Por iniciar* |

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
│   └── [x] DB-05  Supabase Auth configuración (Implementado y verificado — trigger endurecido)
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
│   ├── [x] SE-04  Prompt de quiz + API Route /api/sessions/[id]/quiz (Completado — 3 archivos + cache en memoria)
│   ├── [x] SE-05  UI: QuizCard (opciones A/B/C/D, sin feedback inmediato) (Completado — 4 componentes + page.tsx refactorizado, 11/11 checkpoints)
│   ├── [x] SE-06  Envío en conjunto + API Route /api/sessions/[id]/evaluate (Completado — types + prompt + evaluate route + QuizCard modificado)
│   ├── [x] SE-07  Lógica adaptativa: advance | reinforce | restructure (Completado — /adapt + topic_progress + refuerzos + estimated_end_date)
│   └── [x] SE-08  UI: FeedbackPanel (score, errores, decisión, próxima sesión) (Completado — FeedbackPanel conectado, BLOQUE E finalizado)
│
├── 📊  BLOQUE F — DASHBOARD DE PROGRESO
│   ├── [x] DA-01  API Route /api/dashboard/metrics (Completado — 5/5 checkpoints, endpoint funcional)
│   ├── [x] DA-02  UI: gráfica de score por sesión (LineChart) (Completado — ScoreChart + dashboard integrado)
│   ├── [x] DA-03  UI: heatmap de tópicos por estado (Completado — TopicHeatmap + 63 tópicos validados)
│   ├── [x] DA-04  UI: tiempo real vs estimado (BarChart) (Completado — TimeComparisonChart + tsc limpio + build OK)
│   └── [x] DA-05  UI: fecha estimada de examen + contadores (Completado — DashboardSummaryCards + tsc limpio + build OK)
│
├── 🔬  BLOQUE H — QA PRACTICE LAB
│   ├── [x] PL-01  Schema: tablas practice_exercises + practice_submissions (Skill: db-guide-generator) (Completado — constraints verificados)
│   ├── [x] PL-02  RLS policies para tablas de práctica (Skill: db-guide-generator) (Implementado y verificado — solution_json protegida)
│   ├── [x] PL-03  Tipos TypeScript de práctica (Skill: fe-guide-generator) (Completado — tipos Practice Lab + tsc limpio + build OK)
│   ├── [x] PL-04  Prompt: generar ejercicio por tópico + nivel K (Skill: fe-guide-generator) (Implementado y verificado — autoridad semántica sincronizada con PL-05)
│   ├── [x] PL-05  API Route /api/practice/generate (Skill: fe-guide-generator) (Implementado y verificado — POST autenticado y persistencia segura)
│   ├── [x] PL-06  UI: Hub de prácticas /practice (Skill: fe-guide-generator) (Completado — 8/8 checkpoints, tsc+build OK)
│   ├── [x] PL-07  UI: TestCaseEditor — tabla editable interactiva (Completado — implementación manual del usuario, 8 casos de prueba)
│   ├── [x] PL-08  Prompt: evaluar respuesta del usuario (Skill: fe-guide-generator) (Completado — Prompt Builder + validado con 8/8 checkpoints)
│   ├── [x] PL-09  API Route /api/practice/evaluate (Skill: fe-guide-generator) (Implementado y verificado — lectura admin y ownership)
│   ├── [x] PL-10  UI: Feedback de práctica + comparar con solución (Skill: fe-guide-generator) (Completado — generación/evaluación autenticadas con cascada LLM)
│   ├── [x] PL-11  UI: Bug Report Lab — escenario + formulario (Skill: fe-guide-generator) (Implementado y verificado — rehidratación comprobada)
│   ├── [x] PL-12  UI: API Testing Checklist (Skill: fe-guide-generator) (Completado — localStorage versionado + 4 archivos + zero HTTP + tsc+build OK)
│   ├── [x] PL-13  Integración Dashboard — métricas de práctica (Skill: fe-guide-generator) (Completado — practice_stats en DA-01 + PracticeProgressCard + tsc+build OK)
│   └── [x] PL-14  Navegación + protección con proxy.ts (Skill: fe-guide-generator) (Implementado y verificado — proxy.ts + MainNav/MobileNav + tsc/build OK)
│
├── 🤖  BLOQUE I — AI SETTINGS & USAGE CONTROL
│   ├── [x] AI-01  Schema: preferencias IA + tracking de uso/tokens (Skill: db-guide-generator) (Implementado y verificado — 20/20 checkpoints, 13 CHECK constraints, RLS + privilegios)
│   ├── [ ] AI-02  Runtime server-side: resolver proveedor, modo y cuota (Skill: fe-guide-generator)
│   ├── [ ] AI-03  UI Settings: Demo / Managed / BYOK session-only (Skill: fe-guide-generator)
│   ├── [ ] AI-04  UI/API: consumo de tokens, llamadas y límites (Skill: fe-guide-generator)
│   └── [ ] AI-05  Integración del runtime IA con sesiones y Practice Lab (Skill: fe-guide-generator)
│
├── 🧪  BLOQUE QA — TESTING E2E
│   ├── QA-01  Configurar Cypress + data-testid en componentes clave
│   ├── QA-02  Tests de auth: login, register, logout, redirects
│   └── QA-03  Tests de flujo completo: upload → plan → sesión → dashboard
│
└── 🚀  BLOQUE G — PRODUCCIÓN
    ├── [ ] PR-01  GitHub Actions: CI/CD frontend → Vercel (Guía generada)
    ├── [ ] PR-02  GitHub Actions: CI/CD backend → DigitalOcean (Guía generada)
    ├── PR-03  Variables de entorno en producción
    ├── PR-03A Seguridad de IA: modos de uso, BYOK y límites de consumo
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

ESTADO: ✅ Completado — 3 archivos, tsc limpio, 10/10 checkpoints (29 junio 2026)

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

ESTADO: ✅ Completado — 4 archivos + 1 modificado, tsc limpio, build OK, 11/11 checkpoints (29 junio 2026)

CHECKPOINT ✅:
  - Se puede navegar entre preguntas libremente
  - Las respuestas seleccionadas se mantienen al volver atrás
  - El botón de envío solo aparece cuando todas están respondidas
  - No hay feedback de correcto/incorrecto durante el quiz
```

#### SE-06 — Envío en conjunto + API Route /evaluate
```
OBJETIVO:
  Todas las respuestas se evalúan juntas por el endpoint /evaluate.

CUBRE:
  - API Route: /api/sessions/[id]/evaluate
  - Body: array completo de { question_id, user_answer, topic_code, level_k }
  - Prompt de evaluación (ver documento de arquitectura)
  - El endpoint retorna: { score, action, failed_topics, error_patterns,
                      feedback_message, next_method, reinforcement_minutes }
  - Guardar en tabla answers (una fila por respuesta)
  - Actualizar sessions: score_percent, action_taken, completed_at

DEPENDENCIAS: SE-05, DB-02

ESTADO: ✅ Completado — 3 archivos nuevos + 2 modificados, tsc limpio, build OK, /evaluate funcional, 6/6 checkpoints (29 junio 2026)

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
    - Sin cambios en el plan

  REINFORCE (score 50-69%):
    - topic_progress: status → 'in_progress', attempts + 1
    - Crear 1 nueva sesión de tipo 'reinforcement' al final del plan
    - reinforcement_minutes = 15

  RESTRUCTURE (score < 50%):
    - topic_progress: status → 'failed', attempts + 1
    - Crear 2 sesiones de refuerzo con el método recomendado
    - Extender estimated_end_date en study_plans
    - Mantener plan_json sin cambios en este alcance

DEPENDENCIAS: SE-06

ESTADO: ✅ Completado — tsc limpio, build OK, 5/5 checkpoints, RESTRUCTURE verificado con 2 sesiones + end_date extendido (29 junio 2026)

CHECKPOINT ✅:
  - Score 80% → topic en 'mastered', plan sin cambios
  - Score 60% → sesión de refuerzo creada en DB
  - Score 40% → 2 refuerzos creados + estimated_end_date extendido
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

ESTADO: ✅ Completado (30 junio 2026)

CHECKPOINT ✅:
  - El score y la decisión se muestran correctamente
  - La explicación de cada pregunta fallida es visible
  - La fecha estimada refleja los cambios del sistema adaptativo
  - FeedbackPanel conectado en quiz-card.tsx
  - tsc limpio, build OK
  - BLOQUE E completo
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

DEPENDENCIAS: SE-08, UP-05, SE-06, SE-07, DB-02

ESTADO: ✅ Completado (30 junio 2026) — tsc limpio, build OK, endpoint responde JSON con métricas reales

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

ESTADO: ✅ Completado (5 julio 2026) — ScoreChart integrado, tsc limpio

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
  - Grid de todos los tópicos retornados por topic_progress (sin hardcodear 40)
  - Color por estado: gris (pending), azul (in_progress), verde (mastered), rojo (failed)
  - Tooltip al hover/focus: nombre del tópico, nivel K, intentos, mejor score y último score
  - Leyenda de colores
  - Agrupado por sección (FL-1.x, FL-2.x, etc.)
  - DTO TopicHeatmapItem para no exponer user_id/study_plan_id en el cliente

DEPENDENCIAS: UP-05, DA-01, DA-02, FE-04

ESTADO: ✅ Completado (5 julio 2026) — 8/8 checkpoints, tsc limpio, API retorna 63 tópicos sanitizados

CHECKPOINT ✅:
  - Todos los tópicos retornados por el API aparecen en el grid
  - Los colores coinciden con el status real en topic_progress
  - Al hacer hover/focus se muestra el nombre del tópico, K-level, intentos y scores
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

### 🔬 BLOQUE H — QA PRACTICE LAB

---

#### PL-01 — Schema: tablas practice_exercises + practice_submissions
```
OBJETIVO:
  Crear las tablas de base de datos para ejercicios prácticos y
  respuestas del usuario en el QA Practice Lab.

SKILL: istqb-db-guide-generator
OUTPUT: docs/guides/db/PL-01.md

CUBRE:
  - Tabla practice_exercises:
      id, user_id, document_id, study_plan_id, topic_code, level_k,
      exercise_type, attempt_number, scenario_json (JSONB),
      solution_json (JSONB), created_at
  - Tabla practice_submissions:
      id, user_id, exercise_id (FK), submission_json (JSONB),
      score_percent, feedback_json (JSONB), submitted_at
  - document_id referencia documents(id) para evitar ambigüedad entre PDFs
    o certificaciones futuras con códigos similares
  - study_plan_id referencia study_plans(id) como vínculo opcional al plan
    activo del usuario
  - CHECK constraints:
      exercise_type IN ('test_cases', 'bug_report', 'api_testing', 'exploratory')
      level_k IN ('K1', 'K2', 'K3')
      score_percent BETWEEN 0 AND 100 (o NULL)
      attempt_number >= 1
  - Constraint de ownership cruzado:
      practice_exercises debe tener UNIQUE (id, user_id)
      practice_submissions debe usar FK compuesta (exercise_id, user_id)
      hacia practice_exercises(id, user_id)
  - Índices de performance por user_id, document_id, topic_code y exercise_type
  - Foreign keys con ON DELETE CASCADE

DEPENDENCIAS: DB-02 (schema base), DB-04 (patrón RLS), DA-05 (bloque F completado)

CHECKPOINT ✅:
  - supabase db push sin errores
  - Ambas tablas visibles en Table Editor
  - CHECK constraints funcionan (insertar exercise_type inválido falla)
  - document_id apunta a documents(id) y permite distinguir prácticas por PDF
  - FK compuesta impide crear submissions para ejercicios de otro usuario
  - FK cascade funciona (borrar usuario borra sus ejercicios)
```

#### PL-02 — RLS policies para tablas de práctica
```
ESTADO:
  Implementado y verificado (12/07/2026).
  Las 7 policies originales y 20260712230548_protect_practice_solution_json.sql
  están aplicadas; los privilegios de columna fueron comprobados en remoto.

OBJETIVO:
  Cada usuario solo puede ver y crear sus propios ejercicios y submissions,
  sin poder leer solution_json antes de evaluar.

SKILL: istqb-db-guide-generator
OUTPUT: docs/guides/db/PL-02.md

CUBRE:
  - Habilitar RLS en practice_exercises y practice_submissions
  - Policy SELECT: user_id = auth.uid()
  - Policy INSERT: user_id = auth.uid()
  - Policy UPDATE: user_id = auth.uid() (solo para submissions)
  - Policy DELETE: user_id = auth.uid()
  - Policy/validación de ownership del documento:
      practice_exercises.document_id debe pertenecer al mismo auth.uid()
  - Policy/validación de ownership cruzado:
      practice_submissions.exercise_id debe apuntar a un ejercicio del mismo usuario
  - Privilegios por columna en practice_exercises:
      authenticated puede leer scenario_json y metadatos públicos
      authenticated no puede leer solution_json
      /api/practice/evaluate la lee server-only después de autenticar y filtrar ownership
  - Verificar aislamiento entre usuarios

DEPENDENCIAS: PL-01, DB-04

CHECKPOINT ✅:
  - Usuario A no puede ver ejercicios de usuario B
  - Usuario A no puede crear un ejercicio para document_id de usuario B
  - Usuario A no puede crear submission contra exercise_id de usuario B
  - Sin sesión: no se puede leer ni escribir
  - Las policies son consistentes con el patrón de DB-04
  - has_column_privilege confirma scenario_json=true y solution_json=false
```

#### PL-03 — Tipos TypeScript de práctica
```
OBJETIVO:
  Definir los tipos TypeScript para todo el módulo de práctica.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-03.md

CUBRE:
  - frontend/types/practice.ts con:
      PracticeExerciseType = 'test_cases' | 'bug_report' | 'api_testing' | 'exploratory'
      PracticeExercise (scenario, solution, metadata)
      PracticeSubmission (user response, score, feedback)
      TestCaseRow (ID, escenario, dato, esperado, tipo)
      BugReportData (título, pasos, resultado, severidad, prioridad)
      PracticeGenerateRequest / PracticeGenerateResponse
      PracticeEvaluateRequest / PracticeEvaluateResponse
  - Actualizar frontend/types/database.ts con las nuevas tablas

DEPENDENCIAS: PL-01, FE-02

CHECKPOINT ✅:
  - npx tsc --noEmit sin errores
  - Los tipos son consistentes con el schema de PL-01
  - Los tipos de request/response cubren generate y evaluate
```

#### PL-04 — Prompt: generar ejercicio por tópico + nivel K
```
ESTADO:
  Implementado y verificado.

OBJETIVO:
  Diseñar el prompt que genera ejercicios prácticos personalizados
  según el tópico ISTQB y su nivel K.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-04.md

CUBRE:
  - frontend/lib/prompts/practice-exercise.ts
  - Lógica de mapeo nivel K → tipo de ejercicio:
      K1 → actividad guiada de identificación/clasificación de conceptos
           (sin quiz A/B/C/D; el quiz cerrado sigue perteneciendo a SE-04)
      K2 → identificar errores en escenarios
      K3 → crear casos de prueba desde cero
  - Input del prompt: topic_code, level_k, topic_text (del syllabus),
    exercise_type, attempt_number
  - Output JSON esperado:
      {
        scenario: { scenario, task_description, constraints[], evaluation_criteria[] },
        reference_solution: { model_answer, explanation, key_points[] }
      }
  - Variedad: el prompt debe generar escenarios diferentes en cada
    invocación para el mismo tópico
  - Validación del JSON retornado por la IA
  - El prompt define semántica; el JSON Schema ejecutable es autoridad de PL-05

DEPENDENCIAS: PL-03, SE-02 (patrón de prompts ya establecido)

CHECKPOINT ✅:
  - El prompt genera ejercicios coherentes para FL-4.2.1 (K3)
  - El prompt genera ejercicios diferentes para FL-1.1.1 (K1)
  - El JSON retornado cumple el schema definido en PL-03
  - La solución de referencia es válida y educativa
```

#### PL-05 — API Route /api/practice/generate
```
ESTADO:
  Implementado y verificado (12/07/2026).
  Structured Outputs, parser balanceado, cascada y POST autenticado actual
  fueron comprobados con persistencia segura.

OBJETIVO:
  Endpoint que genera un ejercicio práctico para un tópico específico.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-05.md

CUBRE:
  - frontend/app/api/practice/generate/route.ts
  - Validar sesión del usuario (auth check)
  - Recibir: { document_id, topic_code, level_k, exercise_type }
  - Verificar que document_id pertenece al usuario autenticado
  - Obtener el texto del tópico desde documents.topics_json del documento correcto
  - Llamar a Gemini con el prompt de PL-04
  - Mantener llamadas LLM solo en servidor; nunca exponer GEMINI_API_KEY,
    OPENAI_API_KEY ni claves BYOK al navegador o a logs
  - Exigir Structured Outputs con JSON Schema estricto por exercise_type
  - Parsear con extractor del primer objeto JSON balanceado y luego validar dominio
  - Usar la cascada compartida vigente de frontend/lib/ai/model-cascade.ts
  - Guardar en practice_exercises (Supabase)
  - Retornar el ejercicio generado al frontend sin solution_json
  - Manejo de errores: IA no disponible, JSON inválido, tópico no encontrado

DEPENDENCIAS: PL-04, PL-01, FE-02

CHECKPOINT ✅:
  - POST /api/practice/generate retorna ejercicio válido
  - El ejercicio se persiste en practice_exercises
  - No permite generar ejercicios para documentos de otro usuario
  - Error claro si el topic_code no existe en el documento
  - Ninguna API key aparece en response, logs ni bundle frontend
  - POST autenticado actual retorna 200 y persiste un bug_report válido
  - Un objeto JSON válido con texto final se recupera sin persistir basura
```

#### PL-06 — UI: Hub de prácticas (/practice) ✅ **Completado**
```
OBJETIVO:
  Página principal del Practice Lab donde el usuario ve todos
  los tópicos practicables organizados por capítulo.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-06.md

CUBRE:
  - frontend/app/(dashboard)/practice/page.tsx
  - Componentes:
      practice/_components/topic-practice-list.tsx
      practice/_components/practice-card.tsx
      practice/_components/practice-filter.tsx
  - Mostrar 4 cards resumen: Test Cases, Bug Reports, API Testing, Exploratory
    con contadores por tipo
  - Listar tópicos agrupados por capítulo (usando topics_json del documento)
  - Cada tarjeta muestra: código FL-x.x.x, nivel K, nombre, contador
  - Botón [Practicar] por tópico
  - Filtros: por capítulo, por nivel K
  - Loading skeleton, estado de error con reintentar, estado vacío sin plan
  - Diseño responsive (1 col → 2 col → 3/4 col)

DEPENDENCIAS: PL-05, FE-04, UP-03

CHECKPOINT ✅:
  - 4 archivos creados y compilando (tsc + build OK)
  - /practice muestra todos los tópicos del documento subido
  - Las cards de resumen muestran contadores correctos
  - Los filtros funcionan (por capítulo, nivel K)
  - El botón "Practicar" navega a /practice/[topicCode]
```

#### PL-07 — UI: TestCaseEditor (tabla editable interactiva)
```
OBJETIVO:
  Componente de tabla editable donde el usuario crea casos de prueba.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-07.md

CUBRE:
  - frontend/app/(dashboard)/practice/[topicCode]/page.tsx
  - Componentes:
      [topicCode]/_components/theory-brief.tsx
      [topicCode]/_components/exercise-prompt.tsx
      [topicCode]/_components/test-case-editor.tsx
  - Layout de la página: teoría breve → caso práctico → editor
  - Tabla editable con columnas:
      ID | Escenario | Dato de prueba | Resultado esperado | Tipo (Positivo/Negativo)
  - Agregar/eliminar filas dinámicamente
  - Validación: mínimo N filas requeridas según el ejercicio
  - Botones: [Guardar práctica] [Comparar con solución]
  - Estado local con useState antes de enviar

DEPENDENCIAS: PL-06

CHECKPOINT ✅:
  - La tabla renderiza con filas editables
  - Se pueden agregar y eliminar filas
  - Los datos se mantienen al navegar entre campos
  - El botón guardar envía los datos al endpoint de evaluate
```

#### PL-08 — Prompt: evaluar respuesta del usuario
```
OBJETIVO:
  Diseñar el prompt que evalúa los casos de prueba o bug reports
  que el usuario redactó, comparándolos con la solución de referencia.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-08.md

ESTADO: ✅ Completado (7 julio 2026) — Prompt Builder implementado, validado con 8/8 checkpoints

CUBRE:
  - frontend/lib/prompts/practice-evaluate.ts
  - Input: user_submission, reference_solution, evaluation_criteria,
    exercise_type, topic_code, level_k
  - Output JSON:
      { score_percent, feedback_summary, criteria_results[],
        missing_cases[], strengths[], improvements[], model_answer }
  - Criterios de evaluación por tipo:
      test_cases → cobertura de particiones, valores límite,
                   positivos/negativos, claridad
      bug_report → título claro, pasos reproducibles, severidad correcta,
                   resultado esperado vs actual
  - El feedback debe ser constructivo y educativo

DEPENDENCIAS: PL-04

CHECKPOINT ✅:
  - Evalúa correctamente una respuesta parcial (score < 100)
  - Evalúa correctamente una respuesta completa (score >= 80)
  - El feedback identifica casos faltantes específicos
  - La model_answer es útil como referencia de aprendizaje
```

#### PL-09 — API Route /api/practice/evaluate
```
OBJETIVO:
  Endpoint que evalúa la respuesta del usuario y genera feedback.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-09.md

ESTADO:
  Implementado y verificado (12/07/2026).
  solution_json permanece oculta al rol authenticated y la evaluación usa
  lectura admin server-only después de comprobar ownership.

CUBRE:
  - frontend/app/api/practice/evaluate/route.ts
  - Validar sesión del usuario
  - Recibir: { exercise_id, submission } (contrato PracticeEvaluateRequest)
  - Obtener el ejercicio original y solución de referencia verificando
    que exercise_id pertenece al usuario autenticado
  - Leer solution_json con createAdminClient() solo después de autenticar
  - Como service_role omite RLS, filtrar explícitamente por id + user_id
  - Llamar a Gemini con el prompt de PL-08 (temperatura 0.3)
  - Mantener llamadas LLM solo en servidor; nunca exponer GEMINI_API_KEY,
    OPENAI_API_KEY ni claves BYOK al navegador o a logs
  - Parsear y validar el feedback JSON defensivamente
  - Reintento automático si JSON inválido (MAX_FEEDBACK_ATTEMPTS = 2)
  - Log de finish_reason, tokens y chars por intento
  - Guardar en practice_submissions
  - Retornar PracticeEvaluateResponse { submission, solution }

DEPENDENCIAS: PL-08, PL-01, FE-02

CHECKPOINT ✅:
  - POST /api/practice/evaluate retorna feedback válido (score + feedback + solution)
  - La submission se persiste en practice_submissions
  - No permite evaluar submissions contra ejercicios de otro usuario
  - El score es coherente con la calidad de la respuesta
  - Ninguna API key aparece en response, logs ni bundle frontend
  - Funciona con Gemini (reintento automático si JSON truncado)
  - Doble envío retorna 409
  - Persistencia verificada via REST API con service role key
  - authenticated no puede seleccionar solution_json directamente
  - Ejercicio ajeno sigue respondiendo 404 aunque la lectura interna use service_role
```

#### PL-10 — UI: Feedback de práctica + comparar con solución
```
OBJETIVO:
  Mostrar el resultado de la evaluación y la solución de referencia.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-10.md

CUBRE:
  - Componentes:
      [topicCode]/_components/solution-compare.tsx
      [topicCode]/_components/feedback-panel.tsx
  - Score grande y visible (mismo patrón que SE-08)
  - Lista de criterios: ✅ cumplido / ❌ faltante
  - Sección "Lo que hiciste bien" + "Lo que puedes mejorar"
  - Casos de prueba faltantes listados explícitamente
  - Botón "Ver solución modelo" con tabla de referencia
  - Botón "Intentar de nuevo" (genera nuevo ejercicio)
  - Botón "Siguiente tópico"

DEPENDENCIAS: PL-09, PL-07

CHECKPOINT ✅:
  - El feedback renderiza correctamente todos los criterios
  - La solución modelo se muestra como tabla comparativa
  - Los botones de navegación funcionan
  - El score coincide con lo retornado por /evaluate
```

#### PL-11 — UI: Bug Report Lab (escenario + formulario)
```
ESTADO:
  Implementado y verificado (12/07/2026).
  La rehidratación del ejercicio pendiente y su descarte después del envío
  fueron comprobados en la UI real.

OBJETIVO:
  Sección donde el usuario practica redactar bug reports
  profesionales a partir de escenarios generados.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-11.md

CUBRE:
  - frontend/app/(dashboard)/practice/bug-lab/page.tsx
  - Componentes:
      bug-lab/_components/scenario-display.tsx
      bug-lab/_components/bug-report-form.tsx
      bug-lab/_components/bug-evaluation.tsx
  - Escenario generado: historia de usuario + regla de negocio + bug observado
  - Formulario de bug report:
      Título, Precondiciones, Pasos para reproducir,
      Resultado actual, Resultado esperado,
      Severidad (dropdown), Prioridad (dropdown), Evidencia (opcional)
  - Reutilizar /api/practice/generate con exercise_type='bug_report'
  - Reutilizar /api/practice/evaluate para evaluar el report
  - Feedback específico para bug reports (completitud, claridad, reproducibilidad)
  - Al recargar, recuperar el bug_report más reciente del mismo documento/tópico
    únicamente si todavía no tiene practice_submissions
  - Mapear scenario_json al contrato público sin seleccionar solution_json
  - Informar errores de rehidratación; no generar otro escenario silenciosamente

DEPENDENCIAS: PL-06, PL-09

CHECKPOINT ✅:
  - El escenario es claro y tiene un bug identificable
  - El formulario captura todos los campos necesarios
  - La evaluación da feedback sobre calidad del report
  - Se puede intentar de nuevo con un escenario diferente
  - Recargar conserva el mismo exercise.id sin un POST adicional a generate
  - Un ejercicio ya enviado no se rehidrata como pendiente
```

#### PL-12 — UI: API Testing Checklist
```
OBJETIVO:
  Sección donde el usuario practica testing de APIs usando
  el propio backend de FastAPI como caso de estudio real.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-12.md

CUBRE:
  - frontend/app/(dashboard)/practice/api-testing/page.tsx
  - Componentes:
      api-testing/_components/endpoint-card.tsx
      api-testing/_components/validation-checklist.tsx
  - Endpoint de ejemplo: POST /extract-pdf-full
  - Checklist interactiva de validaciones:
      [ ] Archivo PDF válido → 200
      [ ] Archivo vacío → 400
      [ ] Archivo con extensión incorrecta → 400
      [ ] PDF sin texto seleccionable → 422
      [ ] Error controlado → estructura ErrorResponse
      [ ] Respuesta con estructura FullExtractionResponse
  - Cada ítem tiene: descripción, resultado esperado, campo para resultado real
  - Sin llamadas reales a la API (modo educativo/checklist)
  - Progreso guardado en localStorage inicialmente

DEPENDENCIAS: PL-06, BE-05

CHECKPOINT ✅:
  - La checklist renderiza todos los ítems
  - Se pueden marcar/desmarcar ítems
  - El progreso se persiste entre recargas (localStorage)
  - La documentación de cada validación es clara
```

#### PL-13 — Integración Dashboard (métricas de práctica)
```
OBJETIVO:
  Agregar métricas del Practice Lab al dashboard existente.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-13.md

CUBRE:
  - Extender /api/dashboard/metrics para incluir:
      practice_stats: { total_exercises, completed_exercises, avg_score,
                        by_type: { test_cases, bug_report, api_testing, exploratory },
                        most_practiced_type }
  - Nuevo componente: PracticeProgressCard en dashboard
  - Mostrar: ejercicios completados, score promedio, tipo más practicado
  - Integrar en la página /dashboard existente
  - Actualizar tipos en frontend/types/dashboard.ts

DEPENDENCIAS: DA-01, PL-09

CHECKPOINT ✅:
  - /api/dashboard/metrics incluye practice_stats
  - El dashboard muestra la card de práctica
  - Las métricas son correctas según practice_submissions
  - tsc limpio, build OK
```

#### PL-14 — Navegación y protección: agregar "Práctica" al layout
```
ESTADO:
  Implementado y verificado.

OBJETIVO:
  Integrar el acceso visible al Practice Lab y migrar el guard global
  a proxy.ts, protegiendo /plan y /practice sin perder cookies,
  redirects ni la autorización JSON propia de las APIs.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/PL-14.md

CUBRE:
  - Agregar ruta { href: '/practice', label: 'Práctica' } en:
      _components/main-nav.tsx (desktop)
      _components/mobile-nav.tsx (mobile, con emoji 🔬)
  - Migrar frontend/middleware.ts a frontend/proxy.ts según Next.js 16,
    preservando auth, redirects, matcher y actualización de sesión
  - Agregar /practice y reconciliar /plan en las rutas protegidas del proxy
  - Preservar cookies de refresh/limpieza también en respuestas redirect
  - Verificar que el link activo se resalta correctamente
  - Verificar responsive en mobile
  - La rehidratación de Bug Lab queda fuera de alcance y se documenta en PL-11

DEPENDENCIAS: PL-06, PL-13, FE-03, FE-04

CHECKPOINT ✅:
  - "Práctica" aparece en la nav desktop y mobile
  - El link se resalta cuando estás en /practice/*
  - proxy.ts protege /plan y /practice/* (redirect a /login sin sesión)
  - Los redirects preservan cookies de refresh/limpieza de Supabase
  - El build no muestra el warning de convención middleware deprecada
  - tsc limpio, build OK
```

---

### 🤖 BLOQUE I — AI SETTINGS & USAGE CONTROL

---

#### AI-01 — Schema: preferencias IA + tracking de uso/tokens
```
ESTADO:
  Guía generada; implementación pendiente.
  Auditada el 12/07/2026 y lista para implementación manual;
  los gates PL-02/05/09/11 están cerrados.

OBJETIVO:
  Crear la base de datos mínima para soportar configuración segura de IA,
  límites de uso y auditoría de consumo sin almacenar API keys personales.

SKILL: istqb-db-guide-generator
OUTPUT: docs/guides/db/AI-01.md

CUBRE:
  - Tabla user_ai_settings:
      user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
      mode TEXT NOT NULL DEFAULT 'demo'
      provider TEXT NOT NULL DEFAULT 'gemini'
      model_name TEXT NULL
      daily_request_limit INTEGER NOT NULL DEFAULT 20
      monthly_request_limit INTEGER NOT NULL DEFAULT 300
      daily_token_limit INTEGER NOT NULL DEFAULT 50000
      monthly_token_limit INTEGER NOT NULL DEFAULT 500000
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + trigger
      mode/provider/model_name son preferencias editables
      límites son columnas administradas: authenticated no puede modificarlos
  - Tabla ai_usage_events:
      id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
      feature TEXT NOT NULL
      mode TEXT NOT NULL
      provider TEXT NULL en demo; gemini/openai en managed/byok
      model_name TEXT NULL en demo; modelo real en managed/byok
      prompt_tokens INTEGER DEFAULT 0
      completion_tokens INTEGER DEFAULT 0
      total_tokens INTEGER DEFAULT 0
      request_units INTEGER DEFAULT 1
      status TEXT NOT NULL
      error_code TEXT NULL
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - CHECK constraints:
      mode IN ('demo', 'managed', 'byok')
      provider IS NULL en demo; IN ('gemini', 'openai') en managed/byok
      feature IN ('plan', 'theory', 'quiz', 'evaluate', 'practice_generate', 'practice_evaluate')
      status IN ('success', 'blocked_quota', 'error')
      tokens y límites >= 0
      total_tokens = prompt_tokens + completion_tokens
      success no lleva error_code; blocked_quota/error sí
      demo y blocked_quota usan request_units=0 y total_tokens=0;
      success managed/byok consume >=1 unidad
      model_name no vacío y longitud acotada
  - Índices compuestos por (user_id, created_at),
    (user_id, feature, created_at) y parcial para status no exitoso
  - RLS optimizado con (select auth.uid()) para ownership de lectura/escritura
  - Privilegios explícitos:
      authenticated puede editar solo mode/provider/model_name
      authenticated no puede elevar cuotas
      authenticated solo puede leer sus usage_events
      solo service_role server-only registra usage_events
  - Regla explícita: NO crear columnas para guardar API keys de usuario
  - Límite explícito: AI-02 debe reservar cuota de forma atómica e idempotente;
    SELECT + INSERT separados no habilitan modo managed

DEPENDENCIAS: DB-04, DB-05 endurecido, PL-14 y gates cerrados de PL-02/05/09/11

CHECKPOINT ✅:
  - supabase db push --linked --dry-run revisado antes del push
  - supabase db push --linked sin errores
  - user_ai_settings y ai_usage_events visibles en Table Editor
  - Valores inválidos, total inconsistente y error sin error_code fallan por CHECK
  - Usuario A no puede leer usage_events de usuario B
  - authenticated no puede modificar cuotas ni insertar usage_events
  - Advisors de security/performance no muestran errores nuevos
  - Baseline previo no aumenta: 1 warning security y 28 warnings performance
  - No existe ninguna columna tipo api_key, encrypted_key, secret o token personal
```

#### AI-02 — Runtime server-side: resolver proveedor, modo y cuota
```
OBJETIVO:
  Centralizar en servidor la decisión de qué proveedor IA usar, con qué modo,
  qué límites aplicar y cómo registrar consumo.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/AI-02.md

CUBRE:
  - frontend/types/ai.ts con:
      AiUsageMode = 'demo' | 'managed' | 'byok'
      AiProvider = 'gemini' | 'openai'
      AiUsageEvent usa provider/model nullable cuando mode = 'demo'
      AiFeature, AiRuntimeRequest, AiRuntimeResult, AiUsageSummary
  - frontend/lib/ai/runtime.ts server-only:
      resolveAiRuntime(user_id, feature, optionalByokKey)
      reserveAiQuota(user_id, feature, event_id) de forma atómica
      recordAiUsage(event)
      createProviderClient(runtime)
      validar model_name contra allowlist server-side por proveedor
  - Modo demo:
      no llama a proveedor externo
      retorna mock educativo o error controlado según feature
  - Modo managed:
      usa GEMINI_API_KEY / OPENAI_API_KEY solo desde servidor
      reserva cuota por usuario antes de llamar al LLM
      no usa SELECT + INSERT separados: RPC/transacción con lock
      reutiliza event_id en reintentos para idempotencia
  - Modo byok:
      recibe key temporal solo en la request
      no la persiste en Supabase, localStorage, sessionStorage ni cookies
      nunca la imprime en logs ni responses
  - Normalización de usage:
      prompt_tokens, completion_tokens, total_tokens si el proveedor los entrega
      fallback conservador si el proveedor no retorna usage

DEPENDENCIAS: AI-01, SE-02, SE-04, PL-05, PL-09

CHECKPOINT ✅:
  - El runtime compila con TypeScript strict
  - Modo demo funciona sin variables GEMINI_API_KEY ni OPENAI_API_KEY
  - Dos requests concurrentes no pueden superar la cuota por una race condition
  - Reintentar el mismo event_id no cobra ni registra dos veces
  - Modo managed permanece deshabilitado hasta pasar esos dos tests
  - Un model_name fuera de allowlist nunca llega al SDK del proveedor
  - Modo byok usa la key solo en memoria durante la request
  - Cada llamada exitosa o bloqueada crea ai_usage_events sin secrets
```

#### AI-03 — UI Settings: Demo / Managed / BYOK session-only
```
OBJETIVO:
  Agregar una pantalla de configuración donde el usuario elija cómo quiere
  usar IA sin exponer ni persistir API keys personales.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/AI-03.md

CUBRE:
  - Ruta protegida frontend/app/(dashboard)/settings/ai/page.tsx
  - Componentes:
      settings/ai/_components/ai-mode-selector.tsx
      settings/ai/_components/provider-selector.tsx
      settings/ai/_components/byok-session-key-form.tsx
      settings/ai/_components/test-connection-card.tsx
      settings/ai/_components/security-notice.tsx
  - API Routes:
      GET /api/settings/ai
      PATCH /api/settings/ai
      POST /api/settings/ai/test-connection
  - UX de modos:
      Demo: seguro, sin costo, funcionalidad limitada/mock
      Managed: usa la key del servidor con cuotas
      BYOK: usuario pega API key temporal para esa sesión/request
  - BYOK session-only:
      la key se mantiene en estado React solo mientras la pantalla/request vive
      no se guarda en Supabase, localStorage, sessionStorage ni cookies
      el input permite limpiar la key y mostrar/ocultar valor
  - Navegación:
      agregar "Settings" o "IA" al menú si aún no existe, sin romper mobile

DEPENDENCIAS: AI-02, FE-04

CHECKPOINT ✅:
  - /settings/ai está protegido por auth
  - El usuario puede cambiar demo/managed/byok y provider sin guardar keys
  - Probar conexión funciona en demo y managed
  - BYOK muestra aviso claro de no almacenamiento
  - Recargar la página borra la key BYOK temporal
```

#### AI-04 — UI/API: consumo de tokens, llamadas y límites
```
OBJETIVO:
  Mostrar al usuario un informe claro de consumo de IA: llamadas realizadas,
  tokens aproximados, límites diarios/mensuales y bloqueos por cuota.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/AI-04.md

CUBRE:
  - API Route GET /api/settings/ai/usage
  - Query segura sobre ai_usage_events filtrada por auth.uid()
  - Resumen:
      requests_today, requests_month
      tokens_today, tokens_month
      daily_request_limit, monthly_request_limit
      daily_token_limit, monthly_token_limit
      last_events[]
  - Componentes:
      settings/ai/_components/usage-summary-cards.tsx
      settings/ai/_components/token-usage-meter.tsx
      settings/ai/_components/usage-events-table.tsx
      settings/ai/_components/quota-warning-banner.tsx
  - Estados visuales:
      sin uso aún
      cerca del límite
      límite alcanzado
      error al cargar métricas
  - Dashboard opcional:
      mini-card de IA en /dashboard o enlace hacia /settings/ai

DEPENDENCIAS: AI-01, AI-03, DA-01

CHECKPOINT ✅:
  - /api/settings/ai/usage solo retorna eventos del usuario autenticado
  - El usuario ve tokens/requests diarios y mensuales
  - La UI muestra advertencia al superar 80% del límite
  - Límite alcanzado se comunica sin revelar detalles internos del proveedor
  - tsc limpio, build OK
```

#### AI-05 — Integración del runtime IA con sesiones y Practice Lab
```
OBJETIVO:
  Reemplazar llamadas LLM dispersas por el runtime seguro de AI-02 en los
  flujos reales de la aplicación.

SKILL: istqb-fe-guide-generator
OUTPUT: docs/guides/fe/AI-05.md

CUBRE:
  - Integrar runtime en:
      /api/plan/generate
      /api/sessions/[id]/theory
      /api/sessions/[id]/quiz
      /api/sessions/[id]/evaluate
      /api/practice/generate
      /api/practice/evaluate
  - Antes de cada llamada LLM:
      validar sesión
      resolver settings de usuario
      validar cuota
      elegir demo/managed/byok
  - Después de cada llamada:
      registrar ai_usage_events
      retornar mensaje claro si blocked_quota
      no exponer raw provider errors con secrets
  - Modo demo para features clave:
      plan/theory/quiz/practice pueden responder payload educativo mínimo
      evaluate puede retornar feedback simulado claramente marcado como demo
  - BYOK:
      aceptar key temporal solo en headers/body server-bound
      limpiar cualquier referencia después de la request
  - No tocar FastAPI: el control de IA vive en Next.js API Routes

DEPENDENCIAS: AI-02, AI-04, PL-09, SE-08, UP-04

CHECKPOINT ✅:
  - Todos los endpoints LLM usan el runtime centralizado
  - Modo demo permite probar la app sin API keys reales
  - Modo managed respeta límites y registra consumo
  - Modo BYOK no persiste la key y registra consumo sin guardar secretos
  - No existe ninguna variable NEXT_PUBLIC_*AI* ni API key en bundle/logs
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
  - Test: configurar modo IA demo/managed desde /settings/ai
  - Test: ver consumo de IA sin exponer secrets
  - Test: completar teoría → botón ir al quiz visible
  - Test: responder quiz y enviar → feedback visible
  - Test: Practice Lab genera/evalúa práctica respetando modo IA
  - Test: dashboard muestra métricas actualizadas
  - Test responsive: mobile (375px) y desktop (1280px)

DEPENDENCIAS: QA-02, UP-06, SE-08, DA-05, PL-14, AI-05

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
            SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, OPENAI_API_KEY,
            OPENAI_MODEL, GEMINI_OPENAI_BASE_URL, FASTAPI_URL,
            AI_USAGE_MODE, AI_DAILY_LIMIT_PER_USER
  - DigitalOcean: (variables del .env de FastAPI si las hubiera)
  - Verificar que ningún secret está en el código fuente
  - Verificar .gitignore incluye .env.local
  - Verificar que service_role, GEMINI_API_KEY y OPENAI_API_KEY solo existen
    en entornos servidor
  - Revisar precios/modelos vigentes antes de fijar OPENAI_MODEL final

DEPENDENCIAS: PR-01, PR-02

CHECKPOINT ✅:
  - La app en producción se conecta a Supabase correctamente
  - La app en producción se conecta al proveedor LLM elegido correctamente
  - La app en producción se conecta a FastAPI en DO correctamente
  - No hay secrets expuestos en el repositorio de GitHub
  - No hay secrets expuestos en el bundle frontend de Vercel
```

#### PR-03A — Seguridad de IA: modos de uso, BYOK y límites de consumo
```
OBJETIVO:
  Evitar que producción dependa sin control de una API key personal y
  preparar el proyecto para usuarios reales sin riesgo de costos inesperados.

CUBRE:
  - Auditar que AI-01..AI-05 están implementadas y activas antes del go-live
  - Definir modos de uso de IA:
      demo     → respuestas mock/precalculadas o funcionalidad limitada sin LLM externo
      managed  → la app usa una key propia del servidor con cuotas estrictas
      byok     → el usuario aporta su propia API key solo para la request/sesión
  - Reglas de seguridad para BYOK:
      la key no se guarda en Supabase, localStorage ni sessionStorage
      la key se envía solo por HTTPS a Route Handlers del servidor
      el servidor la usa para esa llamada y la descarta
      nunca se imprime en logs, responses, errores o analytics
  - Límites para modo managed:
      autenticación obligatoria
      límite diario por usuario
      límite mensual o presupuesto global
      rate limit por usuario/IP
      timeout, maxRetries, tamaño máximo de prompt y tope de tokens
  - UX de costo/abuso:
      mensajes claros cuando se agota la cuota
      modo demo disponible si no hay proveedor configurado
      aviso visible de que las API keys personales no se almacenan
  - Auditoría de seguridad:
      /settings/ai existe, es usable y explica los modos al usuario
      /api/settings/ai/usage muestra consumo sin exponer secrets
      no existen variables NEXT_PUBLIC_*AI*
      no hay secrets en GitHub, Vercel bundle, logs ni documentación versionada
      alertas de gasto activadas en OpenAI/Gemini/DigitalOcean cuando aplique
      habilitar protección de contraseñas filtradas en Supabase Auth
      resolver los 28 warnings históricos auth_rls_initplan mediante una
      migración dedicada que use (select auth.uid()), sin mezclarla con AI-01

DEPENDENCIAS: PR-03, AI-05, PL-09

CHECKPOINT ✅:
  - Un usuario nuevo no puede ejecutar llamadas LLM ilimitadas
  - Modo demo funciona sin GEMINI_API_KEY ni OPENAI_API_KEY
  - Modo managed respeta cuota diaria por usuario
  - Modo BYOK no persiste la key en BD ni almacenamiento del navegador
  - Una búsqueda en el bundle/repo/logs no muestra API keys ni prefijos sensibles
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

DEPENDENCIAS: PR-01, PR-03, PR-03A

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

DEPENDENCIAS: todas las anteriores, incluyendo PR-03A

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
                                                           └── PL-01...PL-14 (Bloque H)
                                                                └── AI-01...AI-05 (Bloque I)
                                                                     └── QA-01...QA-03
                                                                           └── PR-01, PR-02
                                                                                └── PR-03
                                                                                     └── PR-03A
                                                                                          └── PR-04
                                                                                               └── PR-05
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

SEMANA 4 (dashboard + practice lab setup)
  Día 15: DA-01, DA-02
  Día 16: DA-03, DA-04 (✅ completado), DA-05
  Día 17: PL-01, PL-02, PL-03
  Día 18: PL-04 (✅ completado), PL-05 (✅ completado)
  Día 19: PL-06

SEMANA 5 (practice lab core)
  Día 20: PL-07, PL-08
  Día 21: PL-09 (✅ completado), PL-10 (✅ completado)
  Día 22: PL-11, PL-12
  Día 23: PL-13, PL-14

SEMANA 6 (AI settings + control de consumo)
  Día 24: AI-01, AI-02
  Día 25: AI-03
  Día 26: AI-04, AI-05

SEMANA 7 (testing E2E)
  Día 27: QA-01
  Día 28: QA-02
  Día 29: QA-03

SEMANA 8 (producción)
  Día 30: PR-01, PR-02
  Día 31: PR-03, PR-03A
  Día 32: PR-04, PR-05 — ¡Go live! 🚀
```

---

## Backlog Post-MVP

### PL-15 — Observabilidad UX de Reintentos LLM
```
ESTADO: Pendiente. No bloquea PL-11 a PL-14 ni el cierre de PL-10.

OBJETIVO:
  Mostrar progreso comprensible mientras una operación LLM cambia de
  candidato, sin exponer modelos, claves, cookies, prompts ni errores del proveedor.

DEPENDENCIAS:
  - PL-05 y PL-09 con cascada de modelos compartida
  - PL-10 con estados loading/error recuperables
  - Definir si se usará streaming HTTP o job + polling antes de implementar

CUBRE:
  - Protocolo de progreso server -> cliente para generate/evaluate
  - Estados sanitizados: preparando, generando, reintentando, finalizado, error
  - UI de progreso accesible y no bloqueante
  - Cancelación, timeout y recuperación al recargar
  - Pruebas de fallback sin llamadas LLM reales

REGLAS DE SEGURIDAD:
  - Nunca mostrar API keys, cookies, prompts, respuesta cruda ni error.message del proveedor
  - Mostrar "Probando alternativa" en vez de nombres/modelos concretos
  - No alterar el contrato JSON actual hasta definir una estrategia compatible
```

---

*Árbol de guías v2.4 — Julio 2026*
*Usar junto con: ISTQB_StudyAgent_ProjectDoc.md*
*Bloque H agregado en v2.0; gate PR-03A agregado en v2.1; Bloque I agregado en v2.2; reconciliación de contratos y seguridad IA en v2.3; gates runtime/remotos cerrados y AI-01 habilitada para implementación manual en v2.4*
