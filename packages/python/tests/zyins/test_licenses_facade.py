"""``isa.zyins.licenses`` ergonomics tests (zero-arg defaults + state refresh)."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import pytest

import sah_sdk.isa as isa_module
from sah_sdk import Isa, IsaConfigError, LicenseRefreshedEvent
from sah_sdk.core.credential_store import CREDENTIAL_KEYS, InMemoryCredentialStore
from sah_sdk.core.license_hmac import build_license_header
from sah_sdk.core.transport import TransportResponse


@dataclass
class StubTransport:
    """Per-call programmable transport — supports a queue of canned responses."""

    responses: list[TransportResponse] = field(default_factory=list)
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
        if not self.responses:
            return TransportResponse(status=200, body="{}", headers={})
        return self.responses.pop(0)


class ClosingTransport(StubTransport):
    closed: bool = False

    def close(self) -> None:
        self.closed = True


def _isa_with(transport: StubTransport, store: InMemoryCredentialStore | None = None) -> Isa:
    return Isa.with_license(
        "ABC-123-XYZ",
        "john.doe@acme-agency.com",
        transport=transport,
        credential_store=store or InMemoryCredentialStore(),
        license_clock=lambda: 1700000000000,
    )


def test_activate_zero_args_uses_instance_state() -> None:
    transport = StubTransport(
        responses=[
            TransportResponse(
                status=200,
                body=json.dumps(
                    {"data": {"status": "active", "licenseKey": "lk-fresh", "remainingActivations": 4}}
                ),
                headers={},
            )
        ]
    )
    isa = _isa_with(transport)
    result = isa.zyins.license.activate()
    assert result.status == "active"
    assert result.license_key == "lk-fresh"
    assert result.remaining_activations == 4
    method, url, headers, body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v2/licenses/activate")
    payload = json.loads(body or "")
    assert payload["email"] == "john.doe@acme-agency.com"
    assert payload["keycode"] == "ABC-123-XYZ"
    assert "deviceId" in payload
    # Bootstrap headers only — no Authorization, no HMAC signature.
    assert "Authorization" not in headers
    assert "X-Device-Signature" not in headers
    assert "Idempotency-Key" in headers
    assert "X-Device-ID" in headers


def test_activate_device_override_matches_header() -> None:
    transport = StubTransport(
        responses=[
            TransportResponse(
                status=200,
                body=json.dumps({"data": {"status": "active", "licenseKey": "lk-fresh"}}),
                headers={},
            )
        ]
    )
    isa = _isa_with(transport)

    isa.zyins.license.activate(device_id="device-override")

    _, _, headers, body = transport.calls[0]
    assert json.loads(body or "")["deviceId"] == "device-override"
    assert headers["X-Device-ID"] == "device-override"


def test_activate_refreshes_credential_state_in_place() -> None:
    transport = StubTransport(
        responses=[
            TransportResponse(
                status=200,
                body=json.dumps(
                    {"data": {"status": "active", "licenseKey": "lk-fresh"}}
                ),
                headers={},
            )
        ]
    )
    store = InMemoryCredentialStore()
    isa = _isa_with(transport, store)
    isa.zyins.license.activate()
    # Stored license key persists for cross-boot reuse.
    assert store.get(CREDENTIAL_KEYS.LICENSE_KEY) == "lk-fresh"
    # And the in-memory snapshot reflects the new key.
    assert isa._credential_state is not None
    assert isa._credential_state.snapshot().license_key == "lk-fresh"


def test_account_uses_refreshed_license_after_cached_access() -> None:
    transport = StubTransport(
        responses=[
            TransportResponse(
                status=200,
                body=json.dumps(
                    {"data": {"status": "active", "licenseKey": "lk-fresh"}}
                ),
                headers={},
            ),
            TransportResponse(
                status=200,
                body=json.dumps({"hash": "case-123"}),
                headers={},
            ),
        ]
    )
    isa = _isa_with(transport)
    cases = isa.account.cases
    isa.zyins.license.activate()

    summary = cases.get("case-123")

    assert summary.hash == "case-123"
    _, _, headers, _ = transport.calls[-1]
    assert headers["Authorization"] == build_license_header(
        "lk-fresh",
        "ABC-123-XYZ",
        "john.doe@acme-agency.com",
    )


def test_close_releases_owned_account_transport(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created: list[ClosingTransport] = []

    class AccountTransport(ClosingTransport):
        def __init__(self) -> None:
            super().__init__()
            created.append(self)

    monkeypatch.setattr(isa_module, "HttpTransport", AccountTransport)
    isa = Isa.with_license("ABC-123-XYZ", "john.doe@acme-agency.com")

    isa.close()

    assert created
    assert created[0].closed is True


def test_close_releases_logos_client() -> None:
    class LogosClient:
        closed = False

        def close(self) -> None:
            self.closed = True

    isa = _isa_with(StubTransport())
    logos = LogosClient()
    isa.zyins.logos = logos

    isa.close()

    assert logos.closed is True


def test_on_license_refreshed_fires() -> None:
    transport = StubTransport(
        responses=[
            TransportResponse(
                status=200,
                body=json.dumps({"data": {"status": "active", "licenseKey": "lk-fresh"}}),
                headers={},
            )
        ]
    )
    isa = _isa_with(transport)
    received: list[LicenseRefreshedEvent] = []
    isa.on_license_refreshed(received.append)
    isa.zyins.license.activate()
    assert len(received) == 1
    assert received[0].license_key == "lk-fresh"


def test_check_zero_args_uses_instance_state() -> None:
    transport = StubTransport(
        responses=[
            TransportResponse(
                status=200,
                body=json.dumps({"data": {"status": "valid"}}),
                headers={},
            )
        ]
    )
    isa = _isa_with(transport)
    # Pre-populate the license key so it's included on the check payload.
    assert isa._credential_state is not None
    isa._credential_state.refresh_license_key("lk-stored")
    result = isa.zyins.license.check()
    assert result.status == "valid"
    _, url, _, body = transport.calls[-1]
    assert url.endswith("/v2/licenses/check")
    payload = json.loads(body or "")
    assert payload["licenseKey"] == "lk-stored"


def test_deactivate_clears_stashed_license_key() -> None:
    transport = StubTransport(
        responses=[
            TransportResponse(
                status=200,
                body=json.dumps({"data": {"status": "inactive"}}),
                headers={},
            )
        ]
    )
    store = InMemoryCredentialStore()
    store.set(CREDENTIAL_KEYS.LICENSE_KEY, "lk-existing")
    isa = _isa_with(transport, store)
    assert isa._credential_state is not None
    isa._credential_state.refresh_license_key("lk-existing")
    isa.zyins.license.deactivate()
    assert store.get(CREDENTIAL_KEYS.LICENSE_KEY) is None
    assert isa._credential_state.snapshot().license_key == ""


def test_deactivate_keeps_stashed_license_key_when_response_is_not_success() -> None:
    transport = StubTransport(
        responses=[
            TransportResponse(
                status=200,
                body=json.dumps({"data": {"status": "active"}}),
                headers={},
            )
        ]
    )
    store = InMemoryCredentialStore()
    store.set(CREDENTIAL_KEYS.LICENSE_KEY, "lk-existing")
    isa = _isa_with(transport, store)
    assert isa._credential_state is not None
    isa._credential_state.refresh_license_key("lk-existing")

    with pytest.raises(ValueError, match="inactive status"):
        isa.zyins.license.deactivate()

    assert store.get(CREDENTIAL_KEYS.LICENSE_KEY) == "lk-existing"
    assert isa._credential_state.snapshot().license_key == "lk-existing"


def test_from_env_picks_license_path() -> None:
    os.environ["ISA_LICENSE_KEYCODE"] = "ABC-123-XYZ"
    os.environ["ISA_LICENSE_EMAIL"] = "john.doe@acme-agency.com"
    os.environ.pop("ISA_TOKEN", None)
    try:
        isa = Isa.from_env()
        assert isa._credential_state is not None
        assert isa._credential_state.snapshot().keycode == "ABC-123-XYZ"
    finally:
        os.environ.pop("ISA_LICENSE_KEYCODE", None)
        os.environ.pop("ISA_LICENSE_EMAIL", None)


def test_from_env_raises_when_no_credentials_present() -> None:
    for key in (
        "ISA_TOKEN",
        "ISA_LICENSE_KEYCODE",
        "ISA_LICENSE_EMAIL",
        "ISA_SESSION_ID",
        "ISA_SESSION_SECRET",
    ):
        os.environ.pop(key, None)
    with pytest.raises(IsaConfigError, match="no credentials"):
        Isa.from_env()


def test_account_requires_license_construction() -> None:
    isa = Isa.with_bearer("isa_test_" + "x" * 16)
    with pytest.raises(IsaConfigError, match="license"):
        _ = isa.account
