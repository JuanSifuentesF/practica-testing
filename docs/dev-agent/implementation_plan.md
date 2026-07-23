# Plan de Implementación: Suite Nativa de Agent Skills v2.0.0 (ISTQB Developer Buddy)

Este plan detalla el diseño del ecosistema de tutoría y validación implementado como **Agent Skills nativos** en el cliente de IA global. Los skills NO son scripts Python ejecutables, sino instrucciones estructuradas (`SKILL.md`) que definen mi comportamiento como tutor y validador.

---

## Paradigma: Agent Skills Nativos (No Scripts)

> [!IMPORTANT]
> **Decisión Arquitectónica Clave:**  
> Originalmente se planificó crear scripts Python en `dev-tools/` (`step_validator.py`, `guide_generator.py`, etc.). Este enfoque fue **descartado** en favor de **Agent Skills nativos** — archivos `SKILL.md` que instruyen directamente al agente de IA sobre cómo comportarse, qué archivos leer, y qué reportes generar. Esto elimina dependencias externas (Python, pip, pdfplumber) y permite que todo funcione de forma integrada dentro del cliente de IA.

> [!TIP]
> **Evasión de Comentarios en la Validación de Código:**  
> El skill `istqb-step-validator` pre-procesa mentalmente los archivos fuente removiendo comentarios monolínea (`//`, `#`), multilínea (`/* ... */`, `""" ... """`) y espacios en blanco excesivos, **preservando caracteres `#` y `//` dentro de strings literales** (URLs, colores hex, etc.), para validar puramente la equivalencia funcional del código.

---

## Ubicación del Plugin

```
C:\Users\jsife\.gemini\config\plugins\istqb-developer-buddy/
├── plugin.json                          # v2.0.0 — Metadata del plugin
└── skills/
    ├── istqb-step-validator/            # Validador de progreso por secciones
    │   └── SKILL.md
    ├── istqb-db-guide-generator/        # Generador de guías de BD
    │   └── SKILL.md
    ├── istqb-be-guide-generator/        # Generador de guías de Backend
    │   └── SKILL.md
    ├── istqb-fe-guide-generator/        # Generador de guías de Frontend
    │   └── SKILL.md
    ├── istqb-db-validator/              # Validador de integridad de BD
    │   └── SKILL.md
    ├── istqb-pdf-extractor-tester/      # Tester del extractor PDF
    │   └── SKILL.md
    └── istqb-llm-response-validator/    # Validador de schemas LLM
        └── SKILL.md
```

---

## Rutas del Workspace (Constantes Globales)

Todos los skills comparten estas rutas para mantener consistencia:

| Constante | Ruta |
|---|---|
| Workspace Root | `c:\Users\jsife\OneDrive\Desktop\Repositorios\practica-testing` |
| Roadmap | `docs/roadmap/ISTQB_Guias_Implementacion.md` |
| Guías DB | `docs/guides/db/` |
| Guías BE | `docs/guides/be/` |
| Guías FE | `docs/guides/fe/` |
| Migraciones | `supabase/migrations/` |
| Backend | `backend/` |
| Frontend | `frontend/` |

---

## Detalle de los 7 Agent Skills

### 1. `istqb-step-validator` — Validador de Progreso

**Activación:** `"Valida mi progreso de la guía DB-01 en su sección 3"` o `/validate DB-01 03`

**Capacidades v2.0.0:**
*   **Doble fuente de verdad:** Lee la guía generada (primaria) + el roadmap (secundaria).
*   **Detección automática de capa:** `DB-XX` → `supabase/`, `BE-XX` → `backend/`, `FE-XX` → `frontend/`.
*   **Cross-layer:** Verifica archivos raíz (`.env.example`, `.gitignore`) además de la capa específica.
*   **Comment stripping inteligente:** Preserva `#`/`//` dentro de strings literales.
*   **Reporte visual:** Barra de progreso `███████░░░ XX%`, checkpoints ✅/❌ por sección, y referencia al paso exacto en la guía para cada fallo.

---

### 2. `istqb-db-guide-generator` — Profesor de Base de Datos

