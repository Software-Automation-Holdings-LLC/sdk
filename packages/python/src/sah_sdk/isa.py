"""Public ``Isa`` client + the three bootstrap factories.

This is the SDK_DESIGN.md §3.2 surface. ``Isa`` is a thin orchestrator
that delegates wire work to :class:`~.client.ZyInsClient`; the value it
adds over the bare client is:

* Three named factories (:meth:`Isa.with_bearer`, :meth:`Isa.with_license`,
  :meth:`Isa.with_session`) that read env-var defaults when invoked
  without arguments — per §3.3.
* Per-method ``with_raw_response`` variants — per §5.4.
* A typed :class:`~.envelope.Envelope` carrying ``request_id``,
  ``idempotency_key``, ``livemode``, and ``retry_attempts`` — per §4.6.

License and Session factories accept their credentials but, in this
phase, route requests through the bearer-token transport surface. Phase
3 will replace the inner auth strategy without changing this class.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .core.debug import DebugLogger
from .core.env import EnvReader, IsaConfigError, default_env, require_env
from .core.envelope import Envelope, RawResponse, extract_envelope_fields
from .core.transport import Transport
from .zyins.applicant import Applicant  # re-export convenience
from .zyins.client import DEFAULT_BASE_URL, DEFAULT_TIMEOUT_SECONDS, ZyInsClient
from .zyins.coverage import Coverage  # re-export convenience
from .zyins.prequalify import PrequalifyInput, PrequalifyResult, parse_prequalify_response
from .zyins.quote import QuoteInput, QuoteResult, parse_quote_response

__all__ = [
    "Applicant",
    "Coverage",
    "Envelope",
    "Isa",
    "IsaConfigError",
    "PrequalifyInput",
    "QuoteInput",
    "RawResponse",
]


class Isa:
    """Top-level client with factory constructors.

    Prefer one of :meth:`with_bearer`, :meth:`with_license`, or
    :meth:`with_session` over direct construction; those carry the
    env-var defaults documented in SDK_DESIGN.md §3.3.
    """

    # Carried by the License / Session factories for the Phase 3 auth
    # exchange; ``None`` on the Bearer path.
    _license_keycode: str | None
    _license_email: str | None
    _session_id: str | None
    _session_secret: str | None

    def __init__(
        self,
        *,
        client: ZyInsClient,
        debug: DebugLogger | None = None,
    ) -> None:
        self._client = client
        self._debug = debug or DebugLogger()
        # Plumb the debug logger into the client so wire-level traces are
        # captured at the actual request boundary.
        self._client._debug = self._debug
        self._license_keycode = None
        self._license_email = None
        self._session_id = None
        self._session_secret = None
        self.zyins = ZyinsNamespace(self)
        # rapidsign / proxy / webhooks are scaffolded sub-namespaces wired
        # in subsequent phases. They are present in the public surface today
        # so consumer code can be written against the unified Isa shape; the
        # methods raise NotImplementedError until those products land.
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

        Reads :envvar:`ISA_TOKEN` when ``token`` is omitted. Missing both
        raises :class:`IsaConfigError`.
        """
        reader = env or default_env()
        resolved = (
            token
            if token is not None
            else require_env(reader, "ISA_TOKEN", factory_name="Isa.with_bearer")
        )
        client = ZyInsClient(
            resolved,
            base_url=base_url,
            timeout=timeout,
            transport=transport,
        )
        return cls(client=client, debug=DebugLogger(env=reader))

    @classmethod
    def with_license(
        cls,
        *,
        keycode: str | None = None,
        email: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        transport: Transport | None = None,
        env: EnvReader | None = None,
    ) -> Isa:
        """Construct an :class:`Isa` from a license keycode + email.

        Reads :envvar:`ISA_LICENSE_KEYCODE` and :envvar:`ISA_LICENSE_EMAIL`
        when arguments are omitted. Missing either raises
        :class:`IsaConfigError` naming both.
        """
        reader = env or default_env()
        resolved_keycode = (
            keycode
            if keycode is not None
            else require_env(
                reader, "ISA_LICENSE_KEYCODE", factory_name="Isa.with_license"
            )
        )
        resolved_email = (
            email
            if email is not None
            else require_env(
                reader, "ISA_LICENSE_EMAIL", factory_name="Isa.with_license"
            )
        )
        # Phase 1 stub: license credentials carried on the resulting Isa
        # instance for the auth-exchange Phase 3 will add. The runtime
        # transport stays bearer-shaped until that exchange lands.
        token = _license_bootstrap_token(resolved_keycode, resolved_email)
        client = ZyInsClient(
            token,
            base_url=base_url,
            timeout=timeout,
            transport=transport,
        )
        instance = cls(client=client, debug=DebugLogger(env=reader))
        instance._license_keycode = resolved_keycode
        instance._license_email = resolved_email
        return instance

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
        """Construct an :class:`Isa` from a session id + signing secret.

        Reads :envvar:`ISA_SESSION_ID` and :envvar:`ISA_SESSION_SECRET`
        when arguments are omitted.
        """
        reader = env or default_env()
        resolved_id = (
            session_id
            if session_id is not None
            else require_env(reader, "ISA_SESSION_ID", factory_name="Isa.with_session")
        )
        resolved_secret = (
            session_secret
            if session_secret is not None
            else require_env(
                reader, "ISA_SESSION_SECRET", factory_name="Isa.with_session"
            )
        )
        token = _session_bootstrap_token(resolved_id, resolved_secret)
        client = ZyInsClient(
            token,
            base_url=base_url,
            timeout=timeout,
            transport=transport,
        )
        instance = cls(client=client, debug=DebugLogger(env=reader))
        instance._session_id = resolved_id
        instance._session_secret = resolved_secret
        return instance

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> Isa:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()


def _license_bootstrap_token(keycode: str, email: str) -> str:
    """Return a placeholder ``isa_test_…`` token for the License factory.

    Phase 1 carries License credentials forward without yet performing the
    account-api exchange; the bearer client wants *some* token-shaped value
    for header construction. The placeholder is constructed so it can't be
    confused with a real platform credential (no real secret material) and
    only ever appears on the wire if the consumer pings the SDK before
    Phase 3 wires the exchange.
    """
    # Keep the format compatible with BearerAuth validation: 'isa_test_'
    # prefix + opaque suffix. We blend the keycode + email hash so the
    # placeholder is distinct per-account but never reversible.
    import hashlib

    digest = hashlib.sha256(f"{keycode}|{email}".encode()).hexdigest()[:20]
    return f"isa_test_license_{digest}"


def _session_bootstrap_token(session_id: str, session_secret: str) -> str:
    """Return a placeholder ``isa_test_…`` token for the Session factory."""
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
        self.prequalify = _Prequalify(self)
        self.quote = _Quote(self)


class _Prequalify:
    """Prequalify operation with both envelope-typed and raw-response calls."""

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
    """Dispatch a request through the inner client, returning envelope + raw.

    Centralizes the env-field extraction + RawResponse construction so
    every method's ``with_raw_response`` variant returns the same shape.
    """
    body = body_provider()
    raw_resp = ns._client._dispatch(
        method=method,
        path=path,
        body=body,
        idempotency_key=idempotency_key,
    )
    parsed = parse(raw_resp.body)
    # Pull the four envelope fields out of the JSON object so the typed
    # Envelope[T] never falls back to a generic dict.
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
