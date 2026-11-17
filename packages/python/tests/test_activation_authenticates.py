"""Activation must authenticate the product calls that follow it.

A client built from a keycode has no license key, so its session store cannot
sign until ``/v2/licenses/activate`` issues one. The store has to adopt that
key; otherwise every product call after activation is unauthenticated.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sah_sdk.core.credential_store import InMemoryCredentialStore
from sah_sdk.core.transport import TransportResponse
from sah_sdk.isa import Isa

ACTIVATE_PATH = "/v2/licenses/activate"
DEACTIVATE_PATH = "/v2/licenses/deactivate"
SESSIONS_PATH = "/v1/sessions"


class ActivatingTransport:
    """Answers activation, session bootstrap, and product calls."""

    def __init__(self, issued_key: str) -> None:
        self.issued_key = issued_key
        self.calls: list[tuple[str, str, dict[str, str], str | None]] = []

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        self.calls.append((method, url, dict(headers), body))
        if url.endswith(ACTIVATE_PATH):
            return self._json({"data": {"licenseKey": self.issued_key}})
        if url.endswith(DEACTIVATE_PATH):
            return self._json({"data": {"status": "inactive"}})
        if url.endswith(SESSIONS_PATH):
            expires = datetime.now(tz=timezone.utc) + timedelta(hours=1)
            return self._json(
                {
                    "data": {
                        "sessionId": "sess_after_activation",
                        "sessionSecret": "secret_after_activation",
                        "expiresAt": expires.isoformat().replace("+00:00", "Z"),
                    }
                }
            )
        return self._json({"data": []})

    @staticmethod
    def _json(payload: dict[str, object]) -> TransportResponse:
        return TransportResponse(
            status=200,
            body=json.dumps(payload),
            headers={"Content-Type": "application/json"},
        )


def test_activation_then_product_call_bootstraps_with_the_issued_key() -> None:
    transport = ActivatingTransport(issued_key="lk_after_activate")
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="agent@example.com",
        transport=transport,
        credential_store=InMemoryCredentialStore(),
    )

    isa.zyins.license.activate()
    isa._client.datasets.list()

    session_calls = [
        call for call in transport.calls if call[1].endswith(SESSIONS_PATH)
    ]
    assert session_calls, "activation did not enable the session bootstrap"

    product_calls = [
        call
        for call in transport.calls
        if not call[1].endswith(SESSIONS_PATH) and not call[1].endswith(ACTIVATE_PATH)
    ]
    assert product_calls, "expected a product call"
    authorization = product_calls[-1][2].get("Authorization", "")
    assert authorization.startswith("Session "), authorization
    assert "secret_after_activation" in authorization, authorization


def test_deactivation_stops_signing_with_the_cleared_key() -> None:
    transport = ActivatingTransport(issued_key="lk_after_activate")
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="agent@example.com",
        transport=transport,
        credential_store=InMemoryCredentialStore(),
    )

    isa.zyins.license.activate()
    isa._client.datasets.list()
    isa.zyins.license.deactivate()
    isa._client.datasets.list()

    product_calls = [
        call
        for call in transport.calls
        if not call[1].endswith(SESSIONS_PATH)
        and not call[1].endswith(ACTIVATE_PATH)
        and not call[1].endswith(DEACTIVATE_PATH)
    ]
    assert len(product_calls) == 2, product_calls
    signed, after_clear = product_calls
    assert signed[2].get("Authorization", "").startswith("Session "), signed[2]
    assert "Authorization" not in after_clear[2], after_clear[2]
