"""
Schemas Pydantic del backend — ISTQB Study Agent.

Define los modelos de request (entrada) y response (salida) para
todos los endpoints de la API. Los schemas sirven como:

1. VALIDADORES: rechazan automáticamente datos con tipos incorrectos.
2. SERIALIZADORES: convierten objetos Python a JSON y viceversa.
3. DOCUMENTACIÓN: FastAPI los usa para generar el schema OpenAPI
   visible en Swagger UI (/docs) y ReDoc (/redoc).

Convención de nombres:
  - *Request  → datos que el cliente envía al servidor
  - *Response → datos que el servidor retorna al cliente

Ejemplo: HealthResponse es lo que retorna GET /health.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ═══════════════════════════════════════════════════════════════
# SCHEMAS DE HEALTH CHECK
# ═══════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    """
    Modelo de respuesta del endpoint GET /health.

    Campos:
        status: Estado del servicio ("ok" si está funcionando).
        version: Versión actual del API (semver).

    Ejemplo de respuesta:
        {
            "status": "ok",
            "version": "0.1.0"
        }
    """

    status: str = Field(
        default="ok",
        description="Estado del servicio. 'ok' indica que el backend está operativo.",
        examples=["ok"],
    )

    version: str = Field(
        default="0.1.0",
        description="Versión semántica del API (major.minor.patch).",
        examples=["0.1.0"],
    )


# ═══════════════════════════════════════════════════════════════
# SCHEMAS DE EXTRACCIÓN DE PDF (BE-03)
# ═══════════════════════════════════════════════════════════════


class PageContent(BaseModel):
    """
    Modelo que representa el contenido extraído de UNA página del PDF.

    ¿Por qué separar por páginas?
    1. Permite al cliente saber exactamente de qué página viene cada texto.
    2. Facilita el debugging cuando un tópico no se detecta correctamente.
    3. En guías futuras (BE-04), el topic_detector usará los números de
       página para mapear tópicos FL-x.x.x a su ubicación en el syllabus.

    Ejemplo:
        {
            "page_number": 1,
            "text": "ISTQB Certified Tester Foundation Level..."
        }
    """

    page_number: int = Field(
        ...,
        ge=1,
        description="Número de página (1-indexed). La primera página es 1.",
        examples=[1],
    )

    text: str = Field(
        ...,
        min_length=0,
        description=(
            "Texto extraído de esta página. Puede estar vacío si la página "
            "solo contiene imágenes o diagramas sin texto seleccionable."
        ),
        examples=["ISTQB® Certified Tester Foundation Level Syllabus v4.0..."],
    )


class PdfExtractResponse(BaseModel):
    """
    Modelo de respuesta del endpoint POST /extract-pdf.

    Este schema define el contrato de salida que el frontend (Next.js)
    consumirá en la guía UP-03. Al definirlo con Pydantic, garantizamos
    que la respuesta siempre tiene la misma estructura — sin importar
    qué PDF se procese.

    Ejemplo de respuesta:
        {
            "filename": "ISTQB_CTFL_v4.0.pdf",
            "total_pages": 135,
            "extraction_method": "pdfplumber",
            "full_text": "ISTQB® Certified Tester Foundation Level...",
            "pages": [
                {"page_number": 1, "text": "..."},
                {"page_number": 2, "text": "..."}
            ],
            "text_length": 250000
        }
    """

    filename: str = Field(
        ...,
        description="Nombre original del archivo PDF subido por el usuario.",
        examples=["ISTQB_CTFL_v4.0.pdf"],
    )

    total_pages: int = Field(
        ...,
        ge=1,
        description="Número total de páginas del PDF.",
        examples=[135],
    )

    extraction_method: str = Field(
        ...,
        description=(
            "Método utilizado para la extracción. 'pdfplumber' si la "
            "extracción principal fue exitosa, 'pymupdf' si se usó el "
            "fallback con PyMuPDF/fitz."
        ),
        examples=["pdfplumber"],
    )

    full_text: str = Field(
        ...,
        min_length=1,
        description=(
            "Texto completo extraído del PDF, concatenando todas las páginas. "
            "Las páginas están separadas por doble salto de línea (\\n\\n). "
            "Este campo será consumido por el topic_detector en BE-04."
        ),
    )

    pages: list[PageContent] = Field(
        ...,
        description=(
            "Lista de objetos PageContent con el texto extraído de cada "
            "página individual. Permite inspeccionar el contenido por página."
        ),
    )

    text_length: int = Field(
        ...,
        ge=0,
        description=(
            "Longitud total del texto extraído en caracteres. Sirve como "
            "indicador rápido de calidad: el syllabus ISTQB CTFL v4.0.1 debería "
            "tener aproximadamente 200,000-300,000 caracteres."
        ),
        examples=[250000],
    )


class ErrorResponse(BaseModel):
    """
    Modelo estándar para respuestas de error.

    Todos los endpoints usan este schema cuando retornan un error HTTP
    (400, 422, 500). Esto garantiza que el frontend siempre recibe
    errores con la misma estructura, facilitando el manejo uniforme
    de errores en el cliente.

    Ejemplo de respuesta de error:
        {
            "detail": "El archivo subido no es un PDF válido.",
            "error_code": "INVALID_FILE_TYPE"
        }
    """

    model_config = ConfigDict(extra="forbid")

    detail: str = Field(
        ...,
        min_length=1,
        description="Mensaje descriptivo del error en lenguaje humano.",
        examples=["El archivo subido no es un PDF válido."],
    )

    error_code: str = Field(
        ...,
        min_length=1,
        pattern=r"^[A-Z][A-Z0-9_]*$",
        description=(
            "Código de error programático para el frontend. Permite al "
            "cliente mostrar mensajes de error específicos sin parsear "
            "el texto del mensaje."
        ),
        examples=["INVALID_FILE_TYPE"],
    )
    
    # ═══════════════════════════════════════════════════════════════
# SCHEMAS DE DETECCIÓN DE TÓPICOS (BE-04)
# ═══════════════════════════════════════════════════════════════


class DetectedTopicSchema(BaseModel):
    """
    Modelo que representa UN tópico detectado del syllabus ISTQB.

    Cada tópico tiene un código único (FL-x.x.x), un nivel cognitivo K
    (K1, K2 o K3), un nombre descriptivo, y el texto del syllabus que
    le corresponde.

    Ejemplo:
        {
            "code": "FL-1.1.1",
            "level_k": "K1",
            "name": "Identify Typical Test Objectives",
            "text": "Testing has different objectives depending on...",
            "chapter": 1,
            "section": "1.1"
        }
    """

    code: str = Field(
        ...,
        pattern=r"^FL-\d+\.\d+\.\d+$",
        description=(
            "Código único del tópico en formato FL-x.x.x. "
            "Ejemplo: FL-1.1.1, FL-2.3.1, FL-4.2.4."
        ),
        examples=["FL-1.1.1"],
    )

    level_k: str = Field(
        ...,
        pattern=r"^K[123]$",
        description=(
            "Nivel cognitivo del tópico según la taxonomía de Bloom: "
            "K1 (recordar), K2 (comprender), K3 (aplicar)."
        ),
        examples=["K1"],
    )

    name: str = Field(
        ...,
        min_length=3,
        description=(
            "Nombre del objetivo de aprendizaje tal como aparece en "
            "el syllabus. Ejemplo: 'Identify Typical Test Objectives'."
        ),
        examples=["Identify Typical Test Objectives"],
    )

    text: str = Field(
        ...,
        min_length=1,
        description=(
            "Texto autoritativo de la subsección x.y.z del cuerpo del "
            "syllabus asociada al objetivo FL-x.y.z."
        ),
    )

    chapter: int = Field(
        ...,
        ge=1,
        le=6,
        description=(
            "Número de capítulo del syllabus al que pertenece este tópico "
            "(1-6). Se extrae del primer dígito del código FL-x.x.x."
        ),
        examples=[1],
    )

    section: str = Field(
        ...,
        description=(
            "Sección del syllabus (ej: '1.1', '2.3', '4.2'). "
            "Se extrae de los dos primeros números del código FL-x.x.x."
        ),
        examples=["1.1"],
    )


class KLevelDistribution(BaseModel):
    """
    Distribución de tópicos por nivel K.

    Permite al frontend mostrar estadísticas del syllabus y al
    servicio de generación de plan (UP-04) calcular las horas
    estimadas de estudio.

    Ejemplo:
        {
            "K1": 15,
            "K2": 38,
            "K3": 6
        }
    """

    K1: int = Field(
        default=0,
        ge=0,
        description="Cantidad de tópicos con nivel K1 (recordar).",
    )

    K2: int = Field(
        default=0,
        ge=0,
        description="Cantidad de tópicos con nivel K2 (comprender).",
    )

    K3: int = Field(
        default=0,
        ge=0,
        description="Cantidad de tópicos con nivel K3 (aplicar).",
    )


class TopicDetectionResponse(BaseModel):
    """
    Respuesta completa del algoritmo de detección de tópicos.

    Incluye todos los tópicos detectados, estadísticas de distribución,
    y warnings si la detección fue incompleta.

    Este schema será consumido por:
    1. ExtractorService (BE-05) para construir el JSON final.
    2. Next.js (UP-03) para validar que la extracción fue exitosa.
    3. El servicio de generación de plan (UP-04) para asignar tópicos
       a sesiones de estudio.

    Ejemplo:
        {
            "topics": [...],
            "total_topics": 40,
            "level_distribution": {"K1": 12, "K2": 20, "K3": 8},
            "warnings": [],
            "is_complete": true
        }
    """

    topics: list[DetectedTopicSchema] = Field(
        ...,
        description="Lista de todos los tópicos detectados en el syllabus.",
    )

    total_topics: int = Field(
        ...,
        ge=0,
        description="Número total de tópicos detectados.",
        examples=[40],
    )

    level_distribution: KLevelDistribution = Field(
        ...,
        description="Distribución de tópicos por nivel K (K1, K2, K3).",
    )

    warnings: list[str] = Field(
        default_factory=list,
        description=(
            "Lista de advertencias generadas durante la detección. "
            "Ejemplos: tópicos faltantes, niveles K no encontrados, "
            "texto vacío para un tópico. Una lista vacía indica que "
            "la detección fue perfecta."
        ),
    )

    is_complete: bool = Field(
        ...,
        description=(
            "True si los códigos detectados coinciden exactamente con los "
            "64 tópicos esperados del syllabus CTFL v4.0. False si falta "
            "alguno o aparece un código inesperado."
        ),
    )
    
    # ═══════════════════════════════════════════════════════════════
# SCHEMAS DE EXTRACCIÓN COMPLETA (BE-05)
# ═══════════════════════════════════════════════════════════════
#
# Estos schemas representan el JSON FINAL que Next.js consumirá
# directamente en la guía UP-03. Son el "contrato" entre el
# backend (FastAPI) y el frontend (Next.js).
#
# Diferencia con los schemas de BE-04:
#   BE-04: TopicDetectionResponse → tópicos como LISTA (interno)
#   BE-05: FullExtractionResponse → tópicos como DICCIONARIO (API)


class TopicInfo(BaseModel):
    """
    Información de UN tópico en el formato final para Next.js.

    A diferencia de DetectedTopicSchema (BE-04), este schema:
    1. NO incluye 'code' — porque el código ES la clave del diccionario.
    2. NO incluye 'start_pos' — dato interno del detector, irrelevante
       para el frontend.
    3. SÍ incluye 'chapter' y 'section' — para agrupación visual en
       la UI del plan de estudio.

    Este modelo representa el VALOR del diccionario en:
        { "FL-1.1.1": TopicInfo, "FL-1.1.2": TopicInfo, ... }

    Ejemplo:
        {
            "level_k": "K1",
            "name": "Identify Typical Test Objectives",
            "text": "Testing has different objectives depending on...",
            "chapter": 1,
            "section": "1.1"
        }
    """

    level_k: str = Field(
        ...,
        pattern=r"^K[123]$",
        description=(
            "Nivel cognitivo según la taxonomía de Bloom: "
            "K1 (recordar), K2 (comprender), K3 (aplicar)."
        ),
        examples=["K1"],
    )

    name: str = Field(
        ...,
        min_length=3,
        description=(
            "Nombre del objetivo de aprendizaje tal como aparece "
            "en el syllabus ISTQB."
        ),
        examples=["Identify Typical Test Objectives"],
    )

    text: str = Field(
        ...,
        min_length=1,
        description=(
            "Texto completo del syllabus asociado a este tópico. "
            "Incluye todo el contenido desde el encabezado FL-x.x.x "
            "hasta el inicio del siguiente tópico."
        ),
    )

    chapter: int = Field(
        ...,
        ge=1,
        le=6,
        description="Número de capítulo del syllabus (1-6).",
        examples=[1],
    )

    section: str = Field(
        ...,
        description="Sección del syllabus (ej: '1.1', '2.3').",
        examples=["1.1"],
    )


class FullExtractionResponse(BaseModel):
    """
    Respuesta COMPLETA del pipeline de extracción y análisis.

    Este es el JSON FINAL que Next.js consumirá en UP-03.
    Combina los resultados de:
    1. PdfExtractorService (BE-03) → metadatos del PDF.
    2. TopicDetectorService (BE-04) → tópicos detectados.
    3. ExtractorService (BE-05) → transformación y cálculos.

    La estructura está optimizada para el consumo del frontend:
    - topics: diccionario indexado por código FL-x.x.x (acceso O(1)).
    - estimated_study_hours: calculado automáticamente por el backend.
    - is_complete: indica si el frontend debería alertar al usuario
      sobre posibles problemas en la extracción.

    Ejemplo:
        {
            "filename": "ISTQB_CTFL_v4.0.pdf",
            "total_pages": 135,
            "extraction_method": "pdfplumber",
            "topics": {
                "FL-1.1.1": {
                    "level_k": "K1",
                    "name": "Identify Typical Test Objectives",
                    "text": "Testing has different objectives...",
                    "chapter": 1,
                    "section": "1.1"
                }
            },
            "total_topics": 64,
            "level_distribution": {"K1": 14, "K2": 42, "K3": 8},
            "estimated_study_hours": 61.0,
            "warnings": [],
            "is_complete": true
        }
    """

    contract_version: Literal[2] = Field(
        default=2,
        description="Versión del contrato de extracción y delimitación de tópicos.",
    )

    filename: str = Field(
        ...,
        description="Nombre original del archivo PDF subido.",
        examples=["ISTQB_CTFL_v4.0.pdf"],
    )

    total_pages: int = Field(
        ...,
        ge=1,
        description="Número total de páginas del PDF.",
        examples=[135],
    )

    extraction_method: str = Field(
        ...,
        description=(
            "Método de extracción de texto utilizado: "
            "'pdfplumber' o 'pymupdf'."
        ),
        examples=["pdfplumber"],
    )

    topics: dict[str, TopicInfo] = Field(
        ...,
        description=(
            "Diccionario de tópicos detectados, indexado por código "
            "FL-x.x.x. Cada valor es un objeto TopicInfo con el nivel K, "
            "nombre, texto, capítulo y sección."
        ),
    )

    total_topics: int = Field(
        ...,
        ge=0,
        description="Número total de tópicos detectados.",
        examples=[64],
    )

    level_distribution: KLevelDistribution = Field(
        ...,
        description="Distribución de tópicos por nivel K (K1, K2, K3).",
    )

    estimated_study_hours: float = Field(
        ...,
        ge=0.0,
        description=(
            "Horas estimadas de estudio calculadas automáticamente. "
            "Fórmula: (K1 × 0.5) + (K2 × 1.0) + (K3 × 1.5). "
            "Usado por UP-04 para generar el plan de estudio."
        ),
        examples=[61.0],
    )

    warnings: list[str] = Field(
        default_factory=list,
        description=(
            "Advertencias generadas durante la extracción y detección. "
            "Lista vacía indica que todo fue perfecto."
        ),
    )

    is_complete: bool = Field(
        ...,
        description=(
            "True si se detectó exactamente el catálogo esperado. "
            "Si es False, el frontend no debe generar el plan."
        ),
    )
