"""Public ``Isa`` client + the three bootstrap factories.

This is the SDK_DESIGN.md §3.2 surface. ``Isa`` is a thin orchestrator
that delegates wire work to :class:`~.client.ZyInsClient`; the value it
adds over the bare client is:

* Four named factories (:meth:`Isa.with_bearer`, :meth:`Isa.with_license`,
  :meth:`Isa.with_session`, :meth:`Isa.from_env`) that read env-var
  defaults when invoked without arguments — per §3.3.
* Per-method ``with_raw_response`` variants — per §5.4.
* A typed :class:`~.envelope.Envelope` carrying ``request_id``,
  ``idempotency_key``, ``livemode``, and ``retry_attempts`` — per §4.6.
* The License-HMAC ``isa.account.*`` namespace and the
  ``isa.zyins.license`` ergonomics layer.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING, Any, overload

from .zyins.bundled_api_versions import BUNDLED_API_VERSIONS
from .zyins.cases.storage import CaseStorage

if TYPE_CHECKING:
    from .zyins.isa_options import (
        IsaApiVersion,
        IsaAuthSupplier,
        IsaCreateOptions,
        IsaEngine,
    )

from .account import AccountNamespace
from .core.credential_store import CREDENTIAL_KEYS, CredentialStore, InMemoryCredentialStore
from .core.debug import DebugLogger
from .core.env import EnvReader, IsaConfigError, default_env, require_env
from .core.envelope import Envelope, RawResponse, extract_envelope_fields
from .core.license_hmac import LicenseClock, system_license_clock
from .core.transport import HttpTransport, Transport
from .zyins.applicant import Applicant  # re-export convenience
from .zyins.bundled_api_versions import resolve_api_version
from .zyins.client import DEFAULT_BASE_URL, DEFAULT_TIMEOUT_SECONDS, ZyInsClient
from .zyins.coverage import Coverage  # re-export convenience
from .zyins.credential_state import (
    IsaCredentialState,
    LicenseCredentialSnapshot,
    LicenseRefreshedEvent,
    LicenseRefreshedListener,
    load_or_mint_device_id,
)
from .zyins.datasets_v3 import DatasetBundleV3
from .zyins.licenses_facade import LicenseFacade
from .zyins.logos import LogosSubClient
from .zyins.measurements import Height, Weight
from .zyins.prequalify import PrequalifyInput, PrequalifyResult, parse_prequalify_response
from .zyins.prequalify_v3 import (
    PrequalifyV3Request,
    PrequalifyV3Result,
    parse_prequalify_v3_envelope,
    serialize_v3_prequalify_body,
)
from .zyins.prequalify_v3 import (
    serialize_wire_body as serialize_v3_quote_wire_body,
)
from .zyins.quote import QuoteInput, QuoteResult, parse_quote_response
from .zyins.quote_v3 import (
    QuoteV3Request,
    QuoteV3Result,
    parse_quote_v3_envelope,
)

__all__ = [
    "BUNDLED_API_VERSIONS",
    "Applicant",
    "CaseStorage",
    "Coverage",
    "Envelope",
    "Isa",
    "IsaConfigError",
    "LicenseRefreshedEvent",
    "PrequalifyInput",
    "PrequalifyV3Request",
    "PrequalifyV3Result",
    "QuoteInput",
    "QuoteV3Request",
    "QuoteV3Result",
    "RawResponse",
]


def _validate_api_version_override(value: Mapping[str, str] | None) -> None:
    """Reject the two forbidden ``api_version`` shapes at runtime.

    The locked SDK syntax (``docs/sdk-syntax-proposal.md`` §2.7) accepts
    a per-surface map only:

    * A string shorthand (``api_version="v3"``) is forbidden — there is
      no single "current" API version across surfaces.
    * A ``"default"`` key in the map is forbidden — same reason.

    mypy already rejects both shapes by typing (``Mapping[str, str] |
    None``), but runtime callers from untyped code paths bypass that
    check, so the runtime guard mirrors the type contract.
    """
    if value is None:
        return
    if isinstance(value, str):
        raise TypeError(
            "Isa.with_keycode: api_version must be a per-surface Mapping[str, str], "
            "not a string shorthand. See docs/sdk-syntax-proposal.md §2.7 — "
            "each ISA API surface (prequalify, quote, datasets, …) ships its own "
            "version history, so there is no global 'current' version."
        )
    if not isinstance(value, Mapping):
        raise TypeError(
            f"Isa.with_keycode: api_version must be a Mapping[str, str], got {type(value).__name__}."
        )
    if "default" in value:
        raise TypeError(
            "Isa.with_keycode: api_version map must not contain a 'default' key. "
            "Surfaces absent from the map fall through to BUNDLED_API_VERSIONS — "
            "see docs/sdk-syntax-proposal.md §2.7."
        )


class Isa:
    """Top-level client with factory constructors.

    Prefer one of :meth:`from_env`, :meth:`with_bearer`, :meth:`with_license`,
    or :meth:`with_session` over direct construction; those carry the
    env-var defaults documented in SDK_DESIGN.md §3.3.
    """

    _license_keycode: str | None
    _license_email: str | None
    _session_id: str | None
    _session_secret: str | None
    _proxy_origin: str
    _api_version: str | None  # legacy scalar — superseded by _api_versions; kept for compat
    _api_versions: Mapping[str, str] | None
    _client_version: str | None
    _credential_state: IsaCredentialState | None
    _case_storage: CaseStorage | None
    _base_url: str
    _transport: Transport
    _license_clock: LicenseClock

    def __init__(
        self,
        *,
        client: ZyInsClient,
        debug: DebugLogger | None = None,
        base_url: str = DEFAULT_BASE_URL,
        transport: Transport | None = None,
        license_clock: LicenseClock | None = None,
        case_storage: CaseStorage | None = None,
        dataset_bundle_fetcher: Callable[[], Any] | None = None,
        autocorrector: Any | None = None,
        match_algorithm: Any | None = None,
        autocomplete_algorithm: Any | None = None,
    ) -> None:
        self._client = client
        # Reference-adapter wholesale-replacement slots. The defaults are
        # bound lazily inside :class:`ZyinsNamespace` so non-reference
        # call paths don't pay the dataset-bundle cost.
        self._autocorrector_override = autocorrector
        self._match_algorithm_override = match_algorithm
        self._autocomplete_algorithm_override = autocomplete_algorithm
        self._debug = debug or DebugLogger()
        self._client._debug = self._debug
        self._license_keycode = None
        self._license_email = None
        self._session_id = None
        self._session_secret = None
        from .proxy import DEFAULT_PROXY_ORIGIN as _DEFAULT_PROXY

        self._proxy_origin = _DEFAULT_PROXY
        self._api_version = None
        self._api_versions = None
        self._client_version = None
        self._credential_state = None
        self._case_storage = None
        self._base_url = base_url.rstrip("/")
        self._transport = transport or HttpTransport()
        self._owns_transport = transport is None
        self._license_clock = license_clock or system_license_clock
        self._case_storage = case_storage
        self._dataset_bundle_fetcher = dataset_bundle_fetcher
        self.zyins = ZyinsNamespace(self)
        from .proxy import ProxyNamespace
        from .rapidsign import RapidsignNamespace
        from .webhooks import WebhooksNamespace

        self.rapidsign = RapidsignNamespace(self)
        self.proxy = ProxyNamespace(self)
        self.webhooks = WebhooksNamespace(self)
        # ``isa.autocorrector`` — top-level kernel factory per the
        # locked spec §2. Exposed as a namespace object so
        # ``isa.autocorrector.create(typo_map=...)`` matches the TS
        # ``isa.autocorrector.create({ typoMap })`` shape.
        self.autocorrector = _AutocorrectorNamespace()

    # ------------------------------------------------------------------
    # Factories
    # ------------------------------------------------------------------

    @classmethod
    def with_bearer(
        cls,
        token: str | None = None,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        transport: Transport | None = None,
        env: EnvReader | None = None,
        case_storage: CaseStorage | None = None,
        dataset_bundle_fetcher: Callable[[], Any] | None = None,
    ) -> Isa:
        """Construct an :class:`Isa` from an ``isa_live_…`` bearer token.

        Reads :envvar:`ISA_TOKEN` when ``token`` is omitted.
        """
        reader = env or default_env()
        resolved = (
            token
            if token is not None
            else require_env(reader, "ISA_TOKEN", factory_name="Isa.with_bearer")
        )
        client = ZyInsClient(
            resolved, base_url=base_url, timeout=timeout, transport=transport
        )
        return cls(
            client=client,
            debug=DebugLogger(env=reader),
            base_url=base_url,
            transport=transport,
            case_storage=case_storage,
            dataset_bundle_fetcher=dataset_bundle_fetcher,
        )

    @classmethod
    def with_license(
        cls,
        keycode: str | None = None,
        email: str | None = None,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        transport: Transport | None = None,
        env: EnvReader | None = None,
        credential_store: CredentialStore | None = None,
        license_clock: LicenseClock | None = None,
        api_version: Mapping[str, str] | None = None,
        case_storage: CaseStorage | None = None,
        dataset_bundle_fetcher: Callable[[], Any] | None = None,
    ) -> Isa:
        """Construct an :class:`Isa` from a license keycode + email.

        Both positional and keyword args are accepted so consumers can write
        ``Isa.with_license("ABC-123-XYZ", "john.doe@acme-agency.com")``.

        Reads :envvar:`ISA_LICENSE_KEYCODE` / :envvar:`ISA_LICENSE_EMAIL`
        when arguments are omitted. A device id is minted and persisted on
        first construction so subsequent activations bind to the same id.
        """
        reader = env or default_env()
        resolved_keycode = (
            keycode
            if keycode is not None
            else require_env(reader, "ISA_LICENSE_KEYCODE", factory_name="Isa.with_license")
        )
        resolved_email = (
            email
            if email is not None
            else require_env(reader, "ISA_LICENSE_EMAIL", factory_name="Isa.with_license")
        )
        store = credential_store or InMemoryCredentialStore()
        device_id = load_or_mint_device_id(store)
        persisted_license_key = store.get(CREDENTIAL_KEYS.LICENSE_KEY) or ""
        snapshot = LicenseCredentialSnapshot(
            keycode=resolved_keycode,
            email=resolved_email,
            device_id=device_id,
            license_key=persisted_license_key,
            order_id=resolved_keycode,
        )
        state = IsaCredentialState(snapshot, store)
        token = _license_bootstrap_token(resolved_keycode, resolved_email)
        client = ZyInsClient(
            token, base_url=base_url, timeout=timeout, transport=transport
        )
        instance = cls(
            client=client,
            debug=DebugLogger(env=reader),
            base_url=base_url,
            transport=transport,
            license_clock=license_clock,
            case_storage=case_storage,
            dataset_bundle_fetcher=dataset_bundle_fetcher,
        )
        instance._license_keycode = resolved_keycode
        instance._license_email = resolved_email
        instance._credential_state = state
        _validate_api_version_override(api_version)
        instance._api_versions = api_version
        # Rebind version-routed callables now that the pinned map is set.
        instance.zyins._bind_versioned_callables(instance._api_versions)
        instance._case_storage = case_storage
        return instance

    @classmethod
    def with_keycode(
        cls,
        keycode: str | None = None,
        email: str | None = None,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        transport: Transport | None = None,
        env: EnvReader | None = None,
        credential_store: CredentialStore | None = None,
        license_clock: LicenseClock | None = None,
        api_version: Mapping[str, str] | None = None,
        case_storage: CaseStorage | None = None,
        dataset_bundle_fetcher: Callable[[], Any] | None = None,
        autocorrector: Any | None = None,
        match_algorithm: Any | None = None,
        autocomplete_algorithm: Any | None = None,
    ) -> Isa:
        """Construct an :class:`Isa` from a license keycode + email.

        Canonical factory name per the locked SDK syntax (TS canon:
        ``Isa.withKeycode``). Equivalent to :meth:`with_license`, which is
        retained as a deprecated alias.

        :param api_version: Per-surface API-version override map. Keys
            are surface names (``"prequalify"``, ``"quote"``,
            ``"datasets"``, ``"reference"``, ``"sessions"``,
            ``"branding"``, ``"cases"``); values are pinned versions for
            that surface. Surfaces absent from the map fall through to
            :data:`BUNDLED_API_VERSIONS`. There is **no** shorthand
            string form and **no** ``default`` key — passing either
            raises :class:`TypeError`. See ``docs/sdk-syntax-proposal.md``
            §2.7.

        :param case_storage: Adapter implementing the :class:`CaseStorage`
            protocol — used by ``isa.zyins.cases.save`` / ``.get`` /
            ``.delete``. Defaults to
            :class:`ZeroKnowledgeCaseStorage`, which encrypts payloads
            client-side with AES-256-GCM and stores opaque ciphertext on
            the platform; the per-record key is returned as a
            ``recall_token`` and never touches the wire.

        :raises TypeError: when ``api_version`` is a string or has a
            ``"default"`` key (both forbidden by the locked spec).
        """
        _validate_api_version_override(api_version)
        instance = cls.with_license(
            keycode,
            email,
            base_url=base_url,
            timeout=timeout,
            transport=transport,
            env=env,
            credential_store=credential_store,
            license_clock=license_clock,
            api_version=api_version,
            case_storage=case_storage,
            dataset_bundle_fetcher=dataset_bundle_fetcher,
        )
        # Forward adapter overrides to the constructed instance — the
        # underlying :meth:`with_license` does not yet accept them, so
        # we set the slots directly and rebuild the zyins namespace
        # bindings.
        if autocorrector is not None:
            instance._autocorrector_override = autocorrector
        if match_algorithm is not None:
            instance._match_algorithm_override = match_algorithm
        if autocomplete_algorithm is not None:
            instance._autocomplete_algorithm_override = autocomplete_algorithm
        instance.zyins._rebind_reference_adapters()
        return instance

    @classmethod
    def for_form(
        cls,
        form_token: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        transport: Transport | None = None,
    ) -> Isa:
        """Construct an :class:`Isa` from an embedded-form token.

        Canonical factory per the locked SDK syntax (TS canon:
        ``Isa.forForm``). The form token is exchanged via
        ``POST /v1/sessions/reissue`` on first use; in the Python SDK this
        is a thin bootstrap that wraps the token as the bearer credential
        for subsequent requests until a session reissue is wired.

        :param form_token: the opaque embedded-form token issued by the
            host application.
        """
        if not form_token:
            raise IsaConfigError(
                "Isa.for_form requires a non-empty form_token.",
                missing_env=("form_token",),
            )
        token = _form_bootstrap_token(form_token)
        client = ZyInsClient(
            token, base_url=base_url, timeout=timeout, transport=transport
        )
        return cls(
            client=client,
            base_url=base_url,
            transport=transport,
        )

    @classmethod
    def authenticate(
        cls,
        *,
        token: str | None = None,
        keycode: str | None = None,
        email: str | None = None,
        form_token: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        transport: Transport | None = None,
        env: EnvReader | None = None,
        credential_store: CredentialStore | None = None,
        license_clock: LicenseClock | None = None,
    ) -> Isa:
        """Dispatching factory — picks the right credential path by args.

        Canonical factory per the locked SDK syntax (TS canon:
        ``Isa.authenticate``). Resolution order:

        1. ``token`` → :meth:`with_bearer`
        2. ``keycode`` + ``email`` → :meth:`with_keycode`
        3. ``form_token`` → :meth:`for_form`

        Raises :class:`IsaConfigError` when no valid combination is supplied.
        """
        if token is not None:
            return cls.with_bearer(
                token, base_url=base_url, timeout=timeout, transport=transport, env=env
            )
        if keycode is not None and email is not None:
            return cls.with_keycode(
                keycode,
                email,
                base_url=base_url,
                timeout=timeout,
                transport=transport,
                env=env,
                credential_store=credential_store,
                license_clock=license_clock,
            )
        if form_token is not None:
            return cls.for_form(
                form_token, base_url=base_url, timeout=timeout, transport=transport
            )
        raise IsaConfigError(
            "Isa.authenticate: provide one of token=, keycode=+email=, or form_token=.",
            missing_env=("token", "keycode", "email", "form_token"),
        )

    @classmethod
    def create(
        cls,
        options: IsaCreateOptions | None = None,
        *,
        auth: IsaAuthSupplier | None = None,
        engine: IsaEngine | None = None,
        timeout: float | None = None,
        api_version: IsaApiVersion | None = None,
        client_version: str | None = None,
        transport: Transport | None = None,
        env: EnvReader | None = None,
        credential_store: CredentialStore | None = None,
        license_clock: LicenseClock | None = None,
    ) -> Isa:
        """Construct an :class:`Isa` from a typed options bag.

        The recommended path going forward — matches the cross-language
        SDK shape (TS ``Isa.create({auth, engine, ...})``, C# ``new
        Isa(new IsaOptions { Auth = ... })``). Existing factories
        (:meth:`with_bearer` / :meth:`with_keycode` / :meth:`for_form`)
        remain the canonical primitives; this method dispatches to them
        based on the auth supplier kind.

        Two call shapes are accepted:

        * ``Isa.create(IsaCreateOptions(auth=..., engine=..., ...))`` —
          pass a fully-built options object.
        * ``Isa.create(auth=..., engine=..., ...)`` — pass keyword
          arguments directly; an :class:`IsaCreateOptions` is constructed
          internally. Useful for the common case where the call site
          doesn't otherwise need the typed options object.

        ``api_version`` and ``client_version`` are retained on the
        instance for the native v2 follow-up. Current Python operations
        continue to use the date-pinned ``Version`` header and existing
        endpoint paths.
        """
        from .zyins.isa_options import (
            BearerAuthSupplier,
            FormAuthSupplier,
            IsaCreateOptions,
            LicenseAuthSupplier,
            SessionAuthSupplier,
            resolve_isa_options,
        )

        if options is not None:
            conflicting_options = tuple(
                name
                for name, value in {
                    "auth": auth,
                    "engine": engine,
                    "timeout": timeout,
                    "api_version": api_version,
                    "client_version": client_version,
                    "transport": transport,
                }.items()
                if value is not None
            )
            if conflicting_options:
                joined = ", ".join(conflicting_options)
                raise IsaConfigError(
                    "Isa.create: pass either an IsaCreateOptions positional "
                    f"argument OR keyword options ({joined}) — not both.",
                    missing_env=(),
                )
        if options is None:
            if auth is None:
                raise IsaConfigError(
                    "Isa.create: 'auth' is required (pass auth= or "
                    "an IsaCreateOptions with .auth set).",
                    missing_env=("auth",),
                )
            options = IsaCreateOptions(
                auth=auth,
                engine=engine,
                timeout=timeout
                if timeout is not None
                else DEFAULT_TIMEOUT_SECONDS,
                api_version=api_version if api_version is not None else "v2",
                client_version=client_version,
                transport=transport,
            )

        resolved = resolve_isa_options(options)
        supplier = resolved.auth

        def apply_options(instance: Isa) -> Isa:
            if resolved.proxy_origin is not None:
                instance._proxy_origin = resolved.proxy_origin
            instance._api_version = resolved.api_version
            instance._client_version = resolved.client_version
            return instance

        # Dispatch to the existing legacy factory by auth kind. Each
        # factory already handles env-var fallback, so a supplier whose
        # field is None (e.g. ``BearerAuth.from_env()``) falls through
        # to the env reader inside the factory.
        if isinstance(supplier, BearerAuthSupplier):
            return apply_options(
                cls.with_bearer(
                    supplier.token,
                    base_url=resolved.base_url,
                    timeout=resolved.timeout_seconds,
                    transport=resolved.transport,
                    env=env,
                )
            )
        if isinstance(supplier, LicenseAuthSupplier):
            return apply_options(
                cls.with_keycode(
                    supplier.keycode,
                    supplier.email,
                    base_url=resolved.base_url,
                    timeout=resolved.timeout_seconds,
                    transport=resolved.transport,
                    env=env,
                    credential_store=credential_store,
                    license_clock=license_clock,
                )
            )
        if isinstance(supplier, FormAuthSupplier):
            return apply_options(
                cls.for_form(
                    supplier.form_token,
                    base_url=resolved.base_url,
                    timeout=resolved.timeout_seconds,
                    transport=resolved.transport,
                )
            )
        if isinstance(supplier, SessionAuthSupplier):
            return apply_options(
                cls.with_session(
                    session_id=supplier.session_id,
                    session_secret=supplier.session_secret,
                    base_url=resolved.base_url,
                    timeout=resolved.timeout_seconds,
                    transport=resolved.transport,
                    env=env,
                )
            )
        raise IsaConfigError(
            f"Isa.create: unknown auth supplier kind {supplier!r}.",
            missing_env=(),
        )

    @classmethod
    def with_session(
        cls,
        *,
        session_id: str | None = None,
        session_secret: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        transport: Transport | None = None,
        env: EnvReader | None = None,
    ) -> Isa:
        """Construct an :class:`Isa` from a session id + signing secret."""
        reader = env or default_env()
        resolved_id = (
            session_id
            if session_id is not None
            else require_env(reader, "ISA_SESSION_ID", factory_name="Isa.with_session")
        )
        resolved_secret = (
            session_secret
            if session_secret is not None
            else require_env(reader, "ISA_SESSION_SECRET", factory_name="Isa.with_session")
        )
        token = _session_bootstrap_token(resolved_id, resolved_secret)
        client = ZyInsClient(
            token, base_url=base_url, timeout=timeout, transport=transport
        )
        instance = cls(
            client=client,
            debug=DebugLogger(env=reader),
            base_url=base_url,
            transport=transport,
        )
        instance._session_id = resolved_id
        instance._session_secret = resolved_secret
        return instance

    @classmethod
    def from_env(
        cls,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        transport: Transport | None = None,
        env: EnvReader | None = None,
        credential_store: CredentialStore | None = None,
    ) -> Isa:
        """Auto-detect bearer / license / session credentials from the env.

        Resolution order (first complete set wins):

        1. :envvar:`ISA_TOKEN`                                    → bearer
        2. :envvar:`ISA_LICENSE_KEYCODE` + :envvar:`ISA_LICENSE_EMAIL` → license
        3. :envvar:`ISA_SESSION_ID` + :envvar:`ISA_SESSION_SECRET`    → session

        :raises IsaConfigError: when none of the credential triples are set.
        """
        reader = env or default_env()
        if reader.get("ISA_TOKEN"):
            return cls.with_bearer(
                base_url=base_url, timeout=timeout, transport=transport, env=reader
            )
        if reader.get("ISA_LICENSE_KEYCODE") and reader.get("ISA_LICENSE_EMAIL"):
            return cls.with_license(
                base_url=base_url,
                timeout=timeout,
                transport=transport,
                env=reader,
                credential_store=credential_store,
            )
        if reader.get("ISA_SESSION_ID") and reader.get("ISA_SESSION_SECRET"):
            return cls.with_session(
                base_url=base_url, timeout=timeout, transport=transport, env=reader
            )
        raise IsaConfigError(
            "Isa.from_env: no credentials in the environment. Set ISA_TOKEN, "
            "or ISA_LICENSE_KEYCODE + ISA_LICENSE_EMAIL, "
            "or ISA_SESSION_ID + ISA_SESSION_SECRET.",
            missing_env=(
                "ISA_TOKEN",
                "ISA_LICENSE_KEYCODE",
                "ISA_LICENSE_EMAIL",
                "ISA_SESSION_ID",
                "ISA_SESSION_SECRET",
            ),
        )

    # ------------------------------------------------------------------
    # License-aware namespaces (require with_license / from_env→license)
    # ------------------------------------------------------------------

    @property
    def account(self) -> AccountNamespace:
        """``isa.account.*`` — per-license account operations.

        Requires License-HMAC auth (i.e. constructed via :meth:`with_license`
        or :meth:`from_env` with license env vars set).
        """
        if self._credential_state is None:
            raise IsaConfigError(
                "isa.account is only available when Isa is constructed with license "
                "credentials. Use Isa.with_license(keycode, email) or set "
                "ISA_LICENSE_KEYCODE / ISA_LICENSE_EMAIL and call Isa.from_env()."
            )
        return AccountNamespace(
            auth=self._credential_state.auth,
            base_url=self._base_url,
            transport=self._transport,
            clock=self._license_clock,
        )

    def on_license_refreshed(self, listener: LicenseRefreshedListener) -> Callable[[], None]:
        """Subscribe to license-refresh events.

        Returns an unsubscribe callable. Raises :class:`IsaConfigError`
        when Isa was not constructed with license credentials.
        """
        if self._credential_state is None:
            raise IsaConfigError(
                "Isa.on_license_refreshed requires license-mode construction."
            )
        return self._credential_state.on_license_refreshed(listener)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        self._client.close()
        self.zyins.logos.close()
        if self._owns_transport and isinstance(self._transport, HttpTransport):
            self._transport.close()

    def __enter__(self) -> Isa:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


class _AutocorrectorNamespace:
    """``isa.autocorrector`` — top-level kernel factory.

    Mirrors the locked TS surface ``isa.autocorrector.create({ typoMap })``.
    Exposes :meth:`create` only; consumers wanting domain-bound
    autocorrection use ``isa.zyins.autocorrector`` instead.
    """

    @staticmethod
    def create(
        *,
        typo_map: Mapping[str, str],
        version_tag: str | None = None,
        on_applied: Callable[[Any], None] | None = None,
    ) -> Any:
        """Construct a :class:`DefaultAutocorrector`. See module spec §2."""
        from .zyins.reference.autocorrector import DefaultAutocorrector

        return DefaultAutocorrector(
            typo_map=typo_map, version_tag=version_tag, on_applied=on_applied
        )


class _BoundMatchAlgorithm:
    """Catalog-bound matcher for ``isa.zyins.matcher``."""

    __slots__ = ("_algorithm", "_index")

    def __init__(self, algorithm: Any, index: Any) -> None:
        self._algorithm = algorithm
        self._index = index

    @property
    def version_tag(self) -> str | None:
        version_tag = getattr(self._algorithm, "version_tag", None)
        if version_tag is None or isinstance(version_tag, str):
            return version_tag
        return str(version_tag)

    def match(self, query: str) -> Any:
        return self._algorithm.match(query, self._index.concepts)


class _BoundAutocompleteAlgorithm:
    """Catalog-bound autocomplete for ``isa.zyins.autocomplete``."""

    __slots__ = ("_algorithm", "_index", "_options_cls")

    def __init__(self, algorithm: Any, index: Any, options_cls: Any) -> None:
        self._algorithm = algorithm
        self._index = index
        self._options_cls = options_cls

    @property
    def version_tag(self) -> str | None:
        version_tag = getattr(self._algorithm, "version_tag", None)
        if version_tag is None or isinstance(version_tag, str):
            return version_tag
        return str(version_tag)

    async def rank(self, query: str, options: Any | None = None) -> Any:
        if options is None:
            options = self._options_cls(frequencies=self._index.frequencies)
        elif not isinstance(options, self._options_cls):
            raise TypeError("isa.zyins.autocomplete.rank options must be AutocompleteOptions")
        elif options.frequencies is None:
            options = self._options_cls(
                limit=options.limit,
                kinds=options.kinds,
                frequencies=self._index.frequencies,
                starts_with_only=options.starts_with_only,
                sort=options.sort,
            )
        return await self._algorithm.rank(query, self._index.concepts, options)


def _license_bootstrap_token(keycode: str, email: str) -> str:
    import hashlib

    digest = hashlib.sha256(f"{keycode}|{email}".encode()).hexdigest()[:20]
    return f"isa_test_license_{digest}"


def _form_bootstrap_token(form_token: str) -> str:
    import hashlib

    digest = hashlib.sha256(form_token.encode()).hexdigest()[:20]
    return f"isa_test_form_{digest}"


def _session_bootstrap_token(session_id: str, session_secret: str) -> str:
    import hashlib

    digest = hashlib.sha256(f"{session_id}|{session_secret}".encode()).hexdigest()[:20]
    return f"isa_test_session_{digest}"


# ----------------------------------------------------------------------
# Namespaces
# ----------------------------------------------------------------------


class ZyinsNamespace:
    """``isa.zyins`` — ZyINS underwriting + quoting operations.

    ``prequalify`` and ``quote`` are version-routed: the surface used at
    call time depends on the per-surface ``api_version`` map pinned on
    the parent :class:`Isa`. Surfaces absent from the map fall through
    to :data:`BUNDLED_API_VERSIONS` (currently ``v2`` for both). With
    ``api_version={'prequalify': 'v3'}`` the ``prequalify`` attribute is
    the same object as ``prequalify_v3``; same for ``quote``.

    The Phase 5 cut-over of the bundled defaults to ``v3`` is the
    auditable bump that flips every consumer not pinned at v2.
    """

    def __init__(self, isa: Isa) -> None:
        self._isa = isa
        self._client = isa._client
        # Versioned callables are always available; the selector below
        # binds `self.prequalify` / `self.quote` to one of them based on
        # the pinned per-surface api_version map.
        self.prequalify_v2 = _PrequalifyCallable(self)
        self.prequalify_v3 = _PrequalifyV3Callable(self)
        self.quote_v2 = _Quote(self)
        self.quote_v3 = _QuoteV3Callable(self)
        # Default binding uses the BUNDLED_API_VERSIONS defaults (v2 for
        # both prequalify and quote). Factories that accept
        # ``api_version`` rebind after assigning ``_api_versions`` on the
        # parent Isa via :meth:`_bind_versioned_callables`.
        self._bind_versioned_callables(isa._api_versions)
        self.logos = LogosSubClient(isa._base_url)
        # `license` is constructed lazily so non-license bootstrap paths
        # don't pay the cost of an unused facade.
        self._license: LicenseFacade | None = None
        # `reference` is constructed eagerly with a deferred bundle source.
        # The locked design (``docs/sdk-syntax-proposal.md`` §reference)
        # makes ``isa.zyins.medications.match(text)`` work without any
        # consumer-side ``set_dataset_bundle()`` call when a bundle
        # fetcher is wired on the parent :class:`Isa`. Pre-warming via
        # ``set_dataset_bundle()`` remains supported for tests and for
        # consumers who fetch the bundle through their own path.
        import threading

        from .zyins.reference import ReferenceFacade as _ReferenceFacade

        self._dataset_bundle: DatasetBundleV3 | None = None
        self._bundle_fetch_lock = threading.Lock()
        self._reference: _ReferenceFacade = _ReferenceFacade(self._require_bundle)
        # Locked shortcuts per ``docs/sdk-syntax-proposal.md`` §reference.
        # ``isa.zyins.medications.match(...)`` and
        # ``isa.zyins.conditions.match(...)`` resolve through the same
        # cached :class:`ReferenceIndex` as ``isa.zyins.reference``.
        self.reference: _ReferenceFacade = self._reference
        self.medications = self._reference.medications
        self.conditions = self._reference.conditions
        self.concepts = self._reference.concepts
        # Reference-adapter bindings. ``autocorrector`` / ``matcher`` /
        # ``autocomplete`` are pre-wired against the zyins catalog when
        # a dataset bundle is available; constructed lazily so non-
        # reference call paths don't pay the cost.
        from .zyins.reference.autocomplete_algorithm import (
            DefaultAutocompleteAlgorithm,
        )
        from .zyins.reference.autocorrector import DefaultAutocorrector
        from .zyins.reference.match_algorithm import DefaultMatchAlgorithm

        self._default_autocorrector_cls = DefaultAutocorrector
        self._default_match_algorithm_cls = DefaultMatchAlgorithm
        self._default_autocomplete_algorithm_cls = DefaultAutocompleteAlgorithm
        self._cached_autocorrector: Any | None = None
        self._cached_matcher: Any | None = None
        self._cached_autocompleter: Any | None = None
        self._cached_for_version: str | None = None

        # ``isa.zyins.cases`` — locked save/recall on top of legacy
        # share/email. Resolved at first attribute access so non-cases
        # call paths don't pay any cost.
        from .zyins.cases import CasesFacade as _CasesFacade

        self._cases_facade: _CasesFacade = _CasesFacade(
            storage_provider=self._require_case_storage,
            legacy_provider=lambda: self._client.cases,
        )

    def set_dataset_bundle(self, bundle: DatasetBundleV3) -> None:
        """Bind a :class:`DatasetBundleV3` to ``isa.zyins.reference``.

        Pre-warming step for the reference namespace. Pass the result
        of ``get_datasets_v3(...)`` or any pre-loaded fixture. The
        facade caches the derived :class:`ReferenceIndex` and rebuilds
        it whenever a fresh bundle is set.

        Optional when a ``dataset_bundle_fetcher`` was wired on the
        parent :class:`Isa` — the first ``match()`` call will fetch
        and cache the bundle automatically. Required when no fetcher
        is wired; calling ``match()`` before this raises
        :class:`IsaConfigError` with a recipe.
        """
        self._dataset_bundle = bundle
        self._rebind_reference_adapters()

    def _require_bundle(self) -> DatasetBundleV3:
        cached = self._dataset_bundle
        if cached is not None:
            return cached
        fetcher = self._isa._dataset_bundle_fetcher
        if fetcher is None:
            raise IsaConfigError(
                "isa.zyins.reference requires a dataset bundle. Call "
                "isa.zyins.set_dataset_bundle(bundle) with the result of "
                "sah_sdk.zyins.datasets_v3.get_datasets_v3(...) (or a "
                "fixture in tests), or construct Isa with a "
                "dataset_bundle_fetcher= callable that fetches the bundle "
                "on demand."
            )
        # Serialize concurrent first-call fetches so we issue exactly
        # one request even under contention. Double-checked under lock.
        with self._bundle_fetch_lock:
            if self._dataset_bundle is None:
                self._dataset_bundle = fetcher()
            return self._dataset_bundle

    def _require_case_storage(self) -> CaseStorage:
        """Resolve the wired :class:`CaseStorage` adapter.

        Falls back to :class:`ZeroKnowledgeCaseStorage` (client-side
        AES-256-GCM, opaque ciphertext on the wire) when no adapter was
        passed to :meth:`Isa.with_keycode`. The default is cached on the
        parent :class:`Isa` so subsequent ``save``/``recall`` calls
        reuse the same instance.
        """
        storage = self._isa._case_storage
        if storage is None:
            from .zyins.cases.zero_knowledge import ZeroKnowledgeCaseStorage

            storage = ZeroKnowledgeCaseStorage(self._isa._client)
            self._isa._case_storage = storage
        return storage

    @property
    def license(self) -> LicenseFacade:
        """``isa.zyins.license`` — credential-aware license lifecycle.

        Canonical singular form per the locked SDK syntax (TS canon:
        ``isa.zyins.license``). Each device has exactly one license.

        Requires license-mode bootstrap; raises :class:`IsaConfigError`
        otherwise.
        """
        if self._isa._credential_state is None:
            raise IsaConfigError(
                "isa.zyins.license is only available when Isa is constructed "
                "with license credentials. Use Isa.with_license(keycode, email)."
            )
        if self._license is None:
            self._license = LicenseFacade(
                state=self._isa._credential_state,
                base_url=self._isa._base_url,
                transport=self._isa._transport,
                clock=self._isa._license_clock,
            )
        return self._license

    @property
    def cases(self) -> Any:
        """``isa.zyins.cases`` — locked save/recall + legacy share/email.

        Returns a :class:`~sah_sdk.zyins.cases.CasesFacade` exposing
        the locked verbs ``save(record)`` and ``recall(id, recall_token=None)``
        on top of an injected :class:`~sah_sdk.zyins.cases_storage.CaseStorage`
        adapter; the legacy verbs (``share``, ``email``, ``create``)
        continue to forward to the underlying ``ZyInsClient.cases``
        sub-client so existing call sites work unchanged.
        """
        return self._cases_facade

    # ------------------------------------------------------------------
    # Reference-adapter bindings — locked spec §2 (autocorrect / match /
    # autocomplete adapters). Resolved lazily so non-reference call
    # paths don't fetch the dataset bundle.
    # ------------------------------------------------------------------

    @property
    def autocorrector(self) -> Any:
        """Pre-bound :class:`Autocorrector` against zyins spelling corrections.

        Returns the consumer-supplied override (``Isa(...,
        autocorrector=...)``) when one was passed; otherwise constructs
        a :class:`DefaultAutocorrector` from the current dataset
        bundle's ``spelling_corrections.items`` list.
        """
        override = self._isa._autocorrector_override
        if override is not None:
            return override
        self._ensure_reference_adapters()
        assert self._cached_autocorrector is not None
        return self._cached_autocorrector

    @property
    def matcher(self) -> Any:
        """Pre-bound :class:`MatchAlgorithm` against the zyins catalog."""
        self._ensure_reference_adapters()
        assert self._cached_matcher is not None
        return self._cached_matcher

    @property
    def autocomplete(self) -> Any:
        """Pre-bound :class:`AutocompleteAlgorithm` against the catalog."""
        self._ensure_reference_adapters()
        assert self._cached_autocompleter is not None
        return self._cached_autocompleter

    def _rebind_reference_adapters(self) -> None:
        """Reset cached adapters so the next access rebuilds them."""
        self._cached_autocorrector = None
        self._cached_matcher = None
        self._cached_autocompleter = None
        self._cached_for_version = None

    def _ensure_reference_adapters(self) -> None:
        """Lazily build defaults bound to the current dataset bundle.

        Re-runs whenever the bundle's ``version`` changes so a hot
        catalog rotation doesn't strand the adapter on stale typo data.
        """
        bundle = self._require_bundle()
        has_autocorrector = (
            self._isa._autocorrector_override is not None
            or self._cached_autocorrector is not None
        )
        if (
            self._cached_for_version == bundle.version
            and has_autocorrector
            and self._cached_matcher is not None
            and self._cached_autocompleter is not None
        ):
            return
        from .zyins.reference import AdapterReferenceIndex
        from .zyins.reference.autocomplete_algorithm import AutocompleteOptions

        index = AdapterReferenceIndex.from_bundle(bundle)
        typo_map = index.typo_map
        if self._isa._autocorrector_override is None:
            self._cached_autocorrector = self._default_autocorrector_cls(
                typo_map=typo_map, version_tag=bundle.version
            )
        match_algorithm = self._isa._match_algorithm_override
        if match_algorithm is None:
            match_algorithm = self._default_match_algorithm_cls(version_tag=bundle.version)
        self._cached_matcher = _BoundMatchAlgorithm(
            match_algorithm,
            index,
        )
        autocomplete_algorithm = self._isa._autocomplete_algorithm_override
        if autocomplete_algorithm is None:
            autocomplete_algorithm = self._default_autocomplete_algorithm_cls(
                version_tag=bundle.version
            )
        self._cached_autocompleter = _BoundAutocompleteAlgorithm(
            autocomplete_algorithm,
            index,
            AutocompleteOptions,
        )
        self._cached_for_version = bundle.version

    def _bind_versioned_callables(
        self, api_versions: Mapping[str, str] | None
    ) -> None:
        """Resolve ``prequalify`` / ``quote`` to their pinned-version targets.

        Idempotent — factories that set ``Isa._api_versions`` after
        construction call this to rebind. The resolution mirrors the TS
        SDK (PR #377): ``v1`` and ``v2`` both route to the existing
        callable (Python has not split a v1/v2 module; the same callable
        accepts both wire shapes via ``parse_prequalify_response``);
        ``v3`` routes to the dedicated v3 callable.
        """
        prequalify_version = resolve_api_version(api_versions, "prequalify")
        # Union annotation so mypy accepts either branch — the public
        # surface promises one of the version-pinned callable shapes.
        # v1 + v2 share the legacy callable (no split v2 module in
        # Python yet); v3 routes to the dedicated v3 callable.
        prequalify: _PrequalifyCallable | _PrequalifyV3Callable = (
            self.prequalify_v3
            if prequalify_version == "v3"
            else self.prequalify_v2
        )
        self.prequalify = prequalify
        quote_version = resolve_api_version(api_versions, "quote")
        quote: _Quote | _QuoteV3Callable = (
            self.quote_v3 if quote_version == "v3" else self.quote_v2
        )
        self.quote = quote


class _PrequalifyCallable:
    """``isa.zyins.prequalify`` — callable with raw-response variant.

    Two call shapes are accepted:

    * ``isa.zyins.prequalify(PrequalifyInput(...))`` — original positional form.
    * ``isa.zyins.prequalify(applicant=..., coverage=..., products=...)`` —
      decomposed-keyword form documented in the cross-language quickstart.
      ``applicant`` accepts an :class:`Applicant` or a plain mapping (the
      mapping is validated through :class:`Applicant`).

    Both return ``Envelope[PrequalifyResult]``.
    """

    _PATH = "/v1/prequalify"

    def __init__(self, ns: ZyinsNamespace) -> None:
        self._ns = ns

    @overload
    def __call__(
        self,
        input: PrequalifyInput,
        *,
        idempotency_key: str | None = None,
    ) -> Envelope[PrequalifyResult]: ...

    @overload
    def __call__(
        self,
        *,
        applicant: Applicant | Mapping[str, Any],
        coverage: Coverage,
        products: Any,
        idempotency_key: str | None = None,
    ) -> Envelope[PrequalifyResult]: ...

    def __call__(
        self,
        input: PrequalifyInput | None = None,
        *,
        applicant: Applicant | Mapping[str, Any] | None = None,
        coverage: Coverage | None = None,
        products: Any = None,
        idempotency_key: str | None = None,
    ) -> Envelope[PrequalifyResult]:
        resolved = _resolve_prequalify_input(
            input=input,
            applicant=applicant,
            coverage=coverage,
            products=products,
        )
        env, _raw = _run(
            ns=self._ns,
            method="POST",
            path=self._PATH,
            body_provider=lambda: resolved.to_wire_body(),
            parse=parse_prequalify_response,
            idempotency_key=idempotency_key,
        )
        return env

    def with_raw_response(
        self,
        input: PrequalifyInput | None = None,
        *,
        applicant: Applicant | Mapping[str, Any] | None = None,
        coverage: Coverage | None = None,
        products: Any = None,
        idempotency_key: str | None = None,
    ) -> tuple[Envelope[PrequalifyResult], RawResponse]:
        resolved = _resolve_prequalify_input(
            input=input,
            applicant=applicant,
            coverage=coverage,
            products=products,
        )
        return _run(
            ns=self._ns,
            method="POST",
            path=self._PATH,
            body_provider=lambda: resolved.to_wire_body(),
            parse=parse_prequalify_response,
            idempotency_key=idempotency_key,
        )


def _resolve_prequalify_input(
    *,
    input: PrequalifyInput | None,
    applicant: Applicant | Mapping[str, Any] | None,
    coverage: Coverage | None,
    products: Any,
) -> PrequalifyInput:
    """Coerce either call shape to a :class:`PrequalifyInput`.

    Mixed shapes (e.g. ``input=`` plus ``applicant=``) raise rather than
    silently picking one — the call site should use one form or the
    other, never both.
    """
    decomposed = applicant is not None or coverage is not None or products is not None
    if input is not None and decomposed:
        raise IsaConfigError(
            "isa.zyins.prequalify: pass either a PrequalifyInput positional "
            "argument OR (applicant=, coverage=, products=) keywords — not both.",
            missing_env=(),
        )
    if input is not None:
        return input
    if applicant is None or coverage is None or products is None:
        raise IsaConfigError(
            "isa.zyins.prequalify requires (applicant=, coverage=, products=) "
            "or a PrequalifyInput positional argument.",
            missing_env=("applicant", "coverage", "products"),
        )
    if not isinstance(applicant, Applicant):
        applicant = _coerce_applicant_arg(applicant)
    return PrequalifyInput(
        applicant=applicant,
        coverage=coverage,
        products=_coerce_products_arg(products),
    )


def _coerce_applicant_arg(applicant: Mapping[str, Any] | Any) -> Applicant:
    if isinstance(applicant, Mapping):
        fields = dict(applicant)
        height = fields.pop("height", None)
        weight = fields.pop("weight", None)
        if height is not None:
            fields = _set_measurement_alias(
                fields, "height_inches", _height_inches(height)
            )
        if weight is not None:
            fields = _set_measurement_alias(
                fields, "weight_pounds", _weight_pounds(weight)
            )
        applicant = fields
    return Applicant.model_validate(applicant)


def _set_measurement_alias(
    fields: dict[str, Any], canonical_key: str, canonical_value: Any
) -> dict[str, Any]:
    if canonical_key in fields and fields[canonical_key] != canonical_value:
        raise IsaConfigError(
            f"isa.zyins.prequalify: applicant {canonical_key} conflicts with alias.",
            missing_env=("applicant",),
        )
    return {**fields, canonical_key: canonical_value}


def _height_inches(value: Any) -> Any:
    if isinstance(value, Height):
        return value.inches
    if isinstance(value, str):
        return Height.from_string(value).inches
    return value


def _weight_pounds(value: Any) -> Any:
    if isinstance(value, Weight):
        return value.pounds
    if isinstance(value, str):
        return Weight.from_string(value).pounds
    return value


def _coerce_products_arg(products: Any) -> Any:
    """Adapt the documented ``products=`` shapes to ``PrequalifyInput.products``.

    Accepts (in priority order):

    * A :class:`ProductSelection` — passed through unchanged.
    * A wire-token string (``"fex|term"``) — passed through unchanged.
    * A list/tuple of catalog ``Product`` enum members (``StrEnum`` whose
      values are wire tokens) — joined into the wire-token string.
    * A list/tuple of zyins ``Product`` model instances — wrapped in a
      ``ProductSelection``.
    """
    from .zyins.product import Product as ZyinsProduct
    from .zyins.product import ProductSelection

    if isinstance(products, ProductSelection):
        return products
    if isinstance(products, str):
        if not products:
            raise IsaConfigError(
                "isa.zyins.prequalify: products must contain at least one entry.",
                missing_env=("products",),
            )
        return products
    if isinstance(products, (list, tuple)):
        if not products:
            raise IsaConfigError(
                "isa.zyins.prequalify: products must contain at least one entry.",
                missing_env=("products",),
            )
        if all(isinstance(p, ZyinsProduct) for p in products):
            return ProductSelection.many(products)
        if any(isinstance(p, ZyinsProduct) for p in products):
            raise IsaConfigError(
                "isa.zyins.prequalify: products must not mix zyins Product "
                "models with catalog Product enum members or wire-token strings.",
                missing_env=("products",),
            )
        first_type = type(products[0])
        if any(type(p) is not first_type for p in products):
            raise IsaConfigError(
                "isa.zyins.prequalify: products must use one homogeneous shape.",
                missing_env=("products",),
            )
        tokens: list[str] = []
        for product in products:
            token = getattr(product, "value", product)
            if isinstance(token, str):
                tokens.append(token)
        if len(tokens) != len(products) or any(not token for token in tokens):
            raise IsaConfigError(
                "isa.zyins.prequalify: products must contain wire-token strings.",
                missing_env=("products",),
            )
        return "|".join(tokens)
    raise IsaConfigError(
        "isa.zyins.prequalify: products must be a ProductSelection, "
        "wire-token string, or non-empty list/tuple of products.",
        missing_env=("products",),
    )


class _Quote:
    """Quote operation with both envelope-typed and raw-response calls."""

    _PATH = "/v1/quote"

    def __init__(self, ns: ZyinsNamespace) -> None:
        self._ns = ns

    def __call__(
        self,
        input: QuoteInput,
        *,
        idempotency_key: str | None = None,
    ) -> Envelope[QuoteResult]:
        env, _raw = _run(
            ns=self._ns,
            method="POST",
            path=self._PATH,
            body_provider=lambda: input.to_wire_body(),
            parse=parse_quote_response,
            idempotency_key=idempotency_key,
        )
        return env

    def with_raw_response(
        self,
        input: QuoteInput,
        *,
        idempotency_key: str | None = None,
    ) -> tuple[Envelope[QuoteResult], RawResponse]:
        return _run(
            ns=self._ns,
            method="POST",
            path=self._PATH,
            body_provider=lambda: input.to_wire_body(),
            parse=parse_quote_response,
            idempotency_key=idempotency_key,
        )


class _PrequalifyV3Callable:
    """``isa.zyins.prequalify_v3`` — typed v3 prequalify call.

    ``POST /v3/prequalify``. Returns ``Envelope[PrequalifyV3Result]``.
    Raises :class:`IsaConfigError` when invoked on an :class:`Isa`
    instance whose ``api_version`` map pins ``prequalify`` to anything
    other than ``v3`` — mirrors the TS ``prequalifyV3`` guard.
    """

    _PATH = "/v3/prequalify"

    def __init__(self, ns: ZyinsNamespace) -> None:
        self._ns = ns

    def __call__(
        self,
        request: PrequalifyV3Request,
        *,
        idempotency_key: str | None = None,
    ) -> Envelope[PrequalifyV3Result]:
        _assert_surface_pinned_to_v3(self._ns._isa, "prequalify", "prequalify_v3")
        env, _raw = _run_v3_prequalify(
            ns=self._ns, request=request, idempotency_key=idempotency_key
        )
        return env

    def with_raw_response(
        self,
        request: PrequalifyV3Request,
        *,
        idempotency_key: str | None = None,
    ) -> tuple[Envelope[PrequalifyV3Result], RawResponse]:
        _assert_surface_pinned_to_v3(self._ns._isa, "prequalify", "prequalify_v3")
        return _run_v3_prequalify(
            ns=self._ns, request=request, idempotency_key=idempotency_key
        )


class _QuoteV3Callable:
    """``isa.zyins.quote_v3`` — typed v3 quote call.

    ``POST /v3/quote``. Returns ``Envelope[QuoteV3Result]``. Raises
    :class:`IsaConfigError` when invoked on an :class:`Isa` instance
    whose ``api_version`` map pins ``quote`` to anything other than
    ``v3`` — mirrors the TS ``quoteV3`` guard.
    """

    _PATH = "/v3/quote"

    def __init__(self, ns: ZyinsNamespace) -> None:
        self._ns = ns

    def __call__(
        self,
        request: QuoteV3Request,
        *,
        idempotency_key: str | None = None,
    ) -> Envelope[QuoteV3Result]:
        _assert_surface_pinned_to_v3(self._ns._isa, "quote", "quote_v3")
        env, _raw = _run_v3_quote(
            ns=self._ns, request=request, idempotency_key=idempotency_key
        )
        return env

    def with_raw_response(
        self,
        request: QuoteV3Request,
        *,
        idempotency_key: str | None = None,
    ) -> tuple[Envelope[QuoteV3Result], RawResponse]:
        _assert_surface_pinned_to_v3(self._ns._isa, "quote", "quote_v3")
        return _run_v3_quote(
            ns=self._ns, request=request, idempotency_key=idempotency_key
        )


def _assert_surface_pinned_to_v3(
    isa: Isa, surface: str, method_name: str
) -> None:
    """Guard that the caller has explicitly pinned ``surface`` to ``v3``.

    Mirrors TS ``assertPrequalifyApiVersion`` / ``assertQuoteApiVersion``
    — using the v3 callable on an Isa whose surface is pinned elsewhere
    is a configuration bug, not a runtime fallback.
    """
    actual = resolve_api_version(isa._api_versions, surface)
    if actual == "v3":
        return
    raise IsaConfigError(
        f"isa.zyins.{method_name} requires api_version "
        f"{{'{surface}': 'v3'}} on this Isa instance, but the {surface} "
        f"surface is pinned to '{actual}'. Construct the Isa with "
        f"Isa.with_keycode(..., api_version={{'{surface}': 'v3'}}) or "
        f"call the version-routed isa.zyins.{surface} attribute instead."
    )


def _run_v3_prequalify(
    *,
    ns: ZyinsNamespace,
    request: PrequalifyV3Request,
    idempotency_key: str | None,
) -> tuple[Envelope[PrequalifyV3Result], RawResponse]:
    body = serialize_v3_prequalify_body(
        applicant=request.applicant,
        coverage=request.coverage,
        products=request.products,
        options=request.options,
    )
    raw_resp = ns._client._dispatch(
        method="POST",
        path=_PrequalifyV3Callable._PATH,
        body=body,
        idempotency_key=idempotency_key,
        extra_headers={"Api-Version": "v3"},
    )
    parsed = parse_prequalify_v3_envelope(
        raw_resp.body,
        idempotency_key=raw_resp.idempotency_key_sent or "",
    )
    envelope = Envelope(
        data=parsed,
        request_id=parsed.request_id,
        idempotency_key=parsed.idempotency_key,
        livemode=parsed.livemode,
        retry_attempts=parsed.retry_attempts,
    )
    raw = RawResponse(
        status=raw_resp.status,
        url=raw_resp.url,
        headers=raw_resp.headers,
    )
    return envelope, raw


def _run_v3_quote(
    *,
    ns: ZyinsNamespace,
    request: QuoteV3Request,
    idempotency_key: str | None,
) -> tuple[Envelope[QuoteV3Result], RawResponse]:
    body = serialize_v3_quote_wire_body(
        applicant=request.applicant,
        coverage=request.coverage,
        products=request.products,
        options=request.options,
    )
    raw_resp = ns._client._dispatch(
        method="POST",
        path=_QuoteV3Callable._PATH,
        body=body,
        idempotency_key=idempotency_key,
    )
    parsed = parse_quote_v3_envelope(
        raw_resp.body,
        idempotency_key=raw_resp.idempotency_key_sent or "",
    )
    envelope = Envelope(
        data=parsed,
        request_id=parsed.request_id,
        idempotency_key=parsed.idempotency_key,
        livemode=parsed.livemode,
        retry_attempts=parsed.retry_attempts,
    )
    raw = RawResponse(
        status=raw_resp.status,
        url=raw_resp.url,
        headers=raw_resp.headers,
    )
    return envelope, raw


def _run(
    *,
    ns: ZyinsNamespace,
    method: str,
    path: str,
    body_provider: Callable[[], str],
    parse: Callable[[str], Any],
    idempotency_key: str | None,
) -> tuple[Envelope[Any], RawResponse]:
    body = body_provider()
    raw_resp = ns._client._dispatch(
        method=method,
        path=path,
        body=body,
        idempotency_key=idempotency_key,
    )
    parsed = parse(raw_resp.body)
    import json

    try:
        raw_obj = json.loads(raw_resp.body) if raw_resp.body else {}
    except (ValueError, json.JSONDecodeError):
        raw_obj = {}
    if not isinstance(raw_obj, dict):
        raw_obj = {}
    request_id, idem, livemode, attempts = extract_envelope_fields(
        raw_obj,
        idempotency_key_sent=raw_resp.idempotency_key_sent,
    )
    envelope = Envelope(
        data=parsed,
        request_id=request_id,
        idempotency_key=idem,
        livemode=livemode,
        retry_attempts=attempts,
    )
    raw = RawResponse(
        status=raw_resp.status,
        url=raw_resp.url,
        headers=raw_resp.headers,
    )
    return envelope, raw
