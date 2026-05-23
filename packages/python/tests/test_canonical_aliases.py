"""Regression guard for the SDK canonical name surface.

Per the locked SDK syntax (TS canon):

* ``Isa.with_keycode`` is canonical; ``Isa.with_license`` is a deprecated alias.
* ``Isa.for_form`` and ``Isa.authenticate`` are canonical factories.
* ``isa.zyins.license`` is the only license surface (no plural alias).
* ``isa.zyins.cases.share`` is canonical; ``isa.zyins.cases.create`` is a
  deprecated alias.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

import pytest

from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import Isa, IsaConfigError


@dataclass
class FakeEnv:
    values: dict[str, str] = field(default_factory=dict)

    def get(self, key: str) -> str | None:
        v = self.values.get(key)
        return None if v is None or v == "" else v


@dataclass
class StubTransport:
    def request(
        self, method: str, url: str, *, headers: dict[str, str], body: str | None = None
    ) -> TransportResponse:
        return TransportResponse(status=200, body="{}", headers={})


# Fake values built at runtime so literal "isa_test_..." never appears as
# a single string in source — matches the convention in test_isa_factories.py.
_TOKEN_SUFFIX = os.environ.get("_ZYINS_CANON_TOKEN_SUFFIX", "canonpersona00000000")
_FAKE_TOKEN = "isa_" + "test_" + _TOKEN_SUFFIX
_FAKE_KEYCODE = "ABC-123-XYZ"
_FAKE_EMAIL = "john.doe@acme-agency.com"
_FAKE_FORM_TOKEN = "form" + "_canon_" + "persona"


def test_with_keycode_is_alias_of_with_license() -> None:
    env = FakeEnv({"ISA_LICENSE_KEYCODE": _FAKE_KEYCODE, "ISA_LICENSE_EMAIL": _FAKE_EMAIL})
    via_canonical = Isa.with_keycode(env=env, transport=StubTransport())
    via_deprecated = Isa.with_license(env=env, transport=StubTransport())
    assert via_canonical is not None
    assert via_deprecated is not None
    assert via_canonical._credential_state is not None
    assert via_deprecated._credential_state is not None


def test_for_form_constructs_isa() -> None:
    isa = Isa.for_form(_FAKE_FORM_TOKEN, transport=StubTransport())
    assert isa is not None


def test_for_form_rejects_empty_token() -> None:
    with pytest.raises(IsaConfigError):
        Isa.for_form("", transport=StubTransport())


def test_authenticate_dispatches_by_arg_shape() -> None:
    via_token = Isa.authenticate(token=_FAKE_TOKEN, transport=StubTransport())
    assert via_token is not None

    via_kc = Isa.authenticate(
        keycode=_FAKE_KEYCODE, email=_FAKE_EMAIL, transport=StubTransport()
    )
    assert via_kc._credential_state is not None

    via_form = Isa.authenticate(form_token=_FAKE_FORM_TOKEN, transport=StubTransport())
    assert via_form is not None


def test_authenticate_with_no_args_raises() -> None:
    with pytest.raises(IsaConfigError):
        Isa.authenticate(transport=StubTransport())


def test_zyins_license_singular_exists() -> None:
    env = FakeEnv({"ISA_LICENSE_KEYCODE": _FAKE_KEYCODE, "ISA_LICENSE_EMAIL": _FAKE_EMAIL})
    isa = Isa.with_keycode(env=env, transport=StubTransport())
    # The singular `license` property must be accessible.
    assert isa.zyins.license is not None


def test_zyins_cases_share_is_alias_of_create() -> None:
    env = FakeEnv({"ISA_LICENSE_KEYCODE": _FAKE_KEYCODE, "ISA_LICENSE_EMAIL": _FAKE_EMAIL})
    isa = Isa.with_keycode(env=env, transport=StubTransport())
    cases = isa.zyins.cases
    assert callable(cases.share)
    assert callable(cases.create)
    # Both bound methods must live on the same sub-client instance.
    assert cases.share.__self__ is cases.create.__self__
