# 🔬 Análisis: ISTQB Study Agent → QA Practice Lab

## Veredicto: ✅ **100% viable y altamente recomendable**

Tu proyecto ya tiene el **90% de la infraestructura necesaria**. No es un "empezar de cero" — es una **evolución natural** de lo que ya construiste.

---

## 📊 Estado actual del proyecto (lo que ya tienes)

| Capa | Componentes completados | Estado |
|:---|:---|:---:|
| **Database** | 6 tablas (user_profiles, documents, study_plans, sessions, answers, topic_progress) + RLS + Storage | ✅ |
| **Backend** | FastAPI con `/extract-pdf`, `/extract-pdf-full`, topic_detector con regex FL-x.x.x | ✅ |
| **Frontend** | Next.js 16 + Auth + Dashboard + Plan + Session (teoría + quiz + feedback adaptativo) | ✅ |
| **Bloques completados** | DB (5/5), BE (6/6), FE (4/4), UP (6/6), SE (8/8), DA (5/5) + PL-01..PL-08 | ✅ |
| **Pendiente** | PL-09..PL-14, AI-01..AI-05, QA-01..QA-03, PR-01..PR-05 | ⏳ |

---

## 🧬 ¿Por qué es viable? — Mapeo de lo que ya tienes vs lo que necesitas

### Lo que ya tienes y se reutiliza directamente

```
Backend ya detecta:
├── FL-x.x.x codes          → Se convierten en IDs de práctica
├── level_k (K1/K2/K3)      → Determina tipo de ejercicio
├── chapter + section        → Agrupa prácticas por capítulo
├── topic text               → Base para el contexto teórico
└── estimated_study_hours    → Se puede extender a horas prácticas

Database ya tiene:
├── documents.topics_json    → Almacena los tópicos detectados
├── topic_progress           → Ya rastrea progreso por tópico ← CLAVE
├── sessions                 → Modelo extensible para sesiones prácticas
└── answers                  → Ya guarda respuestas con evaluación

Frontend ya tiene:
├── Dashboard con gráficas   → Se extiende con métricas de práctica
├── Layout con sidebar       → Se agregan rutas de práctica
├── Auth + RLS               → Cada usuario ve solo sus prácticas
└── API Routes               → Patrón ya establecido
```

### Lo que necesitarías construir NUEVO

```
Backend (3 endpoints nuevos):
├── POST /api/practice/generate     → Genera ejercicio para un tópico
├── POST /api/practice/evaluate     → Evalúa respuesta del usuario
└── POST /api/practice/bug-report   → Evalúa bug report del usuario

Database (2-3 tablas nuevas):
├── practice_exercises    → Ejercicios generados por IA
├── practice_submissions  → Respuestas del usuario
└── bug_reports           → Bug reports redactados (opcional, podría ser JSON en submissions)

Frontend (4-5 páginas + 8-10 componentes):
├── /practice             → Hub de práctica (listado)
├── /practice/[topicCode] → Ejercicio individual
├── /practice/bug-lab     → Laboratorio de bugs
├── /practice/api-testing → Checklist de API testing
└── Componentes específicos de cada tipo de práctica
```

---

## 🗺️ Layout propuesto — Análisis con tu arquitectura actual

### Tu layout actual vs el propuesto

Tu dashboard layout actual ([layout.tsx](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/frontend/app/(dashboard)/layout.tsx)) usa un **header horizontal** sin sidebar:

```
┌─────────────────────────────────────────────────────────┐
│ ISTQB Agent    Dashboard | Mi Plan | Sesión    [Avatar] │  ← Header actual
├─────────────────────────────────────────────────────────┤
│                                                         │
│                   {children}                            │  ← Contenido
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Tu propuesta sugiere un **sidebar**. Hay dos caminos:

### Opción A: Agregar Sidebar (cambio mayor)

```
┌──────────────────────────────────────────────────────────────┐
│ ISTQB Agent + QA Practice Lab                      [Avatar] │
├───────────────┬──────────────────────────────────────────────┤
│ Sidebar       │ Contenido principal                          │
│               │                                              │
│ 📊 Dashboard  │  ┌──────────────────────────────────────┐    │
│ 📋 Mi Plan    │  │ Título del módulo                    │    │
│ 📖 Sesión     │  │ Resumen teórico breve                │    │
│ ─────────     │  │ Ejercicio práctico                   │    │
│ 🔬 Practice   │  │ Editor / formulario interactivo      │    │
│   ├ Test Cases│  │ Resultado / feedback                 │    │
│   ├ Bug Lab   │  └──────────────────────────────────────┘    │
│   ├ API Tests │                                              │
│   └ Explor.   │                                              │
│ 📈 Progreso   │                                              │
│ ⚙️ Settings   │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

