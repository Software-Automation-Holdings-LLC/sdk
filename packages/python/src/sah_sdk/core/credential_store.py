"""Pluggable credential storage facade.

Python mirror of ``packages/ts/src/core/storage/credentialStore.ts``. The
SDK persists the device id minted at first activation and the license key
issued by ``/v1/licenses/activate`` so subsequent process boots do not
have to re-bootstrap the user. The storage layer is a facade so the same
``Isa.with_license(...)`` call works in three runtimes:

1. Server (default) — the SDK ships an in-memory store.
2. Disk — :func:`from_path_dict` adapter for a JSON-on-disk dict (caller
   supplies the read/write functions).
3. Custom — any object implementing the :class:`CredentialStore` protocol.

The interface is intentionally tiny (get / set / remove) so any KV-shaped
storage can be adapted in a few lines. All values are strings.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Final, Protocol


class CredentialStore(Protocol):
    """Persistent key/value store for SDK credentials."""

    def get(self, key: str) -> str | None: ...
    def set(self, key: str, value: str) -> None: ...
    def remove(self, key: str) -> None: ...


class CredentialKeys:
    """Canonical key names the SDK uses inside any :class:`CredentialStore`."""

    DEVICE_ID: Final[str] = "isa.deviceId"
    LICENSE_KEY: Final[str] = "isa.licenseKey"
    ORDER_ID: Final[str] = "isa.orderId"


# Backward-compatible module-level alias mirroring the TS ``CREDENTIAL_KEYS``.
CREDENTIAL_KEYS: Final[CredentialKeys] = CredentialKeys()


class InMemoryCredentialStore:
    """In-memory credential store. Default when no adapter is supplied.

    State survives the process but NOT a restart — for cross-boot
    persistence, plug in a custom :class:`CredentialStore` via
    ``Isa.with_license(credential_store=...)``.
    """

    __slots__ = ("_data",)

    def __init__(self) -> None:
        self._data: dict[str, str] = {}

    def get(self, key: str) -> str | None:
        return self._data.get(key)

    def set(self, key: str, value: str) -> None:
        self._data[key] = value

    def remove(self, key: str) -> None:
        self._data.pop(key, None)


def in_memory_credential_store() -> CredentialStore:
    """Construct a fresh in-memory store."""
    return InMemoryCredentialStore()


def from_mapping(
    *,
    getter: Callable[[str], str | None],
    setter: Callable[[str, str], None],
    remover: Callable[[str], None],
) -> CredentialStore:
    """Adapt arbitrary getter/setter/remover callables into a CredentialStore.

    Useful for wiring a custom backend (e.g. a database, a keychain, a
    cloud secret store) without subclassing.
    """

    class _Adapter:
        __slots__ = ()

        def get(self, key: str) -> str | None:
            return getter(key)

        def set(self, key: str, value: str) -> None:
            setter(key, value)

        def remove(self, key: str) -> None:
            remover(key)

    return _Adapter()
