"""Tier 3 logos operations — ``GET /v1/logo/{carrier}`` (synonym ``/v1/logos``).

Static carrier-brand assets. Per ``api-standards.md`` the endpoint sits on
the GET allowlist and is non-credentialed; the SDK does NOT attach auth
headers. Two response shapes are negotiated via the ``?ds=`` query parameter:

* ``?ds=true``  — server returns a ``data:image/...;base64,...`` text body.
* default       — server returns the raw image bytes (typically PNG/JPEG).

The Python surface presents a single call: ``client.zyins.logos.get(carrier,
data_uri=False)``. When ``data_uri=False`` (default) the result is ``bytes``;
when ``data_uri=True`` the result is a ``str`` data URI. Callers never
juggle two shapes at one call site.

Mirror of ``packages/ts/src/zyins/logos.ts``. The 404 surfaces through the
existing :class:`~..core.errors.ISAError` funnel; an empty carrier and a
non-``data:`` response on the data-URI path both raise a typed error.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from urllib.parse import quote as urlquote

import httpx

from ..core.errors import ISAError, from_http_response

#: Canonical path on the platform. Per zyins #303 ``/v1/logos/{c}`` is a
#: server-side synonym; the SDK uses ``/v1/logo`` because that's the
#: shipping path. Callers wiring the SDK against a vendor that exposes
#: only the plural form can override at construction.
LOGOS_PATH = "/v1/logo"


@dataclass(frozen=True, slots=True)
class LogosResponse:
    """Minimal binary-aware HTTP response shape the logos module needs."""

    status: int
    body: bytes
    headers: dict[str, str]

    def text(self) -> str:
        """Decode the body as UTF-8, replacing invalid bytes."""
        return self.body.decode("utf-8", errors="replace")


class LogosFetch(Protocol):
    """Injectable fetcher for the logos endpoint. Tests pass a stub."""

    def __call__(self, url: str) -> LogosResponse: ...


class _HttpxLogosFetch:
    """Default httpx-backed fetcher.

    A standalone fetcher (rather than reusing the SDK's text-only
    :class:`~..core.transport.Transport`) is required because the raw-bytes
    path must round-trip binary safely.
    """

    __slots__ = ("_client", "_owns")

    def __init__(self, *, client: httpx.Client | None = None, timeout: float = 30.0) -> None:
        self._client = client or httpx.Client(timeout=timeout)
        self._owns = client is None

    def __call__(self, url: str) -> LogosResponse:
        response = self._client.get(url)
        return LogosResponse(
            status=response.status_code,
            body=response.content,
            headers={k.lower(): v for k, v in response.headers.items()},
        )

    def close(self) -> None:
        if self._owns:
            self._client.close()


class LogosSubClient:
    """``client.zyins.logos`` — carrier-logo fetcher.

    Constructed once per :class:`ZyInsClient`; non-credentialed, so no
    auth context is plumbed in.
    """

    __slots__ = ("_base_url", "_fetch", "_path_prefix")

    def __init__(
        self,
        base_url: str,
        *,
        fetch: LogosFetch | None = None,
        path_prefix: str = LOGOS_PATH,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._fetch = fetch or _HttpxLogosFetch()
        self._path_prefix = path_prefix

    def get(self, carrier: str, *, data_uri: bool = False) -> bytes | str:
        """Fetch the carrier-logo asset.

        Returns ``bytes`` (raw image) by default; pass ``data_uri=True``
        for the ``data:image/...;base64,...`` string variant. Callers
        pick one shape; the SDK does not return a union per call site.
        """
        if not carrier:
            raise ISAError(
                "zyins.logos.get: carrier is required",
                code="validation_error",
            )
        url = self._build_url(carrier, data_uri=data_uri)
        response = self._fetch(url)
        if response.status < 200 or response.status >= 300:
            raise from_http_response(response.status, response.text())
        if data_uri:
            return _assert_data_uri(response.text())
        return response.body

    def close(self) -> None:
        close = getattr(self._fetch, "close", None)
        if callable(close):
            close()

    def _build_url(self, carrier: str, *, data_uri: bool) -> str:
        path = f"{self._path_prefix}/{urlquote(carrier, safe='')}"
        suffix = "?ds=true" if data_uri else ""
        return f"{self._base_url}{path}{suffix}"


def _assert_data_uri(body: str) -> str:
    """Guard the data-URI response path.

    Surfaces a clear typed error when the server (or a misconfigured proxy)
    hands back non-text on ``?ds=true`` instead of silently returning a body
    that *looks* like a URI but isn't.
    """
    if not body.startswith("data:image/"):
        raise ISAError(
            "zyins.logos.get: expected a data:image/... URI but got: "
            f"{body[:32]}",
            code="unknown",
        )
    return body
