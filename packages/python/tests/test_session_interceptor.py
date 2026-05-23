"""Concurrent-call test for ``SessionInterceptor``.

Verifies the single-flight invariant: 10 concurrent product calls from
a cold-start interceptor must trigger exactly one bootstrap.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import threading
import time
from datetime import datetime, timedelta, timezone

import pytest

from sah_sdk.core.session import (
    ExchangeInput,
    Session,
    SessionExchangeError,
    SessionInterceptor,
    SessionStore,
)
from sah_sdk.core.sign_request import canonical_string
from sah_sdk.core.transport import TransportResponse


class RecordingTransport:
    """In-memory transport that counts bootstrap vs product hits."""

    def __init__(self) -> None:
        self.bootstrap_hits = 0
        self.product_hits = 0
        self._lock = threading.Lock()
        # When set, the next product response returns an expired-session 401.
        self.expire_next_product = False
        self.fail_next_bootstrap = False
        self.bootstrap_expires_at: datetime | None = None
        self.product_error_code = "unauthorized"
        self.raise_next_bootstrap: Exception | None = None
        self.product_headers: list[dict[str, str]] = []

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        if url.endswith("/v1/sessions"):
            with self._lock:
                self.bootstrap_hits += 1
                fail = self.fail_next_bootstrap
                self.fail_next_bootstrap = False
                bootstrap_error = self.raise_next_bootstrap
                self.raise_next_bootstrap = None
            if bootstrap_error is not None:
                raise bootstrap_error
            if fail:
                return TransportResponse(
                    status=503,
                    body='{"error":"unavailable"}',
                    headers={"Content-Type": "application/json"},
                )
            # Sleep so concurrent product threads collide on the lock.
            time.sleep(0.02)
            expires_at = self.bootstrap_expires_at or (
                datetime.now(tz=timezone.utc) + timedelta(hours=24)
            )
            payload = {
                "data": {
                    "sessionId": "sess_test_01HZK2N5GQR9T8X4B6FJW3Y1AS",
                    "sessionSecret": "secret_test_4fjK2nQ7mX1aB8sR9pZ3",
                    "expiresAt": expires_at.isoformat().replace("+00:00", "Z"),
                },
            }
            return TransportResponse(
                status=200,
                body=json.dumps(payload),
                headers={"Content-Type": "application/json"},
            )
        with self._lock:
            self.product_hits += 1
            self.product_headers.append(headers)
            expire = self.expire_next_product
            self.expire_next_product = False
        if expire:
            return TransportResponse(
                status=401,
                body=json.dumps({"code": self.product_error_code, "type": "about:blank"}),
                headers={"Content-Type": "application/problem+json"},
            )
        return TransportResponse(
            status=200,
            body='{"ok":true}',
            headers={"Content-Type": "application/json"},
        )


@pytest.fixture
def fixture_store_and_interceptor() -> tuple[SessionStore, SessionInterceptor, RecordingTransport]:
    transport = RecordingTransport()
    store = SessionStore(
        transport=transport,
        base_url="https://api.example.test",
        exchange_input=ExchangeInput(
            keycode="SDV-HWH-WDD",
            email="john.doe@acme-agency.com",
            license_key="zyins_test_4fjK2nQ7mX1aB8sR9pZ3",
            device_id="device-abc-123",
        ),
    )
    interceptor = SessionInterceptor(store=store, inner=transport)
    return store, interceptor, transport


def test_concurrent_product_calls_trigger_exactly_one_bootstrap(
    fixture_store_and_interceptor: tuple[SessionStore, SessionInterceptor, RecordingTransport],
) -> None:
    """10 concurrent product calls from a cold start ⇒ 1 bootstrap."""
    _, interceptor, transport = fixture_store_and_interceptor
    results: list[TransportResponse] = []
    results_lock = threading.Lock()

    def call_once() -> None:
        resp = interceptor.request(
            "POST",
            "https://api.example.test/v1/prequalify",
            headers={"Content-Type": "application/json"},
            body='{"x":1}',
        )
        with results_lock:
            results.append(resp)

    threads = [threading.Thread(target=call_once) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert transport.bootstrap_hits == 1, (
        f"single-flight violated: {transport.bootstrap_hits} bootstrap hits"
    )
    assert transport.product_hits == 10
    assert all(r.status == 200 for r in results)


def test_retry_on_401_unauthorized_near_expiry(
    fixture_store_and_interceptor: tuple[SessionStore, SessionInterceptor, RecordingTransport],
) -> None:
    """The proxy's expired-session 401 triggers bootstrap + replay."""
    _, interceptor, transport = fixture_store_and_interceptor
    transport.bootstrap_expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=4)
    transport.expire_next_product = True
    resp = interceptor.request(
        "POST",
        "https://api.example.test/v1/prequalify",
        headers={"Content-Type": "application/json"},
        body='{"x":1}',
    )
    assert resp.status == 200
    assert transport.bootstrap_hits == 2
    assert transport.product_hits == 2


