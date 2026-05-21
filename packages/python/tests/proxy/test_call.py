"""Tests for ``isa.proxy.call`` — session-credential signed invocation.

The transport seam is mocked so tests never open sockets; the assertion
surface is the envelope shape on the wire, the auto-minted idempotency
key, the four signed headers, and the status → typed-error mapping.
"""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from typing import Any

import pytest

from sah_sdk.core.env import IsaConfigError
from sah_sdk.core.errors import (
    AuthError,
    ISAError,
    IsaIdempotencyConflictError,
    ValidationError,
)
from sah_sdk.isa import Isa
from sah_sdk.proxy.call import _default_transport

_UUID_V4 = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

_FIXTURE_SECRET = "-".join(["fixture", "value", "no", "wire", "meaning"])
_FIXTURE_BEARER = "_".join(["isa", "live", "unit", "test", "fixture"])


class RecordingTransport:
    """Transport double — records the one call it receives, returns canned data."""

    def __init__(self, status: int = 200, payload: Any = None) -> None:
        self.status = status
        self.payload = payload if payload is not None else {"ok": True}
        self.calls: list[dict[str, Any]] = []

    def __call__(
        self,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: bytes,
    ) -> tuple[int, bytes, dict[str, str]]:
        self.calls.append(
            {"method": method, "url": url, "headers": dict(headers), "body": body}
        )
        raw = json.dumps(self.payload).encode("utf-8")
        return self.status, raw, {"Content-Type": "application/json"}


def _session_isa() -> Isa:
    return Isa.with_session(session_id="sess_test_unit", session_secret=_FIXTURE_SECRET)


def test_rejects_bearer_identity() -> None:
    isa = Isa.with_bearer(token=_FIXTURE_BEARER)
    with pytest.raises(IsaConfigError, match="Session identity"):
        isa.proxy.call(integration_uuid="u", params={})


def test_rejects_license_identity() -> None:
    isa = Isa.with_license(keycode="ABC-123-XYZ", email="agent@example.com")
    with pytest.raises(IsaConfigError):
        isa.proxy.call(integration_uuid="u", params={})


def test_rejects_both_identifiers_set() -> None:
    isa = _session_isa()
    with pytest.raises(ValidationError):
        isa.proxy.call(
            integration_uuid="u",
            integration_id=1,
            params={},
            transport=RecordingTransport(),
        )


def test_rejects_neither_identifier_set() -> None:
    isa = _session_isa()
    with pytest.raises(ValidationError):
        isa.proxy.call(params={}, transport=RecordingTransport())


@pytest.mark.parametrize("integration_id", [0, -1])
def test_rejects_non_positive_integration_id_before_sending(integration_id: int) -> None:
    isa = _session_isa()
    with pytest.raises(ValidationError):
        isa.proxy.call(integration_id=integration_id, params={}, transport=RecordingTransport())


def test_envelope_shape_unflattened() -> None:
    isa = _session_isa()
    transport = RecordingTransport()
    isa.proxy.call(integration_uuid="int_abc", params={"foo": "bar"}, transport=transport)
    assert len(transport.calls) == 1
    body = json.loads(transport.calls[0]["body"].decode("utf-8"))
    assert body == {
        "integration_uuid": "int_abc",
        "method": "POST",
        "params": {"foo": "bar"},
    }


def test_empty_integration_uuid_is_unset_when_integration_id_is_valid() -> None:
    isa = _session_isa()
    transport = RecordingTransport()
    isa.proxy.call(
        integration_uuid="",
        integration_id=42,
        params={"foo": "bar"},
        transport=transport,
    )
    body = json.loads(transport.calls[0]["body"].decode("utf-8"))
    assert body == {
        "integration_id": 42,
        "method": "POST",
        "params": {"foo": "bar"},
    }


def test_default_transport_sets_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, float] = {}

    class FakeResponse:
        def __init__(self) -> None:
            self.status = 200
            self.headers: dict[str, str] = {}

        def __enter__(self) -> FakeResponse:
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return b'{"ok":true}'

    def fake_urlopen(_req: object, *, timeout: float) -> FakeResponse:
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr("sah_sdk.proxy.call.urllib.request.urlopen", fake_urlopen)

    status, _raw, _headers = _default_transport(
        "POST",
        "https://proxy.test/v1/call",
        {},
        b"{}",
        timeout=1.5,
    )

    assert status == 200
    assert captured["timeout"] == 1.5


def test_auto_mints_uuid_v4_idempotency_key() -> None:
    isa = _session_isa()
    transport = RecordingTransport()
    isa.proxy.call(integration_uuid="int_abc", params={}, transport=transport)
    headers = transport.calls[0]["headers"]
    assert _UUID_V4.match(headers["Idempotency-Key"]) is not None


def test_caller_idempotency_key_honored() -> None:
    isa = _session_isa()
    transport = RecordingTransport()
    isa.proxy.call(
        integration_uuid="int_abc",
        params={},
        idempotency_key="caller-supplied",
        transport=transport,
    )
    assert transport.calls[0]["headers"]["Idempotency-Key"] == "caller-supplied"


def test_session_auth_headers_present() -> None:
    isa = _session_isa()
    transport = RecordingTransport()
    isa.proxy.call(integration_uuid="int_abc", params={}, transport=transport)
    h = transport.calls[0]["headers"]
    assert h["Authorization"] == f"Bearer {_FIXTURE_SECRET}"
    assert h["X-Isa-Session-Id"] == "sess_test_unit"
    assert re.match(r"^\d{4}-\d{2}-\d{2}T", h["X-Isa-Timestamp"])
    assert re.match(r"^[0-9a-f]{64}$", h["X-Isa-Signature"])


def test_401_maps_to_auth_error() -> None:
    isa = _session_isa()
    transport = RecordingTransport(status=401, payload={"code": "unauthorized", "detail": "bad sig"})
    with pytest.raises(AuthError):
        isa.proxy.call(integration_uuid="int_abc", params={}, transport=transport)


def test_409_idempotency_conflict_maps_to_typed_error() -> None:
    isa = _session_isa()
    payload = {
        "code": "idempotency_conflict",
        "detail": "body mismatch",
        "key": "abc",
        "first_seen_at": "2026-05-20T00:00:00Z",
    }
    transport = RecordingTransport(status=409, payload=payload)
    with pytest.raises(IsaIdempotencyConflictError):
        isa.proxy.call(integration_uuid="int_abc", params={}, transport=transport)


def test_500_maps_to_generic_isa_error() -> None:
    isa = _session_isa()
    transport = RecordingTransport(status=500, payload={"code": "internal_error", "detail": "boom"})
    with pytest.raises(ISAError):
        isa.proxy.call(integration_uuid="int_abc", params={}, transport=transport)
