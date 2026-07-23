from collections.abc import Iterator

import pytest
from app.core.config import Settings
from app.main import create_app
from fastapi import FastAPI
from fastapi.testclient import TestClient

TEST_SECRET = "test-only-shared-secret-with-at-least-32-characters"


def build_app(**overrides: object) -> FastAPI:
    values: dict[str, object] = {
        "BFF_SHARED_SECRET": TEST_SECRET,
        "MAX_UPLOAD_BYTES": 1024,
        "MULTIPART_OVERHEAD_BYTES": 4096,
        "PDF_RATE_LIMIT_REQUESTS": 100,
        "PDF_RATE_LIMIT_WINDOW_SECONDS": 60,
        "CORS_ORIGINS": ["https://frontend.example"],
    }
    values.update(overrides)
    settings = Settings(_env_file=None, **values)
    return create_app(settings)


def build_client(**overrides: object) -> TestClient:
    return TestClient(build_app(**overrides))


@pytest.fixture
def client() -> Iterator[TestClient]:
    with build_client() as test_client:
        yield test_client


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {TEST_SECRET}"}