> [!WARNING]
> **Impacto**: Requiere refactorizar [layout.tsx](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/frontend/app/(dashboard)/layout.tsx), [main-nav.tsx](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/frontend/app/(dashboard)/_components/main-nav.tsx), y [mobile-nav.tsx](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/frontend/app/(dashboard)/_components/mobile-nav.tsx). No es destructivo pero sí un cambio visual significativo.

### Opción B: Mantener Header + Expandir rutas (cambio mínimo) — **Recomendada como MVP**

```
┌──────────────────────────────────────────────────────────────┐
│ ISTQB Agent    Dashboard | Plan | Sesión | 🔬 Práctica  [👤]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Tabs: [Test Cases] [Bug Lab] [API Testing] [Exploratoria]  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Contenido del tipo de práctica seleccionado            │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

> [!TIP]
> **Ventaja**: Solo necesitas agregar una ruta más al array `routes` en [main-nav.tsx](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/frontend/app/(dashboard)/_components/main-nav.tsx) y crear las páginas. **Cero refactorización del layout actual.**

---

## 🏗️ Estructura de carpetas propuesta (Next.js)

Se integra limpiamente con tu estructura existente:

```diff
 frontend/app/(dashboard)/
   ├── dashboard/page.tsx          ← Ya existe
   ├── plan/page.tsx               ← Ya existe
   ├── session/page.tsx            ← Ya existe
   ├── setup/page.tsx              ← Ya existe
+  ├── practice/                   ← NUEVO
+  │   ├── page.tsx                ← Hub: lista tópicos practicables
+  │   ├── _components/
+  │   │   ├── topic-practice-list.tsx
+  │   │   ├── practice-card.tsx
+  │   │   └── practice-filter.tsx
+  │   ├── [topicCode]/            ← Ejercicio individual por tópico
+  │   │   ├── page.tsx
+  │   │   └── _components/
+  │   │       ├── theory-brief.tsx
+  │   │       ├── exercise-prompt.tsx
+  │   │       ├── test-case-editor.tsx   ← Tabla editable de casos
+  │   │       ├── solution-compare.tsx
+  │   │       └── feedback-panel.tsx
+  │   ├── bug-lab/                ← Laboratorio de bugs
+  │   │   ├── page.tsx
+  │   │   └── _components/
+  │   │       ├── scenario-display.tsx
+  │   │       ├── bug-report-form.tsx
+  │   │       └── bug-evaluation.tsx
+  │   └── api-testing/            ← Práctica de API testing
+  │       ├── page.tsx
+  │       └── _components/
+  │           ├── endpoint-card.tsx
+  │           ├── validation-checklist.tsx
+  │           └── test-runner.tsx

 frontend/app/api/
+  ├── practice/
+  │   ├── generate/route.ts       ← Genera ejercicio con IA
+  │   ├── evaluate/route.ts       ← Evalúa respuesta
+  │   └── bug-report/route.ts     ← Evalúa bug report

 frontend/types/
+  ├── practice.ts                 ← Tipos de práctica

 frontend/lib/prompts/
