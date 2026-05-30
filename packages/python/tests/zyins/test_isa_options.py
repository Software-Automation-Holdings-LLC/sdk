"""Tests for the typed options-bag constructor (``Isa.create``) and the
auth-supplier / engine-selector primitives.

Mirrors ``packages/ts/tests/zyins/isaOptions.test.ts`` coverage.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field

import pytest

import sah_sdk.zyins as zyins
from sah_sdk import Isa
from sah_sdk.core.env import IsaConfigError
from sah_sdk.zyins.isa_options import (
    DEFAULT_TIMEOUT_SECONDS,
    PRODUCTION_PROXY_ORIGIN,
    PRODUCTION_REMOTE_ORIGIN,
    BearerAuth,
    BearerAuthSupplier,
    FormAuth,
    FormAuthSupplier,
    InMemoryEngine,
    InMemoryEngineSelector,
    IsaCreateOptions,
    LicenseAuth,
    LicenseAuthSupplier,
    LocalEngine,
    LocalEngineSelector,
    ProxyEngine,
    ProxyEngineSelector,
    RemoteEngine,
    RemoteEngineSelector,
    SessionAuth,
    SessionAuthSupplier,
    resolve_isa_options,
)

_FAKE_SESSION_ID = "sess_test_01HZK2N5GQR9T8X4B6FJW3Y1AS"
_FAKE_SESSION_SECRET = "fakevalue_xxxxxxxxxx"
_FAKE_UUID = "00000000-0000-4000-8000-000000000000"


@dataclass
class FakeEnv:
    values: dict[str, str] = field(default_factory=dict)

    def get(self, key: str) -> str | None:
        value = self.values.get(key)
        return value if value else None


class TestBearerAuthFactory:
    """Bearer supplier factory — the recommended path for explicit tokens
    and the env-var fallback path. Mirrors TS ``BearerAuth.fromToken``.
    """

    def test_from_token_with_explicit_value(self) -> None:
        supplier = BearerAuth.from_token("isa_test_abc123")
        assert isinstance(supplier, BearerAuthSupplier)
        assert supplier.kind == "bearer"
        assert supplier.token == "isa_test_abc123"

    def test_from_token_rejects_empty(self) -> None:
        with pytest.raises(ValueError, match="non-empty"):
            BearerAuth.from_token("")

    def test_from_env_carries_no_token(self) -> None:
        """``from_env`` defers token resolution to factory time so the
        env reader on the calling factory governs precedence.
        """
        supplier = BearerAuth.from_env()
        assert isinstance(supplier, BearerAuthSupplier)
        assert supplier.token is None


class TestLicenseAuthFactory:
    def test_from_keycode(self) -> None:
        supplier = LicenseAuth.from_keycode("ABC-123-XYZ", "agent@example.com")
        assert isinstance(supplier, LicenseAuthSupplier)
        assert supplier.keycode == "ABC-123-XYZ"
        assert supplier.email == "agent@example.com"

    def test_from_keycode_rejects_empty_keycode(self) -> None:
        with pytest.raises(ValueError, match="keycode"):
            LicenseAuth.from_keycode("", "agent@example.com")

    def test_from_keycode_rejects_empty_email(self) -> None:
        with pytest.raises(ValueError, match="email"):
            LicenseAuth.from_keycode("ABC-123-XYZ", "")

    def test_from_env_carries_no_credentials(self) -> None:
        supplier = LicenseAuth.from_env()
        assert isinstance(supplier, LicenseAuthSupplier)
        assert supplier.keycode is None
        assert supplier.email is None


class TestFormAuthFactory:
    def test_from_token(self) -> None:
        supplier = FormAuth.from_token("form_abc123")
        assert isinstance(supplier, FormAuthSupplier)
        assert supplier.form_token == "form_abc123"

    def test_rejects_empty(self) -> None:
        with pytest.raises(ValueError, match="form_token"):
            FormAuth.from_token("")


class TestSessionAuthFactory:
    def test_from_credentials(self) -> None:
        supplier = SessionAuth.from_credentials(
            _FAKE_SESSION_ID,
            _FAKE_SESSION_SECRET,
        )
        assert isinstance(supplier, SessionAuthSupplier)
        assert supplier.session_id == _FAKE_SESSION_ID
        assert supplier.session_secret == _FAKE_SESSION_SECRET

    def test_from_credentials_rejects_empty_session_id(self) -> None:
        with pytest.raises(ValueError, match="session_id"):
            SessionAuth.from_credentials("", _FAKE_SESSION_SECRET)

    def test_from_credentials_rejects_empty_session_secret(self) -> None:
        with pytest.raises(ValueError, match="session_secret"):
            SessionAuth.from_credentials(_FAKE_SESSION_ID, "")

    def test_from_env_carries_no_credentials(self) -> None:
        supplier = SessionAuth.from_env()
        assert isinstance(supplier, SessionAuthSupplier)
        assert supplier.session_id is None
        assert supplier.session_secret is None


class TestZyinsNamespaceExports:
    def test_auth_factories_are_exported_from_zyins_namespace(self) -> None:
        assert isinstance(zyins.BearerAuth.from_token("isa_test_abc"), BearerAuthSupplier)
        assert isinstance(
            zyins.LicenseAuth.from_keycode("ABC-123-XYZ", "agent@example.com"),
            LicenseAuthSupplier,
        )
        assert isinstance(
            zyins.SessionAuth.from_credentials(
                _FAKE_SESSION_ID,
                _FAKE_SESSION_SECRET,
            ),
            SessionAuthSupplier,
        )


class TestEngineSelectors:
    """Engine selectors map to base URLs in :func:`resolve_isa_options`.
    Each one is a tagged value; switching deployments stays a one-line
    change at the call site.
    """

    def test_remote_default_points_at_production(self) -> None:
        engine = RemoteEngine.default()
        assert isinstance(engine, RemoteEngineSelector)
        assert engine.base_url == PRODUCTION_REMOTE_ORIGIN

    def test_remote_at_explicit_url(self) -> None:
        engine = RemoteEngine.at("https://staging.example.com")
        assert isinstance(engine, RemoteEngineSelector)
        assert engine.base_url == "https://staging.example.com"

    def test_remote_at_rejects_empty(self) -> None:
        with pytest.raises(ValueError, match="base_url"):
            RemoteEngine.at("")

    def test_local_at(self) -> None:
        engine = LocalEngine.at("http://localhost:9090")
        assert isinstance(engine, LocalEngineSelector)
        assert engine.base_url == "http://localhost:9090"

    def test_local_at_rejects_empty(self) -> None:
        with pytest.raises(ValueError, match="base_url"):
            LocalEngine.at("")

    def test_proxy_default(self) -> None:
        engine = ProxyEngine.default()
        assert isinstance(engine, ProxyEngineSelector)
        assert engine.proxy_origin == PRODUCTION_PROXY_ORIGIN

    def test_proxy_at(self) -> None:
        engine = ProxyEngine.at("https://proxy.staging.example.com")
        assert isinstance(engine, ProxyEngineSelector)
        assert engine.proxy_origin == "https://proxy.staging.example.com"

    def test_proxy_at_rejects_empty(self) -> None:
        with pytest.raises(ValueError, match="proxy_origin"):
            ProxyEngine.at("")

    def test_in_memory_is_singleton_marker(self) -> None:
        assert isinstance(InMemoryEngine, InMemoryEngineSelector)


class TestResolveIsaOptions:
    """``resolve_isa_options`` is pure — given the same input it always
    returns the same defaulted view. Anchor every default in TS parity.
    """

    def test_defaults_when_only_auth_supplied(self) -> None:
        opts = IsaCreateOptions(auth=BearerAuth.from_token("isa_test_abc"))
        resolved = resolve_isa_options(opts)
        assert resolved.timeout_seconds == DEFAULT_TIMEOUT_SECONDS
        assert resolved.api_version == "v2"
        assert resolved.base_url == PRODUCTION_REMOTE_ORIGIN
        assert resolved.proxy_origin is None
        assert resolved.client_version is None
        assert resolved.transport is None
        assert isinstance(resolved.engine, RemoteEngineSelector)

    def test_explicit_v1_pin(self) -> None:
        opts = IsaCreateOptions(
            auth=BearerAuth.from_token("isa_test_abc"), api_version="v1"
        )
        assert resolve_isa_options(opts).api_version == "v1"

    def test_local_engine_sets_base_url(self) -> None:
        opts = IsaCreateOptions(
            auth=BearerAuth.from_token("isa_test_abc"),
            engine=LocalEngine.at("http://localhost:9090"),
        )
        assert resolve_isa_options(opts).base_url == "http://localhost:9090"

    def test_proxy_engine_carries_proxy_origin(self) -> None:
        opts = IsaCreateOptions(
            auth=BearerAuth.from_token("isa_test_abc"),
            engine=ProxyEngine.at("https://proxy.example.com"),
        )
        resolved = resolve_isa_options(opts)
        # Proxy mode targets the production origin for the underlying
        # ZyINS request; proxy_origin lives on the resolved options for
        # the proxy namespace to consume.
        assert resolved.base_url == PRODUCTION_REMOTE_ORIGIN
        assert resolved.proxy_origin == "https://proxy.example.com"

    def test_explicit_timeout(self) -> None:
        opts = IsaCreateOptions(
            auth=BearerAuth.from_token("isa_test_abc"), timeout=5.0
        )
        assert resolve_isa_options(opts).timeout_seconds == 5.0


class TestIsaCreate:
    """``Isa.create`` is the public entry point. It dispatches by auth
    supplier kind to the matching legacy factory.
    """

    def test_with_options_object(self) -> None:
        opts = IsaCreateOptions(
            auth=BearerAuth.from_token("isa_test_abc123"),
            engine=RemoteEngine.default(),
            api_version="v2",
        )
        isa = Isa.create(opts)
        assert isa is not None

    def test_with_keyword_arguments(self) -> None:
        isa = Isa.create(
            auth=BearerAuth.from_token("isa_test_xyz"),
            engine=RemoteEngine.default(),
            api_version="v1",
        )
        assert isa is not None

    def test_rejects_both_positional_and_keyword(self) -> None:
        opts = IsaCreateOptions(auth=BearerAuth.from_token("isa_test_abc"))
        with pytest.raises(IsaConfigError, match="not both"):
            Isa.create(opts, auth=BearerAuth.from_token("isa_test_other"))

    def test_rejects_ignored_keyword_options_with_options_object(self) -> None:
        opts = IsaCreateOptions(auth=BearerAuth.from_token("isa_test_abc"))
        with pytest.raises(IsaConfigError, match="timeout"):
            Isa.create(opts, timeout=5.0)

    def test_rejects_missing_auth(self) -> None:
        with pytest.raises(IsaConfigError, match="auth"):
            Isa.create()

    def test_dispatches_to_with_keycode_for_license_supplier(self) -> None:
        isa = Isa.create(
            auth=LicenseAuth.from_keycode("ABC-123-XYZ", "agent@example.com")
        )
        assert isa is not None

    def test_dispatches_to_for_form_for_form_supplier(self) -> None:
        isa = Isa.create(auth=FormAuth.from_token("form_abc123"))
        assert isa is not None

    def test_default_api_version_is_v2(self) -> None:
        """The whole point of this PR — v2 is the default. Pin it."""
        opts = IsaCreateOptions(auth=BearerAuth.from_token("isa_test_abc"))
        assert resolve_isa_options(opts).api_version == "v2"

    def test_session_supplier_defaults_to_env_fallback(self) -> None:
        env = FakeEnv(
            {
                "ISA_SESSION_ID": _FAKE_SESSION_ID,
                "ISA_SESSION_SECRET": _FAKE_SESSION_SECRET,
            }
        )
        isa = Isa.create(auth=SessionAuthSupplier(), env=env)

        assert isa._session_id == _FAKE_SESSION_ID
        assert isa._session_secret == _FAKE_SESSION_SECRET

    def test_proxy_engine_sets_proxy_call_origin(self) -> None:
        captured: dict[str, str] = {}

        def transport(
            method: str,
            url: str,
            headers: Mapping[str, str],
            body: bytes,
        ) -> tuple[int, bytes, dict[str, str]]:
            captured["url"] = url
            return 200, b'{"ok":true}', {}

        isa = Isa.create(
            auth=SessionAuthSupplier(
                session_id=_FAKE_SESSION_ID,
                session_secret=_FAKE_SESSION_SECRET,
            ),
            engine=ProxyEngine.at("https://proxy.example.com"),
        )

        result = isa.proxy.call(
            integration_id=1,
            transport=transport,
            uuid_factory=lambda: _FAKE_UUID,
        )

        assert result == {"ok": True}
        assert captured["url"] == "https://proxy.example.com/v1/call"