def test_401_unauthorized_refreshes_fresh_session(
    fixture_store_and_interceptor: tuple[SessionStore, SessionInterceptor, RecordingTransport],
) -> None:
    _, interceptor, transport = fixture_store_and_interceptor
    transport.expire_next_product = True
    resp = interceptor.request(
        "POST",
        "https://api.example.test/v1/prequalify",
        headers={"Content-Type": "application/json"},
        body='{"x":1}',
    )
    assert resp.status == 200
    assert transport.bootstrap_hits == 2
    assert transport.product_hits == 2


def test_failed_refresh_returns_original_unauthorized_response() -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    transport = RecordingTransport()
    transport.bootstrap_expires_at = now + timedelta(minutes=4)
    store = SessionStore(
        transport=transport,
        base_url="https://api.example.test",
        exchange_input=ExchangeInput(
            keycode="SDV-HWH-WDD",
            email="john.doe@acme-agency.com",
            license_key="zyins_test_4fjK2nQ7mX1aB8sR9pZ3",
            device_id="device-abc-123",
        ),
        clock=lambda: now,
    )
    interceptor = SessionInterceptor(store=store, inner=transport)
    original = store.bootstrap()

    transport.expire_next_product = True
    transport.fail_next_bootstrap = True

    resp = interceptor.request(
        "POST",
        "https://api.example.test/v1/prequalify",
        headers={"Content-Type": "application/json"},
        body='{"x":1}',
    )

    assert resp.status == 401
    assert json.loads(resp.body)["code"] == "unauthorized"
    assert transport.bootstrap_hits == 2
    assert transport.product_hits == 1
    assert store.current_secret() == original


def test_failed_refresh_network_error_returns_original_unauthorized_response() -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    transport = RecordingTransport()
    transport.bootstrap_expires_at = now + timedelta(minutes=4)
    store = SessionStore(
        transport=transport,
        base_url="https://api.example.test",
        exchange_input=ExchangeInput(
            keycode="SDV-HWH-WDD",
            email="john.doe@acme-agency.com",
            license_key="zyins_test_4fjK2nQ7mX1aB8sR9pZ3",
            device_id="device-abc-123",
        ),
        clock=lambda: now,
    )
    interceptor = SessionInterceptor(store=store, inner=transport)
    original = store.bootstrap()

    transport.expire_next_product = True
    transport.raise_next_bootstrap = RuntimeError("network unavailable")

    resp = interceptor.request(
        "POST",
        "https://api.example.test/v1/prequalify",
        headers={"Content-Type": "application/json"},
        body='{"x":1}',
    )

    assert resp.status == 401
    assert json.loads(resp.body)["code"] == "unauthorized"
    assert transport.bootstrap_hits == 2
    assert transport.product_hits == 1
    assert store.current_secret() == original


