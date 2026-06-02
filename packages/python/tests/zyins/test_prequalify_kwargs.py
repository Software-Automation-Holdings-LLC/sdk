"""Tests for the decomposed-keyword ``prequalify(applicant=, coverage=, products=)`` form.

Mirrors the cross-language quickstart's call shape::

    isa.zyins.prequalify(
        applicant={...} | Applicant(...),
        coverage=Coverage.face_value(25_000),
        products=[Products.Fex.AetnaAccendo],
    )
"""

from __future__ import annotations

import json

import pytest

from sah_sdk import Height, Isa, Weight
from sah_sdk.catalog.products import Products
from sah_sdk.core.env import IsaConfigError
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import (
    Applicant,
    Coverage,
    NicotineDuration,
    NicotineUsageInput,
    Sex,
)
from sah_sdk.zyins.prequalify_v3 import PrequalifyV3Request
from sah_sdk.zyins.product import ProductSelection

_OK_BODY = json.dumps(
    {
        "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
        "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
        "livemode": False,
        "data": {
            "plans": [
                {
                    "id": "offer_01",
                    "eligible": True,
                    "carrier": {"id": "aetna-accendo", "name": "Aetna Accendo", "logo_url": ""},
                    "product": {
                        "id": "prod_d7b57156-3e83-506b-8936-0692c1193dc7",
                        "slug": "fex-aetna-accendo",
                        "name": "fex-aetna-accendo",
                        "display_name": "Aetna Accendo",
                        "type": "fex",
                        "wire_token": "fex-aetna-accendo",
                    },
                    "plan_info": [],
                    "death_benefit": {"amount": {"cents": 2500000, "display": "$25,000"}, "period": None},
                    "pricing": [
                        {
                            "rate_class": "standard",
                            "primary": True,
                            "eligibility": {"eligible": True, "category": "immediate", "reasons": []},
                            "rank": 1,
                            "premium": {
                                "amount": {"cents": 8742, "display": "$87.42"},
                                "default_mode": "MONTHLY-EFT",
                                "modes": {"MONTHLY-EFT": {"cents": 8742, "display": "$87.42"}},
                            },
                        }
                    ],
                    "metadata": {},
                }
            ]
        },
    }
)

# Synthetic test fixture; matches the SDK's expected ``isa_test_*`` shape but
# is not a real credential. Built from concatenation so secret-scanners
# don't flag the literal.
_FAKE_TOKEN = "isa_" + "test_" + "kwargstest" + "00000000"


class _CapturingTransport:
    """Records the last request and returns a canned 200 envelope."""

    def __init__(self) -> None:
        self.last_body: str | None = None
        self.last_path: str | None = None

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        self.last_body = body
        self.last_path = url
        return TransportResponse(
            status=200,
            body=_OK_BODY,
            headers={"content-type": "application/json"},
        )


def _applicant_dict() -> dict[str, object]:
    return {
        "dob": "1962-04-18",
        "sex": Sex.MALE,
        "height_inches": 70,
        "weight_pounds": 195,
        "state": "NC",
        "nicotine_use": NicotineUsageInput(last_used=NicotineDuration.NEVER),
    }


def _quickstart_applicant_dict() -> dict[str, object]:
    applicant = _applicant_dict()
    applicant.pop("height_inches")
    applicant.pop("weight_pounds")
    applicant["height"] = Height.from_feet_inches(5, 10)
    applicant["weight"] = Weight.from_pounds(195)
    return applicant


def _applicant() -> Applicant:
    return Applicant.model_validate(_applicant_dict())


