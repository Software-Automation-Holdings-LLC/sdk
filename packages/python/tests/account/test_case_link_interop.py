"""Cross-SDK case-link + case-crypto interop — Python SDK in-process gate.

Reads the shared fixture conformance/scenarios/.fixtures/case-link-share.fixture.json
(produced from the canonical TypeScript WebCrypto stack) and proves:

  - Python assembles the byte-identical single-segment link from (base, code, key).
  - Python parses both single-segment and legacy /c/ link forms to the same
    (code, key_fragment) every other SDK produces.
  - A case encrypted by TypeScript decrypts in Python for both the 128-bit and
    256-bit envelopes (the "encrypted-in-X decrypts-in-all" matrix row).
  - Python round-trips its own encrypt -> decrypt back to the original payload.

Sibling tests in packages/go, packages/php, and packages/csharp read the same
fixture, so any divergence fails the diverging language's own CI job.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from sah_sdk.account.case_crypto import (
    CaseDecryptError,
    CaseEnvelope,
    decrypt_case,
    encrypt_case,
)
from sah_sdk.account.case_link import assemble_link, parse_link

_FIXTURE = (
    Path(__file__).resolve().parents[4]
    / "conformance"
    / "scenarios"
    / ".fixtures"
    / "case-link-share.fixture.json"
)


def _load() -> dict[str, Any]:
    return json.loads(_FIXTURE.read_text(encoding="utf-8"))


def _envelope(raw: dict[str, str]) -> CaseEnvelope:
    return CaseEnvelope(
        ciphertext=raw["ciphertext"], iv=raw["iv"], tag=raw["tag"]
    )


def test_assemble_link_single_segment_matches_shared_fixture() -> None:
    fx = _load()
    got = assemble_link(fx["viewer_base_url"], fx["code"], fx["key_fragment_128"])
    assert got == fx["expected_link_single_segment"]


def test_parse_link_both_forms_match_shared_fixture() -> None:
    fx = _load()
    for case in fx["parse_cases"]:
        parsed = parse_link(case["link"])
        assert parsed.code == case["expected_code"]
        assert parsed.key_fragment == case["expected_key_fragment"]


def test_parse_link_rejects_missing_or_empty_fragment() -> None:
    with pytest.raises(ValueError):
        parse_link("https://link.isaapi.com/abc123")
    with pytest.raises(ValueError):
        parse_link("https://link.isaapi.com/abc123#k=")
    with pytest.raises(ValueError):
        parse_link("")


def test_decrypt_typescript_envelope_128() -> None:
    fx = _load()
    payload = decrypt_case(
        fx["product"], _envelope(fx["envelope_128"]), fx["key_fragment_128"]
    )
    assert payload == fx["payload"]


def test_decrypt_typescript_envelope_256() -> None:
    fx = _load()
    payload = decrypt_case(
        fx["product"], _envelope(fx["envelope_256"]), fx["key_fragment_256"]
    )
    assert payload == fx["payload"]


def test_decrypt_wrong_product_fails_authentication() -> None:
    fx = _load()
    with pytest.raises(CaseDecryptError):
        decrypt_case("eapp", _envelope(fx["envelope_128"]), fx["key_fragment_128"])


def test_encrypt_round_trip() -> None:
    fx = _load()
    encrypted = encrypt_case(fx["product"], fx["payload"])
    payload = decrypt_case(
        fx["product"], encrypted.envelope, encrypted.key_fragment
    )
    assert payload == fx["payload"]
