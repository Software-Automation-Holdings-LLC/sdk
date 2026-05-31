"""Tests for the v3 prequalify parser + transport entry point."""

from __future__ import annotations

import json
import re
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
from sah_sdk.zyins.prequalify_v3 import (
    PrequalifyV3Options,
    PrequalifyV3Request,
    V3EligibilityCategory,
    parse_prequalify_v3_envelope,
    prequalify_v3,
    serialize_wire_body,
)
from sah_sdk.zyins.product import Product, ProductSelection, ProductType


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
            "object": "prequalify",
            "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
            "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
            "livemode": True,
            "data": {
                "plans": [
                    {
                        "object": "plan_offer",
                        "id": "11111111-2222-3333-4444-555555555555",
                        "eligible": True,
                        "carrier": {
                            "id": "aetna-accendo",
                            "name": "Aetna Accendo",
                            "logo_url": "https://logos.example/aetna-accendo.png",
                        },
                        "product": {
                            "id": "fex",
                            "slug": "final-expense",
                            "name": "Final Expense",
                            "display_name": "Final Expense",
                            "type": "final_expense",
                            "wire_token": "fex",
                        },
                        "plan_info": [{"label": "Riders", "value": "ADB"}],
                        "death_benefit": {"amount": {"cents": 1000000, "display": "$10,000"}, "period": None},
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
                                    "amount": {"cents": 8742, "display": "$87.42"},
                                    "default_mode": "MONTHLY-EFT",
                                    "modes": {
                                        "MONTHLY-EFT": {
                                            "cents": 8742,
                                            "display": "$87.42",
                                        },
                                        "ANNUAL": {
                                            "cents": 100000,
                                            "display": "$1,000.00",
                                        },
                                    },
                                },
                            },
                            {
                                "rate_class": "standard-tobacco",
                                "primary": False,
                                "eligibility": {
                                    "category": "other",
                                    "eligible": False,
                                    "reasons": ["nicotine usage"],
                                },
                                "rank": None,
                            },
                        ],
                        "metadata": {"campaign": "default"},
                    }
                ]
            },
        }
    )


def test_serialize_wire_body_emits_flat_v3_shape() -> None:
    body = serialize_wire_body(
        applicant=_applicant(),
        coverage=Coverage.face_value(10_000),
        products=_product_selection(),
    )
    payload = json.loads(body)
    assert payload["date_of_birth"] == "1962-04-18"
    assert payload["gender"] == "male"
    assert payload["height"] == 70
    assert payload["weight"] == 195
    assert payload["state"] == "NC"
    assert payload["nicotine_usage"] == {"last_used": "never"}
    assert payload["quote_options"] == {
        "quote_type": "face_amounts",
        "amounts": ["10000"],
    }
    assert payload["products"] == ["fex"]
    # include_ineligible defaults to True per the v3 contract.
    assert payload["include_ineligible"] is True


def test_serialize_wire_body_propagates_options() -> None:
    body = serialize_wire_body(
        applicant=_applicant(),
        coverage=Coverage.monthly_budget(50),
        products=_product_selection(),
        options=PrequalifyV3Options(
            only_product_class="fex",
            min_rank="standard",
            show_unreleased=True,
            include_ineligible=False,
        ),
    )
    payload = json.loads(body)
    assert payload["only_product_class"] == "fex"
    assert payload["min_rank"] == "standard"
    assert payload["show_unreleased"] is True
    assert payload["include_ineligible"] is False
    assert payload["quote_options"]["quote_type"] == "monthly_budget"


def test_parse_envelope_typed_pricing_rows() -> None:
    result = parse_prequalify_v3_envelope(
        _sample_envelope(),
        idempotency_key="fallback",
        retry_attempts=2,
    )
    assert result.request_id == "req_01HZK2N5GQR9T8X4B6FJW3Y1AS"
    assert result.idempotency_key == "550e8400-e29b-41d4-a716-446655440000"
    assert result.livemode is True
    assert result.retry_attempts == 2
    assert len(result.plans) == 1
    offer = result.plans[0]
    assert offer.object == "plan_offer"
    assert offer.carrier.name == "Aetna Accendo"
    assert offer.death_benefit is not None
    assert offer.death_benefit.amount.cents == 1_000_000
    assert offer.death_benefit.amount.display == "$10,000"
    assert offer.death_benefit.period is None
    assert offer.budget is None
    assert len(offer.pricing) == 2
    first = offer.pricing[0]
    assert first.primary is True
    assert first.rate_class == "preferred"
    assert first.eligibility.category is V3EligibilityCategory.IMMEDIATE
    assert first.eligibility.eligible is True
    assert first.rank == 1
    assert first.premium is not None
    assert first.premium.amount.cents == 8742
    assert first.premium.default_mode == "MONTHLY-EFT"
    assert first.premium.modes["ANNUAL"].cents == 100_000
    second = offer.pricing[1]
    assert second.primary is False
    assert second.rank is None
    assert second.premium is None
    assert second.eligibility.eligible is False
    assert second.eligibility.reasons == ("nicotine usage",)


def test_prequalify_v3_mints_idempotency_key_when_missing() -> None:
    transport = _RecordingTransport(response_body=_sample_envelope())
    result = prequalify_v3(
        PrequalifyV3Request(
            applicant=_applicant(),
            coverage=Coverage.face_value(10_000),
            products=_product_selection(),
        ),
        transport=transport,
        base_url="https://api.example.com",
        headers={"Authorization": "Bearer test"},
    )
    _, url, headers, body = transport.calls[0]
    assert url == "https://api.example.com/v3/prequalify"
    key = headers["Idempotency-Key"]
    # UUID v4 shape: 8-4-4-4-12, version digit 4, variant in {8, 9, a, b}.
    assert re.match(
        r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        key,
    )
    # The envelope's idempotency_key overrides our minted one on success.
    assert result.idempotency_key == "550e8400-e29b-41d4-a716-446655440000"
    assert headers["Content-Type"] == "application/json"
    assert headers["Authorization"] == "Bearer test"
    assert body is not None


def test_prequalify_v3_raises_typed_error_on_4xx() -> None:
    transport = _RecordingTransport(response_status=400, response_body="bad request")
    with pytest.raises(ISAError):
        prequalify_v3(
            PrequalifyV3Request(
                applicant=_applicant(),
                coverage=Coverage.face_value(10_000),
                products=_product_selection(),
            ),
            transport=transport,
            base_url="https://api.example.com",
            headers={},
        )


def test_prequalify_v3_propagates_retry_after_on_429() -> None:
    from sah_sdk.core.errors import RateLimitError

    transport = _RecordingTransport(
        response_status=429,
        response_body="slow down",
        response_headers={"retry-after": "30"},
    )
    with pytest.raises(RateLimitError) as exc_info:
        prequalify_v3(
            PrequalifyV3Request(
                applicant=_applicant(),
                coverage=Coverage.face_value(10_000),
                products=_product_selection(),
            ),
            transport=transport,
            base_url="https://api.example.com",
            headers={},
        )
    assert exc_info.value.retry_after_seconds == 30.0
