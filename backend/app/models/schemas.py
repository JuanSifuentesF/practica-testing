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