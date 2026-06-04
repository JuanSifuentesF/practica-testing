"""
Servicio de extracción de texto de PDFs — ISTQB Study Agent.

Este módulo contiene la lógica de negocio para extraer texto de archivos
PDF usando pdfplumber como método principal y PyMuPDF (fitz) como fallback.

Arquitectura:
    Este servicio es INDEPENDIENTE de FastAPI — no conoce HTTP, routers
    ni requests. Solo recibe bytes crudos y retorna datos estructurados.
    Esto permite:
    1. Testearlo sin levantar un servidor HTTP.
    2. Reutilizarlo en scripts de procesamiento batch.
    3. Cambiar la librería de extracción sin tocar el router.

Patrón de diseño: Strategy Pattern (implícito)
    - Método primario: pdfplumber (más preciso para texto estructurado).
    - Método fallback: PyMuPDF/fitz (más robusto con PDFs problemáticos).
    - Si ambos fallan, se lanza una excepción clara.

Uso:
    from app.services.pdf_extractor import PdfExtractorService

    service = PdfExtractorService()
    result = service.extract(pdf_bytes=b"...", filename="syllabus.pdf")
"""

import io
import logging
from dataclasses import dataclass

import fitz  # PyMuPDF — se importa como 'fitz' por razones históricas
import pdfplumber

# ─── Configurar logger del módulo ───
# Cada módulo de Python debería tener su propio logger.
# El nombre __name__ produce "app.services.pdf_extractor", lo que
# permite filtrar logs por módulo en producción.
logger = logging.getLogger(__name__)


@dataclass
class ExtractionResult:
    """
    Resultado interno de la extracción de texto.

    Usamos un dataclass en lugar de un Pydantic model porque este
    objeto es INTERNO del servicio — nunca se serializa a JSON.
    Los dataclasses son más ligeros y rápidos para datos internos.

    Atributos:
        filename: Nombre original del archivo procesado.
        total_pages: Número total de páginas del PDF.
        full_text: Texto completo concatenado de todas las páginas.
        pages: Lista de tuplas (page_number, text) por cada página.
        extraction_method: "pdfplumber" o "pymupdf" según qué método se usó.
        text_length: Longitud total del texto extraído.
    """

    filename: str
    total_pages: int
    full_text: str
    pages: list[tuple[int, str]]
    extraction_method: str
    text_length: int


