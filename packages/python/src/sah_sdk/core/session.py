"""Steady-state session module + transparent auto-refresh interceptor.

Pairs with :mod:`sah_sdk.core.bootstrap` (the byte-pinned HMAC algorithm)
and :func:`sah_sdk.core.sign_request.sign_request` (per-request signing).

Consumer view: never call :func:`SessionStore.bootstrap` directly. The
:class:`SessionInterceptor` wraps the underlying :class:`Transport` and
fires bootstrap on miss/expiry, retries once on refreshable 401 auth errors,
and collapses concurrent cold-start callers onto a single round-trip via
a cached :class:`threading.Lock` + monotonically-stored result.

Concurrency:
    - :class:`threading.RLock` guards the cached :class:`Session`.
    - Single-flight is enforced by holding the lock for the duration of
      the in-flight bootstrap, so the second arriving thread observes
      the freshly-stored session on lock acquisition and skips the
      network round-trip.
    - The 30-second grace overlap lives server-side
      (``services/account/internal/handler/sessions_bootstrap.go``);
      the client just retries on 401 and never tracks the previous
      secret.
"""

from __future__ import annotations

import json
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from .bootstrap import BootstrapInput, build_bootstrap_signature
from .sign_request import sign_request
from .transport import Transport, TransportResponse


@dataclass(frozen=True, slots=True)
class Session:
    """Cached credential bundle returned by ``POST /v1/sessions``.

    The ``secret`` is the HMAC key used to sign every steady-state
    request. Treat as a credential: never log, never persist to disk.
    """

    session_id: str
    session_secret: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class ExchangeInput:
    """Inputs needed to bootstrap a session."""

    keycode: str
    email: str
    license_key: str
    device_id: str


class SessionExchangeError(RuntimeError):
    """Raised when ``POST /v1/sessions`` returns non-2xx."""


SessionClock = Callable[[], datetime]
_SESSION_EXPIRED_CODE = "session_expired"
_UNAUTHORIZED_CODE = "unauthorized"


def _system_clock() -> datetime:
    return datetime.now(tz=timezone.utc)


class SessionStore:
    """Thread-safe atomic session cache + single-flight bootstrap driver.

    One :class:`SessionStore` per SDK client. Safe for concurrent use
    from any thread.
    """

    #: How close to expiry :meth:`on_activity` proactively re-mints.
    PROACTIVE_WINDOW = timedelta(minutes=5)
    #: Minimum delay before retrying after a failed session exchange.
    FAILURE_BACKOFF = timedelta(seconds=1)

    def __init__(
        self,
        *,
        transport: Transport,
        base_url: str,
        exchange_input: ExchangeInput,
        clock: SessionClock | None = None,
    ) -> None:
        if not base_url:
            raise ValueError("SessionStore: base_url must be a non-empty string")
        if not (
            exchange_input.keycode
            and exchange_input.email
            and exchange_input.license_key
            and exchange_input.device_id
        ):
            raise ValueError(
                "SessionStore: ExchangeInput requires non-empty keycode, "
                "email, license_key, device_id"
            )
        self._transport = transport
        self._base_url = base_url.rstrip("/")
        self._input = exchange_input
        self._clock = clock or _system_clock
        self._lock = threading.RLock()
        self._current: Session | None = None
        self._exchange_blocked_until: datetime | None = None
        self._last_exchange_error: Exception | None = None
        # Single-flight counter for tests. Incremented inside the
        # critical section, so reads under the same lock are consistent.
        self._bootstrap_count = 0

    @property
    def bootstrap_count(self) -> int:
        """Number of network bootstraps the store has executed.

        Tests assert exactly 1 after concurrent cold-start calls — the
        single-flight invariant.
        """
        with self._lock:
            return self._bootstrap_count

    def current_secret(self) -> Session | None:
        """Return the cached session if present and not past expiry.

        Returns ``None`` if the caller must bootstrap.
        """
        with self._lock:
            if self._current is None:
                return None
            if self._clock() >= self._current.expires_at:
                return None
            return self._current

    def bootstrap(self) -> Session:
        """Perform ``POST /v1/sessions`` with the embedded HMAC signature.

        Single-flight: concurrent callers serialize on ``self._lock``;
        the second arriver observes the freshly-cached session and
        skips the network call.
        """
        with self._lock:
            now = self._clock()
            # Double-checked: a concurrent caller may have already
            # bootstrapped while we waited for the lock.
            if self._current is not None and now < self._current.expires_at:
                return self._current
            self._raise_recent_exchange_error(now)
            return self._exchange_locked(now)

    def invalidate(self) -> None:
        """Clear the cached session. Called by the interceptor on 401."""
        with self._lock:
            self._current = None

    def _invalidate_if_current(self, session_id: str) -> None:
        with self._lock:
            if self._current is not None and self._current.session_id == session_id:
                self._current = None

    def _refresh_if_current(self, session_id: str) -> Session:
        with self._lock:
            now = self._clock()
            if self._current is not None and self._current.session_id != session_id:
                return self._current
            self._raise_recent_exchange_error(now)
            return self._exchange_locked(now)

    def on_activity(self) -> None:
        """Consumer-facing proactive-refresh hook.

        If the cached session is within :attr:`PROACTIVE_WINDOW` of
        expiry, re-mint now so the next product call doesn't pay the
        bootstrap round-trip. Safe to call on every consumer-side
        activity boundary (button click, IPC tick).
        """
        with self._lock:
            now = self._clock()
            cur = self._current
            if cur is None or now + self.PROACTIVE_WINDOW >= cur.expires_at:
                self._raise_recent_exchange_error(now)
                self._exchange_locked(now)

    def _exchange_locked(self, now: datetime) -> Session:
        try:
            sess = self._do_exchange()
        except Exception as exc:
            self._exchange_blocked_until = now + self.FAILURE_BACKOFF
            self._last_exchange_error = exc
            raise
        self._current = sess
        self._exchange_blocked_until = None
        self._last_exchange_error = None
        self._bootstrap_count += 1
        return sess

    def _raise_recent_exchange_error(self, now: datetime) -> None:
        if (
            self._last_exchange_error is not None
            and self._exchange_blocked_until is not None
            and now < self._exchange_blocked_until
        ):
            raise self._last_exchange_error

    def _do_exchange(self) -> Session:
        ts = int(self._clock().timestamp())
        sig = build_bootstrap_signature(
            BootstrapInput(
                keycode=self._input.keycode,
                email=self._input.email,
                license_key=self._input.license_key,
                device_id=self._input.device_id,
                method="POST",
                path="/v1/sessions",
                timestamp=ts,
            )
        )
        resp = self._transport.request(
            "POST",
            self._base_url + "/v1/sessions",
            headers={
                "Content-Type": "application/json",
                "X-Device-ID": self._input.device_id,
                "ISA-Signature": f"t={ts},v1={sig.hex}",
            },
            body=sig.serialized_body,
        )
        if not 200 <= resp.status < 300:
            raise SessionExchangeError(
                f"POST /v1/sessions returned {resp.status}: {resp.body[:200]}"
            )
        payload = json.loads(resp.body)["data"]
        return Session(
            session_id=payload["sessionId"],
            session_secret=payload["sessionSecret"],
            expires_at=datetime.fromisoformat(
                payload["expiresAt"].replace("Z", "+00:00")
            ),
        )


