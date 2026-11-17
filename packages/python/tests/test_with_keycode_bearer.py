"""Isa.with_keycode must not send a placeholder bearer production rejects."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from sah_sdk.core.credential_store import CREDENTIAL_KEYS, InMemoryCredentialStore
from sah_sdk.core.transport import TransportResponse
from sah_sdk.isa import Isa


class RecordingTransport:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict[str, str]]] = []

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        self.calls.append((method, url, dict(headers)))
        if url.endswith("/v1/sessions"):
            expires = (datetime.now(tz=timezone.utc) + timedelta(hours=1)).isoformat()
            payload = {
                "data": {
                    "sessionId": "sess_real",
                    "sessionSecret": "secret_real",
                    "expiresAt": expires.replace("+00:00", "Z"),
                }
            }
            return TransportResponse(
                status=200,
                body=json.dumps(payload),
                headers={"Content-Type": "application/json"},
            )
        return TransportResponse(
            status=200,
            body='{"data":[]}',
            headers={"Content-Type": "application/json"},
        )


def test_with_keycode_product_call_does_not_send_placeholder_bearer() -> None:
    transport = RecordingTransport()
    store = InMemoryCredentialStore()
    store.set(CREDENTIAL_KEYS.LICENSE_KEY, "lk_real_not_a_placeholder")
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="agent@example.com",
        transport=transport,
        credential_store=store,
    )
    isa._client.datasets.list()
    product = [c for c in transport.calls if not c[1].endswith("/v1/sessions")]
    assert product, "expected a product call"
    auth = product[-1][2].get("Authorization", "")
    assert not auth.startswith("Bearer isa_test_license_"), auth
    assert auth.startswith("Session "), auth
