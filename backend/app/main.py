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
# allow_origins: lista de dominios permitidos.
#   - localhost     → desarrollo local
#   - vercel.app    → frontend en producción (se actualizará
#                     con el dominio real en la guía FE-01)
#   - ondigitalocean.app → URL del backend en DO (para Swagger UI)
#
# ⚠️ IMPORTANTE: Cuando despliegues el frontend en la guía FE-01,
# reemplaza "https://tu-frontend.vercel.app" con la URL real.
# ═══════════════════════════════════════════════════════════════
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # --- Desarrollo local ---
        "http://localhost:3000",    # Frontend Next.js
        "http://127.0.0.1:3000",   # Variante de localhost
        # --- Producción ---
        # URL del frontend en Vercel (actualizar en FE-01 con la URL real).
        # Por ahora dejamos un placeholder que se actualizará.
        # "https://tu-frontend.vercel.app",
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