def test_failed_session_expired_refresh_clears_rejected_session() -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    transport = RecordingTransport()
    transport.bootstrap_expires_at = now + timedelta(hours=1)
    transport.product_error_code = "session_expired"
    store = SessionStore(
        transport=transport,
        base_url="https://api.example.test",
        exchange_input=ExchangeInput(
            keycode="SDV-HWH-WDD",
            email="john.doe@acme-agency.com",
            license_key="zyins_test_4fjK2nQ7mX1aB8sR9pZ3",
            device_id="device-abc-123",
        ),
        clock=lambda: now,
    )
    interceptor = SessionInterceptor(store=store, inner=transport)
    store.bootstrap()

    transport.expire_next_product = True
    transport.fail_next_bootstrap = True

    resp = interceptor.request(
        "POST",
        "https://api.example.test/v1/prequalify",
        headers={"Content-Type": "application/json"},
        body='{"x":1}',
    )

    assert resp.status == 401
    assert json.loads(resp.body)["code"] == "session_expired"
    assert transport.bootstrap_hits == 2
    assert transport.product_hits == 1
    assert store.current_secret() is None


def test_on_activity_cold_start_bootstraps(
    fixture_store_and_interceptor: tuple[SessionStore, SessionInterceptor, RecordingTransport],
) -> None:
    """``on_activity`` from cold state mints the session proactively."""
    store, _, transport = fixture_store_and_interceptor
    store.on_activity()
    assert transport.bootstrap_hits == 1
    assert store.current_secret() is not None


def test_on_activity_failed_refresh_preserves_current_session() -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    transport = RecordingTransport()
    transport.bootstrap_expires_at = now + timedelta(minutes=4)
    store = SessionStore(
        transport=transport,
        base_url="https://api.example.test",
        exchange_input=ExchangeInput(
            keycode="SDV-HWH-WDD",
            email="john.doe@acme-agency.com",
            license_key="zyins_test_4fjK2nQ7mX1aB8sR9pZ3",
            device_id="device-abc-123",
        ),
        clock=lambda: now,
    )
    original = store.bootstrap()

    transport.fail_next_bootstrap = True
    with pytest.raises(SessionExchangeError):
        store.on_activity()

    assert store.current_secret() == original


def test_failed_bootstrap_backs_off_second_attempt(
    fixture_store_and_interceptor: tuple[SessionStore, SessionInterceptor, RecordingTransport],
) -> None:
    _, interceptor, transport = fixture_store_and_interceptor
    transport.fail_next_bootstrap = True

    with pytest.raises(SessionExchangeError):
        interceptor.request("GET", "https://api.example.test/v1/usage", headers={})
    with pytest.raises(SessionExchangeError):
        interceptor.request("GET", "https://api.example.test/v1/usage", headers={})

    assert transport.bootstrap_hits == 1


def test_invalidate_preserves_newer_session(
    fixture_store_and_interceptor: tuple[SessionStore, SessionInterceptor, RecordingTransport],
) -> None:
    store, _, _ = fixture_store_and_interceptor
    old = store.bootstrap()
    replacement = Session(
        session_id="sess_new",
        session_secret="secret_new",
        expires_at=old.expires_at,
    )
    store._current = replacement

    store._invalidate_if_current(old.session_id)

    assert store.current_secret() == replacement


def test_session_signing_uses_path_without_query(
    fixture_store_and_interceptor: tuple[SessionStore, SessionInterceptor, RecordingTransport],
) -> None:
    _, interceptor, transport = fixture_store_and_interceptor

    resp = interceptor.request(
        "GET",
        "https://api.example.test/v1/usage?period=month",
        headers={},
    )

    assert resp.status == 200
    signed_headers = transport.product_headers[-1]
    canonical = canonical_string(
        "GET",
        "/v1/usage",
        "",
        signed_headers["X-Isa-Timestamp"],
        "sess_test_01HZK2N5GQR9T8X4B6FJW3Y1AS",
    )
    expected_signature = hmac.new(
        b"secret_test_4fjK2nQ7mX1aB8sR9pZ3",
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    assert signed_headers["X-Isa-Signature"] == expected_signature
