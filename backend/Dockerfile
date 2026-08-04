# ═══════════════════════════════════════════════════════════════
# Dockerfile — Backend ISTQB Study Agent (FastAPI)
# ═══════════════════════════════════════════════════════════════
#
# Multi-stage build optimizado para producción en Heroku (Cedar Container Registry).
#
# Stage 1 (builder):
#   - Instala dependencias de compilación temporales.
#   - Compila las dependencias Python de requirements.txt.
#   - Esta etapa NO se incluye en la imagen final.
#
# Stage 2 (production):
#   - Imagen limpia basada en python:3.12-slim.
#   - Copia solo los paquetes compilados y el código fuente.
#   - Resultado: imagen pequeña (~250 MB) y segura.
#
# Build:  docker build -t istqb-backend .
# Run:    docker run -p 8000:8000 istqb-backend
# ═══════════════════════════════════════════════════════════════


# ───────────────────────────────────────────────────────────────
# STAGE 1: Builder — Instalación de dependencias
# ───────────────────────────────────────────────────────────────
#
# python:3.12-slim es la variante "delgada" de la imagen oficial
# de Python. Incluye solo lo mínimo para ejecutar Python, sin
# herramientas de desarrollo innecesarias.
#
# "AS builder" le da un nombre a esta etapa para referenciarla
# desde la siguiente con COPY --from=builder.
# ───────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

# Instalar dependencias del sistema operativo necesarias para
# compilar paquetes Python con extensiones nativas (C/C++).
#
# - build-essential: incluye gcc, g++, make (compiladores C/C++).
#   PyMuPDF y algunas dependencias de pdfplumber necesitan
#   compilar código nativo durante `pip install`.
#
# - libffi-dev: headers de la librería Foreign Function Interface.
#   Usada por cffi (dependencia de cryptography y otros).
#
# Las 3 líneas (update, install, rm) se ejecutan en un solo RUN
# para crear una sola capa y reducir el tamaño de la imagen.
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  build-essential \
  libffi-dev \
  && rm -rf /var/lib/apt/lists/*

# Definir el directorio de trabajo dentro del contenedor.
# Todos los comandos siguientes se ejecutan desde /app.
WORKDIR /app

# Copiar SOLO el archivo de dependencias primero.
#
# ¿Por qué? Docker cachea cada capa (layer). Si copiamos
# requirements.txt por separado y no ha cambiado, Docker
# reutiliza la capa de `pip install` del build anterior.
#
# Esto es CRÍTICO para velocidad de desarrollo:
# - Si solo cambias código Python → rebuild en segundos.
# - Si cambias requirements.txt → rebuild completo (~2 min).
COPY requirements.txt .

# Instalar las dependencias Python.
#
# --no-cache-dir: no guardar la caché de pip dentro de la imagen.
#   Ahorra ~50-100 MB de archivos temporales.
#
# --prefix=/install: instalar en un directorio especial en lugar
#   del directorio default de Python. Esto nos permite copiar
#   SOLO los paquetes instalados al Stage 2 con COPY --from.
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ───────────────────────────────────────────────────────────────
# STAGE OPCIONAL: Tests reproducibles en Python 3.12
# ───────────────────────────────────────────────────────────────
FROM python:3.12-slim AS test

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

COPY ./app ./app
COPY ./tests ./tests
COPY pytest.ini .

CMD ["python", "-m", "pytest", "-c", "pytest.ini", "tests", "-q"]


# ───────────────────────────────────────────────────────────────
# STAGE 2: Production — Imagen final optimizada
# ───────────────────────────────────────────────────────────────
#
# Partimos de una imagen NUEVA y limpia, sin los compiladores
# ni archivos temporales del Stage 1.
# ───────────────────────────────────────────────────────────────
FROM python:3.12-slim

# Metadata de la imagen siguiendo las convenciones OCI.
# Esto es informativo — no afecta el comportamiento.
LABEL maintainer="Juan Sifuentes <jsifuentes@example.com>"
LABEL description="ISTQB Study Agent — FastAPI PDF extraction microservice"
LABEL version="0.1.0"

# Configurar variables de entorno de Python para producción.
#
# PYTHONDONTWRITEBYTECODE=1
#   → No crear archivos .pyc (bytecode compilado).
#   → En un contenedor no necesitamos .pyc porque el código
#     no cambia en runtime. Ahorra espacio en disco.
#
# PYTHONUNBUFFERED=1
#   → Desactivar el buffering de stdout/stderr.
#   → Los logs de print() y logging aparecen inmediatamente
#     en `docker logs` sin esperar a que se llene el buffer.
#   → Crítico para debugging en producción.
ENV PYTHONDONTWRITEBYTECODE=1 \
  PYTHONUNBUFFERED=1

WORKDIR /app

RUN useradd --create-home --shell /usr/sbin/nologin appuser

# Copiar los paquetes Python compilados del Stage 1.
#
# --from=builder: indica que el origen es la etapa "builder".
# /install/lib → contiene los site-packages de Python.
# /install/bin → contiene los scripts ejecutables (uvicorn, etc.).
#
# Esto es el truco del multi-stage build: copiamos solo el
# resultado de la compilación, sin los compiladores pesados.
COPY --from=builder /install/lib /usr/local/lib
COPY --from=builder /install/bin /usr/local/bin

# Copiar el código fuente de la aplicación.
#
# El .dockerignore se encarga de excluir venv/, __pycache__/,
# .env y otros archivos que no deben estar en la imagen.
COPY --chown=appuser:appuser ./app ./app

# Exponer el puerto 8000.
#
# EXPOSE es declarativo — documenta que el contenedor escucha
# en el puerto 8000. No abre el puerto; eso lo hace -p al
# ejecutar `docker run -p 8000:8000`.
EXPOSE 8000

USER appuser

# Comando de inicio del contenedor.
#
# uvicorn: servidor ASGI que ejecuta FastAPI.
# app.main:app: módulo y variable de la instancia FastAPI.
# --host 0.0.0.0: escuchar en todas las interfaces de red
#   (necesario dentro del contenedor para que el tráfico
#   externo pueda llegar a la aplicación).
# --port 8000: puerto de escucha.
#
# NO usamos --reload en producción porque:
# 1. No hay archivos que cambien en un contenedor inmutable.
# 2. --reload consume CPU innecesariamente.
# 3. --reload importa watchfiles que no está instalado.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\""]
