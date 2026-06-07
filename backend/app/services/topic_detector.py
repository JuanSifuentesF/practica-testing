"""
Servicio de detección de tópicos ISTQB — ISTQB Study Agent.

Este módulo implementa el algoritmo de detección de objetivos de
aprendizaje (Learning Objectives) del syllabus ISTQB Foundation Level.

Funcionalidad principal:
    1. Recibe texto crudo extraído de un PDF del syllabus.
    2. Usa expresiones regulares para encontrar patrones FL-x.x.x.
    3. Identifica el nivel cognitivo K (K1, K2, K3) de cada tópico.
    4. Extrae el nombre y texto asociado a cada tópico.
    5. Valida la completitud de la detección.
    6. Retorna una lista estructurada de tópicos con metadatos.

Arquitectura:
    Este servicio es INDEPENDIENTE de FastAPI — no conoce HTTP, routers
    ni requests. Solo recibe texto y retorna datos estructurados.
    Esto permite:
    1. Testearlo con fixtures sin levantar un servidor HTTP.
    2. Ejecutarlo como script independiente para debugging.
    3. Cambiarlo sin afectar la capa HTTP.

Patrón de diseño: Pipeline (secuencia de transformaciones)
    normalizar → encontrar → extraer_k → extraer_nombre → delimitar_texto
    → deduplicar → validar → construir_resultado

Uso:
    from app.services.topic_detector import TopicDetectorService

    service = TopicDetectorService()
    result = service.detect(full_text="...")
    print(f"Detectados {result.total_topics} tópicos")
"""

import logging
import re
from dataclasses import dataclass, field

# ─── Logger del módulo ───
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE TÓPICOS ESPERADOS
# ═══════════════════════════════════════════════════════════════
#
# Lista canónica de todos los códigos FL-x.x.x del ISTQB CTFL v4.0.
# Se usa para validar la completitud de la detección.
#
# Si ISTQB publica una nueva versión del syllabus con tópicos
# diferentes, SOLO necesitas actualizar esta lista.

EXPECTED_TOPICS_V4: list[str] = [
    # Capítulo 1: Fundamentals of Testing (12 tópicos)
    "FL-1.1.1", "FL-1.1.2",
    "FL-1.2.1", "FL-1.2.2",
    "FL-1.3.1",
    "FL-1.4.1", "FL-1.4.2", "FL-1.4.3", "FL-1.4.4", "FL-1.4.5",
    "FL-1.5.1", "FL-1.5.2",
    # Capítulo 2: Testing Throughout the SDLC (10 tópicos)
    "FL-2.1.1", "FL-2.1.2", "FL-2.1.3", "FL-2.1.4", "FL-2.1.5", "FL-2.1.6",
    "FL-2.2.1", "FL-2.2.2", "FL-2.2.3",
    "FL-2.3.1",
    # Capítulo 3: Static Testing (8 tópicos)
    "FL-3.1.1", "FL-3.1.2", "FL-3.1.3",
    "FL-3.2.1", "FL-3.2.2", "FL-3.2.3", "FL-3.2.4", "FL-3.2.5",
    # Capítulo 4: Test Analysis and Design (10 tópicos)
    "FL-4.1.1",
    "FL-4.2.1", "FL-4.2.2", "FL-4.2.3", "FL-4.2.4",
    "FL-4.3.1", "FL-4.3.2", "FL-4.3.3",
    "FL-4.4.1", "FL-4.4.2", "FL-4.4.3",
    # Capítulo 5: Managing the Test Activities (17 tópicos)
    "FL-5.1.1", "FL-5.1.2", "FL-5.1.3", "FL-5.1.4", "FL-5.1.5",
    "FL-5.1.6", "FL-5.1.7",
    "FL-5.2.1", "FL-5.2.2", "FL-5.2.3", "FL-5.2.4",
    "FL-5.3.1", "FL-5.3.2", "FL-5.3.3",
    "FL-5.4.1",
    # Capítulo 6: Test Tools (2 tópicos)
    "FL-6.1.1",
    "FL-6.2.1",
]

# Umbral para considerar la detección como "completa".
# 90% de 59 tópicos = 53.1, redondeamos a 53.
COMPLETENESS_THRESHOLD = 0.90