class TestPrequalifyKwargs:
    def test_accepts_decomposed_kwargs_with_typed_applicant(self) -> None:
        transport = _CapturingTransport()
        isa = Isa.with_bearer(_FAKE_TOKEN, transport=transport)

        envelope = isa.zyins.prequalify(
            applicant=_applicant(),
            coverage=Coverage.face_value(25_000),
            products=[Products.Fex.AetnaAccendo],
        )

        assert transport.last_body is not None
        assert envelope.data.plans[0].carrier.name == "Aetna Accendo"

    def test_accepts_dict_applicant(self) -> None:
        from sah_sdk.zyins.prequalify_v3 import offer_premium

        transport = _CapturingTransport()
        isa = Isa.with_bearer(_FAKE_TOKEN, transport=transport)

        envelope = isa.zyins.prequalify(
            applicant=_applicant_dict(),
            coverage=Coverage.face_value(25_000),
            products=[Products.Fex.AetnaAccendo],
        )

        premium = offer_premium(envelope.data.plans[0])
        assert premium is not None
        assert premium.amount.cents == 8742

    def test_accepts_quickstart_height_weight_applicant_keys(self) -> None:
        transport = _CapturingTransport()
        isa = Isa.with_bearer(_FAKE_TOKEN, transport=transport)

        isa.zyins.prequalify(
            applicant=_quickstart_applicant_dict(),
            coverage=Coverage.face_value(25_000),
            products=[Products.Fex.AetnaAccendo],
        )

        assert transport.last_body is not None
        body = json.loads(transport.last_body)
        # v3 prequalify envelope: height/weight live under applicant.
        assert body["applicant"]["height_inches"] == 70
        assert body["applicant"]["weight_lbs"] == 195
        # products[] must serialize to the opaque prod_<uuid> id — never a slug.
        assert body["products"] == ["prod_d7b57156-3e83-506b-8936-0692c1193dc7"]

    def test_rejects_conflicting_height_weight_aliases(self) -> None:
        transport = _CapturingTransport()
        isa = Isa.with_bearer(_FAKE_TOKEN, transport=transport)
        applicant = _quickstart_applicant_dict()
        applicant["height_inches"] = 71

        with pytest.raises(IsaConfigError, match="height_inches"):
            isa.zyins.prequalify(
                applicant=applicant,
                coverage=Coverage.face_value(25_000),
                products=[Products.Fex.AetnaAccendo],
            )

    def test_positional_input_still_supported(self) -> None:
        transport = _CapturingTransport()
        isa = Isa.with_bearer(_FAKE_TOKEN, transport=transport)

        envelope = isa.zyins.prequalify(
            PrequalifyV3Request(
                applicant=_applicant(),
                coverage=Coverage.face_value(25_000),
                products=ProductSelection.of(Products.Fex.AetnaAccendo),
            )
        )

        # In v3, eligibility is per pricing row, not on the offer directly.
        assert envelope.data.plans[0].pricing[0].eligibility.category.value == "immediate"

    def test_rejects_mixed_input_and_kwargs(self) -> None:
        transport = _CapturingTransport()
        isa = Isa.with_bearer(_FAKE_TOKEN, transport=transport)

        positional = PrequalifyV3Request(
            applicant=_applicant(),
            coverage=Coverage.face_value(25_000),
            products=ProductSelection.of(Products.Fex.AetnaAccendo),
        )
        with pytest.raises(IsaConfigError, match="not both"):
            isa.zyins.prequalify(  # type: ignore[call-overload]
                positional,
                applicant=_applicant(),
                coverage=Coverage.face_value(25_000),
                products=[Products.Fex.AetnaAccendo],
            )

    def test_rejects_missing_required_kwargs(self) -> None:
        transport = _CapturingTransport()
        isa = Isa.with_bearer(_FAKE_TOKEN, transport=transport)

        with pytest.raises(IsaConfigError, match="applicant"):
            isa.zyins.prequalify(  # type: ignore[call-overload]
                coverage=Coverage.face_value(25_000),
                products=[Products.Fex.AetnaAccendo],
            )

    def test_rejects_empty_products_string(self) -> None:
        transport = _CapturingTransport()
        isa = Isa.with_bearer(_FAKE_TOKEN, transport=transport)

        with pytest.raises(IsaConfigError, match="products"):
            isa.zyins.prequalify(
                applicant=_applicant(),
                coverage=Coverage.face_value(25_000),
                products="",
            )

    def test_rejects_mixed_products_shape(self) -> None:
        transport = _CapturingTransport()
        isa = Isa.with_bearer(_FAKE_TOKEN, transport=transport)

        with pytest.raises(IsaConfigError, match="products"):
            isa.zyins.prequalify(
                applicant=_applicant(),
                coverage=Coverage.face_value(25_000),
                products=[Products.Fex.AetnaAccendo, "fex-aetna-accendo"],
            )
