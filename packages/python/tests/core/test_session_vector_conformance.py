"""Bytewise conformance gate for the steady-state session-HMAC signature.

The fixture at ``tests/conformance/fixtures/session-vector.json`` (repo
root) is the binding contract. This Python SDK MUST reproduce the
identical canonical string, signature, and Authorization header as the
TypeScript, Go, PHP, and C# SDKs.

This is exactly the drift that shipped in all five SDKs: hard-coding
``Bearer <secret>`` instead of ``Session <secret>``. This gate turns
that class of bug into a CI failure.

If this test fails after an intentional change to the session wire
format, regenerate the fixture (see its ``$comment`` for the
regeneration recipe), update
``shared/go/auth/session/canonical.go``'s doc comment if the shape
changed, and bump every SDK's major version — the change is breaking.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pytest

from sah_sdk.core.sign_request import canonical_string, sign_request

# packages/python/tests/core → repo root is four levels up.
_FIXTURE_PATH = (
    Path(__file__).resolve().parents[4]
    / "tests"
    / "conformance"
    / "fixtures"
    / "session-vector.json"
)


@pytest.fixture(scope="module")
def session_vector() -> dict:
    with _FIXTURE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _fixed_clock(timestamp: str):
    parsed = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%SZ")

    def clock() -> datetime:
        return parsed.replace(tzinfo=None)

    return clock


def test_canonical_string_matches_fixture(session_vector: dict) -> None:
    inputs = session_vector["inputs"]
    canonical = canonical_string(
        inputs["method"],
        inputs["path"],
        inputs["body"],
        inputs["timestamp"],
        inputs["sessionId"],
    )
    assert canonical == session_vector["canonical"]


def test_signature_matches_fixture_bytewise(session_vector: dict) -> None:
    inputs = session_vector["inputs"]
    headers = sign_request(
        method=inputs["method"],
        path=inputs["path"],
        body=inputs["body"],
        session_id=inputs["sessionId"],
        session_secret=inputs["sessionSecret"],
        clock=_fixed_clock(inputs["timestamp"]),
    )
    assert headers.isa_signature == session_vector["expected"]["signature"]


def test_authorization_header_uses_session_scheme_not_bearer(
    session_vector: dict,
) -> None:
    inputs = session_vector["inputs"]
    headers = sign_request(
        method=inputs["method"],
        path=inputs["path"],
        body=inputs["body"],
        session_id=inputs["sessionId"],
        session_secret=inputs["sessionSecret"],
        clock=_fixed_clock(inputs["timestamp"]),
    )
    assert headers.authorization == session_vector["expected"]["header"]
    assert not headers.authorization.startswith("Bearer ")
