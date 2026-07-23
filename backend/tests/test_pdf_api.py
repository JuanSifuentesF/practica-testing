import asyncio
import json
from dataclasses import replace

from app.routers import pdf
from app.services.extractor import FullExtractionResult

from tests.conftest import TEST_SECRET, build_app, build_client


def successful_result() -> FullExtractionResult:
    return FullExtractionResult(
        filename="syllabus.pdf",
        total_pages=1,
        extraction_method="pdfplumber",
        topics_dict={
            "FL-1.1.1": {
                "level_k": "K1",
                "name": "Objetivos de testing",
                "text": "Texto suficiente del tópico.",
                "chapter": 1,
                "section": "1.1",
            }
        },
        total_topics=1,
        level_distribution={"K1": 1, "K2": 0, "K3": 0},
        estimated_study_hours=0.5,
        warnings=[],
        is_complete=False,
    )


def assert_flat_error(response, status_code: int, error_code: str) -> None:
    assert response.status_code == status_code
    assert set(response.json()) == {"detail", "error_code"}
    assert response.json()["error_code"] == error_code
    assert isinstance(response.json()["detail"], str)


def test_valid_pdf_returns_200(client, auth_headers, monkeypatch) -> None:
    monkeypatch.setattr(
        pdf._extractor_service,
        "full_extraction",
        lambda **_kwargs: successful_result(),
    )

    response = client.post(
        "/extract-pdf-full",
        headers=auth_headers,
        files={"file": ("syllabus.pdf", b"%PDF-valid", "application/pdf")},
    )

    assert response.status_code == 200
    assert response.json()["contract_version"] == 2
    assert response.json()["total_topics"] == 1


def test_invalid_mime_returns_flat_400(client, auth_headers) -> None:
    response = client.post(
        "/extract-pdf-full",
        headers=auth_headers,
        files={"file": ("notes.txt", b"not-a-pdf", "text/plain")},
    )
    assert_flat_error(response, 400, "INVALID_FILE_TYPE")


def test_invalid_magic_bytes_returns_flat_400(client, auth_headers) -> None:
    response = client.post(
        "/extract-pdf-full",
        headers=auth_headers,
        files={"file": ("fake.pdf", b"not-a-pdf", "application/pdf")},
    )
    assert_flat_error(response, 400, "INVALID_PDF_HEADER")


def test_missing_auth_returns_401_before_body_parsing(client) -> None:
    response = client.post("/extract-pdf-full")
    assert_flat_error(response, 401, "UNAUTHORIZED")


def test_invalid_auth_returns_401_before_body_parsing(client) -> None:
    response = client.post(
        "/extract-pdf-full",
        headers={"Authorization": "Bearer incorrect-secret"},
    )
    assert_flat_error(response, 401, "UNAUTHORIZED")


def test_missing_server_secret_returns_503() -> None:
    with build_client(BFF_SHARED_SECRET=None) as client:
        response = client.post("/extract-pdf-full")
    assert_flat_error(response, 503, "SERVICE_CONFIGURATION_ERROR")


def test_missing_multipart_file_returns_flat_422(client, auth_headers) -> None:
    response = client.post("/extract-pdf-full", headers=auth_headers)
    assert_flat_error(response, 422, "MISSING_FILE")


def test_declared_request_over_limit_returns_413(auth_headers) -> None:
    with build_client(
        MAX_UPLOAD_BYTES=1024,
        MULTIPART_OVERHEAD_BYTES=1024,
    ) as client:
        response = client.post(
            "/extract-pdf-full",
            headers={**auth_headers, "Content-Length": "2049"},
        )
    assert_flat_error(response, 413, "PAYLOAD_TOO_LARGE")


def test_file_size_over_limit_returns_413(auth_headers) -> None:
    with build_client(
        MAX_UPLOAD_BYTES=1024,
        MULTIPART_OVERHEAD_BYTES=4096,
    ) as client:
        response = client.post(
            "/extract-pdf-full",
            headers=auth_headers,
            files={
                "file": (
                    "large.pdf",
                    b"%PDF-" + b"x" * 1020,
                    "application/pdf",
                )
            },
        )
    assert_flat_error(response, 413, "PAYLOAD_TOO_LARGE")