+  ├── practice-exercise.ts        ← Prompt para generar ejercicios
+  ├── practice-evaluate.ts        ← Prompt para evaluar respuestas
+  └── bug-report-evaluate.ts      ← Prompt para evaluar bug reports
```

---

## 🗄️ Schema de base de datos propuesto

### Nueva tabla: `practice_exercises`

```sql
CREATE TABLE public.practice_exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_code      TEXT NOT NULL,          -- FL-4.2.1
  level_k         TEXT NOT NULL,          -- K3
  exercise_type   TEXT NOT NULL,          -- 'test_cases', 'bug_report', 'api_testing', 'exploratory'
  scenario_json   JSONB NOT NULL,         -- El escenario/contexto generado por IA
  solution_json   JSONB,                  -- La solución de referencia (generada por IA)
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT practice_type_chk
    CHECK (exercise_type IN ('test_cases', 'bug_report', 'api_testing', 'exploratory')),
  CONSTRAINT practice_level_k_chk
    CHECK (level_k IN ('K1', 'K2', 'K3'))
);
```

### Nueva tabla: `practice_submissions`

```sql
CREATE TABLE public.practice_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id     UUID NOT NULL REFERENCES public.practice_exercises(id) ON DELETE CASCADE,
  submission_json JSONB NOT NULL,         -- Lo que el usuario escribió
  score_percent   NUMERIC(5,2),           -- 0-100
  feedback_json   JSONB,                  -- Feedback detallado de la IA
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT submission_score_chk
    CHECK (score_percent IS NULL OR score_percent BETWEEN 0 AND 100)
);
```

> [!NOTE]
> Estas tablas siguen **exactamente** las mismas convenciones que tu schema actual: UUIDs, CASCADE, CHECK constraints, JSONB para datos flexibles, y `user_id` para RLS.

---

## 🧠 Lógica de generación de ejercicios por nivel K

Esta es la parte más inteligente — cada nivel K se traduce en un **tipo de ejercicio diferente**:

| Nivel K | Verbo cognitivo | Tipo de ejercicio generado | Ejemplo |
|:---:|:---|:---|:---|
| **K1** | Recordar | Quiz de conceptos + definiciones | "¿Qué es Equivalence Partitioning?" |
| **K2** | Comprender | Identificar errores en un escenario | "¿Qué está mal en este test case?" |
| **K3** | Aplicar | **Crear casos de prueba desde cero** | "Diseña 5 test cases para este formulario" |

Tu backend ya clasifica cada tópico con su nivel K. Esto significa que el generador de ejercicios puede **automáticamente** decidir qué tipo de práctica crear.

---

## 📐 Mockup detallado de la vista de práctica

### Vista Hub de Prácticas (`/practice`)

```
┌────────────────────────────────────────────────────────────┐
│  🔬 QA Practice Lab                                        │
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 🧪 Test  │  │ 🐛 Bug   │  │ 🔌 API   │  │ 🔍 Explor│  │
│  │  Cases   │  │  Reports │  │ Testing  │  │  atory   │  │
│  │  12/42   │  │   3/10   │  │   0/6    │  │   0/5    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                            │
│  ─── Capítulo 4: Test Analysis and Design ──────────────  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  FL-4.2.1 · K3 · Equivalence Partitioning           │  │
│  │  ████████████████░░░░  80% completado                │  │
│  │  [Ver teoría]  [🔬 Practicar]  [📝 Crear TC]        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  FL-4.2.2 · K3 · Boundary Value Analysis            │  │
│  │  ░░░░░░░░░░░░░░░░░░░░  Sin iniciar                  │  │
│  │  [Ver teoría]  [🔬 Practicar]  [📝 Crear TC]        │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Vista de ejercicio individual (`/practice/FL-4.2.1`)

