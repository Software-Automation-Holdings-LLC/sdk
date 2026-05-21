"""Health/readiness sub-client tests."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import pytest

from sah_sdk.core.errors import ISAError
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import ZyInsClient

_TOKEN = os.environ.get(
    "ZYINS_FAKE_TEST_TOKEN", "isa_test_" + "fakepersona" + "1234567890"
)


@dataclass
class RecordingTransport:
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


def test_get_readiness_parses_typed_response() -> None:
    body = json.dumps(
        {
            "ready": True,
            "status": "serving",
            "db": {
                "status": "serving",
                "latency_ms": 3,
                "checked_at": "2026-05-14T14:32:01Z",
            },
            "cache": {
                "status": "serving",
                "latency_ms": 1,
                "checked_at": "2026-05-14T14:32:01Z",
            },
            "checked_at": "2026-05-14T14:32:01Z",
        }
    )
    transport = RecordingTransport(response_body=body)
    client = ZyInsClient(_TOKEN, transport=transport)
    result = client.health.get_readiness()
    assert result.ready is True
    assert result.status == "serving"
    assert result.db.latency_ms == 3
    assert result.cache.status == "serving"
    method, url, _, _ = transport.calls[0]
    assert method == "GET"
    assert url.endswith("/ready")


def test_get_readiness_parses_downstream_map() -> None:
    body = json.dumps(
        {
            "ready": False,
            "status": "not_serving",
            "db": {"status": "serving", "latency_ms": 2, "checked_at": "x"},
            "cache": {
                "status": "not_serving",
                "latency_ms": 0,
                "message": "connection refused",
                "checked_at": "x",
            },
            "downstream_services": {
                "accounts": {
                    "status": "serving",
                    "latency_ms": 5,
                    "checked_at": "x",
                }
            },
            "checked_at": "x",
        }
    )
    transport = RecordingTransport(response_body=body)
    client = ZyInsClient(_TOKEN, transport=transport)
    result = client.health.get_readiness()
    assert result.ready is False
    assert result.cache.message == "connection refused"
    assert result.downstream_services["accounts"].latency_ms == 5


def test_get_readiness_surfaces_503_as_isa_error() -> None:
    transport = RecordingTransport(
        response_status=503,
        response_body=json.dumps(
            {"code": "service_unavailable", "detail": "not ready"}
        ),
    )
    client = ZyInsClient(_TOKEN, transport=transport)
    with pytest.raises(ISAError):
        client.health.get_readiness()
