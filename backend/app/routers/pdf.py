"""
Router de Extracción de PDF — ISTQB Study Agent.

Propósito:
  Proveer endpoints para procesar archivos PDF del syllabus ISTQB.

Endpoints:
  POST /extract-pdf       → Extrae texto crudo del PDF (BE-03).
  POST /extract-pdf-full  → Pipeline completo: PDF → Tópicos → JSON (BE-05).

Autenticación: Bearer privado entre el BFF de Next.js y FastAPI.
Content-Type de entrada: multipart/form-data
Content-Type de salida: application/json

Consumidores futuros:
  - Next.js API Route /api/upload (guía UP-03): usará /extract-pdf-full
    para obtener el JSON estructurado en una sola llamada.
"""

import logging

from app.core.errors import ApiError
from app.models.schemas import (ErrorResponse, FullExtractionResponse,
                                 KLevelDistribution, PageContent,
                                 PdfExtractResponse, TopicInfo)
from app.services.extractor import ExtractorService
from app.services.pdf_extractor import PdfExtractionError, PdfExtractorService
from app.services.topic_detector import TopicDetectionError
from fastapi import APIRouter, File, Request, Security, UploadFile, status
from fastapi.security import HTTPBearer

# ─── Logger del módulo ───
logger = logging.getLogger(__name__)

# ─── Crear instancia del Router ───
# tags: agrupa los endpoints en Swagger UI bajo la etiqueta "PDF Extraction".
_bff_bearer = HTTPBearer(
    scheme_name="BFFBearer",
    description="Credencial privada compartida por el BFF de Next.js.",
    auto_error=False,
)

router = APIRouter(
    tags=["PDF Extraction"],
    dependencies=[Security(_bff_bearer)],
)

_GUARD_ERROR_RESPONSES = {
    401: {
        "description": "Credencial BFF ausente o inválida.",
        "model": ErrorResponse,
    },
    413: {
        "description": "El archivo supera el tamaño máximo permitido.",
        "model": ErrorResponse,
    },
    429: {
        "description": "Se alcanzó el límite temporal de extracciones.",
        "model": ErrorResponse,
    },
    503: {
        "description": "La credencial BFF no está configurada en el servicio.",
        "model": ErrorResponse,
    },
}

# ─── Instancias de servicios ───
# Ambos servicios son stateless, así que creamos una instancia
# única que se reutiliza en todas las peticiones.
_pdf_service = PdfExtractorService()
_extractor_service = ExtractorService()


# ═══════════════════════════════════════════════════════════════
# FUNCIONES AUXILIARES DE VALIDACIÓN
# ═══════════════════════════════════════════════════════════════
#
# Extraemos las validaciones a funciones reutilizables para evitar
# duplicar código entre los endpoints /extract-pdf y /extract-pdf-full.


def _validate_pdf_content_type(file: UploadFile) -> None:
    """
    Valida que el content_type del archivo sea application/pdf.

    Args:
        file: Archivo subido via multipart/form-data.

    Raises:
        HTTPException(400): Si el content_type no es application/pdf.
    """
    if file.content_type != "application/pdf":
        logger.warning(
            "Archivo rechazado: content_type='%s', filename='%s'",
            file.content_type,
            file.filename,
        )
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "El archivo debe usar content_type 'application/pdf'.",
            "INVALID_FILE_TYPE",
        )


async def _read_pdf_bytes(file: UploadFile, max_bytes: int) -> bytes:
    """
    Lee los bytes del archivo y valida que no esté vacío y sea un PDF.

    Args:
        file: Archivo subido via multipart/form-data.

    Returns:
        Bytes crudos del archivo PDF.

    Raises:
        HTTPException(400): Si el archivo está vacío o no es PDF.
        HTTPException(500): Si hay un error al leer el archivo.
    """
    if file.size is not None and file.size > max_bytes:
        raise ApiError(
            413,
            "El archivo supera el tamaño máximo permitido.",
            "PAYLOAD_TOO_LARGE",
        )

    try:
        chunks: list[bytes] = []
        total_bytes = 0
        while chunk := await file.read(64 * 1024):
            total_bytes += len(chunk)
            if total_bytes > max_bytes:
                raise ApiError(
                    413,
                    "El archivo supera el tamaño máximo permitido.",
                    "PAYLOAD_TOO_LARGE",
                )
            chunks.append(chunk)
        pdf_bytes = b"".join(chunks)
    except ApiError:
        raise
    except Exception as exc:
        logger.error(
            "Error de lectura para '%s': %s",
            file.filename,
            type(exc).__name__,
        )
        raise ApiError(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "No se pudo leer el archivo enviado.",
            "FILE_READ_ERROR",
        ) from exc

    # Validar que no está vacío
    if len(pdf_bytes) == 0:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "El archivo PDF está vacío.",
            "EMPTY_FILE",
        )

    # Validar magic bytes del PDF
    if not pdf_bytes.startswith(b"%PDF-"):
        logger.warning(
            "Archivo rechazado por magic bytes: filename='%s', "
            "primeros bytes=%r",
            file.filename,
            pdf_bytes[:10],
        )
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "El contenido no tiene una cabecera PDF válida.",
            "INVALID_PDF_HEADER",
        )

    return pdf_bytes