```
┌────────────────────────────────────────────────────────────┐
│  FL-4.2.1 — Equivalence Partitioning                       │
│  Nivel: K3 — Aplicar                      Intento: 2/3     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📖 TEORÍA BREVE                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ La partición de equivalencia divide los datos de     │  │
│  │ entrada en grupos (particiones) donde todos los      │  │
│  │ valores del grupo se comportan de la misma manera... │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  🎯 CASO PRÁCTICO                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Una aplicación web permite registrar usuarios.       │  │
│  │ El campo "Edad" acepta valores entre 18 y 65 años.   │  │
│  │                                                      │  │
│  │ Tarea: Define las particiones válidas e inválidas     │  │
│  │ y crea mínimo 5 casos de prueba.                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  📝 TU RESPUESTA — Editor de Casos de Prueba               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ID    │ Escenario        │ Dato │ Esperado │ Tipo    │  │
│  │───────┼──────────────────┼──────┼──────────┼─────────│  │
│  │ TC-01 │ Edad mín válida  │ 18   │ OK       │ ✅ Pos  │  │
│  │ TC-02 │ Edad máx válida  │ 65   │ OK       │ ✅ Pos  │  │
│  │ TC-03 │ Edad bajo mín    │ 17   │ Error    │ ❌ Neg  │  │
│  │ TC-04 │ Edad sobre máx   │ 66   │ Error    │ ❌ Neg  │  │
│  │ TC-05 │ [editable...]    │      │          │         │  │
│  │ [+ Agregar caso]                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ 💾 Guardar       │  │ 🔍 Comparar con solución     │   │
│  └──────────────────┘  └──────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

### Vista de Bug Lab (`/practice/bug-lab`)

```
┌────────────────────────────────────────────────────────────┐
│  🐛 Bug Report Practice Lab                                │
│  Tópico: FL-4.2.1 · Equivalence Partitioning               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📋 ESCENARIO                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Historia de usuario:                                 │  │
│  │ "Como usuario, quiero registrarme con mi edad para   │  │
│  │ validar si puedo crear una cuenta."                  │  │
│  │                                                      │  │
│  │ Regla de negocio:                                    │  │
│  │ Solo se permiten usuarios entre 18 y 65 años.        │  │
│  │                                                      │  │
│  │ 🐛 Resultado observado:                               │  │
│  │ El sistema permite registrar usuarios de 17 años.    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ✍️ REDACTA EL BUG REPORT                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Título:        [___________________________________] │  │
│  │ Precondiciones: [___________________________________] │  │
│  │ Pasos:         [___________________________________] │  │
│  │                [___________________________________] │  │
│  │ Resultado actual:   [______________________________] │  │
│  │ Resultado esperado: [______________________________] │  │
│  │ Severidad:     [Alta ▾]   Prioridad: [Media ▾]      │  │
│  │ Evidencia:     [📎 Adjuntar captura]                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [📤 Enviar para evaluación]                                │
└────────────────────────────────────────────────────────────┘
```

---

## 📋 Plan de implementación por fases (nuevo bloque de guías)

### Bloque H: QA Practice Lab

| ID | Guía | Dependencias | Complejidad | Archivos nuevos |
|:---|:---|:---|:---:|:---:|
| **PL-01** | Schema: tablas practice_exercises + practice_submissions | DB-02 | 🟢 Baja | 1 migración |
| **PL-02** | RLS policies para tablas de práctica | DB-04, PL-01 | 🟢 Baja | 1 migración |
| **PL-03** | Tipos TypeScript de práctica | PL-01, FE-02 | 🟢 Baja | 2 archivos modificados + 1 nuevo |
| **PL-04** | Prompt: generar ejercicio por tópico + nivel K | PL-03, SE-02 | 🟡 Media | 1 archivo |
| **PL-05** | API Route `/api/practice/generate` | PL-03, PL-04 | 🟡 Media | 1 archivo |
| **PL-06** | UI: Hub de prácticas (`/practice`) | PL-05 | 🟡 Media | 3-4 componentes |
| **PL-07** | UI: TestCaseEditor (tabla editable interactiva) | PL-06 | 🔴 Alta | 2-3 componentes |
| **PL-08** | Prompt: evaluar respuesta del usuario | PL-04 | ✅ Completado | 1 archivo (practice-evaluate.ts) |
| **PL-09** | API Route `/api/practice/evaluate` | PL-08 | 🟡 Media | 1 archivo |
| **PL-10** | UI: Feedback de práctica + comparar con solución | PL-09 | 🟡 Media | 2 componentes |
| **PL-11** | UI: Bug Report Lab (escenario + formulario) | PL-06 | 🟡 Media | 3 componentes |
| **PL-12** | UI: API Testing Checklist (tu backend como caso real) | PL-06 | 🟢 Baja | 2 componentes |
| **PL-13** | Integración con Dashboard (métricas de práctica) | DA-01, PL-09 | 🟡 Media | 2-3 archivos |
| **PL-14** | Navegación: agregar "Práctica" al layout | FE-04 | 🟢 Baja | 2 archivos |

> [!IMPORTANT]
> **Estimación total**: ~14 guías nuevas, equivalente a ~2-3 semanas de trabajo siguiendo tu ritmo actual.

**Estado local actualizado:** PL-01 y PL-02 completadas en DB; PL-03 y PL-04 implementadas en frontend con `tsc`/build OK; PL-05 completada y validada con respuesta 200 autenticada + persistencia; PL-06 implementada y funcional; PL-07 completada (TestCaseEditor manual por el usuario, 8 casos funcionales); PL-08 completada (Prompt Builder practice-evaluate.ts, 8/8 checkpoints validados).

---

## 🔑 Decisiones de diseño clave

### 1. Sidebar vs Header — ¿Cuál elegir?

| Criterio | Header actual | Sidebar nuevo |
|:---|:---:|:---:|
| Refactorización requerida | Mínima | Significativa |
| Escala (más secciones futuras) | Se llena rápido | Escala mejor |
| Mobile experience | Ya funciona con Sheet | Requiere ajuste |
| Consistencia con lo existente | ✅ | Rompe patrón |
| **Recomendación MVP** | ✅ **Usar esto** | Para v2.0 |

### 2. ¿Dónde guardar progreso de práctica?

| Opción | Pros | Contras |
|:---|:---|:---|
| `topic_progress` existente | Reutiliza tabla, unifica métricas | Mezcla teoría con práctica |
| Nueva tabla `practice_submissions` | Separación limpia, más detalle | Tabla adicional |
| **Recomendación** | **Tabla nueva** + columna `practice_score` en `topic_progress` | Mejor de ambos mundos |

### 3. ¿Generación de ejercicios con IA o estáticos?

| Opción | Pros | Contras |
|:---|:---|:---|
| Estáticos (hardcodeados) | Rápido de implementar, sin costo API | No escala, repetitivos |
| IA (Gemini/GPT) | Infinitos escenarios, personalizados | Costo API, latencia |
| **Recomendación** | **IA** — ya tienes la integración con Gemini en [openai.ts](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/frontend/lib/openai.ts) | Reutilizas 100% de la infra |

---

## 💡 Valor agregado para tu perfil QA

Este Practice Lab transformaría tu proyecto de "una app que muestra teoría ISTQB" a:

```
Antes:  "Subir PDF → Leer teoría → Responder quiz"
Después: "Subir PDF → Leer teoría → Crear test cases → Reportar bugs 
          → Validar APIs → Tracking de competencias"
