import asyncio
import secrets
import time
from collections import deque
from collections.abc import Awaitable, Callable

from app.core.config import Settings
from app.core.errors import error_response
from starlette.types import Message, Receive, Scope, Send

ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


class PdfRequestGuardMiddleware:
    _protected_paths = {"/extract-pdf", "/extract-pdf-full"}

    def __init__(self, app: ASGIApp, settings: Settings) -> None:
        self.app = app
        self.settings = settings
        self._requests: deque[float] = deque()
        self._rate_lock = asyncio.Lock()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") == "OPTIONS"
            or scope.get("path", "").rstrip("/") not in self._protected_paths
        ):
            await self.app(scope, receive, send)
            return

        secret_value = (
            self.settings.BFF_SHARED_SECRET.get_secret_value()
            if self.settings.BFF_SHARED_SECRET is not None
            else ""
        )
        if len(secret_value) < 32:
            await error_response(
                503,
                "El servicio de extracción no está configurado.",
                "SERVICE_CONFIGURATION_ERROR",
            )(scope, receive, send)
            return

        headers = {
            key.lower(): value
            for key, value in scope.get("headers", [])
        }
        expected = f"Bearer {secret_value}".encode()
        authorization = headers.get(b"authorization", b"")
        if not secrets.compare_digest(authorization, expected):
            await error_response(
                401,
                "La credencial del servicio no es válida.",
                "UNAUTHORIZED",
            )(scope, receive, send)
            return

        max_request_bytes = (
            self.settings.MAX_UPLOAD_BYTES
            + self.settings.MULTIPART_OVERHEAD_BYTES
        )
        content_length = headers.get(b"content-length")
        if content_length is not None:
            try:
                declared_length = int(content_length)
            except ValueError:
                await error_response(
                    400,
                    "Content-Length no es válido.",
                    "INVALID_CONTENT_LENGTH",
                )(scope, receive, send)
                return
            if declared_length < 0 or declared_length > max_request_bytes:
                await error_response(
                    413,
                    "El archivo supera el tamaño máximo permitido.",
                    "PAYLOAD_TOO_LARGE",
                )(scope, receive, send)
                return

        retry_after = await self._consume_rate_limit()
        if retry_after is not None:
            await error_response(
                429,
                "Se alcanzó el límite temporal de extracciones.",
                "RATE_LIMIT_EXCEEDED",
                {"Retry-After": str(retry_after)},
            )(scope, receive, send)
            return

        received_bytes = 0
        buffered_messages: list[Message] = []
        while True:
            message = await receive()
            buffered_messages.append(message)
            if message["type"] == "http.request":
                received_bytes += len(message.get("body", b""))
                if received_bytes > max_request_bytes:
                    await error_response(
                        413,
                        "El archivo supera el tamaño máximo permitido.",
                        "PAYLOAD_TOO_LARGE",
                    )(scope, receive, send)
                    return
                if not message.get("more_body", False):
                    break
            elif message["type"] == "http.disconnect":
                break

        message_index = 0

        async def replay_receive() -> Message:
            nonlocal message_index
            if message_index >= len(buffered_messages):
                return {"type": "http.disconnect"}
            message = buffered_messages[message_index]
            message_index += 1
            return message

        await self.app(scope, replay_receive, send)

    async def _consume_rate_limit(self) -> int | None:
        now = time.monotonic()
        window = self.settings.PDF_RATE_LIMIT_WINDOW_SECONDS
        async with self._rate_lock:
            while self._requests and now - self._requests[0] >= window:
                self._requests.popleft()
            if len(self._requests) >= self.settings.PDF_RATE_LIMIT_REQUESTS:
                remaining = max(1, int(window - (now - self._requests[0]) + 0.999))
                return remaining
            self._requests.append(now)
        return None
