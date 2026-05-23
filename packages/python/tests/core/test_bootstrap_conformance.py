"""Bytewise conformance gate for the embedded HMAC bootstrap signature.

The fixture at ``tests/conformance/fixtures/auth-vector.json`` (repo
root) is the binding contract. This Python SDK MUST reproduce the
identical hex against the same inputs as the TypeScript, Go, PHP, and
C# SDKs.

If this test fails after an intentional change to the auth wire format,
regenerate the fixture, update ``api/guides/authentication-advanced.md``,
and bump every SDK's major version — the change is breaking.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from sah_sdk.core.bootstrap import BootstrapInput, build_bootstrap_signature

# packages/python/tests/core → repo root is four levels up.
_FIXTURE_PATH = (
    Path(__file__).resolve().parents[4]
    / "tests"
    / "conformance"
    / "fixtures"
    / "auth-vector.json"
)


@pytest.fixture(scope="module")
def auth_vector() -> dict:
    with _FIXTURE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _input_from_fixture(fx: dict) -> BootstrapInput:
    inputs = fx["inputs"]
    return BootstrapInput(
        keycode=inputs["keycode"],
        email=inputs["email"],
        license_key=inputs["licenseKey"],
        device_id=inputs["deviceId"],
        method=inputs["method"],
        path=inputs["path"],
        timestamp=int(inputs["timestamp"]),
    )


def test_serialized_body_matches_fixture(auth_vector: dict) -> None:
    sig = build_bootstrap_signature(_input_from_fixture(auth_vector))
    assert sig.serialized_body == auth_vector["serializedBody"]


def test_canonical_matches_fixture(auth_vector: dict) -> None:
    sig = build_bootstrap_signature(_input_from_fixture(auth_vector))
    assert sig.canonical == auth_vector["canonical"]


def test_hex_matches_fixture_bytewise(auth_vector: dict) -> None:
    sig = build_bootstrap_signature(_input_from_fixture(auth_vector))
    assert sig.hex == auth_vector["expected"]["hex"]


def test_header_matches_fixture(auth_vector: dict) -> None:
    sig = build_bootstrap_signature(_input_from_fixture(auth_vector))
    assert sig.header == auth_vector["expected"]["header"]


def test_device_id_only_in_body(auth_vector: dict) -> None:
    """Anti-regression: an earlier draft included deviceId in the canonical
    path. Locked spec sends it as X-Device-ID header only; the only
    canonical appearance is inside the body JSON for POST /v1/sessions.
    """
    canonical: str = auth_vector["canonical"]
    serialized_body: str = auth_vector["serializedBody"]
    device_id: str = auth_vector["inputs"]["deviceId"]
    before = canonical[: canonical.index(serialized_body)]
    assert device_id not in before


@pytest.mark.parametrize(
    "field",
    ["keycode", "email", "license_key", "device_id", "method", "path"],
)
@pytest.mark.parametrize("missing_value", ["", "   ", " padded "])
def test_missing_string_fields_raise(
    auth_vector: dict, field: str, missing_value: str
) -> None:
    inp = _input_from_fixture(auth_vector)
    kwargs = {
        "keycode": inp.keycode,
        "email": inp.email,
        "license_key": inp.license_key,
        "device_id": inp.device_id,
        "method": inp.method,
        "path": inp.path,
        "timestamp": inp.timestamp,
    }
    kwargs[field] = missing_value
    with pytest.raises(ValueError):
        build_bootstrap_signature(BootstrapInput(**kwargs))


def test_missing_timestamp_raises(auth_vector: dict) -> None:
    inp = _input_from_fixture(auth_vector)
    with pytest.raises(ValueError):
        build_bootstrap_signature(
            BootstrapInput(
                keycode=inp.keycode,
                email=inp.email,
                license_key=inp.license_key,
                device_id=inp.device_id,
                method=inp.method,
                path=inp.path,
                timestamp=0,
            )
        )


def test_negative_timestamp_raises(auth_vector: dict) -> None:
    inp = _input_from_fixture(auth_vector)
    with pytest.raises(ValueError):
        build_bootstrap_signature(
            BootstrapInput(
                keycode=inp.keycode,
                email=inp.email,
                license_key=inp.license_key,
                device_id=inp.device_id,
                method=inp.method,
                path=inp.path,
                timestamp=-1,
            )
        )
