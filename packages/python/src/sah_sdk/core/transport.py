"""HTTP transport facade.

Wraps httpx so the rest of the SDK never imports it directly — a
test or alternative transport can replace :class:`HttpTransport`
without changing call sites. This is the Python equivalent of the
TS ``transport.ts`` injection seam.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from .errors import from_http_response


@dataclass(frozen=True, slots=True)
class TransportResponse:
    status: int
    body: str
    headers: dict[str, str]

    def request_id(self) -> str | None:
        return self.headers.get("x-request-id") or self.headers.get("X-Request-Id")


class Transport(Protocol):
    """Minimal HTTP transport contract used by every operation."""

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse: ...


class HttpTransport:
    """Default httpx-backed transport. Sync API.

    The client owns the underlying :class:`httpx.Client`; close it via
    :meth:`close` or use the transport as a context manager.
    """

    def __init__(
        self, *, timeout: float = 30.0, client: httpx.Client | None = None
    ) -> None:
        self._client = client or httpx.Client(timeout=timeout)
        self._owns_client = client is None

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        response = self._client.request(
            method,
            url,
            headers=headers,
            content=body,
        )
        return TransportResponse(
            status=response.status_code,
            body=response.text,
            headers={k.lower(): v for k, v in response.headers.items()},
        )

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> HttpTransport:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


def raise_for_status(response: TransportResponse) -> None:
    """Raise a typed :class:`~.errors.ISAError` for any non-2xx status."""
    if 200 <= response.status < 300:
        return
    retry_after = response.headers.get("retry-after")
    retry_after_seconds: float | None = None
    if retry_after is not None:
        try:
            retry_after_seconds = float(retry_after)
        except ValueError:
            retry_after_seconds = None
    raise from_http_response(
        response.status,
        response.body,
        request_id=response.request_id(),
        retry_after_seconds=retry_after_seconds,
    )
