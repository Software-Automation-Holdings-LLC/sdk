"""Typed Envelope fields + .with_raw_response variants."""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from sah_sdk.core.envelope import extract_envelope_fields
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import (
    Applicant,
    Coverage,
    Envelope,
    Isa,
    NicotineUsage,
    PrequalifyInput,
    RawResponse,
    Sex,
)


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


def _input() -> PrequalifyInput:
    return PrequalifyInput(
        applicant=Applicant(
            dob="1962-04-18",
            sex=Sex.MALE,
            height_inches=70,
            weight_pounds=195,
            state="NC",
            nicotine_use=NicotineUsage.NONE,
        ),
        coverage=Coverage.face_value(100_000),
        products="colonial-penn.final-expense",
    )


def test_envelope_carries_typed_fields() -> None:
    body = json.dumps(
        {
            "plans": [],
            "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
            "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
            "livemode": True,
            "retry_attempts": 2,
        }
    )
    transport = RecordingTransport(response_body=body)
    isa = _bearer_isa(transport)
    env = isa.zyins.prequalify(_input())

    assert isinstance(env, Envelope)
    assert env.request_id == "req_01HZK2N5GQR9T8X4B6FJW3Y1AS"
    assert env.idempotency_key == "550e8400-e29b-41d4-a716-446655440000"
    assert env.livemode is True
    assert env.retry_attempts == 2
    # Typed payload preserved.
    assert env.data.plans == ()


def test_envelope_falls_back_to_client_minted_key() -> None:
    body = json.dumps({"plans": [], "request_id": "req_x"})
    transport = RecordingTransport(response_body=body)
    isa = _bearer_isa(transport)
    env = isa.zyins.prequalify(_input(), idempotency_key="case-42")
    # Server omitted idempotency_key — SDK echoes the key it sent.
    assert env.idempotency_key == "case-42"


def test_with_raw_response_returns_envelope_and_raw() -> None:
    body = json.dumps(
        {
            "plans": [],
            "request_id": "req_raw_01",
            "idempotency_key": "k-1",
            "livemode": False,
            "retry_attempts": 0,
        }
    )
    transport = RecordingTransport(
        response_body=body,
        response_status=200,
        response_headers={
            "x-isa-request-id": "req_raw_01",
            "content-type": "application/json",
        },
    )
    isa = _bearer_isa(transport)

    env, raw = isa.zyins.prequalify.with_raw_response(_input())

    assert isinstance(env, Envelope)
    assert env.request_id == "req_raw_01"

    assert isinstance(raw, RawResponse)
    assert raw.status == 200
    assert raw.url.endswith("/v1/prequalify")
    assert raw.headers["x-isa-request-id"] == "req_raw_01"


def test_with_raw_response_quote_variant() -> None:
    body = json.dumps({"plans": [], "request_id": "req_quote_01"})
    transport = RecordingTransport(response_body=body, response_status=200)
    isa = _bearer_isa(transport)
    from sah_sdk.zyins import QuoteInput

    qi = QuoteInput(
        applicant=_input().applicant,
        coverage=_input().coverage,
        products="colonial-penn.final-expense",
    )
    env, raw = isa.zyins.quote.with_raw_response(qi)
    assert env.request_id == "req_quote_01"
    assert raw.status == 200
    assert raw.url.endswith("/v1/quote")


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
