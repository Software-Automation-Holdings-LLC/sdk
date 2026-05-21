"""``sah_sdk.proxy`` — proxy product namespace.

Today exposes :meth:`ProxyNamespace.call` for session-credential signed
invocation against ``/v1/call``. The SDK↔proxy hop is HMAC-signed; the
proxy↔downstream hop remains Algosure HMAC and is handled server-side
(see ADR-035, amended in PR #<this>).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from .call import (
    DEFAULT_PROXY_ORIGIN,
    DEFAULT_PROXY_TIMEOUT_SECONDS,
    SessionBinding,
    Transport,
    require_session_binding,
)
from .call import (
    call as run_proxy_call,
)

if TYPE_CHECKING:  # pragma: no cover
    from ..isa import Isa


class ProxyNamespace:
    """``isa.proxy`` — structured invocation against ``/v1/call``.

    The namespace is bound at :class:`Isa` construction and reads the
    session credentials carried by the parent. Non-session identities
    cause :meth:`call` to raise :class:`IsaConfigError` at the boundary.
    """

    def __init__(self, isa: Isa) -> None:
        self._isa = isa

    def call(
        self,
        *,
        integration_uuid: str | None = None,
        integration_id: int | None = None,
        params: Any = None,
        method: str = "POST",
        idempotency_key: str | None = None,
        clock: Callable[[], Any] | None = None,
        uuid_factory: Callable[[], str] | None = None,
        transport: Transport | None = None,
        timeout: float = DEFAULT_PROXY_TIMEOUT_SECONDS,
    ) -> Any:
        """Invoke a registered integration through the platform proxy.

        See :func:`sah_sdk.proxy.call.call` for the full parameter contract.
        """
        binding = require_session_binding(
            getattr(self._isa, "_session_id", None),
            getattr(self._isa, "_session_secret", None),
            proxy_origin=getattr(self._isa, "_proxy_origin", DEFAULT_PROXY_ORIGIN),
        )
        kwargs: dict[str, Any] = {
            "params": params,
            "method": method,
            "timeout": timeout,
        }
        if integration_uuid is not None:
            kwargs["integration_uuid"] = integration_uuid
        if integration_id is not None:
            kwargs["integration_id"] = integration_id
        if idempotency_key is not None:
            kwargs["idempotency_key"] = idempotency_key
        if clock is not None:
            kwargs["clock"] = clock
        if uuid_factory is not None:
            kwargs["uuid_factory"] = uuid_factory
        if transport is not None:
            kwargs["transport"] = transport
        return run_proxy_call(binding, **kwargs)


__all__ = [
    "DEFAULT_PROXY_ORIGIN",
    "DEFAULT_PROXY_TIMEOUT_SECONDS",
    "ProxyNamespace",
    "SessionBinding",
    "Transport",
]
