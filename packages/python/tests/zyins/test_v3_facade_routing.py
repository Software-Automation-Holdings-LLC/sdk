"""Per-surface ``api_version`` routing of ``isa.zyins.prequalify`` / ``.quote``.

Mirrors the TS SDK contract pinned in PR #377
(``feat(sdk-ts): wire v3 facade routing on prequalify/quote``):

* With ``api_version={'prequalify': 'v3'}`` the version-routed
  ``isa.zyins.prequalify`` attribute is identity-equal to the dedicated
  ``isa.zyins.prequalify_v3`` callable and POSTs ``/v3/prequalify``.
* With the bundled defaults (``v2``) it remains the legacy callable.
* The dedicated ``prequalify_v3`` / ``quote_v3`` callables refuse to run
  when their surface is not pinned to ``v3`` — config error, not a
  silent fallback.

These guards pin the locked behaviour ahead of the Phase 5 bundled-default
cut-over; flipping :data:`BUNDLED_API_VERSIONS` later is the deliberate
auditable bump that flips every consumer not pinned at v2.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

import pytest

from sah_sdk import Isa, IsaConfigError
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins.applicant import (
    Applicant,
    NicotineDuration,
    NicotineUsageInput,
    Sex,
)
from sah_sdk.zyins.coverage import Coverage
from sah_sdk.zyins.prequalify_v3 import PrequalifyV3Options, PrequalifyV3Request
from sah_sdk.zyins.product import Product, ProductSelection, ProductType
from sah_sdk.zyins.quote_v3 import QuoteV3Request

# ---------------------------------------------------------------------------
# Recording transport + canonical persona inputs.
# ---------------------------------------------------------------------------


@dataclass
class _RecordingTransport:
    """Test transport that records every call and returns a fixed body."""

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
    """John Doe, the project's canonical primary applicant persona."""
    return Applicant(
        dob="1962-04-18",
        sex=Sex.MALE,
        height_inches=70,
        weight_pounds=195,
        state="NC",
        nicotine_use=NicotineUsageInput(last_used=NicotineDuration.NEVER),
    )


def _coverage() -> Coverage:
    return Coverage.face_value(25000)


def _products() -> ProductSelection:
    return ProductSelection.of(
        Product(
            brand="aetna-accendo",
            type=ProductType.FINAL_EXPENSE,
            wire_token="fex",
            display_name="Final Expense",
        )
    )


def _v3_response_body() -> str:
    """Minimal valid ``/v3/prequalify`` and ``/v3/quote`` envelope."""
    return json.dumps(
        {
            "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
            "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
            "livemode": True,
            "data": {"plans": [], "results": []},
        }
    )


# ---------------------------------------------------------------------------
# Routing tests.
# ---------------------------------------------------------------------------


def test_prequalify_routes_to_v3_when_pinned() -> None:
    """``api_version={'prequalify': 'v3'}`` → ``prequalify`` is the v3 callable."""
    transport = _RecordingTransport(response_body=_v3_response_body())
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
        transport=transport,
        api_version={"prequalify": "v3"},
    )

    assert isa.zyins.prequalify is isa.zyins.prequalify_v3

    env = isa.zyins.prequalify(
        PrequalifyV3Request(
            applicant=_applicant(),
            coverage=_coverage(),
            products=_products(),
            options=PrequalifyV3Options(),
        )
    )

    assert any("/v3/prequalify" in call[1] for call in transport.calls), (
        f"expected POST /v3/prequalify, saw {[c[1] for c in transport.calls]}"
    )
    assert env.request_id == "req_01HZK2N5GQR9T8X4B6FJW3Y1AS"
    assert env.livemode is True


def test_prequalify_keeps_v2_alias_when_api_version_omitted() -> None:
    """Bundled default (``v2``) → ``prequalify`` aliases ``prequalify_v2``."""
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
    )

    assert isa.zyins.prequalify is isa.zyins.prequalify_v2
    assert isa.zyins.prequalify is not isa.zyins.prequalify_v3


def test_quote_routes_to_v3_when_pinned() -> None:
    """``api_version={'quote': 'v3'}`` → ``quote_v3`` POSTs ``/v3/quote``."""
    transport = _RecordingTransport(response_body=_v3_response_body())
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
        transport=transport,
        api_version={"quote": "v3"},
    )

    assert isa.zyins.quote is isa.zyins.quote_v3

    env = isa.zyins.quote_v3(
        QuoteV3Request(
            applicant=_applicant(),
            coverage=_coverage(),
            products=_products(),
        )
    )

    assert any("/v3/quote" in call[1] for call in transport.calls), (
        f"expected POST /v3/quote, saw {[c[1] for c in transport.calls]}"
    )
    assert env.request_id == "req_01HZK2N5GQR9T8X4B6FJW3Y1AS"


def test_prequalify_v3_refuses_to_run_when_prequalify_pinned_to_v2() -> None:
    """Calling the dedicated v3 callable while pinned to v2 raises IsaConfigError."""
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
    )

    with pytest.raises(IsaConfigError, match=r"api_version.*'v3'"):
        isa.zyins.prequalify_v3(
            PrequalifyV3Request(
                applicant=_applicant(),
                coverage=_coverage(),
                products=_products(),
            )
        )


def test_quote_v3_refuses_to_run_when_quote_pinned_to_v2() -> None:
    """Calling the dedicated v3 quote while quote is pinned to v2 raises."""
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
    )

    with pytest.raises(IsaConfigError, match=r"api_version.*'v3'"):
        isa.zyins.quote_v3(
            QuoteV3Request(
                applicant=_applicant(),
                coverage=_coverage(),
                products=_products(),
            )
        )
