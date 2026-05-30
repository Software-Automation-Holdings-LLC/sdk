"""Cross-language conformance test for the v3 ``reference`` namespace.

Loads ``shared/schemas/sdk/testdata/reference_vectors.json`` — the
cross-language ground truth — and asserts the Python SDK matches every
``make_key`` parity vector and every ``match()`` scenario. The same
JSON drives the TS / Go / C# / PHP parity tests; drift between
languages must surface here.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from types import MappingProxyType
from typing import Any

import pytest

from sah_sdk.zyins import reference_v3
from sah_sdk.zyins.datasets_v3 import (
    DatasetBundleV3,
    DatasetCategory,
    DatasetEntry,
    FrequencyGraphs,
    ReferenceEntity,
)
from sah_sdk.zyins.reference_v3 import (
    ConceptKind,
    Sort,
    match_concept,
    match_condition,
    match_medication,
)

_VECTORS_PATH = (
    Path(__file__).resolve().parents[4]
    / "shared"
    / "schemas"
    / "sdk"
    / "testdata"
    / "reference_vectors.json"
)


def _load_vectors() -> Mapping[str, Any]:
    with _VECTORS_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


_VECTORS = _load_vectors()


def _bundle_from_fixture(fixture: Mapping[str, Any]) -> DatasetBundleV3:
    conditions = tuple(
        ReferenceEntity(id=e["id"], name=e["name"]) for e in fixture["conditions"]
    )
    medications = tuple(
        ReferenceEntity(id=e["id"], name=e["name"]) for e in fixture["medications"]
    )
    version = fixture["version"]
    datasets: dict[DatasetCategory, DatasetEntry | None] = {
        DatasetCategory.CONDITIONS: DatasetEntry(
            version=version, item_count=len(conditions), items=conditions
        ),
        DatasetCategory.MEDICATIONS: DatasetEntry(
            version=version, item_count=len(medications), items=medications
        ),
        DatasetCategory.PRODUCTS: None,
        DatasetCategory.CORRECTIONS: None,
        DatasetCategory.NICOTINE_OPTIONS: None,
    }
    return DatasetBundleV3(
        version=version,
        medications=medications,
        conditions=conditions,
        products=(),
        corrections=(),
        nicotine_options=(),
        medications_by_condition=MappingProxyType(
            {k: tuple(v) for k, v in fixture["medications_by_condition"].items()}
        ),
        frequency_graphs=FrequencyGraphs(
            use_map=MappingProxyType(
                {
                    cond_id: MappingProxyType(dict(row))
                    for cond_id, row in fixture["frequency_graphs"]["use_map"].items()
                }
            )
        ),
        datasets=MappingProxyType(datasets),
    )


@pytest.mark.parametrize(
    ("inp", "expected"),
    [(vec["input"], vec["expected"]) for vec in _VECTORS["make_key"]],
)
def test_make_key_parity(inp: str, expected: str) -> None:
    """Every ``make_key`` vector matches byte-identical to the TS / Go output."""
    assert reference_v3._internal.make_key(inp) == expected


_BUNDLE = _bundle_from_fixture(_VECTORS["bundle"])


def _resolve(matcher_name: str, text: str) -> reference_v3.Concept:
    if matcher_name == "medications":
        return match_medication(text, _BUNDLE)
    if matcher_name == "conditions":
        return match_condition(text, _BUNDLE)
    if matcher_name == "concepts":
        return match_concept(text, _BUNDLE)
    raise AssertionError(f"unknown matcher in vectors: {matcher_name!r}")


@pytest.mark.parametrize(
    "scenario", _VECTORS["matches"], ids=lambda s: s["name"]
)
def test_match_scenarios(scenario: Mapping[str, Any]) -> None:
    concept = _resolve(scenario["matcher"], scenario["input"])

    assert concept.kind.value == scenario["expected_kind"]
    assert concept.is_known is scenario["expected_known"]
    assert concept.id == scenario["expected_id"]
    assert concept.input_text == scenario["input"]

    if "input_text_preserved" in scenario:
        assert concept.input_text == scenario["input_text_preserved"]

    if "medications_most_common_first" in scenario:
        ids = [m.id or "" for m in concept.medications(Sort.MOST_COMMON_FIRST)]
        assert ids == scenario["medications_most_common_first"]
    if "medications_alphabetical" in scenario:
        ids = [m.id or "" for m in concept.medications(Sort.ALPHABETICAL)]
        assert ids == scenario["medications_alphabetical"]
    if "conditions_most_common_first" in scenario:
        ids = [c.id or "" for c in concept.conditions(Sort.MOST_COMMON_FIRST)]
        assert ids == scenario["conditions_most_common_first"]
    if scenario.get("conditions_any_known") is True:
        conds: Sequence[reference_v3.Concept] = concept.conditions(
            Sort.MOST_COMMON_FIRST
        )
        assert len(conds) > 0
        assert all(c.is_known for c in conds)


def test_unknown_text_returns_empty_accessors_not_an_error() -> None:
    concept = match_concept("unknown free text", _BUNDLE)
    assert concept.is_known is False
    assert concept.id is None
    assert concept.input_text == "unknown free text"
    assert concept.medications() == ()
    assert concept.conditions() == ()


def test_canonical_live_bug_hbp_meds_most_common_first() -> None:
    """``conditions.match("hbp").medications(MostCommonFirst)`` returns frequency-ordered."""
    concept = match_condition("hbp", _BUNDLE)
    assert concept.is_known is True
    assert concept.kind is ConceptKind.CONDITION
    meds = concept.medications(Sort.MOST_COMMON_FIRST)
    ids = [m.id for m in meds]
    # Frequency-descending per vectors: LISINOPRIL (4120) > AMLODIPINE (2105) > LOSARTAN (880).
    assert ids == ["LISINOPRIL", "AMLODIPINE", "LOSARTAN"]


def test_related_concept_handles_preserve_original_input() -> None:
    condition = match_condition("hbp", _BUNDLE)
    medications = condition.medications(Sort.MOST_COMMON_FIRST)
    assert medications[0].input_text == "hbp"

    medication = match_medication("lisinopril", _BUNDLE)
    conditions = medication.conditions(Sort.MOST_COMMON_FIRST)
    assert conditions[0].input_text == "lisinopril"


def test_make_key_not_on_public_surface() -> None:
    """``make_key`` is internal — only reachable through ``_internal``."""
    public_names = set(reference_v3.__all__)
    assert "make_key" not in public_names
    assert "_make_key" not in public_names
    # The internal escape hatch is the only documented path.
    assert callable(reference_v3._internal.make_key)
