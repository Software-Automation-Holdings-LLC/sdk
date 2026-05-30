"""Reference-adapter tests — Autocorrector / MatchAlgorithm / AutocompleteAlgorithm.

Mirror of the TS reference-adapter conformance corpus. Each test
asserts one bullet of the locked spec (v3-datasets-adapter-cutover-spec
§2).
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Sequence
from dataclasses import replace
from typing import cast

import pytest

from sah_sdk import Isa
from sah_sdk.zyins.datasets_v3 import (
    DatasetBundleV3,
    MedicationRelation,
    ReferenceEntity,
    SpellingCorrectionRow,
    parse_datasets_v3_envelope,
)
from sah_sdk.zyins.reference.autocomplete_algorithm import (
    AutocompleteOptions,
    DefaultAutocompleteAlgorithm,
    _apply_frequency_sort,
)
from sah_sdk.zyins.reference.autocorrector import (
    AutocorrectAppliedEvent,
    DefaultAutocorrector,
)
from sah_sdk.zyins.reference.concept import Concept, ConceptKind
from sah_sdk.zyins.reference.match_algorithm import DefaultMatchAlgorithm
from sah_sdk.zyins.reference.reference_index import ReferenceIndex
from sah_sdk.zyins.reference.sort import Sort
from sah_sdk.zyins.reference.suggestion import Suggestion

# ---------------------------------------------------------------------------
# Autocorrector
# ---------------------------------------------------------------------------


def test_autocorrect_submit_applies_simple_typo() -> None:
    ac = DefaultAutocorrector(typo_map={"HYPRTENSION": "HYPERTENSION"})
    assert ac.correct("hyprtension", mode="submit") == "HYPERTENSION"


def test_autocorrect_keyup_skips_strict_superstring() -> None:
    ac = DefaultAutocorrector(typo_map={"ASTHM": "ASTHMA"})
    # Keyup guard: "ASTHMA" contains "ASTHM" and is longer — skip.
    assert ac.correct("asthm", mode="keyup") == "ASTHM"


def test_autocorrect_submit_skips_when_correction_already_present() -> None:
    ac = DefaultAutocorrector(typo_map={"CHOLESTEROL": "HIGH CHOLESTEROL"})
    # Anti-duplication: "HIGH CHOLESTEROL" already contains correction → skip.
    assert ac.correct("high cholesterol", mode="submit") == "HIGH CHOLESTEROL"


def test_autocorrect_submit_guard_matches_whole_token_not_substring() -> None:
    # The submit anti-duplication guard skips a correction only when it already
    # appears as a consecutive whole-token phrase, not when it is a substring
    # inside a larger token. "DOG" ⊂ "DOGMA" must NOT suppress CAT→DOG. Matches
    # the locked TS containsPhrase.
    ac = DefaultAutocorrector(typo_map={"CAT": "DOG"})
    assert ac.correct("cat dogma", mode="submit") == "DOG DOGMA"
    # When the correction IS a standalone token already present, skip applies.
    ac2 = DefaultAutocorrector(typo_map={"ASMA": "ASTHMA"})
    assert ac2.correct("asma asthma", mode="submit") == "ASMA ASTHMA"


def test_autocorrect_submit_guard_uppercases_correction_value() -> None:
    ac = DefaultAutocorrector(typo_map={"CHOLESTEROL": "high cholesterol"})
    assert ac.correct("high cholesterol", mode="submit") == "HIGH CHOLESTEROL"


def test_autocorrect_preserves_trailing_whitespace() -> None:
    ac = DefaultAutocorrector(typo_map={"HYPRTENSION": "HYPERTENSION"})
    assert ac.correct("hyprtension ", mode="submit") == "HYPERTENSION "


def test_autocorrect_no_change_returns_uppercased_words() -> None:
    ac = DefaultAutocorrector(typo_map={"FOO": "BAR"})
    assert ac.correct("baz qux", mode="submit") == "BAZ QUX"


def test_autocorrect_empty_typo_map_still_normalizes() -> None:
    # A catalog with no spelling corrections still uppercases and collapses
    # whitespace; it does not pass the raw input through. Matches the locked
    # TS adapter, which returns ``words.join(' ') + trailing`` on a zero-size
    # map. Empty / whitespace-only inputs are returned verbatim.
    ac = DefaultAutocorrector(typo_map={})
    assert ac.correct("high blood  pressure", mode="submit") == "HIGH BLOOD PRESSURE"
    assert ac.correct("asthma ", mode="submit") == "ASTHMA "
    assert ac.correct("", mode="submit") == ""
    assert ac.correct("   ", mode="submit") == "   "


def test_autocorrect_on_applied_fires_once_per_correction() -> None:
    events: list[AutocorrectAppliedEvent] = []
    ac = DefaultAutocorrector(
        typo_map={"HYPRTENSION": "HYPERTENSION"},
        on_applied=events.append,
    )
    ac.correct("hyprtension", mode="submit")
    assert len(events) == 1
    assert events[0].original == "hyprtension"
    assert events[0].corrected == "HYPERTENSION"
    assert events[0].mode == "submit"
    assert events[0].window == "HYPRTENSION"
    assert events[0].correction == "HYPERTENSION"


def test_autocorrect_continues_after_applied_correction() -> None:
    ac = DefaultAutocorrector(typo_map={"ASTHM": "ASTHMA", "HYPRTENSION": "HYPERTENSION"})
    assert ac.correct("asthm hyprtension", mode="submit") == "ASTHMA HYPERTENSION"


def test_autocorrect_events_identify_each_correction() -> None:
    events: list[AutocorrectAppliedEvent] = []
    ac = DefaultAutocorrector(
        typo_map={"ASTHM": "ASTHMA", "HYPRTENSION": "HYPERTENSION"},
        on_applied=events.append,
    )

    ac.correct("asthm hyprtension", mode="submit")

    assert [(event.window, event.correction) for event in events] == [
        ("ASTHM", "ASTHMA"),
        ("HYPRTENSION", "HYPERTENSION"),
    ]


def test_autocorrect_clone_overrides_version_tag() -> None:
    ac = DefaultAutocorrector(typo_map={}, version_tag="v1")
    child = ac.clone(version_tag="v2")
    assert ac.version_tag == "v1"
    assert child.version_tag == "v2"


# ---------------------------------------------------------------------------
# MatchAlgorithm
# ---------------------------------------------------------------------------


def _concepts(*pairs: tuple[str, str, ConceptKind]) -> list[Concept]:
    return [
        Concept(
            id=cid,
            name=name,
            kind=kind,
            is_known=True,
            input_text=name,
            _index=None,
        )
        for cid, name, kind in pairs
    ]


def test_match_smart_cmp_uppercase_alphanumeric() -> None:
    m = DefaultMatchAlgorithm()
    candidates = _concepts(
        ("HIGHBLOODPRESSURE", "High Blood Pressure", ConceptKind.CONDITION),
    )
    hit = m.match("high blood pressure!!", candidates)
    assert hit.id == "HIGHBLOODPRESSURE"
    assert hit.is_known
    assert hit.input_text == "high blood pressure!!"


def test_match_uses_normalized_names_for_opaque_ids() -> None:
    m = DefaultMatchAlgorithm()
    candidates = _concepts(
        ("cond_01JZULID", "High Blood Pressure", ConceptKind.CONDITION),
    )
    hit = m.match("high blood pressure!!", candidates)
    assert hit.id == "cond_01JZULID"
    assert hit.is_known


def test_match_unknown_returns_unknown_concept() -> None:
    m = DefaultMatchAlgorithm()
    miss = m.match("nope", _concepts(("X", "X", ConceptKind.CONDITION)))
    assert miss.kind is ConceptKind.UNKNOWN
    assert not miss.is_known
    assert miss.input_text == "nope"


def test_match_clone_independent() -> None:
    m = DefaultMatchAlgorithm(version_tag="a")
    assert m.clone(version_tag="b").version_tag == "b"
    assert m.version_tag == "a"


# ---------------------------------------------------------------------------
# AutocompleteAlgorithm
# ---------------------------------------------------------------------------


def test_autocomplete_starts_with_bucket_wins() -> None:
    algo = DefaultAutocompleteAlgorithm()
    candidates = _concepts(
        ("c1", "High Blood Pressure", ConceptKind.CONDITION),
        ("c2", "Blood Cancer", ConceptKind.CONDITION),
    )
    result = asyncio.run(
        algo.rank(
            "high",
            candidates,
            AutocompleteOptions(limit=5, kinds=(ConceptKind.CONDITION,)),
        )
    )
    assert result
    assert result[0].id == "c1"  # starts-with bucket beats word-intersection


def test_autocomplete_frequency_boost_within_bucket() -> None:
    algo = DefaultAutocompleteAlgorithm()
    candidates = _concepts(
        ("c1", "High Blood Pressure", ConceptKind.CONDITION),
        ("c2", "High Cholesterol", ConceptKind.CONDITION),
    )
    result = asyncio.run(
        algo.rank(
            "high",
            candidates,
            AutocompleteOptions(
                limit=5,
                kinds=(ConceptKind.CONDITION,),
                frequencies={"c2": 1000, "c1": 1},
            ),
        )
    )
    assert [s.id for s in result] == ["c2", "c1"]


def test_autocomplete_alphabetical_ignores_frequency() -> None:
    # B2: Alphabetical keeps the relevance FILTER but emits A→Z, frequency-blind.
    algo = DefaultAutocompleteAlgorithm()
    candidates = _concepts(
        ("c1", "High Cholesterol", ConceptKind.CONDITION),
        ("c2", "High Blood Pressure", ConceptKind.CONDITION),
    )
    result = asyncio.run(
        algo.rank(
            "high",
            candidates,
            AutocompleteOptions(
                limit=5,
                kinds=(ConceptKind.CONDITION,),
                frequencies={"c1": 9000, "c2": 1},
                sort=Sort.ALPHABETICAL,
            ),
        )
    )
    # A→Z by name: "High Blood Pressure" < "High Cholesterol".
    assert [s.id for s in result] == ["c2", "c1"]


def test_autocomplete_alphabetical_flattens_across_buckets() -> None:
    # B2: every match A→Z regardless of which relevance bucket it landed in.
    algo = DefaultAutocompleteAlgorithm()
    candidates = _concepts(
        ("c1", "High Blood Pressure", ConceptKind.CONDITION),
        ("c2", "Low Blood Pressure", ConceptKind.CONDITION),
        ("c3", "Blood Pressure Cuff", ConceptKind.CONDITION),
    )
    result = asyncio.run(
        algo.rank(
            "pressure",
            candidates,
            AutocompleteOptions(
                limit=5,
                kinds=(ConceptKind.CONDITION,),
                frequencies={"c1": 9000},
                sort=Sort.ALPHABETICAL,
            ),
        )
    )
    assert [s.concept.name for s in result] == [
        "Blood Pressure Cuff",
        "High Blood Pressure",
        "Low Blood Pressure",
    ]


def test_autocomplete_default_sort_is_most_common_first() -> None:
    # Default (omitted sort) keeps frequency order — proves Alphabetical is opt-in.
    algo = DefaultAutocompleteAlgorithm()
    candidates = _concepts(
        ("c1", "High Blood Pressure", ConceptKind.CONDITION),
        ("c2", "High Cholesterol", ConceptKind.CONDITION),
    )
    result = asyncio.run(
        algo.rank(
            "high",
            candidates,
            AutocompleteOptions(
                limit=5,
                kinds=(ConceptKind.CONDITION,),
                frequencies={"c2": 9000, "c1": 1},
            ),
        )
    )
    assert [s.id for s in result] == ["c2", "c1"]


def test_autocomplete_respects_limit() -> None:
    algo = DefaultAutocompleteAlgorithm()
    candidates = _concepts(
        ("c1", "Heart Attack", ConceptKind.CONDITION),
        ("c2", "Heart Disease", ConceptKind.CONDITION),
        ("c3", "Heart Failure", ConceptKind.CONDITION),
    )
    result = asyncio.run(
        algo.rank(
            "heart",
            candidates,
            AutocompleteOptions(limit=2, kinds=(ConceptKind.CONDITION,)),
        )
    )
    assert len(result) == 2


def test_autocomplete_returns_suggestion_with_rank_and_span() -> None:
    algo = DefaultAutocompleteAlgorithm()
    candidates = _concepts(
        ("c1", "Diabetes", ConceptKind.CONDITION),
    )
    result = asyncio.run(
        algo.rank(
            "diab",
            candidates,
            AutocompleteOptions(limit=5, kinds=(ConceptKind.CONDITION,)),
        )
    )
    assert len(result) == 1
    suggestion = result[0]
    assert isinstance(suggestion, Suggestion)
    assert suggestion.rank == 0
    assert suggestion.matched_span == (0, 4)
    assert suggestion.input_text == "diab"


def test_autocomplete_punctuation_only_query_returns_empty() -> None:
    algo = DefaultAutocompleteAlgorithm()
    result = asyncio.run(
        algo.rank(
            "---",
            _concepts(("c1", "Diabetes", ConceptKind.CONDITION)),
            AutocompleteOptions(limit=5),
        )
    )
    assert result == []


def test_autocomplete_single_word_query_uses_tokenized_filter() -> None:
    algo = DefaultAutocompleteAlgorithm()
    result = asyncio.run(
        algo.rank(
            "high-",
            _concepts(("c1", "High Blood Pressure", ConceptKind.CONDITION)),
            AutocompleteOptions(limit=5),
        )
    )
    assert [s.id for s in result] == ["c1"]


def test_autocomplete_start_bucket_uses_tokenized_query() -> None:
    algo = DefaultAutocompleteAlgorithm()
    result = asyncio.run(
        algo.rank(
            "high-",
            _concepts(
                ("starts", "High Blood Pressure", ConceptKind.CONDITION),
                ("substring", "Other High", ConceptKind.CONDITION),
            ),
            AutocompleteOptions(
                limit=5,
                frequencies={"starts": 1, "substring": 1000},
            ),
        )
    )
    assert [s.id for s in result] == ["starts", "substring"]


def test_autocomplete_starts_with_only_strips_open_parenthesis() -> None:
    algo = DefaultAutocompleteAlgorithm()
    result = asyncio.run(
        algo.rank(
            "high",
            _concepts(("c1", "(High Blood Pressure)", ConceptKind.CONDITION)),
            AutocompleteOptions(limit=5, starts_with_only=True),
        )
    )
    assert [s.id for s in result] == ["c1"]


def test_autocomplete_independent_intersection_precedes_same_count_tolerance() -> None:
    # "Cart Dia" tokenizes to {CART, DIA}: DIA is an exact token and ART is a
    # substring of CART, so it survives the at-most-one-missing token filter
    # and lands in the independentWordIntersection bucket. "Dia Cab" tokenizes
    # to {DIA, CAB}: DIA is exact, ART is absent from the token set, so it
    # falls to the lower sameNumWithTolerance bucket. Bucket order dominates
    # frequency — the high-frequency tolerance match still ranks below the
    # low-frequency independent intersection. (Ground-truthed against the
    # locked TS DefaultAutocompleteAlgorithm.)
    algo = DefaultAutocompleteAlgorithm()
    result = asyncio.run(
        algo.rank(
            "art dia",
            _concepts(
                ("same-count", "Dia Cab", ConceptKind.CONDITION),
                ("independent", "Cart Dia", ConceptKind.CONDITION),
            ),
            AutocompleteOptions(
                limit=5,
                frequencies={"same-count": 1000, "independent": 1},
            ),
        )
    )
    assert [s.id for s in result] == ["independent", "same-count"]


def test_autocomplete_superset_uses_word_count_bucket() -> None:
    # "Extra Art Dia" tokenizes to {EXTRA, ART, DIA}: a superset of the query
    # tokens {ART, DIA}, so it lands in the wordCountNoTolerance bucket. "Cart
    # Dia" survives the filter (DIA exact, ART substring of CART) into the
    # higher independentWordIntersection bucket, so it precedes the superset
    # despite the superset's far higher frequency. (Ground-truthed against the
    # locked TS DefaultAutocompleteAlgorithm.)
    algo = DefaultAutocompleteAlgorithm()
    result = asyncio.run(
        algo.rank(
            "art dia",
            _concepts(
                ("independent", "Cart Dia", ConceptKind.CONDITION),
                ("superset", "Extra Art Dia", ConceptKind.CONDITION),
            ),
            AutocompleteOptions(
                limit=5,
                frequencies={"superset": 1000, "independent": 1},
            ),
        )
    )
    assert [s.id for s in result] == ["independent", "superset"]


def test_frequency_sort_scores_unknown_concepts_independently() -> None:
    unknown = Concept(
        id=None,
        name="Alpha",
        kind=ConceptKind.UNKNOWN,
        is_known=False,
        input_text="alpha",
    )
    known = Concept(
        id="known",
        name="Zulu",
        kind=ConceptKind.CONDITION,
        is_known=True,
        input_text="zulu",
    )
    later_unknown = Concept(
        id=None,
        name="Tail",
        kind=ConceptKind.UNKNOWN,
        is_known=False,
        input_text="tail",
    )

    grouped = _apply_frequency_sort(
        [[unknown, known], [], [], [], [], [later_unknown]], {"known": 0}
    )

    assert grouped[0] == [unknown, known]


def test_frequency_sort_scores_value_equal_concepts_by_actual_group() -> None:
    early = Concept(
        id="same",
        name="Zulu",
        kind=ConceptKind.CONDITION,
        is_known=True,
        input_text="zulu",
    )
    later = replace(early)
    alpha = Concept(
        id="alpha",
        name="Alpha",
        kind=ConceptKind.CONDITION,
        is_known=True,
        input_text="alpha",
    )

    grouped = _apply_frequency_sort(
        [[early], [], [], [], [], [later, alpha]], {"same": 0, "alpha": 0}
    )

    assert grouped[5] == [alpha, later]


# ---------------------------------------------------------------------------
# Inline-row DatasetBundleV3 + ReferenceIndex aggregate frequency map.
# ---------------------------------------------------------------------------


_INLINE_ROW_BODY = json.dumps(
    {
        "object": "datasets_catalog",
        "data": {
            "catalog_version": "2026.05.29",
            "datasets": {
                "conditions": {
                    "version": "2026.05.29",
                    "item_count": 1,
                    "items": [
                        {
                            "object": "condition",
                            "id": "cond_HBP",
                            "name": "High Blood Pressure",
                            "treated_with": [
                                {
                                    "id": "med_LOS",
                                    "name": "Losartan",
                                    "prescription_count": 4120,
                                },
                                {
                                    "id": "med_LIS",
                                    "name": "Lisinopril",
                                    "prescription_count": 880,
                                },
                            ],
                        }
                    ],
                },
                "medications": {
                    "version": "2026.05.29",
                    "item_count": 2,
                    "items": [
                        {
                            "object": "medication",
                            "id": "med_LOS",
                            "name": "Losartan",
                            "used_for": [
                                {
                                    "id": "cond_HBP",
                                    "name": "High Blood Pressure",
                                    "prescription_count": 4120,
                                }
                            ],
                        },
                        {
                            "object": "medication",
                            "id": "med_LIS",
                            "name": "Lisinopril",
                            "used_for": [
                                {
                                    "id": "cond_HBP",
                                    "name": "High Blood Pressure",
                                    "prescription_count": 880,
                                }
                            ],
                        },
                    ],
                },
                "spelling_corrections": {
                    "version": "2026.05.29",
                    "item_count": 2,
                    "items": [
                        {
                            "object": "spelling_correction",
                            "id": "spl_HYP",
                            "from": "HYPRTENSION",
                            "to": "HYPERTENSION",
                        },
                        {
                            "object": "spelling_correction",
                            "id": "spl_HOS",
                            "from": "HOSPITILIZED",
                            "to": "HOSPITALIZED",
                        },
                    ],
                },
            },
        },
    }
)


_LEGACY_CORRECTIONS_BODY = json.dumps(
    {
        "object": "datasets",
        "data": {
            "version": "3.0",
            "datasets": {
                "corrections": {
                    "version": "3.0",
                    "item_count": 1,
                    "items": [{"id": "hyprtension", "name": "hypertension"}],
                },
            },
        },
    }
)


def test_inline_row_parser_populates_rows_and_derives_maps() -> None:
    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    assert bundle.version == "2026.05.29"
    assert len(bundle.condition_rows) == 1
    cond = bundle.condition_rows[0]
    assert cond.id == "cond_HBP"
    assert cond.treated_with[0] == MedicationRelation(
        id="med_LOS", name="Losartan", prescription_count=4120
    )
    assert len(bundle.medication_rows) == 2
    assert len(bundle.spelling_corrections) == 2
    assert bundle.spelling_corrections[0] == SpellingCorrectionRow(
        id="spl_HYP", from_="HYPRTENSION", to="HYPERTENSION"
    )
    assert bundle.corrections[0] == ReferenceEntity(
        id="HYPRTENSION", name="HYPERTENSION"
    )
    # Derived legacy maps still populated for back-compat.
    assert bundle.medications_by_condition["cond_HBP"] == ("med_LOS", "med_LIS")
    assert bundle.frequency_graphs.use_map["cond_HBP"]["med_LOS"] == 4120


def test_reference_index_builds_aggregate_frequencies_and_typo_map() -> None:
    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    index = ReferenceIndex.from_bundle(bundle)
    # Condition total = sum of its treated_with counts.
    assert index.frequencies["cond_HBP"] == 4120 + 880
    # Medication totals roll up across used_for.
    assert index.frequencies["med_LOS"] == 4120
    assert index.frequencies["med_LIS"] == 880
    # Typo map keys are uppercased and pass-through.
    assert index.typo_map["HYPRTENSION"] == "HYPERTENSION"
    assert index.typo_map["HOSPITILIZED"] == "HOSPITALIZED"
    # Concepts surface medications + conditions.
    kinds = {c.kind for c in index.concepts}
    assert kinds == {ConceptKind.CONDITION, ConceptKind.MEDICATION}


def test_reference_index_typo_map_falls_back_to_legacy_corrections() -> None:
    bundle = parse_datasets_v3_envelope(_LEGACY_CORRECTIONS_BODY)
    index = ReferenceIndex.from_bundle(bundle)

    assert index.typo_map["HYPRTENSION"] == "HYPERTENSION"


def test_reference_index_binds_concepts_for_symmetric_traversal() -> None:
    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    index = ReferenceIndex.from_bundle(bundle)

    condition = index.concept_for_id("cond_HBP")
    medication = index.concept_for_id("med_LOS")

    assert condition is not None
    assert [m.id for m in condition.medications()] == ["med_LOS", "med_LIS"]
    assert medication is not None
    assert [c.id for c in medication.conditions()] == ["cond_HBP"]


def test_reference_index_does_not_double_count_inline_condition_frequencies() -> None:
    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    mixed_bundle = replace(bundle, medication_rows=())
    index = ReferenceIndex.from_bundle(mixed_bundle)
    assert index.frequencies["cond_HBP"] == 4120 + 880


def test_reference_index_frequency_keeps_zero_counts() -> None:
    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    index = ReferenceIndex.from_bundle(bundle)
    index = replace(
        index,
        use_map={
            "cond_HBP": {"med_LOS": 0, "med_LIS": 1},
            "med_LOS": {"cond_HBP": 999},
        },
    )

    medications = index.medications_for_condition(
        "cond_HBP", "High Blood Pressure", Sort.MOST_COMMON_FIRST
    )

    assert [med.id for med in medications] == ["med_LIS", "med_LOS"]


def test_inline_row_bundle_drives_autocorrector_factory() -> None:
    bundle: DatasetBundleV3 = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    typo_map = {row.from_.upper(): row.to.upper() for row in bundle.spelling_corrections}
    ac = DefaultAutocorrector(typo_map=typo_map, version_tag=bundle.version)
    assert ac.correct("hyprtension", mode="submit") == "HYPERTENSION"
    assert ac.version_tag == "2026.05.29"


def test_isa_reference_adapters_are_bound_to_bundle() -> None:
    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
    )
    isa.zyins.set_dataset_bundle(bundle)

    match = isa.zyins.matcher.match("high blood pressure!!")
    suggestions = asyncio.run(isa.zyins.autocomplete.rank("los"))

    assert match.id == "cond_HBP"
    assert [s.id for s in suggestions] == ["med_LOS"]


def test_isa_set_dataset_bundle_rebinds_same_version_adapters() -> None:
    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
    )
    isa.zyins.set_dataset_bundle(bundle)
    assert isa.zyins.matcher.match("high blood pressure").id == "cond_HBP"

    condition = replace(bundle.condition_rows[0], name="Low Blood Pressure")
    updated = replace(bundle, condition_rows=(condition,))
    isa.zyins.set_dataset_bundle(updated)

    assert isa.zyins.matcher.match("low blood pressure").id == "cond_HBP"


def test_isa_autocomplete_default_options_use_bundle_frequencies() -> None:
    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
    )
    isa.zyins.set_dataset_bundle(bundle)

    suggestions = asyncio.run(isa.zyins.autocomplete.rank("l", AutocompleteOptions(limit=2)))

    assert [s.id for s in suggestions] == ["med_LOS", "med_LIS"]


def test_isa_matcher_override_is_bound_to_bundle() -> None:
    class OverrideMatcher:
        def match(self, query: str, candidates: Sequence[Concept]) -> Concept:
            assert query == "anything"
            assert len(candidates) == 3
            return Concept(
                id="override",
                name="Override",
                kind=ConceptKind.CONDITION,
                is_known=True,
                input_text=query,
            )

    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
        match_algorithm=OverrideMatcher(),
    )
    isa.zyins.set_dataset_bundle(bundle)

    assert isa.zyins.matcher.match("anything").id == "override"
    assert isa.zyins.matcher.version_tag is None


def test_isa_autocomplete_override_is_bound_to_bundle() -> None:
    class OverrideAutocomplete:
        async def rank(
            self,
            query: str,
            candidates: Sequence[Concept],
            options: AutocompleteOptions,
        ) -> list[Suggestion]:
            assert query == "anything"
            assert len(candidates) == 3
            assert options.frequencies == {}
            return []

    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
        autocomplete_algorithm=OverrideAutocomplete(),
    )
    isa.zyins.set_dataset_bundle(bundle)

    asyncio.run(isa.zyins.autocomplete.rank("anything", AutocompleteOptions(frequencies={})))
    assert isa.zyins.autocomplete.version_tag is None


def test_isa_autocorrector_override_skips_default_autocorrector() -> None:
    class OverrideAutocorrector:
        def correct(self, text: str, *, mode: str) -> str:
            return text

    def fail_default_autocorrector(**kwargs: object) -> DefaultAutocorrector:
        raise AssertionError("default autocorrector should not be constructed")

    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    override = OverrideAutocorrector()
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
        autocorrector=override,
    )
    isa.zyins._default_autocorrector_cls = cast(
        type[DefaultAutocorrector], fail_default_autocorrector
    )
    isa.zyins.set_dataset_bundle(bundle)

    assert isa.zyins.autocorrector is override
    assert isa.zyins.matcher.match("high blood pressure!!").id == "cond_HBP"
    assert isa.zyins.matcher.match("high blood pressure!!").id == "cond_HBP"


def test_isa_autocomplete_rejects_non_option_objects() -> None:
    bundle = parse_datasets_v3_envelope(_INLINE_ROW_BODY)
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
    )
    isa.zyins.set_dataset_bundle(bundle)

    with pytest.raises(TypeError, match="AutocompleteOptions"):
        asyncio.run(isa.zyins.autocomplete.rank("anything", object()))