# ═══════════════════════════════════════════════════════════════
# PATRONES REGEX
# ═══════════════════════════════════════════════════════════════
#
# Estos patrones capturan las variaciones de formato que pueden
# aparecer en el texto extraído del PDF, incluyendo:
#   - FL-1.1.1 (K1) Nombre del tópico
#   - FL-1.1.1(K1) Nombre del tópico  (sin espacio)
#   - FL-1.1.1 K1 Nombre del tópico   (sin paréntesis)

# Patrón principal: captura FL-x.x.x, nivel K, y nombre del tópico.
# Grupo 1: código FL-x.x.x
# Grupo 2: nivel K (K1, K2 o K3)
# Grupo 3: nombre del tópico (hasta fin de línea)
TOPIC_HEADER_PATTERN = re.compile(
    r"(FL-\d+\.\d+\.\d+)"   # Grupo 1: código del tópico
    r"\s*"                    # Espacios opcionales
    r"\(?(K[123])\)?"         # Grupo 2: nivel K, paréntesis opcionales
    r"\s+"                    # Al menos un espacio
    r"(.+?)$",                # Grupo 3: nombre del tópico (hasta fin de línea)
    re.MULTILINE,             # ^ y $ matchean inicio/fin de cada línea
)

# Patrón para encontrar solo los códigos FL-x.x.x (sin K ni nombre).
# Se usa para delimitar el texto de cada tópico.
TOPIC_CODE_PATTERN = re.compile(
    r"FL-\d+\.\d+\.\d+",
)


@dataclass
class DetectedTopic:
    """
    Resultado interno de un tópico detectado.

    Dataclass interno del servicio — nunca se serializa a JSON.
    Se convierte a DetectedTopicSchema cuando se retorna al router.

    Atributos:
        code: Código FL-x.x.x del tópico.
        level_k: Nivel K (K1, K2 o K3).
        name: Nombre del objetivo de aprendizaje.
        text: Texto completo del syllabus para este tópico.
        chapter: Número de capítulo (1-6).
        section: Sección del syllabus (ej: "1.1", "2.3").
        start_pos: Posición en el texto donde empieza este tópico.
    """

    code: str
    level_k: str
    name: str
    text: str
    chapter: int
    section: str
    start_pos: int = 0


@dataclass
class TopicDetectionResult:
    """
    Resultado completo de la detección de tópicos.

    Dataclass interno del servicio. Se convierte a
    TopicDetectionResponse (schema Pydantic) en el router o
    en el servicio que lo consuma.

    Atributos:
        topics: Lista de tópicos detectados, ordenados por código.
        total_topics: Número total de tópicos detectados.
        level_distribution: Diccionario con la cuenta por nivel K.
        warnings: Lista de advertencias (tópicos faltantes, etc.).
        is_complete: True si se detectó >= 90% de los tópicos esperados.
    """

    topics: list[DetectedTopic] = field(default_factory=list)
    total_topics: int = 0
    level_distribution: dict[str, int] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    is_complete: bool = False


