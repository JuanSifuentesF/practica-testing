"""
Servicio orquestador de extracción — ISTQB Study Agent.

Este módulo implementa el ExtractorService, que conecta y orquesta
los servicios de extracción de texto (BE-03) y detección de tópicos
(BE-04) para producir un JSON estructurado listo para el frontend.

Arquitectura:
    ExtractorService sigue el patrón Facade:
    - Simplifica una cadena compleja (PDF → Texto → Tópicos → JSON)
      en una sola llamada: full_extraction(pdf_bytes, filename).
    - El router NO necesita conocer los pasos internos.
    - Cada servicio interno (PdfExtractor, TopicDetector) sigue
      siendo independiente y testeable por separado.

    ┌─────────────────────────────────────────────────────┐
    │               ExtractorService                      │
    │                                                     │
    │  pdf_bytes ──→ PdfExtractorService.extract()        │
    │                       │                             │
    │                  full_text                           │
    │                       │                             │
    │               TopicDetectorService.detect()         │
    │                       │                             │
    │              TopicDetectionResult                   │
    │                       │                             │
    │              _build_topics_dict()                   │
    │              _calculate_study_hours()               │
    │                       │                             │
    │              FullExtractionResponse                 │
    └─────────────────────────────────────────────────────┘

Uso:
    from app.services.extractor import ExtractorService

    service = ExtractorService()
    result = service.full_extraction(
        pdf_bytes=b"...",
        filename="syllabus.pdf"
    )
    print(f"Detectados {result.total_topics} tópicos")
    print(f"Horas estimadas: {result.estimated_study_hours}")
"""

import logging
from dataclasses import dataclass

from app.services.pdf_extractor import ExtractionResult, PdfExtractorService
from app.services.topic_detector import (DetectedTopic, TopicDetectionResult,
                                         TopicDetectorService)

# ─── Logger del módulo ───
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# CONSTANTES DE CÁLCULO DE HORAS DE ESTUDIO
# ═══════════════════════════════════════════════════════════════
#
# Estas constantes definen cuántas horas de estudio se estiman
# para cada nivel cognitivo K de la taxonomía de Bloom.
#
# Están basadas en las recomendaciones del ISTQB para preparación
# del examen Foundation Level, ajustadas por experiencia práctica:
#
# K1 (Recordar):   Memorizar definiciones → rápido → 0.5 horas.
# K2 (Comprender):  Entender relaciones  → medio  → 1.0 horas.
# K3 (Aplicar):     Aplicar en escenarios → lento  → 1.5 horas.
#
# Si estos valores se necesitan ajustar en el futuro, solo
# se cambian aquí y todos los cálculos se actualizan.

HOURS_PER_K_LEVEL: dict[str, float] = {
    "K1": 0.5,
    "K2": 1.0,
    "K3": 1.5,
}


@dataclass
class FullExtractionResult:
    """
    Resultado interno del pipeline completo de extracción.

    Dataclass interno — nunca se serializa a JSON directamente.
    Se convierte a FullExtractionResponse (schema Pydantic) en
    el router antes de retornar al cliente.

    Atributos:
        filename: Nombre original del PDF procesado.
        total_pages: Número total de páginas del PDF.
        extraction_method: Método usado para extraer texto.
        topics_dict: Diccionario de tópicos indexado por código FL-x.x.x.
        total_topics: Cantidad de tópicos detectados.
        level_distribution: Diccionario con cuenta por nivel K.
        estimated_study_hours: Horas estimadas de estudio.
        warnings: Lista de advertencias del proceso.
        is_complete: True si se detectaron >= 90% de los tópicos esperados.
    """

    filename: str
    total_pages: int
    extraction_method: str
    topics_dict: dict[str, dict]
    total_topics: int
    level_distribution: dict[str, int]
    estimated_study_hours: float
    warnings: list[str]
    is_complete: bool