class PdfExtractorService:
    """
    Servicio principal de extracción de texto de archivos PDF.

    Estrategia de extracción:
    1. Intenta con pdfplumber (alta precisión para texto estructurado).
    2. Si pdfplumber no extrae texto significativo, usa PyMuPDF como fallback.
    3. Si ambos fallan, lanza PdfExtractionError con detalles.

    Ejemplo de uso:
        service = PdfExtractorService()
        try:
            result = service.extract(pdf_bytes, "syllabus.pdf")
            print(f"Extraídas {result.total_pages} páginas")
        except PdfExtractionError as e:
            print(f"Error: {e}")
    """

    # Umbral mínimo de caracteres para considerar que la extracción
    # fue exitosa. Un PDF real del ISTQB tiene ~200K caracteres.
    # Si extraemos menos de 100 caracteres, probablemente el PDF
    # es un scan sin OCR o está corrupto.
    MIN_TEXT_LENGTH = 100

    def extract(self, pdf_bytes: bytes, filename: str) -> ExtractionResult:
        """
        Extrae texto de un archivo PDF usando pdfplumber con fallback a PyMuPDF.

        Args:
            pdf_bytes: Contenido binario completo del archivo PDF.
            filename: Nombre original del archivo (para logging y respuesta).

        Returns:
            ExtractionResult: Objeto con el texto extraído y metadatos.

        Raises:
            PdfExtractionError: Si no se puede abrir el PDF o no se extrae texto.
        """
        logger.info(
            "Iniciando extracción de '%s' (%d bytes)",
            filename,
            len(pdf_bytes),
        )

        # ─── Intento 1: pdfplumber ───
        try:
            result = self._extract_with_pdfplumber(pdf_bytes, filename)
            if result.text_length >= self.MIN_TEXT_LENGTH:
                logger.info(
                    "Extracción exitosa con pdfplumber: %d páginas, %d caracteres",
                    result.total_pages,
                    result.text_length,
                )
                return result
            else:
                logger.warning(
                    "pdfplumber extrajo solo %d caracteres (mínimo: %d). "
                    "Intentando fallback con PyMuPDF...",
                    result.text_length,
                    self.MIN_TEXT_LENGTH,
                )
        except Exception as e:
            logger.warning(
                "pdfplumber falló con error: %s. Intentando fallback con PyMuPDF...",
                str(e),
            )

        # ─── Intento 2: PyMuPDF (fallback) ───
        try:
            result = self._extract_with_pymupdf(pdf_bytes, filename)
            if result.text_length >= self.MIN_TEXT_LENGTH:
                logger.info(
                    "Extracción exitosa con PyMuPDF (fallback): %d páginas, %d caracteres",
                    result.total_pages,
                    result.text_length,
                )
                return result
            else:
                raise PdfExtractionError(
                    f"No se pudo extraer texto significativo del PDF '{filename}'. "
                    f"Solo se obtuvieron {result.text_length} caracteres. "
                    "El PDF podría ser un escaneo sin OCR o no contener texto seleccionable.",
                    error_code="NO_TEXT_EXTRACTED",
                )
        except PdfExtractionError:
            # Re-lanzar nuestros propios errores sin atraparlos.
            raise
        except Exception as e:
            raise PdfExtractionError(
                f"Error al procesar el PDF '{filename}' con ambos métodos de extracción. "
                f"Detalle: {str(e)}",
                error_code="EXTRACTION_FAILED",
            ) from e

    def _extract_with_pdfplumber(
        self, pdf_bytes: bytes, filename: str
    ) -> ExtractionResult:
        """
        Extrae texto usando pdfplumber.

        pdfplumber es excelente para PDFs con texto estructurado como
        el syllabus ISTQB. Maneja bien tablas, columnas y watermarks.

        Internamente:
        1. Abre el PDF desde un BytesIO (sin escribir a disco).
        2. Itera por cada página llamando page.extract_text().
        3. Concatena el texto de todas las páginas.

        Args:
            pdf_bytes: Bytes crudos del PDF.
            filename: Nombre del archivo para el resultado.

        Returns:
            ExtractionResult con method="pdfplumber".
        """
        pages: list[tuple[int, str]] = []

        # io.BytesIO envuelve los bytes en un objeto file-like que
        # pdfplumber puede leer como si fuera un archivo en disco.
        # Esto evita escribir el PDF a un archivo temporal.
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            total_pages = len(pdf.pages)
            logger.debug("pdfplumber: PDF tiene %d páginas", total_pages)

            for i, page in enumerate(pdf.pages, start=1):
                # extract_text() retorna None si la página no tiene
                # texto seleccionable (ej. página de solo imágenes).
                text = page.extract_text() or ""
                pages.append((i, text))

                # Log de progreso cada 20 páginas para PDFs largos.
                if i % 20 == 0:
                    logger.debug("pdfplumber: Procesada página %d/%d", i, total_pages)

        # Concatenar texto de todas las páginas con doble newline
        # como separador. Esto facilita el parsing posterior porque
        # cada página es claramente distinguible en el texto final.
        full_text = "\n\n".join(text for _, text in pages)

        return ExtractionResult(
            filename=filename,
            total_pages=total_pages,
            full_text=full_text,
            pages=pages,
            extraction_method="pdfplumber",
            text_length=len(full_text),
        )

    def _extract_with_pymupdf(
        self, pdf_bytes: bytes, filename: str
    ) -> ExtractionResult:
        """
        Extrae texto usando PyMuPDF (fitz) como método alternativo.

        PyMuPDF es significativamente más rápido que pdfplumber y
        maneja mejor ciertos PDFs problemáticos (watermarks pesados,
        fonts embebidos raros). Se usa como fallback cuando pdfplumber
        no extrae suficiente texto.

        Args:
            pdf_bytes: Bytes crudos del PDF.
            filename: Nombre del archivo para el resultado.

        Returns:
            ExtractionResult con method="pymupdf".
        """
        pages: list[tuple[int, str]] = []

        # fitz.open() puede abrir PDFs desde bytes directamente
        # usando los parámetros stream y filetype.
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            total_pages = len(doc)
            logger.debug("PyMuPDF: PDF tiene %d páginas", total_pages)

            for i, page in enumerate(doc, start=1):
                # get_text() extrae el texto de la página.
                # El argumento "text" especifica el formato de salida.
                text = page.get_text("text") or ""
                pages.append((i, text))

                if i % 20 == 0:
                    logger.debug("PyMuPDF: Procesada página %d/%d", i, total_pages)
        finally:
            # Cerrar el documento explícitamente para liberar memoria.
            # PyMuPDF mantiene el PDF en memoria hasta que se cierra.
            doc.close()

        full_text = "\n\n".join(text for _, text in pages)

        return ExtractionResult(
            filename=filename,
            total_pages=total_pages,
            full_text=full_text,
            pages=pages,
            extraction_method="pymupdf",
            text_length=len(full_text),
        )


class PdfExtractionError(Exception):
    """
    Excepción personalizada para errores de extracción de PDF.

    Incluye un error_code para que el router pueda retornar
    un ErrorResponse consistente al cliente.

    Atributos:
        message: Descripción del error.
        error_code: Código programático para el frontend.
    """

    def __init__(self, message: str, error_code: str = "EXTRACTION_FAILED"):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)