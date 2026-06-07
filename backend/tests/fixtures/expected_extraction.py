"""
Snapshot del JSON esperado para el ExtractorService — ISTQB Study Agent.

Este fixture contiene los valores ESPERADOS de la extracción completa
cuando se procesa el fixture de texto del syllabus ISTQB v4.0.

Propósito:
    1. Detectar regresiones: si alguien cambia el regex del topic detector
       y un tópico deja de detectarse, el test falla inmediatamente.
    2. Documentar el contrato: estos valores definen qué espera el frontend.
    3. Servir de referencia: cualquier desarrollador puede ver exactamente
       qué produce el pipeline completo.

Regeneración:
    Si se cambian intencionalmente los tópicos detectados (ej: nueva versión
    del syllabus), actualiza estos valores manualmente.

Nota:
    Estos valores corresponden al fixture SAMPLE_SYLLABUS_TEXT de
    sample_syllabus_text.py, NO al PDF real completo. El fixture
    contiene fragmentos representativos del syllabus.
"""

# ═══════════════════════════════════════════════════════════════
# VALORES ESPERADOS PARA EL FIXTURE DE TEXTO
# ═══════════════════════════════════════════════════════════════

# Total de tópicos que el detector debe encontrar en el fixture.
# El fixture sample_syllabus_text.py contiene los 64 tópicos del ISTQB CTFL v4.0.1.
EXPECTED_TOTAL_TOPICS: int = 64

# Distribución esperada de niveles K en el fixture.
EXPECTED_K_DISTRIBUTION: dict[str, int] = {
    "K1": 14,
    "K2": 42,
    "K3": 8,
}

# Horas estimadas de estudio calculadas con la fórmula:
# (K1 × 0.5) + (K2 × 1.0) + (K3 × 1.5)
# = (14 × 0.5) + (42 × 1.0) + (8 × 1.5)
# = 7.0 + 42.0 + 12.0 = 61.0
EXPECTED_STUDY_HOURS: float = 61.0

# La detección debe ser completa (>= 90% de los tópicos esperados).
EXPECTED_IS_COMPLETE: bool = True

# ═══════════════════════════════════════════════════════════════
# TÓPICOS CLAVE PARA VERIFICACIÓN PUNTUAL
# ═══════════════════════════════════════════════════════════════
#
# No verificamos TODOS los 64 tópicos en detalle (sería frágil).
# En su lugar, verificamos algunos tópicos clave de cada capítulo
# y de cada nivel K para asegurar que el pipeline funciona end-to-end.

SPOT_CHECK_TOPICS: dict[str, dict] = {
    # Primer tópico del syllabus — debe detectarse siempre
    "FL-1.1.1": {
        "level_k": "K1",
        "name_contains": "Identify",
        "chapter": 1,
        "section": "1.1",
    },
    # Un tópico K2 del capítulo 2
    "FL-2.1.1": {
        "level_k": "K2",
        "name_contains": "Impact",
        "chapter": 2,
        "section": "2.1",
    },
    # Un tópico K3 del capítulo 4 (aplicar)
    "FL-4.2.1": {
        "level_k": "K3",
        "name_contains": "Equivalence",
        "chapter": 4,
        "section": "4.2",
    },
    # Último tópico del syllabus — verifica que el detector
    # procesa hasta el final del documento
    "FL-6.2.1": {
        "level_k": "K1",
        "name_contains": "Risks",
        "chapter": 6,
        "section": "6.2",
    },
}

# ═══════════════════════════════════════════════════════════════
# CÓDIGOS QUE DEBEN EXISTIR COMO CLAVES DEL DICCIONARIO
# ═══════════════════════════════════════════════════════════════
#
# Verificamos que el diccionario de salida contiene EXACTAMENTE
# estos códigos como claves. Si aparece uno nuevo o falta uno,
# el test falla.

EXPECTED_TOPIC_CODES_SET: set[str] = {
    # Capítulo 1 (14 tópicos)
    "FL-1.1.1", "FL-1.1.2",
    "FL-1.2.1", "FL-1.2.2", "FL-1.2.3",
    "FL-1.3.1",
    "FL-1.4.1", "FL-1.4.2", "FL-1.4.3", "FL-1.4.4", "FL-1.4.5",
    "FL-1.5.1", "FL-1.5.2", "FL-1.5.3",
    # Capítulo 2 (10 tópicos)
    "FL-2.1.1", "FL-2.1.2", "FL-2.1.3", "FL-2.1.4", "FL-2.1.5", "FL-2.1.6",
    "FL-2.2.1", "FL-2.2.2", "FL-2.2.3",
    "FL-2.3.1",
    # Capítulo 3 (8 tópicos)
    "FL-3.1.1", "FL-3.1.2", "FL-3.1.3",
    "FL-3.2.1", "FL-3.2.2", "FL-3.2.3", "FL-3.2.4", "FL-3.2.5",
    # Capítulo 4 (14 tópicos)
    "FL-4.1.1",
    "FL-4.2.1", "FL-4.2.2", "FL-4.2.3", "FL-4.2.4",
    "FL-4.3.1", "FL-4.3.2", "FL-4.3.3",
    "FL-4.4.1", "FL-4.4.2", "FL-4.4.3",
    "FL-4.5.1", "FL-4.5.2", "FL-4.5.3",
    # Capítulo 5 (16 tópicos)
    "FL-5.1.1", "FL-5.1.2", "FL-5.1.3", "FL-5.1.4", "FL-5.1.5",
    "FL-5.1.6", "FL-5.1.7",
    "FL-5.2.1", "FL-5.2.2", "FL-5.2.3", "FL-5.2.4",
    "FL-5.3.1", "FL-5.3.2", "FL-5.3.3",
    "FL-5.4.1", "FL-5.5.1",
    # Capítulo 6 (2 tópicos)
    "FL-6.1.1",
    "FL-6.2.1",
}
