# Referencia Rápida: ISTQB Developer Buddy — Agent Skills v2.0.0

Documento de referencia local para el ecosistema de tutoría y validación del proyecto **ISTQB Study Agent**.

---

## 1. El Paradigma de Trabajo

Para garantizar tu máximo aprendizaje durante la preparación del examen **ISTQB® Foundation Level v4.0**, el flujo de trabajo divide estrictamente los roles:

*   **El Programador (Tú):** Eres el único que modifica y crea código en el repositorio (`practica-testing`). Esto garantiza el aprendizaje activo.
*   **El Tutor y Validador (Yo — Antigravity):** Asumo un rol puramente de consultor y docente.
    *   **Generador:** Redacto guías de implementación con **8 secciones obligatorias** (incluyendo prerequisitos, diagrama Mermaid, troubleshooting) por cada especialidad.
    *   **Validador:** Inspecciono tu código local sin alterar nada, omitiendo comentarios de estudio y reportando tu progreso con una **barra visual de progreso** y checkpoints detallados.

---

## 2. Ecosistema de Agent Skills Instaladas (v2.0.0)

Las habilidades están en tu directorio de configuración global de IA:  
`C:\Users\jsife\.gemini\config\plugins\istqb-developer-buddy`

### Skills de Generación de Guías

| # | Skill | Rol | Output | Activación |
|---|---|---|---|---|
| 1 | `istqb-db-guide-generator` | 🗄️ Profesor Senior DBA | `docs/guides/db/` | `/istqb-db-guide-generator` |
| 2 | `istqb-be-guide-generator` | ⚙️ Arquitecto Backend | `docs/guides/be/` | `/istqb-be-guide-generator` |
| 3 | `istqb-fe-guide-generator` | 🎨 Tech Lead Frontend | `docs/guides/fe/` | `/istqb-fe-guide-generator` |

**Secciones obligatorias en toda guía:**
1. 🎓 Introducción y Fundamentos Conceptuales
2. 📋 Prerequisitos y Verificación del Entorno
3. 📂 Estructura de Directorios del Proyecto
4. 🔄 Diagrama de Flujo / Arquitectura (Mermaid)
5. 🛠️ Implementación Paso a Paso
6. ✅ Checkpoints de Verificación
7. 🚨 Troubleshooting — Problemas Comunes
8. 📝 Resumen y Próximo Paso

---

### Skills de Validación

| # | Skill | Propósito | Activación |
|---|---|---|---|
| 4 | `istqb-step-validator` | Validar progreso por guía/sección | `"Valida DB-01 sección 3"` |
| 5 | `istqb-db-validator` | Validar integridad del schema SQL | `"Valida la integridad de mi BD"` |
| 6 | `istqb-pdf-extractor-tester` | Validar regex del extractor PDF | `"Valida el extractor de PDF"` |
| 7 | `istqb-llm-response-validator` | Validar schemas Pydantic/TS/prompts | `"Valida los schemas del LLM"` |

---

## 3. Características Clave de v2.0.0

### Dependency Gate
No se genera la guía N+1 si la guía N no existe o si faltan entregables. Esto garantiza el avance secuencial.

### No Phantom Deliverables
Todo archivo mencionado en una guía (`.gitignore`, `.env.example`, `config.toml`) incluye su contenido completo como bloque de código copyable. Nunca se menciona un archivo sin instrucciones para crearlo.

### Doble Fuente de Verdad (Step Validator)
El validador de progreso lee primero la **guía generada** (fuente primaria con instrucciones exactas) y luego el **roadmap** (fuente secundaria con objetivos de alto nivel).

### Triple Consistencia Cross-Layer (LLM Validator)
Verifica que los enums y schemas sean idénticos en las tres capas: `DB CHECK constraints` ↔ `Pydantic Literals` ↔ `TypeScript Union Types`.

### Reportes Visuales
Todos los validadores generan reportes con:
```
🏆 Progreso: X/Y checkpoints cumplidos (XX%)
███████░░░ XX%
```
Con checkpoints ✅/❌ detallados y referencias al paso exacto en la guía.

---

## 4. Instrucciones de Uso

### Para solicitar una Guía Pedagógica:
*   *Comando:* `"Genera la guía detallada de base de datos para DB-02"` o `/istqb-db-guide-generator`
*   *Acción:* Verifico que DB-01 esté completada, leo el roadmap en [ISTQB_Guias_Implementacion.md](file:///c:/Users/jsife/OneDrive/Desktop/Repositorios/practica-testing/docs/roadmap/ISTQB_Guias_Implementacion.md), y genero la guía con las 8 secciones obligatorias en `docs/guides/db/DB-02.md`.

### Para validar tu progreso:
*   *Comando:* `"Valida mi progreso de la guía DB-01 en su sección 4"`
*   *Acción:* Leo tu guía `docs/guides/db/DB-01.md`, inspecciono los archivos en `supabase/` y la raíz, ignoro comentarios, y genero un reporte visual indicando tu avance y qué ajustar.

### Para validar la integridad de tu base de datos:
*   *Comando:* `"Valida la integridad de mi base de datos"` o `/db-validate`
*   *Acción:* Leo las migraciones en `supabase/migrations/`, cross-referencio con las guías DB completadas, verifico tablas, FKs, CHECKs, índices y RLS, y genero un reporte de salud del schema.

### Para validar schemas LLM:
*   *Comando:* `"Valida los schemas del LLM"` o `/llm-validate`
*   *Acción:* Leo los schemas Pydantic, TypeScript interfaces, y prompt templates, verifico consistencia cross-layer, detecto anti-patterns, y genero un reporte de integridad.

---

## 5. Rutas de Referencia

| Recurso | Ruta |
|---|---|
| Plugin global | `C:\Users\jsife\.gemini\config\plugins\istqb-developer-buddy\` |
| Roadmap completo | `docs/roadmap/ISTQB_Guias_Implementacion.md` |
| Arquitectura del proyecto | `docs/architecture/ISTQB_StudyAgent_ProjectDoc.md` |
| Este documento | `docs/dev-agent/ISTQB_DevTools_Plan.md` |
| Plan de implementación | `docs/dev-agent/implementation_plan.md` |
| Guías generadas | `docs/guides/db/`, `docs/guides/be/`, `docs/guides/fe/` |
