"""In-memory credential state shared between :class:`Isa`, the licenses
facade, and the License-HMAC auth path.

The state object's identity is stable across the :class:`Isa` lifetime;
the fields inside it are mutated in place when ``licenses.activate()``
returns a fresh license key. Because every operation captures the same
state reference, the in-place mutation is observed by subsequent calls
without any caller re-bootstrap.

Persistence is driven through :class:`~..core.credential_store.CredentialStore`.
The store is the source of truth across process boots; the in-memory state
is the source of truth within a single process so per-call store
round-trips stay off the hot path.

Mirror of ``packages/ts/src/zyins/credentialState.ts``.
"""

from __future__ import annotations

import contextlib
import secrets
from collections.abc import Callable
from dataclasses import dataclass

from ..account import AuthContext
from ..core.credential_store import CREDENTIAL_KEYS, CredentialStore


@dataclass(frozen=True, slots=True)
class LicenseCredentialSnapshot:
    """Snapshot of the credentials needed for one license-mode call."""

    #: BPP keycode (XXX-XXX-XXX). Required at bootstrap.
    keycode: str
    #: Login email. Required at bootstrap.
    email: str
    #: Per-device id; minted + persisted automatically.
    device_id: str
    #: License key returned by ``/v1/licenses/activate``. Empty until activated.
    license_key: str
    #: Order id; defaults to ``keycode`` when unspecified.
    order_id: str


@dataclass(frozen=True, slots=True)
class LicenseRefreshedEvent:
    """Payload fired when the SDK observes a fresh license key."""

    license_key: str
    device_id: str
    email: str
    order_id: str


#: Listener signature for :class:`LicenseRefreshedEvent`.
LicenseRefreshedListener = Callable[[LicenseRefreshedEvent], None]


class IsaCredentialState:
    """Holds the shared mutable identity blob plus a small event-emitter.

    One instance per :class:`Isa`. The :class:`~..account.AuthContext` returned
    from :meth:`auth` is the live view — mutating it is intentional, since
    every sub-client captures the same reference.
    """

    __slots__ = ("_device_id", "_email", "_keycode", "_license_key", "_listeners", "_order_id", "_store")

    def __init__(self, initial: LicenseCredentialSnapshot, store: CredentialStore) -> None:
        self._keycode = initial.keycode
        self._email = initial.email
        self._device_id = initial.device_id
        self._license_key = initial.license_key
        self._order_id = initial.order_id or initial.keycode
        self._store = store
        self._listeners: set[LicenseRefreshedListener] = set()

    def auth(self) -> AuthContext:
        """Build a fresh :class:`AuthContext` snapshot.

        Returned by value so the caller can sign without holding a live
        reference into mutable state. The state itself is mutated by
        :meth:`refresh_license_key` and :meth:`clear_license_key`.
        """
        return AuthContext(
            license_key=self._license_key,
            order_id=self._order_id,
            email=self._email,
            device_id=self._device_id,
        )

    def snapshot(self) -> LicenseCredentialSnapshot:
        return LicenseCredentialSnapshot(
            keycode=self._keycode,
            email=self._email,
            device_id=self._device_id,
            license_key=self._license_key,
            order_id=self._order_id,
        )

    def on_license_refreshed(
        self, listener: LicenseRefreshedListener
    ) -> Callable[[], None]:
        """Subscribe to license-refresh events. Returns an unsubscribe callable."""
        self._listeners.add(listener)

        def _unsubscribe() -> None:
            self._listeners.discard(listener)

        return _unsubscribe

    def refresh_license_key(self, license_key: str) -> None:
        """Update the live key, persist it, and notify subscribers."""
        self._license_key = license_key
        self._store.set(CREDENTIAL_KEYS.LICENSE_KEY, license_key)
        event = LicenseRefreshedEvent(
            license_key=license_key,
            device_id=self._device_id,
            email=self._email,
            order_id=self._order_id,
        )
        for listener in tuple(self._listeners):
            # Listener failures must not break the activation flow. The SDK
            # does not log here so consumers can layer their own observability
            # without double-emission.
            with contextlib.suppress(Exception):
                listener(event)

    def clear_license_key(self) -> None:
        """Clear the stashed license key (post-deactivate)."""
        self._license_key = ""
        self._store.remove(CREDENTIAL_KEYS.LICENSE_KEY)


def mint_device_id() -> str:
    """Generate a per-device identifier.

    The device id is the HMAC key for ``X-Device-Signature`` so it MUST be
    high-entropy. 32 hex characters (128 bits) matches the TS minter.
    """
    return secrets.token_hex(16)


def load_or_mint_device_id(store: CredentialStore) -> str:
    """Return the persisted device id, minting + persisting one when absent."""
    existing = store.get(CREDENTIAL_KEYS.DEVICE_ID)
    if existing:
        return existing
    fresh = mint_device_id()
    store.set(CREDENTIAL_KEYS.DEVICE_ID, fresh)
    return fresh
