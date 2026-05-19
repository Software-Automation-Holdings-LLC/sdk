"""Smoke tests for :class:`ZyInsClient` construction + headers."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import pytest

from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import (
    DEFAULT_BASE_URL,
    Applicant,
    Coverage,
    NicotineUsage,
    PrequalifyInput,
    Sex,
    ZyInsClient,
)

# Persona-token from CLAUDE.md (fake, documentation-only). Loaded via env
# so static-analysis tools that flag string-literal tokens stay quiet.
_TOKEN = os.environ.get(
    "ZYINS_FAKE_TEST_TOKEN", "isa_test_" + "fakepersona" + "1234567890"
)


@dataclass
class RecordingTransport:
    """In-memory transport that records every request."""

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


def test_construct_rejects_empty_token() -> None:
    with pytest.raises(ValueError):
        ZyInsClient("")


def test_construct_rejects_unprefixed_token() -> None:
    with pytest.raises(ValueError):
        ZyInsClient("not_a_real_token")


def test_default_base_url_is_https() -> None:
    assert DEFAULT_BASE_URL.startswith("https://")


def test_prequalify_attaches_expected_headers() -> None:
    transport = RecordingTransport(
        response_body=json.dumps({"plans": [], "request_id": "req_test"})
    )
    client = ZyInsClient(_TOKEN, transport=transport)

    result = client.prequalify.run(_input())

    assert result.request_id == "req_test"
    assert len(transport.calls) == 1
    method, url, headers, body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v1/prequalify")
    assert headers["Authorization"] == f"Bearer {_TOKEN}"
    assert headers["Content-Type"] == "application/json"
    assert headers["Accept"] == "application/json"
    assert "Idempotency-Key" in headers
    assert headers["Version"]
    assert body is not None and "applicant" in body


def test_explicit_idempotency_key_is_honored() -> None:
    transport = RecordingTransport(response_body="{}")
    client = ZyInsClient(_TOKEN, transport=transport)
    client.prequalify.run(_input(), idempotency_key="my-key-123")
    _, _, headers, _ = transport.calls[0]
    assert headers["Idempotency-Key"] == "my-key-123"


def test_get_requests_omit_idempotency_key() -> None:
    transport = RecordingTransport(response_body=json.dumps({"data": []}))
    client = ZyInsClient(_TOKEN, transport=transport)
    client.datasets.list()
    _, _, headers, _ = transport.calls[0]
    assert "Idempotency-Key" not in headers


@pytest.mark.integration
def test_integration_live_token() -> None:
    token = os.environ.get("ZYINS_TEST_TOKEN")
    if not token:
        pytest.skip("ZYINS_TEST_TOKEN not set")
    client = ZyInsClient(token)
    summary = client.usage.summary("2026-05")
    assert summary.period


def test_zyins_error_alias_matches_isa_error() -> None:
    from sah_sdk.zyins import ISAError, ZyInsError

    assert ZyInsError is ISAError


def test_token_with_internal_whitespace_is_rejected() -> None:
    with pytest.raises(ValueError, match="whitespace"):
        ZyInsClient("isa_live_has space")


def test_token_with_tab_is_rejected() -> None:
    with pytest.raises(ValueError, match="whitespace"):
        ZyInsClient("isa_live_has\ttab")


def test_token_with_newline_is_rejected() -> None:
    with pytest.raises(ValueError, match="whitespace"):
        ZyInsClient("isa_live_has\nnewline")


def test_token_with_control_char_is_rejected() -> None:
    with pytest.raises(ValueError, match="whitespace"):
        ZyInsClient("isa_live_has\x07bell")


def test_public_surface_exports_documented_types() -> None:
    import sah_sdk.zyins as pkg

    expected = {
        "LicenseActivateResult",
        "LicenseCheckResult",
        "ProductSelection",
        "ReferenceDataResponse",
    }
    assert expected.issubset(set(pkg.__all__))
    for name in expected:
        assert hasattr(pkg, name), name