```

Esto demuestra que:
1. **Sabes teoría ISTQB** (lo que ya tienes)
2. **Sabes aplicarla** (test cases, bug reports)
3. **Sabes probar APIs** (validaciones de tu propio backend)
4. **Construyes herramientas de QA** (el lab en sí mismo)

---

## ⚠️ Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|:---|:---:|:---|
| Scope creep (querer todo de una vez) | 🔴 Alta | MVP: solo Test Cases + Bug Lab primero |
| Prompts de IA que generan ejercicios pobres | 🟡 Media | Iterar prompts con ejemplos reales del ISTQB |
| La tabla editable (TestCaseEditor) es compleja | 🟡 Media | Usar una librería como TanStack Table |
| Latencia al generar ejercicios con IA | 🟢 Baja | Streaming + skeleton loaders (ya lo haces en teoría) |

---

## 🔐 Actualización v2.1 — Gate antes de producción

Decisión tomada: el **QA Practice Lab sí se implementará antes de producción**, aunque retrase el go-live. Para que esa ruta sea segura, el roadmap queda con estos ajustes obligatorios:

1. **PL-01 y PL-02 son de base de datos**, no frontend. Deben generarse con `istqb-db-guide-generator`.
2. **PL-03 a PL-14 son frontend/API Routes de Next.js** y deben generarse con `istqb-fe-guide-generator`.
3. `practice_exercises` debe incluir `document_id` para distinguir prácticas por PDF/certificación, y puede incluir `study_plan_id` si la práctica nace de un plan concreto.
4. `practice_submissions` debe impedir ownership cruzado. La opción recomendada es FK compuesta `(exercise_id, user_id)` contra `practice_exercises(id, user_id)`.
5. Antes de producción se agrega **PR-03A — Seguridad de IA**, cubriendo modo demo, modo administrado, BYOK session-only, cuotas, rate limits, budget alerts y auditoría de secrets.
6. Ninguna API key de IA debe vivir en `NEXT_PUBLIC_*`, localStorage, sessionStorage, logs, responses, screenshots ni documentación versionada.

### Actualización v2.2 — Bloque AI Settings & Usage Control

Antes de iniciar QA y producción se agrega un bloque formal **AI-01 a AI-05** para implementar lo que `PR-03A` auditará al final:

1. **AI-01** crea `user_ai_settings` y `ai_usage_events` para preferencias, límites y tracking de tokens/requests. No guarda API keys.
2. **AI-02** centraliza el runtime server-side para decidir modo `demo`, `managed` o `byok`, validar cuota y registrar consumo.
3. **AI-03** agrega `/settings/ai` para configurar proveedor, modo y BYOK temporal sin persistir la clave.
4. **AI-04** muestra consumo de tokens, llamadas, límites diarios/mensuales y últimos eventos.
5. **AI-05** integra el runtime seguro con plan, teoría, quiz, evaluación y Practice Lab.

Con esto, `PR-03A` deja de ser la primera implementación de seguridad y pasa a ser un **gate final de auditoría** antes del go-live.

---

## 🎯 Conclusión

> **Sí, agregar práctica es viable, encaja perfectamente con tu arquitectura, y eleva tu proyecto de "app de teoría" a "herramienta profesional de QA".**

El camino más inteligente es:

1. **NO tocar el layout actual** (mantener header, agregar una ruta "Práctica")
2. **Empezar con Test Cases** (PL-01 a PL-10) — es la práctica más directa
3. **Después Bug Lab** (PL-11) — reutiliza el 80% de la infra de Test Cases
4. **Después API Testing** (PL-12) — es el más simple porque usa TU propio backend como caso de estudio
5. **Al final, migrar a Sidebar** cuando tengas 5+ secciones en el nav

Siguiente acción práctica: cerrar **PL-05** ejecutando `POST /api/practice/generate` desde navegador autenticado con un `document_id` real que contenga `FL-4.2.1`; si retorna `200` y persiste en `practice_exercises`, marcar PL-05 como completada e implementar **PL-06** con la guía ya validada.