# ═══════════════════════════════════════════════════════════════
# ENDPOINT 1: POST /extract-pdf (BE-03 — solo texto)
# ═══════════════════════════════════════════════════════════════


@router.post(
    "/extract-pdf",
    response_model=PdfExtractResponse,
    summary="Extraer texto de un archivo PDF",
    description=(
        "Recibe un archivo PDF via multipart/form-data y extrae su texto "
        "completo usando pdfplumber como método principal y PyMuPDF como "
        "fallback. Retorna el texto crudo concatenado, el texto por página "
        "individual, y metadatos de la extracción.\n\n"
        "**Nota:** Este endpoint retorna solo el texto extraído, sin "
        "detección de tópicos. Para obtener el JSON estructurado completo "
        "con tópicos, distribución K y horas estimadas, usa "
        "`POST /extract-pdf-full`.\n\n"
        "**Límites:**\n"
        "- Solo acepta archivos con content_type application/pdf.\n"
        "- El archivo se procesa en memoria (no se guarda en disco).\n"
        "- PDFs escaneados sin OCR no retornarán texto útil."
    ),
    responses={
        **_GUARD_ERROR_RESPONSES,
        200: {
            "description": "Texto extraído exitosamente.",
            "content": {
                "application/json": {
                    "example": {
                        "filename": "ISTQB_CTFL_v4.0.pdf",
                        "total_pages": 135,
                        "extraction_method": "pdfplumber",
                        "full_text": "ISTQB® Certified Tester Foundation Level...",
                        "pages": [
                            {"page_number": 1, "text": "ISTQB® Certified..."},
                        ],
                        "text_length": 250000,
                    }
                }
            },
        },
        400: {
            "description": "El archivo no es un PDF.",
            "model": ErrorResponse,
        },
        422: {
            "description": "No se pudo extraer texto del PDF.",
            "model": ErrorResponse,
        },
        500: {
            "description": "Error interno del servidor.",
            "model": ErrorResponse,
        },
    },
)
async def extract_pdf(
    request: Request,
    file: UploadFile = File(
        ...,
        description=(
            "Archivo PDF del syllabus ISTQB a procesar. "
            "Debe ser un PDF válido con texto seleccionable."
        ),
    ),
) -> PdfExtractResponse:
    """
    Endpoint de extracción de texto de PDFs (solo texto, sin tópicos).

    Flujo:
    1. Valida que el archivo recibido es un PDF.
    2. Lee el archivo completo en memoria.
    3. Delega la extracción al PdfExtractorService.
    4. Construye y retorna PdfExtractResponse con los resultados.

    Args:
        file: Archivo PDF subido via multipart/form-data.

    Returns:
        PdfExtractResponse: JSON con el texto extraído y metadatos.
    """
    # Validar content_type
    _validate_pdf_content_type(file)

    # Leer y validar bytes
    pdf_bytes = await _read_pdf_bytes(
        file,
        request.app.state.settings.MAX_UPLOAD_BYTES,
    )
    filename = file.filename or "unknown.pdf"

    # Extraer texto
    try:
        result = _pdf_service.extract(pdf_bytes=pdf_bytes, filename=filename)
    except PdfExtractionError as exc:
        logger.error(
            "Error de extracción para '%s': %s (code: %s)",
            filename,
            exc.error_code,
            exc.error_code,
        )
        raise ApiError(
            422,
            "No se pudo extraer texto utilizable del PDF.",
            exc.error_code,
        ) from exc
    except Exception as exc:
        logger.exception("Error inesperado procesando '%s'", filename)
        raise ApiError(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Ocurrió un error interno al procesar el PDF.",
            "INTERNAL_ERROR",
        ) from exc

    # Construir respuesta
    return PdfExtractResponse(
        filename=result.filename,
        total_pages=result.total_pages,
        extraction_method=result.extraction_method,
        full_text=result.full_text,
        pages=[
            PageContent(page_number=page_num, text=text)
            for page_num, text in result.pages
        ],
        text_length=result.text_length,
    )


# ═══════════════════════════════════════════════════════════════
# ENDPOINT 2: POST /extract-pdf-full (BE-05 — pipeline completo)
# ═══════════════════════════════════════════════════════════════