def test_chunked_request_over_limit_without_content_length_returns_413() -> None:
    application = build_app(
        MAX_UPLOAD_BYTES=1024,
        MULTIPART_OVERHEAD_BYTES=1024,
    )
    boundary = "pl12-boundary"
    body = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="file"; filename="large.pdf"\r\n'
        "Content-Type: application/pdf\r\n\r\n"
    ).encode() + b"%PDF-" + b"x" * 3000 + f"\r\n--{boundary}--\r\n".encode()
    incoming = [
        {
            "type": "http.request",
            "body": body[offset : offset + 256],
            "more_body": offset + 256 < len(body),
        }
        for offset in range(0, len(body), 256)
    ]
    outgoing = []
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/extract-pdf-full",
        "raw_path": b"/extract-pdf-full",
        "query_string": b"",
        "root_path": "",
        "headers": [
            (b"authorization", f"Bearer {TEST_SECRET}".encode()),
            (b"content-type", f"multipart/form-data; boundary={boundary}".encode()),
        ],
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
    }

    async def invoke() -> None:
        async def receive():
            return incoming.pop(0)

        async def send(message):
            outgoing.append(message)

        await application(scope, receive, send)

    asyncio.run(invoke())
    response_start = next(
        message for message in outgoing if message["type"] == "http.response.start"
    )
    response_body = b"".join(
        message.get("body", b"")
        for message in outgoing
        if message["type"] == "http.response.body"
    )

    assert response_start["status"] == 413
    assert json.loads(response_body) == {
        "detail": "El archivo supera el tamaño máximo permitido.",
        "error_code": "PAYLOAD_TOO_LARGE",
    }


def test_no_topics_returns_flat_422(client, auth_headers, monkeypatch) -> None:
    monkeypatch.setattr(
        pdf._extractor_service,
        "full_extraction",
        lambda **_kwargs: replace(
            successful_result(),
            topics_dict={},
            total_topics=0,
            level_distribution={"K1": 0, "K2": 0, "K3": 0},
            estimated_study_hours=0,
            is_complete=False,
        ),
    )
    response = client.post(
        "/extract-pdf-full",
        headers=auth_headers,
        files={"file": ("syllabus.pdf", b"%PDF-valid", "application/pdf")},
    )
    assert_flat_error(response, 422, "NO_TOPICS_DETECTED")


def test_unexpected_error_returns_generic_500(
    client,
    auth_headers,
    monkeypatch,
) -> None:
    def fail(**_kwargs):
        raise RuntimeError("SECRET_SENTINEL_MUST_NOT_LEAK")

    monkeypatch.setattr(pdf._extractor_service, "full_extraction", fail)
    response = client.post(
        "/extract-pdf-full",
        headers=auth_headers,
        files={"file": ("syllabus.pdf", b"%PDF-valid", "application/pdf")},
    )
    assert_flat_error(response, 500, "INTERNAL_ERROR")
    assert "SECRET_SENTINEL" not in response.text


def test_rate_limit_returns_429_with_retry_after(
    auth_headers,
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        pdf._extractor_service,
        "full_extraction",
        lambda **_kwargs: successful_result(),
    )
    with build_client(PDF_RATE_LIMIT_REQUESTS=1) as client:
        first = client.post(
            "/extract-pdf-full",
            headers=auth_headers,
            files={"file": ("first.pdf", b"%PDF-valid", "application/pdf")},
        )
        second = client.post(
            "/extract-pdf-full",
            headers=auth_headers,
            files={"file": ("second.pdf", b"%PDF-valid", "application/pdf")},
        )
    assert first.status_code == 200
    assert_flat_error(second, 429, "RATE_LIMIT_EXCEEDED")
    assert int(second.headers["retry-after"]) >= 1


def test_cors_uses_explicit_allowlist(client) -> None:
    response = client.options(
        "/extract-pdf-full",
        headers={
            "Origin": "https://frontend.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://frontend.example"
    assert response.headers.get("access-control-allow-credentials") is None


def test_openapi_declares_bff_auth_and_guard_errors(client) -> None:
    schema = client.get("/openapi.json").json()
    operation = schema["paths"]["/extract-pdf-full"]["post"]

    assert schema["components"]["securitySchemes"]["BFFBearer"] == {
        "type": "http",
        "description": "Credencial privada compartida por el BFF de Next.js.",
        "scheme": "bearer",
    }
    assert operation["security"] == [{"BFFBearer": []}]
    assert {"200", "400", "401", "413", "422", "429", "500", "503"} <= set(
        operation["responses"]
    )
