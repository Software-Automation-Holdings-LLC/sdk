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

from collections.abc import Callable
from typing import Any

from .account import AccountNamespace
from .core.credential_store import CREDENTIAL_KEYS, CredentialStore, InMemoryCredentialStore
from .core.debug import DebugLogger
from .core.env import EnvReader, IsaConfigError, default_env, require_env
from .core.envelope import Envelope, RawResponse, extract_envelope_fields
from .core.license_hmac import LicenseClock, system_license_clock
from .core.transport import HttpTransport, Transport
from .zyins.applicant import Applicant  # re-export convenience
from .zyins.client import DEFAULT_BASE_URL, DEFAULT_TIMEOUT_SECONDS, ZyInsClient
from .zyins.coverage import Coverage  # re-export convenience
from .zyins.credential_state import (
    IsaCredentialState,
    LicenseCredentialSnapshot,
    LicenseRefreshedEvent,
    LicenseRefreshedListener,
    load_or_mint_device_id,
)
from .zyins.licenses_facade import LicenseFacade
from .zyins.logos import LogosSubClient
from .zyins.prequalify import PrequalifyInput, PrequalifyResult, parse_prequalify_response
from .zyins.prequalify_legacy_blob import encode_legacy_blob, parse_legacy_blob_response
from .zyins.quote import QuoteInput, QuoteResult, parse_quote_response

__all__ = [
    "Applicant",
    "Coverage",
    "Envelope",
    "Isa",
    "IsaConfigError",
    "LicenseRefreshedEvent",
    "PrequalifyInput",
    "QuoteInput",
    "RawResponse",
]


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
    _credential_state: IsaCredentialState | None
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
    ) -> None:
        self._client = client
        self._debug = debug or DebugLogger()
        self._client._debug = self._debug
        self._license_keycode = None
        self._license_email = None
        self._session_id = None
        self._session_secret = None
        from .proxy import DEFAULT_PROXY_ORIGIN as _DEFAULT_PROXY

        self._proxy_origin = _DEFAULT_PROXY
        self._credential_state = None
        self._base_url = base_url.rstrip("/")
        self._transport = transport or HttpTransport()
        self._owns_transport = transport is None
        self._license_clock = license_clock or system_license_clock
        self.zyins = ZyinsNamespace(self)
        from .proxy import ProxyNamespace
        from .rapidsign import RapidsignNamespace
        from .webhooks import WebhooksNamespace

        self.rapidsign = RapidsignNamespace(self)
        self.proxy = ProxyNamespace(self)
        self.webhooks = WebhooksNamespace(self)

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
        )
        instance._license_keycode = resolved_keycode
        instance._license_email = resolved_email
        instance._credential_state = state
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
    ) -> Isa:
        """Construct an :class:`Isa` from a license keycode + email.

        Canonical factory name per the locked SDK syntax (TS canon:
        ``Isa.withKeycode``). Equivalent to :meth:`with_license`, which is
        retained as a deprecated alias.
        """
        return cls.with_license(
            keycode,
            email,
            base_url=base_url,
            timeout=timeout,
            transport=transport,
            env=env,
            credential_store=credential_store,
            license_clock=license_clock,
        )

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
    """``isa.zyins`` — ZyINS underwriting + quoting operations."""

    def __init__(self, isa: Isa) -> None:
        self._isa = isa
        self._client = isa._client
        self.prequalify = _PrequalifyCallable(self)
        self.quote = _Quote(self)
        self.logos = LogosSubClient(isa._base_url)
        # `license` is constructed lazily so non-license bootstrap paths
        # don't pay the cost of an unused facade.
        self._license: LicenseFacade | None = None

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
        """``isa.zyins.cases`` — case create/share + email convenience.

        Forwards to the underlying ``ZyInsClient.cases`` sub-client so
        the canonical ``isa.zyins.cases.share(...)`` path is reachable
        through the unified ``Isa`` entry.
        """
        return self._client.cases


class _PrequalifyCallable:
    """``isa.zyins.prequalify`` — callable with a ``legacy_blob`` companion.

    The default call shape is::

        isa.zyins.prequalify(input)              # → Envelope[PrequalifyResult]
        isa.zyins.prequalify.with_raw_response(input)
        isa.zyins.prequalify.legacy_blob(payload)  # → Envelope[PrequalifyResult]
    """

    _PATH = "/v1/prequalify"

    def __init__(self, ns: ZyinsNamespace) -> None:
        self._ns = ns

    def __call__(
        self,
        input: PrequalifyInput,
        *,
        idempotency_key: str | None = None,
    ) -> Envelope[PrequalifyResult]:
        env, _raw = _run(
            ns=self._ns,
            method="POST",
            path=self._PATH,
            body_provider=lambda: input.to_wire_body(),
            parse=parse_prequalify_response,
            idempotency_key=idempotency_key,
        )
        return env

    def with_raw_response(
        self,
        input: PrequalifyInput,
        *,
        idempotency_key: str | None = None,
    ) -> tuple[Envelope[PrequalifyResult], RawResponse]:
        return _run(
            ns=self._ns,
            method="POST",
            path=self._PATH,
            body_provider=lambda: input.to_wire_body(),
            parse=parse_prequalify_response,
            idempotency_key=idempotency_key,
        )

    def legacy_blob(
        self,
        encoded_payload: dict[str, Any],
        *,
        idempotency_key: str | None = None,
    ) -> Envelope[PrequalifyResult]:
        """Run prequalify with a pre-encoded payload (bpp2.0 encoder shape).

        Same path, headers, and response parsing as the typed variant.
        """
        env, _raw = _run(
            ns=self._ns,
            method="POST",
            path=self._PATH,
            body_provider=lambda: encode_legacy_blob(encoded_payload),
            parse=parse_legacy_blob_response,
            idempotency_key=idempotency_key,
        )
        return env


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
