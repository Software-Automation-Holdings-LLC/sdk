"""Typed options-bag constructor sugar for :class:`Isa`.

Mirrors ``packages/ts/src/zyins/isaOptions.ts``. The historic factories
(:meth:`Isa.with_bearer`, :meth:`Isa.with_keycode`, :meth:`Isa.for_form`,
:meth:`Isa.authenticate`) remain the canonical primitives; this surface
is the recommended path going forward and matches the cross-language
SDK shape (TS ``Isa.create({auth, engine, ...})``, C# ``new Isa(new
IsaOptions { Auth = ... })``)::

    isa = Isa.create(
        auth=BearerAuth.from_token("isa_live_..."),
        engine=RemoteEngine.default(),
        timeout=30.0,
        api_version="v2",
    )

``api_version`` is immutable per-instance options metadata for the
native v2 follow-up. Current Python operations still use the
date-pinned platform ``Version`` header and existing endpoint paths.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from ..core.transport import Transport

# ---------------------------------------------------------------------------
# Pinned API major version
# ---------------------------------------------------------------------------

#: Pinned API major version. Default ``"v2"``; immutable per-instance.
IsaApiVersion = Literal["v1", "v2"]


# ---------------------------------------------------------------------------
# Auth suppliers
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class BearerAuthSupplier:
    """Bearer-token auth supplier — accepted by :class:`IsaCreateOptions`.

    ``token`` may be ``None`` to indicate "resolve from ``ISA_TOKEN``"
    (matches the TS shape: ``BearerAuth.fromEnv()``).
    """

    kind: Literal["bearer"] = "bearer"
    token: str | None = None


@dataclass(frozen=True, slots=True)
class LicenseAuthSupplier:
    """License-credential auth supplier."""

    kind: Literal["license"] = "license"
    keycode: str | None = None
    email: str | None = None


@dataclass(frozen=True, slots=True)
class FormAuthSupplier:
    """Form-token auth supplier (embedded eApp)."""

    kind: Literal["form"] = "form"
    form_token: str = ""


@dataclass(frozen=True, slots=True)
class SessionAuthSupplier:
    """Session-credential auth supplier."""

    kind: Literal["session"] = "session"
    session_id: str | None = None
    session_secret: str | None = None


IsaAuthSupplier = (
    BearerAuthSupplier | LicenseAuthSupplier | FormAuthSupplier | SessionAuthSupplier
)


class BearerAuth:
    """Bearer-auth supplier factory.

    Mirrors the TS ``BearerAuth.fromToken(...)`` / ``fromEnv()`` shape so
    consumers reading both SDKs see the same surface.
    """

    @staticmethod
    def from_token(token: str) -> IsaAuthSupplier:
        """Construct from an explicit token. Validates non-emptiness."""
        if not token:
            raise ValueError("BearerAuth.from_token: token must be a non-empty string")
        return BearerAuthSupplier(token=token)

    @staticmethod
    def from_env() -> IsaAuthSupplier:
        """Construct from ``ISA_TOKEN`` at factory time."""
        return BearerAuthSupplier(token=None)


class LicenseAuth:
    """License-auth supplier factory.

    Mirrors the TS ``LicenseAuth.fromKeycode(...)`` / ``fromEnv()`` shape.
    """

    @staticmethod
    def from_keycode(keycode: str, email: str) -> IsaAuthSupplier:
        """Construct from explicit keycode + email."""
        if not keycode:
            raise ValueError("LicenseAuth.from_keycode: keycode must be non-empty")
        if not email:
            raise ValueError("LicenseAuth.from_keycode: email must be non-empty")
        return LicenseAuthSupplier(keycode=keycode, email=email)

    @staticmethod
    def from_env() -> IsaAuthSupplier:
        """Construct from ``ISA_LICENSE_KEYCODE`` + ``ISA_LICENSE_EMAIL``."""
        return LicenseAuthSupplier(keycode=None, email=None)


class FormAuth:
    """Form-token auth supplier factory."""

    @staticmethod
    def from_token(form_token: str) -> IsaAuthSupplier:
        if not form_token:
            raise ValueError("FormAuth.from_token: form_token must be non-empty")
        return FormAuthSupplier(form_token=form_token)


class SessionAuth:
    """Session-auth supplier factory."""

    @staticmethod
    def from_credentials(session_id: str, session_secret: str) -> IsaAuthSupplier:
        """Construct from explicit session credentials."""
        if not session_id:
            raise ValueError(
                "SessionAuth.from_credentials: session_id must be non-empty"
            )
        if not session_secret:
            raise ValueError(
                "SessionAuth.from_credentials: session_secret must be non-empty"
            )
        return SessionAuthSupplier(
            session_id=session_id,
            session_secret=session_secret,
        )

    @staticmethod
    def from_env() -> IsaAuthSupplier:
        """Construct from ``ISA_SESSION_ID`` + ``ISA_SESSION_SECRET``."""
        return SessionAuthSupplier(session_id=None, session_secret=None)


# ---------------------------------------------------------------------------
# Engine selectors
# ---------------------------------------------------------------------------

#: Production ZyINS endpoint origin.
PRODUCTION_REMOTE_ORIGIN = "https://zyins.isaapi.com"

#: Production proxy endpoint origin.
PRODUCTION_PROXY_ORIGIN = "https://proxy.isaapi.com"


@dataclass(frozen=True, slots=True)
class RemoteEngineSelector:
    """Tagged engine selector — production / staging ZyINS endpoint."""

    kind: Literal["remote"] = "remote"
    base_url: str = PRODUCTION_REMOTE_ORIGIN


@dataclass(frozen=True, slots=True)
class LocalEngineSelector:
    """Local engine binary — points at a developer or test endpoint."""

    kind: Literal["local"] = "local"
    base_url: str = "http://localhost:8080"


@dataclass(frozen=True, slots=True)
class ProxyEngineSelector:
    """Routes through the platform proxy (``/v1/call``)."""

    kind: Literal["proxy"] = "proxy"
    proxy_origin: str = PRODUCTION_PROXY_ORIGIN


@dataclass(frozen=True, slots=True)
class InMemoryEngineSelector:
    """In-process mock — bypasses HTTP entirely. Test-only.

    Carries the test transport via the ``transport`` attribute on
    :class:`IsaCreateOptions`; this selector is the marker.
    """

    kind: Literal["in_memory"] = "in_memory"


IsaEngine = (
    RemoteEngineSelector
    | LocalEngineSelector
    | ProxyEngineSelector
    | InMemoryEngineSelector
)


class RemoteEngine:
    """Production ZyINS endpoint factory."""

    @staticmethod
    def default() -> IsaEngine:
        """Default — production endpoint (``https://zyins.isaapi.com``)."""
        return RemoteEngineSelector(base_url=PRODUCTION_REMOTE_ORIGIN)

    @staticmethod
    def at(base_url: str) -> IsaEngine:
        """Construct from an explicit base URL (staging, region-specific)."""
        if not base_url:
            raise ValueError("RemoteEngine.at: base_url must be a non-empty string")
        return RemoteEngineSelector(base_url=base_url)


class LocalEngine:
    """Local engine factory."""

    @staticmethod
    def at(base_url: str) -> IsaEngine:
        if not base_url:
            raise ValueError("LocalEngine.at: base_url must be a non-empty string")
        return LocalEngineSelector(base_url=base_url)


class ProxyEngine:
    """Platform proxy factory."""

    @staticmethod
    def default() -> IsaEngine:
        return ProxyEngineSelector(proxy_origin=PRODUCTION_PROXY_ORIGIN)

    @staticmethod
    def at(proxy_origin: str) -> IsaEngine:
        if not proxy_origin:
            raise ValueError("ProxyEngine.at: proxy_origin must be a non-empty string")
        return ProxyEngineSelector(proxy_origin=proxy_origin)


#: In-process mock engine — pair with ``transport=`` on
#: :class:`IsaCreateOptions` to inject a test transport.
InMemoryEngine: IsaEngine = InMemoryEngineSelector()


# ---------------------------------------------------------------------------
# Options bag
# ---------------------------------------------------------------------------

#: Default per-call timeout in seconds (matches the TS 30_000 ms default).
DEFAULT_TIMEOUT_SECONDS = 30.0


@dataclass(frozen=True, slots=True)
class IsaCreateOptions:
    """Options accepted by :meth:`Isa.create`.

    Every field is optional except ``auth``; defaults match the
    production posture (RemoteEngine.default, 30s timeout, v2).
    """

    auth: IsaAuthSupplier
    engine: IsaEngine | None = None
    timeout: float = DEFAULT_TIMEOUT_SECONDS
    api_version: IsaApiVersion = "v2"
    client_version: str | None = None
    transport: Transport | None = None


@dataclass(frozen=True, slots=True)
class ResolvedIsaOptions:
    """Resolved view of :class:`IsaCreateOptions` with defaults applied.

    Pure value object — safe to pass between the public ``Isa.create``
    facade and the internal ``ZyInsClient`` constructor.
    """

    auth: IsaAuthSupplier
    engine: IsaEngine
    timeout_seconds: float
    api_version: IsaApiVersion
    client_version: str | None
    transport: Transport | None
    base_url: str
    proxy_origin: str | None


def resolve_isa_options(opts: IsaCreateOptions) -> ResolvedIsaOptions:
    """Resolve :class:`IsaCreateOptions` into a fully-defaulted view.

    Pure — no side effects, safe to call from constructors and tests
    alike. Mirrors the TS ``resolveIsaOptions()`` semantics exactly.
    """
    engine = opts.engine if opts.engine is not None else RemoteEngine.default()
    base_url = _engine_base_url(engine)
    proxy_origin = engine.proxy_origin if isinstance(engine, ProxyEngineSelector) else None
    return ResolvedIsaOptions(
        auth=opts.auth,
        engine=engine,
        timeout_seconds=opts.timeout,
        api_version=opts.api_version,
        client_version=opts.client_version,
        transport=opts.transport,
        base_url=base_url,
        proxy_origin=proxy_origin,
    )


def _engine_base_url(engine: IsaEngine) -> str:
    if isinstance(engine, (RemoteEngineSelector, LocalEngineSelector)):
        return engine.base_url
    if isinstance(engine, ProxyEngineSelector):
        # Proxy mode targets the production remote origin for the
        # underlying ZyINS request; the proxy_origin lives on the
        # ResolvedIsaOptions for the proxy namespace to consume.
        return PRODUCTION_REMOTE_ORIGIN
    if isinstance(engine, InMemoryEngineSelector):
        return PRODUCTION_REMOTE_ORIGIN
    # Defensive — exhaustive over the Union; an unknown variant is a
    # programming error rather than a runtime fallback.
    raise TypeError(f"resolve_isa_options: unknown engine selector {engine!r}")