**Activación:** `/istqb-db-guide-generator` o `"Genera la guía DB-02"`

**Capacidades v2.0.0:**
*   **8 secciones obligatorias:** Introducción → Prerequisitos → Estructura de Directorios → Diagrama Mermaid → Implementación → Checkpoints → Troubleshooting → Resumen.
*   **Dependency Gate:** No genera la guía N+1 si la guía N no existe.
*   **No Phantom Deliverables:** Todo archivo mencionado se entrega con contenido completo copyable.
*   **Output:** Persiste en `docs/guides/db/{GUIDE_ID}.md`.

---

### 3. `istqb-be-guide-generator` — Profesor de Backend

**Activación:** `/istqb-be-guide-generator` o `"Genera la guía BE-01"`

**Capacidades v2.0.0:**
*   Misma estructura de 8 secciones obligatorias.
*   Diagrama Mermaid del flujo HTTP → Router → Service → DB.
*   Troubleshooting específico de FastAPI/Python/Pydantic.
*   Awareness de Windows (`python`, no `python3`; `.\venv\Scripts\Activate.ps1`).
*   **Output:** Persiste en `docs/guides/be/{GUIDE_ID}.md`.

---

### 4. `istqb-fe-guide-generator` — Profesor de Frontend

**Activación:** `/istqb-fe-guide-generator` o `"Genera la guía FE-01"`

**Capacidades v2.0.0:**
*   Misma estructura de 8 secciones obligatorias.
*   Diagrama Mermaid de arquitectura de componentes (layout → sidebar → pages).
*   Verificación visual: describe exactamente qué debe ver el usuario en pantalla.
*   Styling guidance con design tokens y estrategia CSS/Tailwind.
*   **Output:** Persiste en `docs/guides/fe/{GUIDE_ID}.md`.

---

### 5. `istqb-db-validator` — Validador de Integridad de BD

**Activación:** `"Valida la integridad de mi base de datos"` o `/db-validate`

**Capacidades v2.0.0:**
*   Cross-referencia dinámica con guías completadas (no lista fija de tablas).
*   Verificación de RLS (`ENABLE ROW LEVEL SECURITY` + políticas).
*   Simulación estática de inserts inválidos.
*   Explicación de implicaciones de seguridad de cada constraint faltante.
*   Reporte visual categorizado: Tablas, FKs, CHECKs, Índices, RLS.

---

### 6. `istqb-pdf-extractor-tester` — Tester del Extractor PDF

**Activación:** `"Valida el extractor de PDF"` o `/pdf-test`

**Capacidades v2.0.0:**
*   3 test cases estáticos con texto de ejemplo real del syllabus.
*   Verificación de captura regex, clasificación K-level, y calidad de text chunking.
*   Validación de cobertura contra ~40 learning objectives del syllabus v4.0.
*   Edge cases: page breaks, trailing periods, double-digit sub-sections.

---

### 7. `istqb-llm-response-validator` — Validador de Schemas LLM

**Activación:** `"Valida los schemas del LLM"` o `/llm-validate`

**Capacidades v2.0.0:**
*   Triple consistencia: DB CHECK ↔ Pydantic ↔ TypeScript.
*   Detección de anti-patterns en prompts de OpenAI.
*   Verificación de temperaturas por tipo de generación.
*   Verificación de `response_format: { type: "json_object" }`.
*   Identificación de campos vulnerables a desvíos del modelo.

---

## Plan de Verificación

### Pruebas Integradas
*   Invocar `/istqb-db-guide-generator` para generar `DB-01` y verificar que las 8 secciones obligatorias estén presentes.
*   Completar las primeras secciones de `DB-01` y ejecutar `"Valida mi progreso de la guía DB-01 en su sección 4"` para confirmar que el reporte visual funciona correctamente.
*   Crear una migración SQL con un CHECK faltante a propósito y ejecutar `/db-validate` para verificar la detección.

### Pruebas Manuales
*   Revisar que cada skill tenga la ruta correcta a `docs/roadmap/ISTQB_Guias_Implementacion.md`.
*   Confirmar que el Dependency Gate bloquea la generación de `DB-02` si `DB-01` no existe.
