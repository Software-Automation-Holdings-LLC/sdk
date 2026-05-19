"""Typed response envelope and raw-response wrapper.

Per SDK_DESIGN.md §4.6 the wire envelope is::

    {
      "data": { ... },
      "request_id": "req_…",
      "idempotency_key": "550e…",
      "livemode": true,
      "retry_attempts": 0
    }

The Python SDK exposes those five fields as typed dataclass attributes
on :class:`Envelope` — never as a free-form ``dict[str, Any]``. The
:class:`RawResponse` wrapper carries the HTTP-level metadata that
:meth:`.with_raw_response` variants return alongside the parsed body.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, Generic, TypeVar

T = TypeVar("T")


def _empty_headers() -> Mapping[str, str]:
    """Return a read-only empty header map (used as the default headers)."""
    return MappingProxyType({})


@dataclass(frozen=True, slots=True)
class RawResponse:
    """HTTP-level metadata returned by ``.with_raw_response`` variants.

    :attr:`headers` is a read-only mapping so callers cannot mutate the
    captured header set after the SDK returns.
    """

    status: int
    url: str
    headers: Mapping[str, str] = field(default_factory=_empty_headers)


@dataclass(frozen=True, slots=True)
class Envelope(Generic[T]):
    """Typed wrapper around a parsed response body.

    ``data`` is the operation-specific parsed type (e.g.
    :class:`~.prequalify.PrequalifyResult`). The remaining fields mirror
    the wire envelope verbatim.
    """

    data: T
    request_id: str = ""
    idempotency_key: str = ""
    livemode: bool = False
    retry_attempts: int = 0


def extract_envelope_fields(
    raw: Mapping[str, Any],
    *,
    idempotency_key_sent: str | None = None,
    retry_attempts: int = 0,
) -> tuple[str, str, bool, int]:
    """Pull the four scalar envelope fields out of a parsed JSON object.

    Servers may omit the new fields during the migration window; we
    fall back to ``idempotency_key_sent`` (the key the SDK minted client-
    side) so consumers always see a non-empty value for at least the
    correlation half of the contract.
    """
    request_id = _coerce_str(raw.get("request_id"))
    idempotency_key = _coerce_str(raw.get("idempotency_key")) or (
        idempotency_key_sent or ""
    )
    livemode = bool(raw.get("livemode", False))
    server_attempts = raw.get("retry_attempts")
    attempts = (
        int(server_attempts) if isinstance(server_attempts, int) else retry_attempts
    )
    return request_id, idempotency_key, livemode, attempts


def _coerce_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)
