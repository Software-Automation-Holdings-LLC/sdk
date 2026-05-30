"""Tests for the v3 quote parser + transport entry point."""

from __future__ import annotations

import json
from dataclasses import dataclass, field

import pytest

from sah_sdk.core.errors import ISAError
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins.applicant import (
    Applicant,
    NicotineDuration,
    NicotineUsageInput,
    Sex,
)
from sah_sdk.zyins.coverage import Coverage
from sah_sdk.zyins.product import Product, ProductSelection, ProductType
from sah_sdk.zyins.quote_v3 import (
    QuoteV3Request,
    parse_quote_v3_envelope,
    quote_v3,
)


@dataclass
class _RecordingTransport:
    response_status: int = 200
    response_body: str = "{}"
    response_headers: dict[str, str] = field(default_factory=dict)
    calls: list[tuple[str, str, dict[str, str], str | None]] = field(
        default_factory=list
    )

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        self.calls.append((method, url, headers, body))
        return TransportResponse(
            status=self.response_status,
            body=self.response_body,
            headers=self.response_headers,
        )


def _applicant() -> Applicant:
    return Applicant(
        dob="1962-04-18",
        sex=Sex.MALE,
        height_inches=70,
        weight_pounds=195,
        state="NC",
        nicotine_use=NicotineUsageInput(last_used=NicotineDuration.NEVER),
    )


def _product_selection() -> ProductSelection:
    return ProductSelection.of(
        Product(
            brand="aetna-accendo",
            type=ProductType.FINAL_EXPENSE,
            wire_token="fex",
            display_name="Final Expense",
        )
    )


def _sample_envelope() -> str:
    return json.dumps(
        {
            "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
            "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
            "livemode": True,
            "data": {
                "results": [
                    {
                        "amount": "10000",
                        "products": [
                            {
                                "object": "plan_offer",
                                "id": "id-1",
                                "eligible": True,
                                "carrier": {
                                    "id": "aetna-accendo",
                                    "name": "Aetna Accendo",
                                    "logo_url": "",
                                },
                                "product": {
                                    "id": "fex",
                                    "slug": "fex",
                                    "name": "Final Expense",
                                    "display_name": "Final Expense",
                                    "type": "final_expense",
                                    "wire_token": "fex",
                                },
                                "death_benefit": {
                                    "cents": 1_000_000,
                                    "display": "$10,000",
                                },
                                "pricing": [
                                    {
                                        "rate_class": "preferred",
                                        "primary": True,
                                        "eligibility": {
                                            "category": "immediate",
                                            "eligible": True,
                                            "reasons": [],
                                        },
                                        "rank": 1,
                                        "premium": {
                                            "cents": 8742,
                                            "display": "$87.42",
                                            "default": {
                                                "cents": 8742,
                                                "display": "$87.42",
                                            },
                                            "modes": {},
                                        },
                                    }
                                ],
                            }
                        ],
                    }
                ]
            },
        }
    )


def test_parse_envelope_groups_by_amount() -> None:
    result = parse_quote_v3_envelope(_sample_envelope(), idempotency_key="x", retry_attempts=0)
    assert result.request_id == "req_01HZK2N5GQR9T8X4B6FJW3Y1AS"
    assert len(result.results) == 1
    group = result.results[0]
    assert group.amount == "10000"
    assert len(group.products) == 1
    product = group.products[0]
    assert product.object == "plan_offer"
    assert product.carrier.name == "Aetna Accendo"
    assert product.pricing[0].premium is not None
    assert product.pricing[0].premium.cents == 8742


def test_quote_v3_mints_idempotency_key_and_posts_to_v3_quote() -> None:
    transport = _RecordingTransport(response_body=_sample_envelope())
    quote_v3(
        QuoteV3Request(
            applicant=_applicant(),
            coverage=Coverage.face_value(10_000),
            products=_product_selection(),
        ),
        transport=transport,
        base_url="https://api.example.com",
        headers={"Authorization": "Bearer test"},
    )
    method, url, headers, body = transport.calls[0]
    assert method == "POST"
    assert url == "https://api.example.com/v3/quote"
    assert headers["Idempotency-Key"]
    assert headers["Content-Type"] == "application/json"
    assert body is not None


def test_quote_v3_raises_typed_error_on_5xx() -> None:
    transport = _RecordingTransport(response_status=500, response_body="boom")
    with pytest.raises(ISAError):
        quote_v3(
            QuoteV3Request(
                applicant=_applicant(),
                coverage=Coverage.face_value(10_000),
                products=_product_selection(),
            ),
            transport=transport,
            base_url="https://api.example.com",
            headers={},
        )


def test_quote_v3_propagates_retry_after_on_429() -> None:
    from sah_sdk.core.errors import RateLimitError

    transport = _RecordingTransport(
        response_status=429,
        response_body="slow down",
        response_headers={"retry-after": "30"},
    )
    with pytest.raises(RateLimitError) as exc_info:
        quote_v3(
            QuoteV3Request(
                applicant=_applicant(),
                coverage=Coverage.face_value(10_000),
                products=_product_selection(),
            ),
            transport=transport,
            base_url="https://api.example.com",
            headers={},
        )
    assert exc_info.value.retry_after_seconds == 30.0
