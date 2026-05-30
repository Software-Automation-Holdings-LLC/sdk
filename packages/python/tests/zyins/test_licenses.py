"""Licenses sub-client tests.

Covers serialization, response parsing (with and without the ADR-012
envelope), validation, and 5xx funneling.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import pytest
from pydantic import ValidationError

from sah_sdk.core.errors import ISAError
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import (
    LicenseCheckInput,
    LicenseDeactivateInput,
    ZyInsClient,
)

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


def test_check_serializes_and_parses_status() -> None:
    transport = RecordingTransport(response_body=json.dumps({"status": "valid"}))
    client = ZyInsClient(_TOKEN, transport=transport)
    result = client.license.check(
        LicenseCheckInput(
            email="john.doe@acme-agency.com",
            keycode="ABC-123-XYZ",
            device_id="device-1",
        )
    )
    assert result.status == "valid"
    method, url, headers, body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v2/licenses/check")
    assert "Idempotency-Key" in headers
    assert "Authorization" not in headers
    assert headers["X-Device-ID"] == "device-1"
    assert json.loads(body or "") == {
        "email": "john.doe@acme-agency.com",
        "keycode": "ABC-123-XYZ",
        "deviceId": "device-1",
    }


def test_check_tolerates_adr012_envelope() -> None:
    transport = RecordingTransport(
        response_body=json.dumps({"data": {"status": "inactive"}})
    )
    client = ZyInsClient(_TOKEN, transport=transport)
    result = client.license.check(
        LicenseCheckInput(email="x@x", keycode="ABC-123-XYZ")
    )
    assert result.status == "inactive"


def test_check_rejects_missing_email() -> None:
    with pytest.raises(ValidationError, match="email"):
        LicenseCheckInput(email="", keycode="ABC-123-XYZ")


def test_check_surfaces_5xx_as_isa_error() -> None:
    transport = RecordingTransport(
        response_status=500,
        response_body=json.dumps({"code": "server_error", "detail": "boom"}),
    )
    client = ZyInsClient(_TOKEN, transport=transport)
    with pytest.raises(ISAError):
        client.license.check(LicenseCheckInput(email="x@x", keycode="ABC-123-XYZ"))


def test_deactivate_serializes_and_parses_status() -> None:
    transport = RecordingTransport(response_body=json.dumps({"status": "inactive"}))
    client = ZyInsClient(_TOKEN, transport=transport)
    result = client.license.deactivate(
        LicenseDeactivateInput(
            email="john.doe@acme-agency.com",
            keycode="ABC-123-XYZ",
            device_id="device-1",
        )
    )
    assert result.status == "inactive"
    method, url, headers, body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v2/licenses/deactivate")
    assert "Authorization" not in headers
    assert headers["X-Device-ID"] == "device-1"
    assert json.loads(body or "")["deviceId"] == "device-1"
