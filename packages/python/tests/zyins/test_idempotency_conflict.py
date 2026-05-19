"""409 idempotency_conflict raises IsaIdempotencyConflictError."""

from __future__ import annotations

import json

import pytest

from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import (
    Applicant,
    Coverage,
    IsaApiError,
    IsaIdempotencyConflictError,
    NicotineUsage,
    PrequalifyInput,
    Sex,
    ZyInsClient,
)


class ConflictTransport:
    """Transport that returns a 409 idempotency_conflict problem document."""

    def __init__(self, *, key: str, first_seen_at: str) -> None:
        self._body = json.dumps(
            {
                "type": "https://docs.isaapi.com/errors/idempotency_conflict",
                "title": "Idempotency-Key conflict",
                "status": 409,
                "code": "idempotency_conflict",
                "detail": "key already used with different body",
                "idempotency_key": key,
                "first_seen_at": first_seen_at,
                "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
            }
        )

    def request(
        self, method: str, url: str, *, headers: dict[str, str], body: str | None = None
    ) -> TransportResponse:
        return TransportResponse(
            status=409,
            body=self._body,
            headers={"content-type": "application/problem+json"},
        )


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


_FAKE_TOKEN = "isa_" + "test_" + "conflicttest" + "00000000"


def test_409_raises_idempotency_conflict_error() -> None:
    transport = ConflictTransport(
        key="550e8400-e29b-41d4-a716-446655440000",
        first_seen_at="2026-05-14T14:32:01Z",
    )
    client = ZyInsClient(_FAKE_TOKEN, transport=transport)

    with pytest.raises(IsaIdempotencyConflictError) as exc:
        client.prequalify.run(_input(), idempotency_key="case-42")

    err = exc.value
    assert err.code == "idempotency_conflict"
    assert err.http_status == 409
    assert err.key == "550e8400-e29b-41d4-a716-446655440000"
    assert err.first_seen_at == "2026-05-14T14:32:01Z"
    assert err.request_id == "req_01HZK2N5GQR9T8X4B6FJW3Y1AS"


def test_idempotency_conflict_subclasses_isa_api_error() -> None:
    transport = ConflictTransport(key="abc", first_seen_at="2026-05-14T14:32:01Z")
    client = ZyInsClient(_FAKE_TOKEN, transport=transport)

    with pytest.raises(IsaApiError) as exc:
        client.prequalify.run(_input())
    assert isinstance(exc.value, IsaIdempotencyConflictError)