class ExtractorService:
    """
    Servicio orquestador del pipeline de extracción completo.

    Conecta PdfExtractorService (BE-03) y TopicDetectorService (BE-04)
    para producir un JSON estructurado listo para el frontend.

    Ejemplo de uso:
        service = ExtractorService()
        result = service.full_extraction(pdf_bytes, "syllabus.pdf")
        print(result.topics_dict["FL-1.1.1"]["name"])
        # → "Identify Typical Test Objectives"
    """

    def __init__(
        self,
        pdf_extractor: PdfExtractorService | None = None,
        topic_detector: TopicDetectorService | None = None,
    ):
        """
        Inicializa el orquestador con sus servicios internos.

        Permite inyectar servicios personalizados (útil para testing).
        Si no se inyectan, se crean instancias por defecto.

        Args:
            pdf_extractor: Servicio de extracción de texto de PDFs.
                Si es None, se crea una instancia de PdfExtractorService.
            topic_detector: Servicio de detección de tópicos.
                Si es None, se crea una instancia de TopicDetectorService.
        """
        self._pdf_extractor = pdf_extractor or PdfExtractorService()
        self._topic_detector = topic_detector or TopicDetectorService()

        logger.info("ExtractorService inicializado con sus servicios internos")

    def full_extraction(
        self,
        pdf_bytes: bytes,
        filename: str,
    ) -> FullExtractionResult:
        """
        Ejecuta el pipeline completo de extracción y análisis.

        Pipeline:
        1. Extraer texto del PDF (PdfExtractorService).
        2. Detectar tópicos FL-x.x.x (TopicDetectorService).
        3. Transformar tópicos a diccionario indexado por código.
        4. Calcular horas estimadas de estudio.
        5. Construir resultado con todos los datos.

        Args:
            pdf_bytes: Bytes crudos del archivo PDF.
            filename: Nombre original del archivo PDF.

        Returns:
            FullExtractionResult con el JSON estructurado completo.

        Raises:
            PdfExtractionError: Si no se puede extraer texto del PDF.
            TopicDetectionError: Si la detección de tópicos falla
                catastróficamente (distinto de "pocos tópicos", que
                es un warning).
        """
        logger.info(
            "Iniciando extracción completa de '%s' (%d bytes)",
            filename,
            len(pdf_bytes),
        )

        # ─── Paso 1: Extraer texto del PDF ───
        # Delega a PdfExtractorService (BE-03).
        # Si falla, la excepción PdfExtractionError sube al router.
        extraction_result: ExtractionResult = self._pdf_extractor.extract(
            pdf_bytes=pdf_bytes,
            filename=filename,
        )
        logger.info(
            "Texto extraído: %d páginas, %d caracteres, método: %s",
            extraction_result.total_pages,
            extraction_result.text_length,
            extraction_result.extraction_method,
        )

        # ─── Paso 2: Detectar tópicos ───
        # Delega a TopicDetectorService (BE-04).
        # Usa el full_text del paso anterior como input.
        detection_result: TopicDetectionResult = self._topic_detector.detect(
            full_text=extraction_result.full_text,
        )
        logger.info(
            "Tópicos detectados: %d (completo: %s)",
            detection_result.total_topics,
            detection_result.is_complete,
        )

        # ─── Paso 3: Transformar a diccionario ───
        # Convierte la lista de DetectedTopic a un diccionario
        # indexado por código FL-x.x.x.
        topics_dict = self._build_topics_dict(detection_result.topics)

        # ─── Paso 4: Calcular horas estimadas ───
        estimated_hours = self._calculate_study_hours(
            detection_result.level_distribution
        )
        logger.info("Horas estimadas de estudio: %.1f", estimated_hours)

        # ─── Paso 5: Construir resultado ───
        result = FullExtractionResult(
            filename=extraction_result.filename,
            total_pages=extraction_result.total_pages,
            extraction_method=extraction_result.extraction_method,
            topics_dict=topics_dict,
            total_topics=detection_result.total_topics,
            level_distribution=detection_result.level_distribution,
            estimated_study_hours=estimated_hours,
            warnings=detection_result.warnings,
            is_complete=detection_result.is_complete,
        )

        logger.info(
            "Extracción completa finalizada: %d tópicos, %.1f horas, "
            "%d warnings",
            result.total_topics,
            result.estimated_study_hours,
            len(result.warnings),
        )

        return result

    # ═══════════════════════════════════════════════════════════
    # MÉTODOS AUXILIARES
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def _build_topics_dict(
        topics: list[DetectedTopic],
    ) -> dict[str, dict]:
        """
        Transforma una lista de DetectedTopic a un diccionario
        indexado por código FL-x.x.x.

        La transformación es directa:
            Input:  [DetectedTopic(code="FL-1.1.1", level_k="K1", ...), ...]
            Output: {"FL-1.1.1": {"level_k": "K1", "name": "...", ...}, ...}

        ¿Por qué un diccionario y no la lista directamente?
        → Acceso O(1) por código en el frontend.
        → JavaScript: topics["FL-1.1.1"] vs topics.find(...)
        → Más idiomático para recursos indexados en APIs REST.

        Args:
            topics: Lista de tópicos detectados por TopicDetectorService.

        Returns:
            Diccionario donde cada clave es un código FL-x.x.x y
            cada valor es un dict con level_k, name, text, chapter, section.
        """
        topics_dict: dict[str, dict] = {}

        for topic in topics:
            topics_dict[topic.code] = {
                "level_k": topic.level_k,
                "name": topic.name,
                "text": topic.text,
                "chapter": topic.chapter,
                "section": topic.section,
            }

        logger.debug(
            "Diccionario de tópicos construido: %d entradas",
            len(topics_dict),
        )

        return topics_dict

    @staticmethod
    def _calculate_study_hours(
        level_distribution: dict[str, int],
    ) -> float:
        """
        Calcula las horas estimadas de estudio basándose en la
        distribución de niveles K.

        Fórmula:
            estimated_hours = (K1 × 0.5) + (K2 × 1.0) + (K3 × 1.5)

        Ejemplo con ISTQB CTFL v4.0.1 (K1=14, K2=42, K3=8):
            (14 × 0.5) + (42 × 1.0) + (8 × 1.5)
            = 7.0 + 42.0 + 12.0
            = 61.0 horas

        Nota: este cálculo es una ESTIMACIÓN. El servicio de
        generación de plan (UP-04) podrá ajustar estos valores
        según las preferencias del usuario.

        Args:
            level_distribution: Diccionario con la cuenta por nivel K.
                Ejemplo: {"K1": 14, "K2": 42, "K3": 8}

        Returns:
            Horas estimadas de estudio, redondeadas a 1 decimal.
        """
        total_hours = 0.0

        for level, count in level_distribution.items():
            hours_per_topic = HOURS_PER_K_LEVEL.get(level, 1.0)
            total_hours += count * hours_per_topic

            logger.debug(
                "  %s: %d tópicos × %.1f h = %.1f h",
                level,
                count,
                hours_per_topic,
                count * hours_per_topic,
            )

        # Redondear a 1 decimal para evitar artefactos de punto flotante.
        # Ejemplo: 61.00000000000001 → 61.0
        return round(total_hours, 1)
