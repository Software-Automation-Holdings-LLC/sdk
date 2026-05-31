"""``POST /v3/quote`` — v3 quote transport + parser (Python).

Mirror of ``packages/ts/src/zyins/quote-v3.ts``.

Shares the uniform ``pricing[]`` table and the flat ``plans[]`` envelope
with v3 prequalify (see :mod:`sah_sdk.zyins.prequalify_v3`). Both
endpoints answer one flat array; group client-side by the requested
dimension with :func:`~sah_sdk.zyins.prequalify_v3.by_amount`
(``death_benefit`` for face amounts, ``budget`` for monthly budgets).
Money is the ``{cents, display}`` amount paired with a recurrence
period; the v2 string-money map is gone in v3.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from ..core.errors import from_http_response
from ..core.idempotency import generate_idempotency_key
from ..core.transport import Transport
from .applicant import Applicant
from .coverage import Coverage
from .prequalify_v3 import (
    PrequalifyV3Options,
    V3Offer,
    _coerce_offer,  # internal: shared offer coercion
    _retry_after_seconds,
    _retry_attempts_from_headers,
    _to_bool,
    _to_str,
    serialize_wire_body,
)
from .product import ProductSelection


@dataclass(frozen=True, slots=True)
class QuoteV3Result:
    """Output of ``POST /v3/quote`` — the identical flat ``plans`` shape as
    :class:`~sah_sdk.zyins.prequalify_v3.PrequalifyV3Result`."""

    plans: Sequence[V3Offer]
    request_id: str
    idempotency_key: str
    livemode: bool
    retry_attempts: int


@dataclass(frozen=True, slots=True)
class QuoteV3Options(PrequalifyV3Options):
    """Options layered on top of the v3 quote request.

    Mirrors :class:`PrequalifyV3Options` exactly — same fields, same
    defaults. Subclass rather than alias so the symbol shows up
    independently on the public surface and Sphinx/SDK consumers see
    a real type at ``zyins.QuoteV3Options``.
    """


@dataclass(frozen=True, slots=True)
class QuoteV3Request:
    """Inputs accepted by :func:`quote_v3`."""

    applicant: Applicant
    coverage: Coverage
    products: ProductSelection
    options: QuoteV3Options | None = None


_QUOTE_V3_PATH = "/v3/quote"


def quote_v3(
    request: QuoteV3Request,
    *,
    transport: Transport,
    base_url: str,
    headers: Mapping[str, str],
    idempotency_key: str | None = None,
) -> QuoteV3Result:
    """Run a v3 quote call. Returns a flat ``plans`` list; raises typed errors."""
    body = serialize_wire_body(
        applicant=request.applicant,
        coverage=request.coverage,
        products=request.products,
        options=request.options,
    )
    minted_key = idempotency_key or generate_idempotency_key()
    request_headers: dict[str, str] = {
        **dict(headers),
        "Content-Type": "application/json",
        "Idempotency-Key": minted_key,
    }
    response = transport.request(
        "POST",
        f"{base_url}{_QUOTE_V3_PATH}",
        headers=request_headers,
        body=body,
    )
    if response.status < 200 or response.status >= 300:
        raise from_http_response(
            response.status,
            response.body,
            request_id=response.request_id(),
            retry_after_seconds=_retry_after_seconds(response.headers),
        )
    return parse_quote_v3_envelope(
        response.body,
        idempotency_key=minted_key,
        retry_attempts=_retry_attempts_from_headers(response.headers),
    )


def parse_quote_v3_envelope(
    body: str, *, idempotency_key: str = "", retry_attempts: int = 0
) -> QuoteV3Result:
    """Parse a ``/v3/quote`` envelope body into a :class:`QuoteV3Result`."""
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"ZyIns quote_v3: failed to parse response body: {exc.msg}"
        ) from exc
    root = parsed if isinstance(parsed, dict) else {}
    request_id = _to_str(root.get("request_id"))
    echo_key = _to_str(root.get("idempotency_key")) or idempotency_key
    livemode_raw = root.get("livemode")
    livemode = True if livemode_raw is None else _to_bool(livemode_raw)
    data_raw = root.get("data")
    data = data_raw if isinstance(data_raw, dict) else {}
    # Absent plans (vs present-but-empty) indicates wire-shape drift; fail fast.
    if "plans" not in data:
        raise ValueError("ZyIns quote_v3: missing plans field in v3 response")
    plans_raw = data["plans"]
    plans_seq = plans_raw if isinstance(plans_raw, list) else []
    plans = tuple(_coerce_offer(p) for p in plans_seq)
    return QuoteV3Result(
        plans=plans,
        request_id=request_id,
        idempotency_key=echo_key,
        livemode=livemode,
        retry_attempts=retry_attempts,
    )


__all__ = [
    "QuoteV3Options",
    "QuoteV3Request",
    "QuoteV3Result",
    "parse_quote_v3_envelope",
    "quote_v3",
]
