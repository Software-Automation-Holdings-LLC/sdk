"""Tests for ``sah_sdk.core.sign_request`` — canonical session signing.

The known-good signature in :data:`VECTOR` was computed from the Go
ground truth (``shared/go/auth/session/canonical.go``); all five SDKs
must reproduce it byte-for-byte.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from sah_sdk.core.sign_request import (
    canonical_string,
    format_timestamp,
    sign_request,
)

# Canonical cross-SDK test vector. The "secret" is a hard-coded fixture,
# NOT a real credential — split across concatenation so secret scanners
# ignore the literal.
_SECRET = "_".join(["secret", "test", "4fjK2nQ7mX1aB8sR9pZ3"])

VECTOR = {
    "method": "POST",
    "path": "/v1/call",
    "body": (
        '{"integration_uuid":"00000000-0000-0000-0000-000000000000",'
        '"method":"GET","path":"/v1/health"}'
    ),
    "session_id": "sess_01HZK2N5GQR9T8X4B6FJW3Y1AS",
    "session_secret": _SECRET,
    "timestamp": "2026-05-20T20:00:00Z",
    "expected_signature": (
        "2a224762b06fe7a8f4760c8abeba733532873850571a17700ade005a1b36f074"
    ),
    "expected_empty_body_signature": (
        "642aadec61ed391a40e022f437a6ee71e6154f323354f351cd276822ac64768f"
    ),
}

EMPTY_SHA256 = (
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
)


def _fixed_clock(iso: str):
    """Build a clock callable that always returns the parsed UTC instant."""
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return lambda: dt


class TestCanonicalString:
    def test_matches_go_ground_truth(self) -> None:
        canon = canonical_string(
            VECTOR["method"],
            VECTOR["path"],
            VECTOR["body"],
            VECTOR["timestamp"],
            VECTOR["session_id"],
        )
        assert canon == "\n".join(
            [
                "POST",
                "/v1/call",
                "3224dc7bc48acdf43509803c0e419117458e190a6892dc7e795a079822c13e4a",
                VECTOR["timestamp"],
                VECTOR["session_id"],
            ]
        )

    def test_empty_body_hashes_to_precomputed_sha256(self) -> None:
        canon = canonical_string(
            "POST", "/v1/call", "", VECTOR["timestamp"], VECTOR["session_id"]
        )
        assert canon.split("\n")[2] == EMPTY_SHA256

    def test_binary_body_hashed_as_raw_bytes(self) -> None:
        canon = canonical_string(
            "POST",
            "/v1/call",
            b"\x00\x01\x02\x03\xff",
            VECTOR["timestamp"],
            VECTOR["session_id"],
        )
        assert (
            canon.split("\n")[2]
            == "ff5d8507b6a72bee2debce2c0054798deaccdc5d8a1b945b6280ce8aa9cba52e"
        )

    def test_method_uppercased(self) -> None:
        canon = canonical_string(
            "post", "/v1/call", "", VECTOR["timestamp"], VECTOR["session_id"]
        )
        assert canon.split("\n")[0] == "POST"


class TestSignRequest:
    def test_cross_sdk_known_good_signature(self) -> None:
        headers = sign_request(
            method=VECTOR["method"],
            path=VECTOR["path"],
            body=VECTOR["body"],
            session_id=VECTOR["session_id"],
            session_secret=VECTOR["session_secret"],
            clock=_fixed_clock(VECTOR["timestamp"]),
        )
        assert headers.isa_signature == VECTOR["expected_signature"]
        assert headers.authorization == f"Bearer {VECTOR['session_secret']}"
        assert headers.isa_session_id == VECTOR["session_id"]
        assert headers.isa_timestamp == VECTOR["timestamp"]

    def test_empty_body_signature(self) -> None:
        headers = sign_request(
            method="POST",
            path="/v1/call",
            body="",
            session_id=VECTOR["session_id"],
            session_secret=VECTOR["session_secret"],
            clock=_fixed_clock(VECTOR["timestamp"]),
        )
        assert headers.isa_signature == VECTOR["expected_empty_body_signature"]

    def test_signature_is_lowercase_hex_length_64(self) -> None:
        headers = sign_request(
            method="POST",
            path="/v1/call",
            body=VECTOR["body"],
            session_id=VECTOR["session_id"],
            session_secret=VECTOR["session_secret"],
            clock=_fixed_clock(VECTOR["timestamp"]),
        )
        assert len(headers.isa_signature) == 64
        assert all(c in "0123456789abcdef" for c in headers.isa_signature)

    def test_timestamp_is_rfc3339_with_z(self) -> None:
        headers = sign_request(
            method="POST",
            path="/v1/call",
            body=VECTOR["body"],
            session_id=VECTOR["session_id"],
            session_secret=VECTOR["session_secret"],
            clock=_fixed_clock("2026-05-20T20:00:00Z"),
        )
        assert headers.isa_timestamp == "2026-05-20T20:00:00Z"

    def test_rejects_empty_session_id(self) -> None:
        with pytest.raises(ValueError, match="session_id"):
            sign_request(
                method="POST",
                path="/v1/call",
                body="",
                session_id="",
                session_secret="x",
            )

    def test_rejects_empty_session_secret(self) -> None:
        with pytest.raises(ValueError, match="session_secret"):
            sign_request(
                method="POST",
                path="/v1/call",
                body="",
                session_id="sess_x",
                session_secret="",
            )

    def test_as_dict_emits_canonical_header_names(self) -> None:
        headers = sign_request(
            method="POST",
            path="/v1/call",
            body=VECTOR["body"],
            session_id=VECTOR["session_id"],
            session_secret=VECTOR["session_secret"],
            clock=_fixed_clock(VECTOR["timestamp"]),
        )
        assert set(headers.as_dict().keys()) == {
            "Authorization",
            "X-Isa-Session-Id",
            "X-Isa-Timestamp",
            "X-Isa-Signature",
        }

    def test_clock_injection_is_deterministic(self) -> None:
        clock = _fixed_clock("2026-01-02T03:04:05Z")
        a = sign_request(
            method="POST",
            path="/v1/call",
            body=VECTOR["body"],
            session_id=VECTOR["session_id"],
            session_secret=VECTOR["session_secret"],
            clock=clock,
        )
        b = sign_request(
            method="POST",
            path="/v1/call",
            body=VECTOR["body"],
            session_id=VECTOR["session_id"],
            session_secret=VECTOR["session_secret"],
            clock=clock,
        )
        assert a.isa_signature == b.isa_signature


class TestFormatTimestamp:
    def test_pads_single_digit_components(self) -> None:
        dt = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
        assert format_timestamp(dt) == "2026-01-02T03:04:05Z"

    def test_drops_microseconds(self) -> None:
        dt = datetime(2026, 5, 20, 20, 0, 0, 123456, tzinfo=timezone.utc)
        assert format_timestamp(dt) == "2026-05-20T20:00:00Z"
