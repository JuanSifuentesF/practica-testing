"""
Router de Health Check — ISTQB Study Agent.

Propósito:
  Proveer un endpoint ligero que confirma que el backend está
  operativo. Usado por:
  - DigitalOcean App Platform para health checks automáticos.
  - El frontend para verificar conectividad antes de enviar PDFs.
  - CI/CD pipelines para validar que el deploy fue exitoso.

Ruta: GET /health
Autenticación: Ninguna (público).
"""

from app.core.config import get_settings
from app.models.schemas import HealthResponse
from fastapi import APIRouter

# ─── Crear instancia del Router ───
# prefix: todas las rutas de este router empiezan con ""
#         (sin prefijo, porque /health es una ruta raíz).
# tags: agrupa los endpoints en Swagger UI bajo la etiqueta "Health".
router = APIRouter(
    tags=["Health"],
)


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Verificar estado del servicio",
    description=(
        "Retorna el estado actual del backend y su versión. "
        "Este endpoint es público y no requiere autenticación. "
        "Usado por plataformas de hosting para health checks automáticos."
    ),
    responses={
        200: {
            "description": "El servicio está operativo.",
            "content": {
                "application/json": {
                    "example": {
                        "status": "ok",
                        "version": "0.1.0",
                    }
                }
            },
        }
    },
)
async def health_check() -> HealthResponse:
    """
    Endpoint de verificación de salud del backend.

    No requiere parámetros ni autenticación.
    Retorna siempre un JSON con status "ok" y la versión actual.

    Returns:
        HealthResponse: Objeto con status y version del servicio.
    """
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version=settings.VERSION,
    )