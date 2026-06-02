"""Cross-SDK V3 decoded-response equivalence — Python SDK in-process gate.

Loads the shared fixture
(conformance/scenarios/.fixtures/prequalify-v3-fex-immediate.response.json)
and the shared expected triples (…expected.json), decodes the fixture through
``parse_prequalify_v3_envelope`` (the same function ``prequalify_v3`` calls
after receiving the HTTP body), and asserts the decoded values match the
shared expected triples.

Because this test imports from the in-tree source package there is no need
for a public parse shim — ``parse_prequalify_v3_envelope`` is a module-level
function that the SDK already exposes for internal wiring.

Sibling tests in packages/go, packages/csharp, and packages/php assert against
the same expected.json so any decode divergence between languages produces a
failing test in the diverging language's own CI job.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from sah_sdk.zyins.prequalify_v3 import (
    offer_premium,
    parse_prequalify_v3_envelope,
)

# ---------------------------------------------------------------------------
# Fixture resolution
# ---------------------------------------------------------------------------

_FIXTURES_DIR = (
    Path(__file__).resolve().parents[4]  # repo root
    / "conformance"
    / "scenarios"
    / ".fixtures"
)

_FIXTURE_PATH = _FIXTURES_DIR / "prequalify-v3-fex-immediate.response.json"
_EXPECTED_PATH = _FIXTURES_DIR / "prequalify-v3-fex-immediate.expected.json"


def _load_expected() -> list[dict]:  # type: ignore[type-arg]
    with _EXPECTED_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data["plans"]


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------


def test_cross_sdk_equivalence_prequalify_v3() -> None:
    """Decoded V3 triples match the shared expected.json for all plans."""
    if not _FIXTURE_PATH.exists():
        pytest.fail(f"fixture not found at {_FIXTURE_PATH} — missing file is a gate failure, not a skip")
    if not _EXPECTED_PATH.exists():
        pytest.fail(f"expected triples not found at {_EXPECTED_PATH} — missing file is a gate failure, not a skip")

    fixture_body = _FIXTURE_PATH.read_text(encoding="utf-8")
    expected_plans = _load_expected()

    result = parse_prequalify_v3_envelope(fixture_body)

    assert len(result.plans) >= len(expected_plans), (
        f"decoded {len(result.plans)} plans, want at least {len(expected_plans)}"
    )

    for i, want in enumerate(expected_plans):
        offer = result.plans[i]

        assert offer.id == want["id"], (
            f"plan[{i}].id = {offer.id!r}, want {want['id']!r}"
        )

        primary = offer_premium(offer)
        assert primary is not None, (
            f"plan[{i}] offer_premium = None, want {want['premium_cents']} cents"
        )
        assert primary.amount.cents == want["premium_cents"], (
            f"plan[{i}].premium_cents = {primary.amount.cents}, want {want['premium_cents']}"
        )

        primary_row = next((r for r in offer.pricing if r.primary), None)
        assert primary_row is not None, f"plan[{i}] has no primary pricing row"
        got_category = (
            primary_row.eligibility.category.value
            if primary_row.eligibility.category is not None
            else None
        )
        assert got_category == want["eligibility_category"], (
            f"plan[{i}].eligibility_category = {got_category!r}, "
            f"want {want['eligibility_category']!r}"
        )
