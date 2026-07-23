# Estructura obligatoria de las guías

## Contenido

1. Principios de redacción
2. Sección 1: fundamentos
3. Sección 2: prerrequisitos
4. Sección 3: árbol real
5. Sección 4: arquitectura
6. Sección 5: implementación
7. Sección 6: verificación
8. Sección 7: troubleshooting
9. Sección 8: cierre

## Principios de redacción

- Redactar completamente en español.
- Enseñar el porqué además del cómo, pensando en una persona que aprende React y Next.js.
- Conectar el milestone con la guía anterior sin repetir contenido innecesario.
- Mantener snippets completos, estrictamente tipados, formateados y copiables.
- Marcar cada ruta como existente verificada, nueva o planificada.
- No mencionar un entregable que la guía no cree o modifique explícitamente.
- Después de una auditoría de cierre, cambiar futuro por pasado solo donde haya
  evidencia y eliminar estados/checklists obsoletos. Las subsecciones históricas
  pueden conservarse si están etiquetadas y remiten al cierre vigente.

## Sección 1: fundamentos

Usar exactamente:

```markdown
## Sección 1: 🎓 Introducción y Fundamentos Conceptuales
```

Incluir exactamente `### Analogía profesional`, con 2–4 párrafos sustanciales. Explicar los conceptos React/Next.js relevantes: RSC frente a Client Components, hidratación, streaming, Suspense, auth o middleware/proxy cuando apliquen.

## Sección 2: prerrequisitos

Usar exactamente:

```markdown
## Sección 2: 📋 Prerequisitos y Verificación del Entorno
```

Enumerar herramientas, librerías, runtime y entregables previos. Para cada requisito, mostrar un comando PowerShell seguro y su salida realista. Derivar Node.js del `engines.node` del Next.js instalado. Referenciar la guía y paso exactos que crearon credenciales o contratos necesarios sin imprimir secretos.

## Sección 3: árbol real

Usar exactamente:

```markdown
## Sección 3: 📂 Estructura de Directorios del Proyecto
```

Mostrar el árbol actual pertinente, no un árbol histórico. Señalar `NUEVO` y `MODIFICAR`. Omitir paths ilustrativos inexistentes. Incluir inmediatamente una tabla con:

- archivos a crear;
- archivos a modificar;
- archivos que no se tocarán.

## Sección 4: arquitectura

Usar exactamente:

```markdown
## Sección 4: 🎨 Diagrama de Arquitectura de Componentes
```

Colocar un diagrama Mermaid justo debajo del heading. Para APIs, LLM, Supabase, auth, server actions o flujos multipaso, añadir `### Flujo Completo` y un `sequenceDiagram` con actores, payloads y respuestas clave.

Para dashboards/datos, incluir tanto secuencia end-to-end como flowchart/árbol de responsabilidades. Para auth, mostrar separación de rutas públicas/protegidas. Para UI, mostrar composición de componentes.

## Sección 5: implementación

Usar exactamente:

```markdown
## Sección 5: 🛠️ Implementación Paso a Paso
```

Dividir en `Paso A`, `Paso B`, etc. Cada paso debe contener:

- ruta completa relativa al repositorio;
- acción crear/modificar/eliminar;
- anchor real para archivos existentes;
- snippet completo con imports correctos;
- explicación breve de decisiones no obvias;
- entregable explícito del paso;
- estrategia Tailwind/tokens cuando haya UI.

Separar la explicación pedagógica del código copiable: desarrollar conceptos, decisiones y contexto antes o después del bloque. Dentro del snippet, conservar únicamente comentarios que cumplan la política de higiene de `quality-gates.md`, de modo que copiar el bloque produzca código apto para producción.

No comprimir componentes, ramas, objetos, `map` ni árboles JSX en una sola línea. Usar clases Tailwind completas y estáticas; para variantes, emplear mapas `Record<T, string>` o configurar safelist.

Para navegación, enseñar matching por segmento —ruta exacta o hija real, no prefijo ambiguo— y exponer el estado activo con `aria-current="page"` además del estilo visual.

Para datos LLM/API/JSONB, mostrar esquema productor, tipo, validador runtime antes de persistir y guard del consumidor. Un contrato obligatorio incompatible debe producir un diagnóstico visible, no una colección vacía que parezca éxito.

Para prompts con cantidades variables, incluir la fórmula que demuestre que el
resultado es posible en todo el rango aceptado y una tabla con caso mínimo,
medio y máximo. No fijar densidades, tamaños o números de sesiones que entren en
conflicto con los límites del body.

Para selección/fallback de modelos, mostrar por separado: autoridad de
provider/modelo inicial, orden allowlisted, errores que permiten avanzar,
errores que detienen, reserva por intento y auditoría por candidato. No llamar
“cascada” a una lista que en runtime solo usa su primer elemento.

Si se modifica un contrato existente, ordenar los pasos así: dominio, prompt/schema, validador de generación, persistencia/API, normalizador/guard del evaluador, serializer, guard del cliente, fixtures y checks.

Si se modifica una configuración (`package.json`, `next.config.*`, Tailwind, `proxy.ts`/`middleware.ts`, `tsconfig.json`), mostrar el contenido completo o un reemplazo inequívoco anclado al archivo actual.

## Sección 6: verificación

Usar exactamente:

```markdown
## Sección 6: ✅ Checkpoints de Verificación
```

Preferir desde la raíz:

```powershell
npx tsc --noEmit --project frontend/tsconfig.json
npm --prefix frontend run build
npm --prefix frontend run dev
```

Mostrar salidas esperadas realistas, incluida cualquier advertencia no bloqueante conocida. Describir exactamente qué debe verse, estados loading/error/empty, interacción, responsive y fecha/zona horaria cuando aplique.

Incluir checklist completa y tabla de edge cases. Para datos estructurados o localStorage, incluir fixtures offline: válido, legacy/mismatch, campo requerido ausente, enum/discriminante inválido y colección vacía. Probar aceptación y rechazo; buscar texto no es una prueba runtime.

Cada checklist cerrada debe indicar fecha, conteo (`X/X`) y evidencia agrupada:
fixtures, TypeScript/build, inspección estructural y pruebas manuales o reales.
No marcar una interacción BYOK/Managed solo por presencia de archivos. En LLM,
una prueba real controlada debe corroborar el evento de uso finalizado.

Cuando Proxy filtre UI y el matcher también alcance APIs, demostrar con una petición runtime que la UI redirige y que la API conserva status y JSON propios. Si un archivo nuevo sigue untracked, recordar que `git diff` y `git diff --check` no lo incluyen: inspeccionarlo y validarlo de forma explícita.

## Sección 7: troubleshooting

Usar exactamente:

```markdown
## Sección 7: 🚨 Troubleshooting — Problemas Comunes
```

Incluir al menos 3–5 problemas en una tabla `Problema | Causa probable | Solución`. Cubrir errores plausibles de Next.js, React, TypeScript, Supabase o el contrato concreto del milestone.

## Sección 8: cierre

Usar exactamente:

```markdown
## Sección 8: 📝 Resumen y Próximo Paso
```

Resumir en lista numerada, indicar cómo solicitar la validación del checkpoint y anticipar el siguiente milestone real. No declarar completada la implementación al generar una guía; usar `Guía generada; implementación pendiente` hasta ejecutar sus verificaciones contra el código.

Si la tarea es una auditoría posterior a la implementación, la Sección 8 debe
indicar el estado realmente alcanzado, deuda no bloqueante y gate siguiente. No
conservar “cómo implementar” o “archivos futuros” como si siguieran pendientes.
