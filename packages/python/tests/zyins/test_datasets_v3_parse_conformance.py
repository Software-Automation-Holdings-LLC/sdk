"""Cross-language parse-parity conformance for v3 datasets product slices.

Loads ``shared/schemas/sdk/testdata/datasets_v3_parse_conformance.json`` —
the same corpus the Go / TypeScript / PHP / C# SDKs consume — and asserts the
Python parser produces the expected canonical output for every scenario:
explicit-empty vs omitted slices both collapse to a present empty collection,
the non-empty-id keep predicate with a blank-name default, the non-array-family
skip, and the int64 epoch bound. Drift between languages surfaces as a failing
assertion here AND in the sibling test of every other SDK.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import pytest

from sah_sdk.zyins.datasets_v3 import parse_datasets_v3_envelope

_CORPUS_PATH = (
    Path(__file__).resolve().parents[4]
    / "shared"
    / "schemas"
    / "sdk"
    / "testdata"
    / "datasets_v3_parse_conformance.json"
)


def _load_scenarios() -> Sequence[Mapping[str, Any]]:
    with _CORPUS_PATH.open(encoding="utf-8") as fh:
        corpus = json.load(fh)
    scenarios = corpus["scenarios"]
    assert scenarios, "conformance corpus has no scenarios"
    return scenarios


def _scenario_id(scenario: Mapping[str, Any]) -> str:
    return str(scenario["name"])


@pytest.mark.parametrize("scenario", _load_scenarios(), ids=_scenario_id)
def test_datasets_v3_parse_conformance(scenario: Mapping[str, Any]) -> None:
    body = json.dumps(scenario["response_body"])
    expected = scenario["expected"]
    bundle = parse_datasets_v3_envelope(body)

    assert bundle.version == expected["version"]

    # products_by_family — present empty collection in every case; families are
    # ordered by the corpus but compared as a set of (family -> rows) pairs.
    got_families = {
        family: [(e.id, e.name) for e in rows]
        for family, rows in bundle.products_by_family.items()
    }
    want_families = {
        family: [(row["id"], row["name"]) for row in rows]
        for family, rows in expected["products_by_family"].items()
    }
    assert got_families == want_families

    # discontinued_products — slug -> int64 epoch.
    assert dict(bundle.discontinued_products) == {
        slug: int(epoch) for slug, epoch in expected["discontinued_products"].items()
    }

    # state_derivatives — order-preserving list of strings.
    assert list(bundle.state_derivatives) == list(expected["state_derivatives"])