class TopicDetectorService:
    """
    Servicio de detección de tópicos del syllabus ISTQB.

    Implementa un pipeline de análisis de texto que:
    1. Normaliza el texto de entrada.
    2. Encuentra encabezados FL-x.x.x con regex.
    3. Extrae el nivel K y nombre de cada tópico.
    4. Delimita el texto del syllabus para cada tópico.
    5. Deduplica y valida los resultados.

    Ejemplo de uso:
        service = TopicDetectorService()
        result = service.detect(full_text)
        for topic in result.topics:
            print(f"{topic.code} ({topic.level_k}): {topic.name}")
    """

    def __init__(
        self,
        expected_topics: list[str] | None = None,
        completeness_threshold: float = COMPLETENESS_THRESHOLD,
    ):
        """
        Inicializa el servicio con la configuración de validación.

        Args:
            expected_topics: Lista de códigos FL-x.x.x esperados.
                Si es None, usa la lista predefinida del ISTQB v4.0.
                Permite usar listas diferentes para otras versiones.
            completeness_threshold: Porcentaje mínimo de tópicos que
                deben detectarse para considerar la detección completa.
                Default: 0.90 (90%).
        """
        self._expected_topics = expected_topics or EXPECTED_TOPICS_V4
        self._completeness_threshold = completeness_threshold
        logger.info(
            "TopicDetectorService inicializado: %d tópicos esperados, "
            "umbral de completitud: %.0f%%",
            len(self._expected_topics),
            self._completeness_threshold * 100,
        )

    def detect(self, full_text: str) -> TopicDetectionResult:
        """
        Detecta todos los tópicos FL-x.x.x en el texto del syllabus.

        Pipeline:
        1. Normalizar texto (limpiar whitespace, unificar saltos de línea).
        2. Encontrar encabezados FL-x.x.x con regex.
        3. Delimitar el texto de cada tópico.
        4. Deduplicar (quedarse con la primera aparición).
        5. Validar completitud contra la lista esperada.
        6. Construir resultado con estadísticas.

        Args:
            full_text: Texto completo extraído del PDF por
                PdfExtractorService. Puede tener ~200K caracteres.

        Returns:
            TopicDetectionResult con todos los tópicos detectados,
            estadísticas y warnings.
        """
        logger.info(
            "Iniciando detección de tópicos en texto de %d caracteres",
            len(full_text),
        )

        warnings: list[str] = []

        # ─── Paso 1: Normalizar texto ───
        normalized_text = self._normalize_text(full_text)
        logger.debug(
            "Texto normalizado: %d caracteres (original: %d)",
            len(normalized_text),
            len(full_text),
        )

        # ─── Paso 2: Encontrar encabezados FL-x.x.x ───
        raw_topics = self._find_topic_headers(normalized_text)
        logger.info("Encontrados %d encabezados FL-x.x.x", len(raw_topics))

        if not raw_topics:
            warnings.append(
                "No se encontró ningún tópico FL-x.x.x en el texto. "
                "Verifica que el PDF es un syllabus ISTQB válido."
            )
            return TopicDetectionResult(
                topics=[],
                total_topics=0,
                level_distribution={"K1": 0, "K2": 0, "K3": 0},
                warnings=warnings,
                is_complete=False,
            )

        # ─── Paso 3: Delimitar texto de cada tópico ───
        topics_with_text = self._extract_topic_texts(
            raw_topics, normalized_text
        )

        # ─── Paso 4: Deduplicar ───
        unique_topics = self._deduplicate_topics(topics_with_text)
        logger.info(
            "Tópicos únicos después de deduplicación: %d (de %d originales)",
            len(unique_topics),
            len(topics_with_text),
        )

        if len(topics_with_text) > len(unique_topics):
            duplicates_count = len(topics_with_text) - len(unique_topics)
            warnings.append(
                f"Se encontraron {duplicates_count} apariciones duplicadas "
                "de tópicos. Se mantuvo solo la primera aparición de cada uno."
            )

        # ─── Paso 5: Ordenar por código ───
        sorted_topics = sorted(unique_topics, key=lambda t: t.code)

        # ─── Paso 6: Calcular distribución de niveles K ───
        level_distribution = self._calculate_k_distribution(sorted_topics)

        # ─── Paso 7: Validar completitud ───
        is_complete, validation_warnings = self._validate_completeness(
            sorted_topics
        )
        warnings.extend(validation_warnings)

        # ─── Paso 8: Construir resultado ───
        result = TopicDetectionResult(
            topics=sorted_topics,
            total_topics=len(sorted_topics),
            level_distribution=level_distribution,
            warnings=warnings,
            is_complete=is_complete,
        )

        logger.info(
            "Detección completada: %d tópicos, K1=%d, K2=%d, K3=%d, "
            "completo=%s, warnings=%d",
            result.total_topics,
            level_distribution.get("K1", 0),
            level_distribution.get("K2", 0),
            level_distribution.get("K3", 0),
            result.is_complete,
            len(result.warnings),
        )

        return result

    # ═══════════════════════════════════════════════════════════
    # MÉTODOS PRIVADOS DEL PIPELINE
    # ═══════════════════════════════════════════════════════════

    def _normalize_text(self, text: str) -> str:
        """
        Normaliza el texto para facilitar la detección con regex.

        Operaciones:
        1. Reemplaza \\r\\n con \\n (unificar saltos de línea Windows/Unix).
        2. Reemplaza múltiples espacios con un solo espacio.
        3. Elimina líneas vacías consecutivas (máximo 2 saltos seguidos).
        4. Elimina espacios al inicio y final del texto.

        Args:
            text: Texto crudo del PDF.

        Returns:
            Texto normalizado y limpio.
        """
        # Unificar saltos de línea (Windows \\r\\n → Unix \\n)
        text = text.replace("\r\n", "\n")

        # Reemplazar múltiples espacios en la misma línea con uno solo.
        # ¡CUIDADO! No reemplazar \\n, solo espacios horizontales.
        text = re.sub(r"[^\S\n]+", " ", text)

        # Reducir múltiples líneas vacías a máximo 2 saltos de línea.
        text = re.sub(r"\n{3,}", "\n\n", text)

        # Eliminar espacios al inicio/final de cada línea.
        lines = text.split("\n")
        text = "\n".join(line.strip() for line in lines)

        return text.strip()

    def _find_topic_headers(self, text: str) -> list[DetectedTopic]:
        """
        Encuentra todos los encabezados FL-x.x.x en el texto.

        Usa el patrón TOPIC_HEADER_PATTERN para capturar:
        - Grupo 1: código FL-x.x.x
        - Grupo 2: nivel K
        - Grupo 3: nombre del tópico

        Args:
            text: Texto normalizado.

        Returns:
            Lista de DetectedTopic con code, level_k, name y start_pos.
            El campo text se llena posteriormente en _extract_topic_texts.
        """
        topics: list[DetectedTopic] = []

        for match in TOPIC_HEADER_PATTERN.finditer(text):
            code = match.group(1).strip()
            level_k = match.group(2).strip()
            name = match.group(3).strip()

            # Extraer capítulo y sección del código.
            # FL-1.2.3 → capítulo=1, sección="1.2"
            parts = code.replace("FL-", "").split(".")
            chapter = int(parts[0])
            section = f"{parts[0]}.{parts[1]}"

            topic = DetectedTopic(
                code=code,
                level_k=level_k,
                name=name,
                text="",  # Se llena en _extract_topic_texts
                chapter=chapter,
                section=section,
                start_pos=match.start(),
            )

            topics.append(topic)
            logger.debug(
                "Encontrado: %s (%s) — %s (pos: %d)",
                code,
                level_k,
                name[:50],
                match.start(),
            )

        return topics

    def _extract_topic_texts(
        self,
        topics: list[DetectedTopic],
        full_text: str,
    ) -> list[DetectedTopic]:
        """
        Delimita y extrae el texto del syllabus para cada tópico.

        Estrategia:
        El texto de un tópico empieza en su encabezado FL-x.x.x y
        termina donde empieza el SIGUIENTE tópico FL-x.x.x (o donde
        termina el texto completo para el último tópico).

        Ejemplo visual:
            FL-1.1.1 (K1) Identify Typical Test Objectives
            Testing has different objectives...        ← texto de FL-1.1.1
            The test objectives should be clearly...   ← texto de FL-1.1.1
            FL-1.1.2 (K2) Differentiate Testing...     ← aquí empieza FL-1.1.2
            Testing can trigger failures...             ← texto de FL-1.1.2

        Args:
            topics: Lista de tópicos con start_pos pero sin texto.
            full_text: Texto completo normalizado.

        Returns:
            Lista de tópicos con el campo text lleno.
        """
        result: list[DetectedTopic] = []

        for i, topic in enumerate(topics):
            # El texto empieza en la posición del encabezado FL-x.x.x
            start = topic.start_pos

            # El texto termina donde empieza el siguiente tópico
            # (o al final del documento si es el último tópico).
            if i + 1 < len(topics):
                end = topics[i + 1].start_pos
            else:
                end = len(full_text)

            # Extraer el bloque de texto para este tópico.
            raw_text = full_text[start:end].strip()

            # Remover el encabezado del tópico del texto para dejar
            # solo el contenido. El encabezado ya está capturado en
            # code, level_k y name.
            # Buscamos la primera línea (que contiene FL-x.x.x) y la quitamos.
            lines = raw_text.split("\n")
            if lines:
                # Quitar la primera línea (encabezado FL-x.x.x ...)
                content_lines = lines[1:]
                text = "\n".join(content_lines).strip()
            else:
                text = ""

            # Si el texto quedó vacío, dejar al menos el encabezado completo.
            if not text:
                text = raw_text

            topic_with_text = DetectedTopic(
                code=topic.code,
                level_k=topic.level_k,
                name=topic.name,
                text=text,
                chapter=topic.chapter,
                section=topic.section,
                start_pos=topic.start_pos,
            )

            result.append(topic_with_text)

            logger.debug(
                "Texto extraído para %s: %d caracteres",
                topic.code,
                len(text),
            )

        return result

    def _deduplicate_topics(
        self, topics: list[DetectedTopic]
    ) -> list[DetectedTopic]:
        """
        Elimina apariciones duplicadas de tópicos.

        En el syllabus ISTQB, cada código FL-x.x.x puede aparecer
        en múltiples lugares:
        1. En la tabla de contenidos.
        2. En la tabla de objetivos de aprendizaje.
        3. En el cuerpo del capítulo (la aparición "real").

        Estrategia: mantener la aparición con el texto MÁS LARGO,
        ya que esa es probablemente la del cuerpo del capítulo.

        Args:
            topics: Lista de tópicos (puede tener duplicados).

        Returns:
            Lista de tópicos sin duplicados.
        """
        seen: dict[str, DetectedTopic] = {}

        for topic in topics:
            if topic.code not in seen:
                # Primera aparición — guardarla.
                seen[topic.code] = topic
            else:
                # Aparición duplicada — quedarnos con el texto más largo.
                existing = seen[topic.code]
                if len(topic.text) > len(existing.text):
                    logger.debug(
                        "Reemplazando duplicado de %s: texto anterior=%d chars, "
                        "nuevo=%d chars",
                        topic.code,
                        len(existing.text),
                        len(topic.text),
                    )
                    seen[topic.code] = topic

        return list(seen.values())

    def _calculate_k_distribution(
        self, topics: list[DetectedTopic]
    ) -> dict[str, int]:
        """
        Cuenta la cantidad de tópicos por cada nivel K.

        Args:
            topics: Lista de tópicos detectados.

        Returns:
            Diccionario con claves K1, K2, K3 y sus respectivas cantidades.
        """
        distribution: dict[str, int] = {"K1": 0, "K2": 0, "K3": 0}

        for topic in topics:
            if topic.level_k in distribution:
                distribution[topic.level_k] += 1
            else:
                logger.warning(
                    "Nivel K desconocido '%s' en tópico %s",
                    topic.level_k,
                    topic.code,
                )

        return distribution

    def _validate_completeness(
        self, topics: list[DetectedTopic]
    ) -> tuple[bool, list[str]]:
        """
        Valida que se detectaron suficientes tópicos.

        Compara los tópicos detectados contra la lista esperada
        para la versión del syllabus. Genera warnings específicos
        para cada tópico faltante.

        Args:
            topics: Lista de tópicos detectados (ya deduplicados).

        Returns:
            Tupla de (is_complete, warnings):
            - is_complete: True si se detectó >= umbral de los esperados.
            - warnings: Lista de advertencias sobre tópicos faltantes.
        """
        warnings: list[str] = []
        detected_codes = {topic.code for topic in topics}
        expected_codes = set(self._expected_topics)

        # Tópicos esperados que NO se detectaron
        missing = expected_codes - detected_codes
        if missing:
            # Ordenar para que los warnings sean determinísticos
            sorted_missing = sorted(missing)
            warnings.append(
                f"Tópicos esperados no detectados ({len(missing)} de "
                f"{len(expected_codes)}): {', '.join(sorted_missing)}"
            )
            logger.warning(
                "Tópicos faltantes: %s",
                ", ".join(sorted_missing),
            )

        # Tópicos detectados que NO están en la lista esperada
        unexpected = detected_codes - expected_codes
        if unexpected:
            sorted_unexpected = sorted(unexpected)
            warnings.append(
                f"Tópicos detectados que no están en la lista esperada "
                f"(posible versión diferente del syllabus): "
                f"{', '.join(sorted_unexpected)}"
            )
            logger.info(
                "Tópicos inesperados (no en la lista v4.0): %s",
                ", ".join(sorted_unexpected),
            )

        # Calcular completitud
        if len(expected_codes) == 0:
            is_complete = len(detected_codes) > 0
        else:
            completeness_ratio = len(
                detected_codes & expected_codes
            ) / len(expected_codes)
            is_complete = completeness_ratio >= self._completeness_threshold

            logger.info(
                "Completitud: %.1f%% (%d/%d), umbral: %.0f%%, completo: %s",
                completeness_ratio * 100,
                len(detected_codes & expected_codes),
                len(expected_codes),
                self._completeness_threshold * 100,
                is_complete,
            )

        return is_complete, warnings


class TopicDetectionError(Exception):
    """
    Excepción personalizada para errores de detección de tópicos.

    Se usa cuando ocurre un error irrecuperable durante la detección
    (no simplemente "se encontraron pocos tópicos", que es un warning).

    Atributos:
        message: Descripción del error.
        error_code: Código programático para el frontend.
    """

    def __init__(
        self, message: str, error_code: str = "TOPIC_DETECTION_FAILED"
    ):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)