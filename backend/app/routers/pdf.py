"""
Router de Extracción de PDF — ISTQB Study Agent.

Propósito:
  Proveer el endpoint POST /extract-pdf que recibe un archivo PDF
  via multipart/form-data, extrae su texto usando pdfplumber (con
  fallback a PyMuPDF), y retorna el contenido estructurado en JSON.

Ruta: POST /extract-pdf
Autenticación: Ninguna en esta versión (se agregará en guías futuras).
Content-Type de entrada: multipart/form-data
Content-Type de salida: application/json

Consumidores futuros:
  - Next.js API Route /api/upload (guía UP-03): descargará el PDF
    de Supabase Storage y lo enviará a este endpoint.
"""

import logging

from app.models.schemas import ErrorResponse, PageContent, PdfExtractResponse
from app.services.pdf_extractor import PdfExtractionError, PdfExtractorService
from fastapi import APIRouter, File, HTTPException, UploadFile, status

# ─── Logger del módulo ───
logger = logging.getLogger(__name__)

# ─── Crear instancia del Router ───
# tags: agrupa los endpoints en Swagger UI bajo la etiqueta "PDF Extraction".
router = APIRouter(
    tags=["PDF Extraction"],
)

# ─── Instancia del servicio ───
# El servicio es stateless (no guarda estado entre llamadas), así que
# podemos crear una sola instancia y reutilizarla en todas las peticiones.
# En el futuro, si necesita dependencias (ej. base de datos), usaremos
# Dependency Injection de FastAPI con Depends().
_pdf_service = PdfExtractorService()


@router.post(
    "/extract-pdf",
    response_model=PdfExtractResponse,
    summary="Extraer texto de un archivo PDF",
    description=(
        "Recibe un archivo PDF via multipart/form-data y extrae su texto "
        "completo usando pdfplumber como método principal y PyMuPDF como "
        "fallback. Retorna el texto crudo concatenado, el texto por página "
        "individual, y metadatos de la extracción.\n\n"
        "**Límites:**\n"
        "- Solo acepta archivos con content_type application/pdf.\n"
        "- El archivo se procesa en memoria (no se guarda en disco).\n"
        "- PDFs escaneados sin OCR no retornarán texto útil."
    ),
    responses={
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
    file: UploadFile = File(
        ...,
        description=(
            "Archivo PDF del syllabus ISTQB a procesar. "
            "Debe ser un PDF válido con texto seleccionable."
        ),
    ),
) -> PdfExtractResponse:
    """
    Endpoint principal de extracción de texto de PDFs.

    Flujo:
    1. Valida que el archivo recibido es un PDF (content_type).
    2. Lee el archivo completo en memoria (await file.read()).
    3. Delega la extracción al PdfExtractorService.
    4. Construye y retorna PdfExtractResponse con los resultados.

    Args:
        file: Archivo PDF subido via multipart/form-data.

    Returns:
        PdfExtractResponse: JSON con el texto extraído y metadatos.

    Raises:
        HTTPException(400): Si el archivo no es un PDF.
        HTTPException(422): Si no se puede extraer texto del PDF.
        HTTPException(500): Si ocurre un error inesperado.
    """
    # ─── Validación 1: Verificar content_type ───
    # El content_type lo determina el navegador o cliente HTTP basándose
    # en la extensión del archivo o sus magic bytes. No es 100% confiable,
    # pero es una primera barrera de validación rápida.
    if file.content_type != "application/pdf":
        logger.warning(
            "Archivo rechazado: content_type='%s', filename='%s'",
            file.content_type,
            file.filename,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": (
                    f"El archivo '{file.filename}' no es un PDF válido. "
                    f"Se recibió content_type '{file.content_type}', "
                    "pero se esperaba 'application/pdf'."
                ),
                "error_code": "INVALID_FILE_TYPE",
            },
        )

    # ─── Leer archivo en memoria ───
    # await file.read() es asíncrono — no bloquea el event loop
    # de asyncio mientras se leen los bytes del archivo. Esto es
    # importante porque si otro cliente envía una petición mientras
    # estamos leyendo un PDF grande, esa petición no se queda
    # esperando.
    try:
        pdf_bytes = await file.read()
    except Exception as e:
        logger.error("Error al leer el archivo '%s': %s", file.filename, str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": f"Error al leer el archivo: {str(e)}",
                "error_code": "FILE_READ_ERROR",
            },
        ) from e

    # ─── Validación 2: Verificar que el archivo no está vacío ───
    if len(pdf_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": "El archivo PDF está vacío (0 bytes).",
                "error_code": "EMPTY_FILE",
            },
        )

    # ─── Validación 3: Verificar magic bytes del PDF ───
    # Los archivos PDF SIEMPRE comienzan con los bytes "%PDF".
    # Esta es la validación más confiable del tipo de archivo —
    # más segura que confiar solo en el content_type del cliente.
    if not pdf_bytes[:4] == b"%PDF":
        logger.warning(
            "Archivo rechazado por magic bytes: filename='%s', "
            "primeros bytes=%r",
            file.filename,
            pdf_bytes[:10],
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "detail": (
                    f"El archivo '{file.filename}' no es un PDF válido. "
                    "Los primeros bytes del archivo no corresponden al "
                    "formato PDF (esperado: %PDF)."
                ),
                "error_code": "INVALID_PDF_HEADER",
            },
        )

    # ─── Extraer texto ───
    # Delegamos al servicio que encapsula la lógica de extracción.
    # El servicio es síncrono porque pdfplumber y PyMuPDF son
    # librerías síncronas. FastAPI ejecutará esta función síncrona
    # en un thread pool para no bloquear el event loop.
    filename = file.filename or "unknown.pdf"

    try:
        result = _pdf_service.extract(pdf_bytes=pdf_bytes, filename=filename)
    except PdfExtractionError as e:
        logger.error(
            "Error de extracción para '%s': %s (code: %s)",
            filename,
            e.message,
            e.error_code,
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "detail": e.message,
                "error_code": e.error_code,
            },
        ) from e
    except Exception as e:
        logger.exception("Error inesperado procesando '%s'", filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "detail": f"Error interno al procesar el PDF: {str(e)}",
                "error_code": "INTERNAL_ERROR",
            },
        ) from e

    # ─── Construir respuesta ───
    # Transformamos el ExtractionResult interno del servicio al
    # schema Pydantic PdfExtractResponse que será serializado a JSON.
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