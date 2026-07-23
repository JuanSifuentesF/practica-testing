"""
Módulo de configuración del backend — ISTQB Study Agent.

Usa pydantic-settings para cargar y validar variables de entorno
desde un archivo .env o del sistema operativo.

Patrón: Singleton funcional.
La función get_settings() se usa como dependencia inyectable de
FastAPI. Solo se instancia una vez y se reutiliza en todas las
peticiones gracias al mecanismo de caché de lru_cache.

Ejemplo de uso en un router:
    from app.core.config import get_settings

    @router.get("/example")
    def example(settings: Settings = Depends(get_settings)):
        return {"project": settings.PROJECT_NAME}
"""

from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Configuración global de la aplicación.

    Cada atributo corresponde a una variable de entorno.
    pydantic-settings busca automáticamente la variable con el
    mismo nombre (case-insensitive) en el archivo .env o en
    las variables de entorno del sistema.

    Atributos con valor por defecto NO requieren estar definidos
    en el .env — se usan los defaults si no se encuentran.
    """

    # ─── Metadatos de la Aplicación ───
    PROJECT_NAME: str = "ISTQB Study Agent API"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "Microservicio de extracción y análisis de syllabus ISTQB"
    DEBUG: bool = False

    # ─── Servidor ───
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ─── Frontera privada Next.js BFF → FastAPI ───
    BFF_SHARED_SECRET: SecretStr | None = None
    MAX_UPLOAD_BYTES: int = Field(default=20 * 1024 * 1024, ge=1024)
    MULTIPART_OVERHEAD_BYTES: int = Field(default=256 * 1024, ge=1024)
    PDF_RATE_LIMIT_REQUESTS: int = Field(default=5, ge=1)
    PDF_RATE_LIMIT_WINDOW_SECONDS: int = Field(default=60, ge=1)
    CORS_ORIGINS: list[str] = Field(default_factory=list)

    # ─── Supabase (se usarán a partir de BE-03) ───
    # Estas variables NO son requeridas en BE-01.
    # Se definen como opcionales con None por defecto.
    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None

    # ─── Configuración de pydantic-settings ───
    model_config = SettingsConfigDict(
        # Nombre del archivo de variables de entorno.
        # pydantic-settings buscará este archivo en el directorio
        # de trabajo actual (cwd), que será backend/ cuando
        # ejecutemos uvicorn desde ahí.
        env_file=".env",

        # Si el archivo .env no existe, no lanzar error.
        # En producción, las variables se configuran
        # directamente en el entorno del contenedor, no en un archivo.
        env_file_encoding="utf-8",

        # Los nombres de las variables son case-insensitive:
        # SUPABASE_URL, supabase_url y Supabase_Url son equivalentes.
        case_sensitive=False,

        # Variables extra que no estén definidas en el modelo
        # serán ignoradas en lugar de causar un error de validación.
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """
    Retorna una instancia singleton de Settings.

    lru_cache garantiza que Settings() solo se instancia una vez,
    sin importar cuántas veces se llame a get_settings(). Esto es
    eficiente porque leer y parsear el .env solo ocurre al inicio.

    En tests, se puede sobreescribir con app.dependency_overrides.
    """
    return Settings()
