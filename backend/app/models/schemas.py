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

from pydantic import BaseModel, Field

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
            "indicador rápido de calidad: el syllabus ISTQB v4.0 debería "
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

    detail: str = Field(
        ...,
        description="Mensaje descriptivo del error en lenguaje humano.",
        examples=["El archivo subido no es un PDF válido."],
    )

    error_code: str = Field(
        ...,
        description=(
            "Código de error programático para el frontend. Permite al "
            "cliente mostrar mensajes de error específicos sin parsear "
            "el texto del mensaje."
        ),
        examples=["INVALID_FILE_TYPE"],
    )