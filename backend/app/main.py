"""
Punto de entrada principal del backend — ISTQB Study Agent.

Este archivo:
1. Crea la instancia de FastAPI con metadatos del proyecto.
2. Configura CORS para permitir peticiones desde el frontend.
3. Registra todos los routers (endpoints) de la aplicación.

Para ejecutar el servidor de desarrollo:
    cd backend
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

La referencia 'app.main:app' significa:
    - 'app.main' → módulo Python en backend/app/main.py
    - ':app'     → variable 'app' dentro de ese módulo (la instancia FastAPI)
"""

from app.core.config import get_settings
from app.routers import health, pdf
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ─── Cargar configuración ───
settings = get_settings()

# ═══════════════════════════════════════════════════════════════
# INSTANCIA DE FASTAPI
# ═══════════════════════════════════════════════════════════════
#
# Estos metadatos se muestran en la documentación automática
# de Swagger UI (/docs) y ReDoc (/redoc).
# ═══════════════════════════════════════════════════════════════
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    docs_url="/docs",       # Swagger UI en http://localhost:8000/docs
    redoc_url="/redoc",     # ReDoc en http://localhost:8000/redoc
    openapi_url="/openapi.json",  # Schema OpenAPI en formato JSON
    redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js",
)

# ═══════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE CORS (Cross-Origin Resource Sharing)
# ═══════════════════════════════════════════════════════════════
#
# CORS controla qué dominios pueden hacer peticiones HTTP a
# nuestro backend desde un navegador.
#
# Sin esta configuración, el frontend de Next.js en
# http://localhost:3000 NO podría llamar al backend en
# http://localhost:8000 — el navegador bloquearía la petición
# con un error de CORS.
#
# allow_origins: lista de dominios permitidos.
#   - localhost:3000 → frontend en desarrollo local.
#   - En producción, agregaremos el dominio real.
#
# allow_methods: métodos HTTP permitidos.
#   - ["*"] permite GET, POST, PUT, DELETE, etc.
#
# allow_headers: headers personalizados permitidos.
#   - ["*"] permite Authorization, Content-Type, etc.
# ═══════════════════════════════════════════════════════════════
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",    # Frontend Next.js en desarrollo
        "http://127.0.0.1:3000",   # Variante de localhost
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════
# REGISTRO DE ROUTERS
# ═══════════════════════════════════════════════════════════════
#
# Cada router agrupa endpoints relacionados. Al incluirlos aquí,
# FastAPI los "monta" en la aplicación principal.
#
# En guías futuras agregaremos más routers:
#   - app.routers.pdf      → POST /extract-pdf (BE-03)
# ═══════════════════════════════════════════════════════════════
app.include_router(health.router)
app.include_router(pdf.router)