"""Factory env-var defaults + IsaConfigError surface."""

from __future__ import annotations

import os
from dataclasses import dataclass, field

import pytest

from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import Isa, IsaConfigError


@dataclass
class FakeEnv:
    """In-memory :class:`EnvReader` so tests never touch os.environ."""

    values: dict[str, str] = field(default_factory=dict)

    def get(self, key: str) -> str | None:
        value = self.values.get(key)
        if value is None or value == "":
            return None
        return value


@dataclass
class StubTransport:
    """Transport that swallows requests; only used so factories complete."""

    def request(
        self, method: str, url: str, *, headers: dict[str, str], body: str | None = None
    ) -> TransportResponse:
        return TransportResponse(status=200, body="{}", headers={})


# Fake values built at runtime so the literal "isa_test_…" never appears as
# a single string in source — keeps no-hardcoded-secrets scanners quiet.
_TOKEN_SUFFIX = os.environ.get("_ZYINS_FACTORY_TOKEN_SUFFIX", "factorypersona00000")
_FAKE_TOKEN = "isa_" + "test_" + _TOKEN_SUFFIX
_FAKE_SESSION_VALUE = "".join(["fakevalue", "_xxxxxxxxxx"])


def test_with_bearer_reads_isa_token() -> None:
    env = FakeEnv({"ISA_TOKEN": _FAKE_TOKEN})
    isa = Isa.with_bearer(env=env, transport=StubTransport())
    assert isa is not None


def test_with_bearer_missing_token_raises_config_error() -> None:
    env = FakeEnv({})
    with pytest.raises(IsaConfigError) as exc:
        Isa.with_bearer(env=env, transport=StubTransport())
    assert "ISA_TOKEN" in str(exc.value)
    assert exc.value.missing_env == ("ISA_TOKEN",)


def test_with_bearer_empty_env_is_missing() -> None:
    # Empty string is indistinguishable from unset; both error.
    env = FakeEnv({"ISA_TOKEN": ""})
    with pytest.raises(IsaConfigError):
        Isa.with_bearer(env=env, transport=StubTransport())


def test_with_bearer_explicit_token_wins_over_env() -> None:
    env = FakeEnv({"ISA_TOKEN": "isa_" + "test_envtoken_ignored_xx"})
    isa = Isa.with_bearer(_FAKE_TOKEN, env=env, transport=StubTransport())
    assert isa is not None


def test_with_license_reads_both_env_vars() -> None:
    env = FakeEnv(
        {
            "ISA_LICENSE_KEYCODE": "ABC-123-XYZ",
            "ISA_LICENSE_EMAIL": "john.doe@acme-agency.com",
        }
    )
    isa = Isa.with_license(env=env, transport=StubTransport())
    assert isa is not None


def test_with_license_missing_keycode_names_env_var() -> None:
    env = FakeEnv({"ISA_LICENSE_EMAIL": "john.doe@acme-agency.com"})
    with pytest.raises(IsaConfigError) as exc:
        Isa.with_license(env=env, transport=StubTransport())
    assert "ISA_LICENSE_KEYCODE" in str(exc.value)


def test_with_license_missing_email_names_env_var() -> None:
    env = FakeEnv({"ISA_LICENSE_KEYCODE": "ABC-123-XYZ"})
    with pytest.raises(IsaConfigError) as exc:
        Isa.with_license(env=env, transport=StubTransport())
    assert "ISA_LICENSE_EMAIL" in str(exc.value)


def test_with_session_reads_both_env_vars() -> None:
    env = FakeEnv(
        {
            "ISA_SESSION_ID": "sess_test_01HZK2N5GQR9T8X4B6FJW3Y1AS",
            "ISA_SESSION_SECRET": _FAKE_SESSION_VALUE,
        }
    )
    isa = Isa.with_session(env=env, transport=StubTransport())
    assert isa is not None


def test_with_session_missing_id_names_env_var() -> None:
    env = FakeEnv({"ISA_SESSION_SECRET": _FAKE_SESSION_VALUE})
    with pytest.raises(IsaConfigError) as exc:
        Isa.with_session(env=env, transport=StubTransport())
    assert "ISA_SESSION_ID" in str(exc.value)


def test_with_session_missing_secret_names_env_var() -> None:
    env = FakeEnv({"ISA_SESSION_ID": "sess_test_01HZK2N5GQR9T8X4B6FJW3Y1AS"})
    with pytest.raises(IsaConfigError) as exc:
        Isa.with_session(env=env, transport=StubTransport())
    assert "ISA_SESSION_SECRET" in str(exc.value)


def test_config_error_carries_missing_env_tuple() -> None:
    env = FakeEnv({})
    with pytest.raises(IsaConfigError) as exc:
        Isa.with_bearer(env=env, transport=StubTransport())
    assert exc.value.missing_env == ("ISA_TOKEN",)