class SessionInterceptor:
    """Transparent :class:`Transport` wrapper.

    Sits between product namespaces (``zyins``, ``account``, ``rapidsign``,
    ``proxy``) and the underlying :class:`HttpTransport`. Wiring at the
    transport seam means every existing product method inherits
    auto-refresh without per-method changes.

    Behavior:
        1. On every :meth:`request`, read :meth:`SessionStore.current_secret`.
           If ``None``, call :meth:`SessionStore.bootstrap` (single-flight).
        2. Sign the request via :func:`sign_request`.
        3. Forward to the inner transport.
        4. On refreshable 401 auth errors, bootstrap and replay once. A
           second 401 is returned unchanged.
    """

    def __init__(self, *, store: SessionStore, inner: Transport) -> None:
        if store is None:
            raise ValueError("SessionInterceptor: store is required")
        if inner is None:
            raise ValueError("SessionInterceptor: inner transport is required")
        self._store = store
        self._inner = inner

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        resp, session = self._sign_and_send(method, url, headers, body)
        code = _auth_error_code(resp)
        if not self._should_refresh(code):
            return resp
        try:
            if code == _SESSION_EXPIRED_CODE:
                self._store._invalidate_if_current(session.session_id)
            self._store._refresh_if_current(session.session_id)
        except Exception:
            return resp
        retry, _ = self._sign_and_send(method, url, headers, body)
        return retry

    def _should_refresh(self, code: str | None) -> bool:
        return code in (_SESSION_EXPIRED_CODE, _UNAUTHORIZED_CODE)

    def _sign_and_send(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        body: str | None,
    ) -> tuple[TransportResponse, Session]:
        sess = self._store.current_secret() or self._store.bootstrap()
        path = _path_of(url)
        signed = sign_request(
            method=method,
            path=path,
            body=body or "",
            session_id=sess.session_id,
            session_secret=sess.session_secret,
        )
        merged = dict(headers)
        merged.update(signed.as_dict())
        return self._inner.request(method, url, headers=merged, body=body), sess


def _auth_error_code(resp: TransportResponse) -> str | None:
    if resp.status != 401:
        return None
    ct = resp.headers.get("Content-Type", "") or resp.headers.get("content-type", "")
    if "json" not in ct:
        return None
    try:
        payload = json.loads(resp.body)
    except (ValueError, TypeError):
        return None
    if not isinstance(payload, dict):
        return None
    code = payload.get("code")
    return code if isinstance(code, str) else None


def _path_of(url: str) -> str:
    if "://" not in url:
        return url.split("?", 1)[0]
    return urlparse(url).path or "/"