@router.post(
    "/extract-pdf-full",
    response_model=FullExtractionResponse,
    summary="Extracción completa: PDF → Tópicos → JSON estructurado",
    description=(
        "Ejecuta el pipeline completo de extracción y análisis del "
        "syllabus ISTQB:\n\n"
        "1. **Extracción de texto** del PDF (pdfplumber/PyMuPDF).\n"
        "2. **Detección de tópicos** FL-x.x.x con regex.\n"
        "3. **Cálculo de horas** estimadas de estudio.\n"
        "4. **Estructuración** del JSON final para Next.js.\n\n"
        "Este es el endpoint principal que la API Route de Next.js "
        "(`/api/upload` en UP-03) consumirá.\n\n"
        "**Tiempo de respuesta estimado:** 3-5 segundos para el "
        "syllabus ISTQB CTFL v4.0.1 (~135 páginas)."
    ),
    responses={
        **_GUARD_ERROR_RESPONSES,
        200: {
            "description": "Extracción completa exitosa.",
            "content": {
                "application/json": {
                    "example": {
                        "filename": "ISTQB_CTFL_v4.0.pdf",
                        "total_pages": 135,
                        "extraction_method": "pdfplumber",
                        "topics": {
                            "FL-1.1.1": {
                                "level_k": "K1",
                                "name": "Identify Typical Test Objectives",
                                "text": "Testing has different objectives...",
                                "chapter": 1,
                                "section": "1.1",
                            },
                        },
                        "total_topics": 64,
                        "level_distribution": {"K1": 14, "K2": 42, "K3": 8},
                        "estimated_study_hours": 61.0,
                        "warnings": [],
                        "is_complete": True,
                    }
                }
            },
        },
        400: {
            "description": "El archivo no es un PDF válido.",
            "model": ErrorResponse,
        },
        422: {
            "description": "No se pudo extraer texto o detectar tópicos.",
            "model": ErrorResponse,
        },
        500: {
            "description": "Error interno del servidor.",
            "model": ErrorResponse,
        },
    },
)
async def extract_pdf_full(
    request: Request,
    file: UploadFile = File(
        ...,
        description=(
            "Archivo PDF del syllabus ISTQB a procesar. "
            "Debe ser un PDF válido con texto seleccionable."
        ),
    ),
) -> FullExtractionResponse:
    """
    Endpoint de extracción completa: PDF → Tópicos → JSON estructurado.

    Flujo:
    1. Valida que el archivo recibido es un PDF (content_type + magic bytes).
    2. Lee el archivo completo en memoria.
    3. Delega al ExtractorService que orquesta todo el pipeline.
    4. Convierte el resultado interno a FullExtractionResponse.

    Args:
        file: Archivo PDF del syllabus ISTQB.

    Returns:
        FullExtractionResponse: JSON estructurado con tópicos, distribución K,
        y horas estimadas de estudio.
    """
    # ─── Validaciones (reutilizando funciones auxiliares) ───
    _validate_pdf_content_type(file)
    pdf_bytes = await _read_pdf_bytes(
        file,
        request.app.state.settings.MAX_UPLOAD_BYTES,
    )
    filename = file.filename or "unknown.pdf"

    # ─── Pipeline completo ───
    try:
        result = _extractor_service.full_extraction(
            pdf_bytes=pdf_bytes,
            filename=filename,
        )
    except PdfExtractionError as exc:
        logger.error(
            "Error de extracción para '%s': %s (code: %s)",
            filename,
            exc.error_code,
            exc.error_code,
        )
        raise ApiError(
            422,
            "No se pudo extraer texto utilizable del PDF.",
            exc.error_code,
        ) from exc
    except TopicDetectionError as exc:
        logger.error(
            "Error de detección de tópicos para '%s': %s (code: %s)",
            filename,
            exc.error_code,
            exc.error_code,
        )
        raise ApiError(
            422,
            "No se pudieron detectar tópicos ISTQB en el PDF.",
            exc.error_code,
        ) from exc
    except Exception as exc:
        logger.exception(
            "Error inesperado en extracción completa de '%s'", filename
        )
        raise ApiError(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Ocurrió un error interno al procesar el PDF.",
            "INTERNAL_ERROR",
        ) from exc

    if result.total_topics == 0:
        raise ApiError(
            422,
            "No se detectaron tópicos ISTQB en el PDF.",
            "NO_TOPICS_DETECTED",
        )

    # ─── Construir respuesta Pydantic ───
    # Convertimos el FullExtractionResult (dataclass interno)
    # al FullExtractionResponse (schema Pydantic serializable).
    return FullExtractionResponse(
        contract_version=result.contract_version,
        filename=result.filename,
        total_pages=result.total_pages,
        extraction_method=result.extraction_method,
        topics={
            code: TopicInfo(
                level_k=info["level_k"],
                name=info["name"],
                text=info["text"],
                chapter=info["chapter"],
                section=info["section"],
            )
            for code, info in result.topics_dict.items()
        },
        total_topics=result.total_topics,
        level_distribution=KLevelDistribution(
            K1=result.level_distribution.get("K1", 0),
            K2=result.level_distribution.get("K2", 0),
            K3=result.level_distribution.get("K3", 0),
        ),
        estimated_study_hours=result.estimated_study_hours,
        warnings=result.warnings,
        is_complete=result.is_complete,
    )
