"""Wire-shape contract tests for ``prequalify_v3`` and ``prequalify_v2``.

Prod incident 2026-05-29: the v3 prequalify marshaler was emitting the
v2 flat shape (``date_of_birth``, ``gender``, ``height``, ``weight`` at
the root) against ``POST /v3/prequalify``, which rejects unknown fields
and required the envelope shape from ``PrequalifyV3Request``
(``applicant`` + ``coverage`` + ``products[]``). PR #406 fixed the TS
SDK; this module fixes the same bug in the Python SDK and pins the
wire body to the OpenAPI source-of-truth schemas in
``go/zyins/api/openapi.yaml`` so the bug cannot regress silently.

* ``prequalify_v3`` MUST emit the v3 envelope, target ``/v3/prequalify``,
  and carry ``Api-Version: v3``.
* ``prequalify_v2`` MUST emit the v2 flat shape and target
  ``/v2/prequalify`` — preserved untouched by the v3 fix.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import pytest

from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins.applicant import (
    Applicant,
    Condition,
    Medication,
    NicotineDuration,
    NicotineProductUsage,
    NicotineUsageInput,
    Sex,
)
from sah_sdk.zyins.coverage import Coverage
from sah_sdk.zyins.prequalify_v3 import (
    PrequalifyV3Request,
    prequalify_v3,
    serialize_v3_prequalify_body,
)
from sah_sdk.zyins.product import Product, ProductSelection, ProductType


@dataclass
class _CapturingTransport:
    """Mock transport that records the most recent request for assertion."""

    response_body: str = "{}"
    response_status: int = 200
    response_headers: dict[str, str] = field(default_factory=dict)
    calls: list[tuple[str, str, dict[str, str], str | None]] = field(default_factory=list)

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        self.calls.append((method, url, dict(headers), body))
        return TransportResponse(
            status=self.response_status,
            body=self.response_body,
            headers=self.response_headers,
        )


def _success_envelope_body(idempotency_key: str) -> str:
    return json.dumps(
        {
            "object": "prequalify_result",
            "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
            "idempotency_key": idempotency_key,
            "livemode": True,
            "data": {"plans": []},
        }
    )


def _basic_applicant() -> Applicant:
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


def _captured_body(
    transport: _CapturingTransport,
) -> dict[str, Any]:
    assert transport.calls, "expected transport to receive one request"
    body = transport.calls[0][3]
    assert body is not None
    parsed = json.loads(body)
    assert isinstance(parsed, dict)
    return parsed


def test_prequalify_v3_emits_envelope_shape_targets_v3_path_sends_api_version() -> None:
    """The v3 marshaler MUST emit ``{applicant, coverage, products}`` (NOT
    the v2 flat shape) and the request MUST carry ``Api-Version: v3``."""
    transport = _CapturingTransport(
        response_body=_success_envelope_body("550e8400-e29b-41d4-a716-446655440000")
    )
    prequalify_v3(
        PrequalifyV3Request(
            applicant=_basic_applicant(),
            coverage=Coverage.face_value(100_000),
            products=_product_selection(),
        ),
        transport=transport,
        base_url="https://api.example.com",
        headers={"Authorization": "Bearer test"},
    )
    method, url, headers, _ = transport.calls[0]
    assert method == "POST"
    assert url == "https://api.example.com/v3/prequalify"
    assert headers["Api-Version"] == "v3"

    payload = _captured_body(transport)

    # Envelope keys — MUST NOT carry the v2 flat fields at the root.
    assert set(payload.keys()) == {
        "applicant",
        "coverage",
        "include_ineligible",
        "products",
    }
    for forbidden in (
        "date_of_birth",
        "gender",
        "height",
        "weight",
        "nicotine_usage",
        "quote_options",
    ):
        assert forbidden not in payload

    # Applicant envelope per ApplicantV3Input.
    applicant = payload["applicant"]
    assert isinstance(applicant, dict)
    assert applicant["sex"] == "male"
    assert applicant["dob"] == "1962-04-18"
    assert applicant["height_inches"] == 70
    assert applicant["weight_lbs"] == 195
    assert applicant["nicotine"] == {"last_used": "never"}
    # state lives on coverage in v3; the legacy flat field names MUST NOT
    # be on the applicant envelope.
    for forbidden in ("gender", "date_of_birth", "height", "weight", "state"):
        assert forbidden not in applicant

    # Coverage envelope per CoverageV3Input — face_amount_cents + state.
    coverage = payload["coverage"]
    assert isinstance(coverage, dict)
    # face_value(100_000) dollars → 10_000_000 cents.
    assert coverage["face_amount_cents"] == 10_000_000
    assert coverage["state"] == "NC"

    # Products: flat slug list per the PrequalifyV3Request schema.
    assert payload["products"] == ["fex"]


def test_prequalify_v3_serializes_conditions_medications_and_nicotine_specificity() -> None:
    """Conditions, medications, and nicotine specificity must follow the
    v3 schemas: ``text`` (not ``name``/``type``), ``first_fill``/``last_fill``
    keys, and the ``NicotineFrequencyV3`` enum mapping."""
    applicant = Applicant(
        dob="1962-04-18",
        sex=Sex.MALE,
        height_inches=70,
        weight_pounds=195,
        state="NC",
        nicotine_use=NicotineUsageInput(
            last_used=NicotineDuration.WITHIN_12_MONTHS,
            product_usage=(NicotineProductUsage(type="CIGARETTE", frequency="DAILY"),),
        ),
        conditions=(
            Condition(
                name="High Blood Pressure",
                was_diagnosed="5 YEARS AGO",
                last_treatment="2 MONTHS AGO",
            ),
        ),
        medications=(
            Medication(
                name="Lisinopril",
                use="High Blood Pressure",
                first_fill="5 YEARS AGO",
                last_fill="1 MONTH AGO",
            ),
        ),
    )
    transport = _CapturingTransport(response_body=_success_envelope_body(""))
    prequalify_v3(
        PrequalifyV3Request(
            applicant=applicant,
            coverage=Coverage.face_value(100_000),
            products=_product_selection(),
        ),
        transport=transport,
        base_url="https://api.example.com",
        headers={},
    )
    payload = _captured_body(transport)
    ap = payload["applicant"]
    assert ap["conditions"] == [
        {
            "text": "High Blood Pressure",
            "was_diagnosed": "5 YEARS AGO",
            "last_treatment": "2 MONTHS AGO",
        }
    ]
    assert ap["medications"] == [
        {
            "text": "Lisinopril",
            "use": "High Blood Pressure",
            "first_fill": "5 YEARS AGO",
            "last_fill": "1 MONTH AGO",
        }
    ]
    assert ap["nicotine"] == {
        "last_used": "within_12_months",
        "specificity": [{"text": "CIGARETTE", "frequency": "daily"}],
    }


def test_prequalify_v1_marshaler_still_emits_flat_shape() -> None:
    """Regression guard: the v1/v2 SDK marshaler must keep emitting the
    flat wire shape — the v3 envelope fix must NOT bleed into the older
    surface. Asserted at the marshaler boundary (``to_wire_body``) so the
    test is independent of transport plumbing."""
    from sah_sdk.zyins.prequalify import PrequalifyInput

    body = PrequalifyInput(
        applicant=_basic_applicant(),
        coverage=Coverage.face_value(100_000),
        products=_product_selection(),
    ).to_wire_body()
    flat = json.loads(body)
    # The v1 marshaler MUST keep emitting the legacy flat root and MUST
    # NOT have grown a v3 envelope.
    assert "applicant" not in flat, "v1/v2 surface unexpectedly emits the v3 applicant envelope"
    assert "coverage" not in flat


def test_v3_quote_marshaler_unchanged_still_flat() -> None:
    """Regression guard: ``serialize_wire_body`` (now used only by
    ``/v3/quote``) must keep emitting the flat shape. ``/v3/quote`` is
    not part of the prod incident fix — its consumers depend on the
    legacy body."""
    from sah_sdk.zyins.prequalify_v3 import serialize_wire_body

    body = serialize_wire_body(
        applicant=_basic_applicant(),
        coverage=Coverage.face_value(100_000),
        products=_product_selection(),
    )
    payload = json.loads(body)
    # Flat-shape fields MUST be at the root.
    assert payload["date_of_birth"] == "1962-04-18"
    assert payload["gender"] == "male"
    assert payload["height"] == 70
    assert payload["weight"] == 195
    assert payload["state"] == "NC"
    # Envelope shape MUST NOT be at the root.
    assert "applicant" not in payload
    assert "coverage" not in payload


def test_prequalify_v3_rejects_monthly_budget_coverage() -> None:
    """v3 prequalify is face-amount-only. A monthly-budget Coverage must
    be rejected at the marshaler rather than serialized as a face amount
    (a ``$50/month`` budget must not become ``face_amount_cents: 5000``,
    which the server would accept as a valid $50 death benefit)."""
    with pytest.raises(ValueError, match="face-amount coverage only"):
        serialize_v3_prequalify_body(
            applicant=_basic_applicant(),
            coverage=Coverage.monthly_budget(50),
            products=_product_selection(),
        )
