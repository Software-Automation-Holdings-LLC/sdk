"""``POST /v3/quote`` — v3 quote transport + parser (Python).

Mirror of ``packages/ts/src/zyins/quote-v3.ts``.

Shares the uniform ``pricing[]`` table shape with v3 prequalify
(see :mod:`sah_sdk.zyins.prequalify_v3`). The quote endpoint groups
qualifying products by requested amount for side-by-side comparison
tables. Money is integer cents + display string; the v2 string-money
map is gone in v3.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Literal

from ..core.errors import from_http_response
from ..core.idempotency import generate_idempotency_key
from ..core.transport import Transport
from .applicant import Applicant
from .coverage import Coverage
from .prequalify_v3 import (
    PrequalifyV3Options,
    V3Money,
    V3OfferCarrier,
    V3OfferProduct,
    V3PricingRow,
    _coerce_offer,  # internal: shared offer coercion
    _retry_after_seconds,
    _retry_attempts_from_headers,
    _to_bool,
    _to_str,
    coerce_carrier,
    coerce_money,
    coerce_pricing_row,
    coerce_product,
    serialize_wire_body,
)
from .product import ProductSelection


@dataclass(frozen=True, slots=True)
class QuoteV3Product:
    """One product within a quote amount group."""

    object: Literal["plan_offer"]
    id: str
    eligible: bool
    carrier: V3OfferCarrier
    product: V3OfferProduct
    death_benefit: V3Money
    pricing: Sequence[V3PricingRow]


@dataclass(frozen=True, slots=True)
class QuoteV3Group:
    """All qualifying products for one requested amount."""

    amount: str
    products: Sequence[QuoteV3Product]


@dataclass(frozen=True, slots=True)
class QuoteV3Result:
    """Output of ``POST /v3/quote``."""

    results: Sequence[QuoteV3Group]
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
    """Run a v3 quote call. Returns typed amount groups; raises typed errors."""
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
    groups_raw = data.get("results")
    groups_seq = groups_raw if isinstance(groups_raw, list) else []
    results = tuple(_coerce_group(g) for g in groups_seq)
    return QuoteV3Result(
        results=results,
        request_id=request_id,
        idempotency_key=echo_key,
        livemode=livemode,
        retry_attempts=retry_attempts,
    )


def _coerce_quote_product(raw: object) -> QuoteV3Product:
    obj = raw if isinstance(raw, dict) else {}
    pricing_raw = obj.get("pricing")
    pricing = (
        tuple(coerce_pricing_row(row) for row in pricing_raw)
        if isinstance(pricing_raw, list)
        else ()
    )
    return QuoteV3Product(
        object="plan_offer",
        id=_to_str(obj.get("id")),
        eligible=_to_bool(obj.get("eligible")),
        carrier=coerce_carrier(obj.get("carrier")),
        product=coerce_product(obj.get("product")),
        death_benefit=coerce_money(obj.get("death_benefit")),
        pricing=pricing,
    )


def _coerce_group(raw: object) -> QuoteV3Group:
    obj = raw if isinstance(raw, dict) else {}
    products_raw = obj.get("products")
    products = (
        tuple(_coerce_quote_product(p) for p in products_raw)
        if isinstance(products_raw, list)
        else ()
    )
    return QuoteV3Group(amount=_to_str(obj.get("amount")), products=products)


# Re-export the offer coercion symbol so it stays reachable for tests
# that probe the parser without using the public envelope path.
_ = _coerce_offer  # keep import binding alive for type checkers


__all__ = [
    "QuoteV3Group",
    "QuoteV3Options",
    "QuoteV3Product",
    "QuoteV3Request",
    "QuoteV3Result",
    "parse_quote_v3_envelope",
    "quote_v3",
]
