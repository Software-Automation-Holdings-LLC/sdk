"""Typed Envelope fields + .with_raw_response variants."""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from sah_sdk.catalog.products import Products
from sah_sdk.core.envelope import extract_envelope_fields
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import (
    Applicant,
    Coverage,
    Envelope,
    Isa,
    NicotineUsage,
    RawResponse,
    Sex,
)
from sah_sdk.zyins.prequalify_v3 import PrequalifyV3Request
from sah_sdk.zyins.product import ProductSelection
from sah_sdk.zyins.quote_v3 import QuoteV3Request


@dataclass
class RecordingTransport:
    """Captures every request; returns a deterministic envelope body."""

    response_body: str = ""
    response_status: int = 200
    response_headers: dict[str, str] = field(default_factory=dict)
    calls: list[tuple[str, str, dict[str, str], str | None]] = field(
        default_factory=list
    )

    def request(
        self, method: str, url: str, *, headers: dict[str, str], body: str | None = None
    ) -> TransportResponse:
        self.calls.append((method, url, dict(headers), body))
        return TransportResponse(
            status=self.response_status,
            body=self.response_body,
            headers=self.response_headers,
        )


_FAKE_TOKEN = "isa_" + "test_" + "envelope_" + "fake0000000"


def _bearer_isa(transport: RecordingTransport) -> Isa:
    return Isa.with_bearer(_FAKE_TOKEN, transport=transport)


def _applicant() -> Applicant:
    return Applicant(
        dob="1962-04-18",
        sex=Sex.MALE,
        height_inches=70,
        weight_pounds=195,
        state="NC",
        nicotine_use=NicotineUsage.NONE,
    )


def _products() -> ProductSelection:
    return ProductSelection.of(Products.Fex.AetnaAccendo)


def _prequalify_request() -> PrequalifyV3Request:
    return PrequalifyV3Request(
        applicant=_applicant(),
        coverage=Coverage.face_value(100_000),
        products=_products(),
    )


def _v3_body(**overrides: object) -> str:
    """A minimal valid ``/v3/prequalify`` envelope, with overrides merged in."""
    base: dict[str, object] = {"data": {"plans": []}}
    base.update(overrides)
    return json.dumps(base)


def test_envelope_carries_typed_fields() -> None:
    body = _v3_body(
        request_id="req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
        idempotency_key="550e8400-e29b-41d4-a716-446655440000",
        livemode=True,
    )
    transport = RecordingTransport(response_body=body)
    isa = _bearer_isa(transport)
    env = isa.zyins.prequalify(_prequalify_request())

    assert isinstance(env, Envelope)
    assert env.request_id == "req_01HZK2N5GQR9T8X4B6FJW3Y1AS"
    assert env.idempotency_key == "550e8400-e29b-41d4-a716-446655440000"
    assert env.livemode is True
    # Typed payload preserved.
    assert tuple(env.data.plans) == ()


def test_envelope_falls_back_to_client_minted_key() -> None:
    body = _v3_body(request_id="req_x")
    transport = RecordingTransport(response_body=body)
    isa = _bearer_isa(transport)
    env = isa.zyins.prequalify(_prequalify_request(), idempotency_key="case-42")
    # Server omitted idempotency_key — SDK echoes the key it sent.
    assert env.idempotency_key == "case-42"


def test_with_raw_response_returns_envelope_and_raw() -> None:
    body = _v3_body(request_id="req_raw_01", idempotency_key="k-1", livemode=False)
    transport = RecordingTransport(
        response_body=body,
        response_status=200,
        response_headers={
            "x-isa-request-id": "req_raw_01",
            "content-type": "application/json",
        },
    )
    isa = _bearer_isa(transport)

    env, raw = isa.zyins.prequalify.with_raw_response(_prequalify_request())

    assert isinstance(env, Envelope)
    assert env.request_id == "req_raw_01"

    assert isinstance(raw, RawResponse)
    assert raw.status == 200
    assert raw.url.endswith("/v3/prequalify")
    assert raw.headers["x-isa-request-id"] == "req_raw_01"


def test_with_raw_response_quote_variant() -> None:
    body = _v3_body(request_id="req_quote_01")
    transport = RecordingTransport(response_body=body, response_status=200)
    isa = _bearer_isa(transport)

    qr = QuoteV3Request(
        applicant=_applicant(),
        coverage=Coverage.face_value(100_000),
        products=_products(),
    )
    env, raw = isa.zyins.quote.with_raw_response(qr)
    assert env.request_id == "req_quote_01"
    assert raw.status == 200
    assert raw.url.endswith("/v3/quote")


def test_extract_envelope_fields_defaults() -> None:
    request_id, idem, livemode, attempts = extract_envelope_fields({})
    assert request_id == ""
    assert idem == ""
    assert livemode is False
    assert attempts == 0


def test_extract_envelope_fields_respects_server_values() -> None:
    raw = {
        "request_id": "req_x",
        "idempotency_key": "k-x",
        "livemode": True,
        "retry_attempts": 3,
    }
    request_id, idem, livemode, attempts = extract_envelope_fields(
        raw, idempotency_key_sent="k-from-sdk"
    )
    assert request_id == "req_x"
    # Server value wins over SDK-minted.
    assert idem == "k-x"
    assert livemode is True
    assert attempts == 3
