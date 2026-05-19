"""Top-level :class:`ZyInsClient` and its sub-clients.

The constructor takes one positional argument — the bearer token —
because the platform's post-#286 contract makes that the entire auth
surface. Everything else (transport, base URL, timeout) is an
explicit keyword with a safe default.

Sub-clients are exposed as attributes so the discoverable surface is::

    client.prequalify.run(input)
    client.quote.run(input)
    client.datasets.list()
    client.datasets.get(id)
    client.reference_data.get(kind)
    client.usage.summary(period)
    client.license.activate()
    client.license.deactivate()
    client.license.check()
    client.case.email(input)
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlencode

from ..core.auth import BearerAuth
from ..core.debug import DebugLogger
from ..core.idempotency import generate_idempotency_key
from ..core.transport import HttpTransport, Transport, raise_for_status
from .datasets import Dataset, parse_dataset, parse_dataset_list
from .license import (
    LicenseActivateResult,
    LicenseCheckResult,
    parse_activate,
    parse_check,
)
from .prequalify import PrequalifyInput, PrequalifyResult, parse_prequalify_response
from .quote import QuoteInput, QuoteResult, parse_quote_response
from .reference_data import ReferenceDataResponse, parse_reference_data
from .usage import UsageSummary, parse_usage_summary

DEFAULT_BASE_URL = "https://zyins.isaapi.com"
DEFAULT_TIMEOUT_SECONDS = 30.0

# Date-pinned platform version header. Bump on each public-API
# minor release. Callers can override per-request via the ``version``
# kwarg on individual operations.
DEFAULT_VERSION_HEADER = "2026-05-18"

_JSON_CONTENT_TYPE = "application/json"
_MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


@dataclass(frozen=True, slots=True)
class _DispatchResult:
    """Result of an internal request: parsed status, body, and metadata.

    Wraps the bare transport response with the request URL and the
    idempotency key the SDK actually put on the wire so :class:`Isa`'s
    envelope/raw-response machinery never has to re-derive either.
    """

    status: int
    url: str
    body: str
    headers: Mapping[str, str]
    idempotency_key_sent: str | None


class ZyInsClient:
    """The ZyINS API client.

    One bearer token is the full auth surface. The token alone sets
    ``Authorization: Bearer <token>``; idempotency keys and the
    version header are managed automatically.

    Example::

        from sah_sdk.zyins.client import ZyInsClient

        client = ZyInsClient("isa_live_<your-token>")
        result = client.prequalify.run(input)
    """

    def __init__(
        self,
        token: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        version: str = DEFAULT_VERSION_HEADER,
        transport: Transport | None = None,
    ) -> None:
        self._auth = BearerAuth(token)
        self._base_url = base_url.rstrip("/")
        self._version = version
        self._transport: Transport = transport or HttpTransport(timeout=timeout)
        self._owns_transport = transport is None
        # Debug logger reads ISA_LOG at construction; when disabled every
        # log_* call is a single attribute read + early return.
        self._debug = DebugLogger()

        self.prequalify = PrequalifySubClient(self)
        self.quote = QuoteSubClient(self)
        self.datasets = DatasetsSubClient(self)
        self.reference_data = ReferenceDataSubClient(self)
        self.usage = UsageSubClient(self)
        self.license = LicenseSubClient(self)
        self.case = CaseSubClient(self)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Release the underlying httpx client (if owned)."""
        if self._owns_transport and isinstance(self._transport, HttpTransport):
            self._transport.close()

    def __enter__(self) -> ZyInsClient:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Internal HTTP helper used by every sub-client.
    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: str | None = None,
        idempotency_key: str | None = None,
        version: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> str:
        """Send a request and return the raw response body.

        Raises a typed :class:`~.errors.ISAError` for any non-2xx
        status. The caller is responsible for parsing the body.
        """
        result = self._dispatch(
            method=method,
            path=path,
            body=body,
            idempotency_key=idempotency_key,
            version=version,
            extra_headers=extra_headers,
        )
        return result.body

    def _dispatch(
        self,
        *,
        method: str,
        path: str,
        body: str | None = None,
        idempotency_key: str | None = None,
        version: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> _DispatchResult:
        """Send a request and return status + body + headers + minted key.

        Single dispatch point used by both the legacy :meth:`_request`
        surface and the :class:`~.isa.Isa` envelope/raw-response surface.
        Centralizing here keeps debug logging, header construction, and
        idempotency-key minting in exactly one place.
        """
        method_upper = method.upper()
        headers: dict[str, str] = {
            "Accept": _JSON_CONTENT_TYPE,
            "Version": version or self._version,
            **self._auth.headers(),
        }
        if body is not None:
            headers["Content-Type"] = _JSON_CONTENT_TYPE
        minted_key: str | None = None
        if method_upper in _MUTATING_METHODS:
            minted_key = idempotency_key or generate_idempotency_key()
            headers["Idempotency-Key"] = minted_key
        if extra_headers:
            headers.update(extra_headers)

        url = f"{self._base_url}{path}"
        self._debug.log_request(method_upper, url, headers, body)
        response = self._transport.request(
            method_upper, url, headers=headers, body=body
        )
        self._debug.log_response(
            method_upper, url, response.status, response.headers, response.body
        )
        raise_for_status(response)
        return _DispatchResult(
            status=response.status,
            url=url,
            body=response.body,
            headers=response.headers,
            idempotency_key_sent=minted_key,
        )


# ----------------------------------------------------------------------
# Sub-clients
# ----------------------------------------------------------------------


class PrequalifySubClient:
    """``client.prequalify`` namespace."""

    _PATH = "/v1/prequalify"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def run(
        self, input: PrequalifyInput, *, idempotency_key: str | None = None
    ) -> PrequalifyResult:
        body = input.to_wire_body()
        raw = self._client._request(
            "POST", self._PATH, body=body, idempotency_key=idempotency_key
        )
        return parse_prequalify_response(raw)


class QuoteSubClient:
    """``client.quote`` namespace."""

    _PATH = "/v1/quote"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def run(
        self, input: QuoteInput, *, idempotency_key: str | None = None
    ) -> QuoteResult:
        body = input.to_wire_body()
        raw = self._client._request(
            "POST", self._PATH, body=body, idempotency_key=idempotency_key
        )
        return parse_quote_response(raw)


class DatasetsSubClient:
    """``client.datasets`` namespace."""

    _PATH = "/v1/datasets"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def list(self) -> tuple[Dataset, ...]:
        raw = self._client._request("GET", self._PATH)
        return parse_dataset_list(raw)

    def get(self, id: str) -> Dataset:
        if not id:
            raise ValueError("datasets.get: id must be a non-empty string")
        raw = self._client._request("GET", f"{self._PATH}/{quote(id, safe='')}")
        return parse_dataset(raw)


class ReferenceDataSubClient:
    """``client.reference_data`` namespace."""

    _PATH = "/v1/reference-data"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def get(self, kind: str, **params: str) -> ReferenceDataResponse:
        if not kind:
            raise ValueError("reference_data.get: kind must be a non-empty string")
        # Reference-data queries take their key in the path, with optional
        # query params for sub-selection. The server hands back the
        # canonical shape; we preserve it as a dict.
        path = f"{self._PATH}/{quote(kind, safe='')}"
        if params:
            query = urlencode(sorted(params.items()))
            path = f"{path}?{query}"
        raw = self._client._request("GET", path)
        return parse_reference_data(raw, kind=kind)


class UsageSubClient:
    """``client.usage`` namespace."""

    _PATH = "/v1/usage"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def summary(self, period: str) -> UsageSummary:
        if not period:
            raise ValueError("usage.summary: period must be a non-empty string")
        raw = self._client._request(
            "GET", f"{self._PATH}/summary?{urlencode({'period': period})}"
        )
        return parse_usage_summary(raw, period=period)


class LicenseSubClient:
    """``client.license`` namespace."""

    _PATH = "/v1/license"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def activate(self) -> LicenseActivateResult:
        raw = self._client._request("POST", f"{self._PATH}/activate", body="{}")
        return parse_activate(raw)

    def deactivate(self) -> None:
        self._client._request("POST", f"{self._PATH}/deactivate", body="{}")

    def check(self) -> LicenseCheckResult:
        raw = self._client._request("GET", f"{self._PATH}/check")
        return parse_check(raw)


class CaseSubClient:
    """``client.case`` namespace."""

    _PATH = "/v1/case"

    def __init__(self, client: ZyInsClient) -> None:
        self._client = client

    def email(
        self, input: dict[str, Any], *, idempotency_key: str | None = None
    ) -> dict[str, Any]:
        """Email a case summary to the applicant or agent.

        The TS surface for this endpoint is still firming up; the
        Python SDK accepts and returns plain dicts until the wire
        contract stabilizes. Typed wrappers will follow.
        """
        import json as _json

        body = _json.dumps(input, separators=(",", ":"))
        raw = self._client._request(
            "POST", f"{self._PATH}/email", body=body, idempotency_key=idempotency_key
        )
        return _json.loads(raw) if raw else {}
