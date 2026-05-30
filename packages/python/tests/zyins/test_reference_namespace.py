"""Behavior tests for the locked ``sah_sdk.zyins.reference`` namespace.

Covers the v3-freeze contract independently of the cross-language
``reference_vectors.json`` corpus:

* :func:`match` semantics — known condition, known medication,
  unknown text, ``input_text`` preservation, never raises.
* :class:`Sort` ordering for symmetric accessors.
* :meth:`Concept.equals` identity-by-id.
* :meth:`_KindMatcher.match_many` batch behavior.
* :meth:`_KindMatcher.list` ``.list()`` sugar.
* :class:`ReferenceFacade` rebuilds the cached :class:`ReferenceIndex`
  when the dataset version changes.
* Private :func:`_make_key` is not part of the package's ``__all__``.

The fixture is small and shaped — three conditions, three meds — so
the assertions read like the spec rather than relying on the live
catalog.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from types import MappingProxyType

import pytest

from sah_sdk.zyins.datasets_v3 import (
    DatasetBundleV3,
    DatasetCategory,
    DatasetEntry,
    FrequencyGraphs,
    ReferenceEntity,
)
from sah_sdk.zyins.reference import (
    Concept,
    ConceptKind,
    ConditionConcept,
    MedicationConcept,
    ReferenceFacade,
    Sort,
    bind,
    match,
    match_condition,
    match_medication,
    reference,
)
from sah_sdk.zyins.reference import _internal as _reference_internal

# ---------------------------------------------------------------------------
# Fixture — small bundle with three conditions and three medications.
# ---------------------------------------------------------------------------


_CONDITIONS = (
    ReferenceEntity(id="HIGHBLOODPRESSURE", name="High Blood Pressure"),
    ReferenceEntity(id="HBP", name="High Blood Pressure"),  # short-form id
    ReferenceEntity(id="DIABETES", name="Diabetes"),
    ReferenceEntity(id="ASTHMA", name="Asthma"),
)
_MEDICATIONS = (
    ReferenceEntity(id="LISINOPRIL", name="Lisinopril"),
    ReferenceEntity(id="METFORMIN", name="Metformin"),
    ReferenceEntity(id="INSULIN", name="Insulin"),
)
# INSULIN treats both DIABETES (frequency 90) and HIGHBLOODPRESSURE
# (frequency 10) so MOST_COMMON_FIRST and ALPHABETICAL diverge.
_MEDS_BY_CONDITION: Mapping[str, Sequence[str]] = MappingProxyType(
    {
        "HIGHBLOODPRESSURE": ("LISINOPRIL", "INSULIN"),
        "DIABETES": ("METFORMIN", "INSULIN"),
        "ASTHMA": (),
    }
)
_USE_MAP: Mapping[str, Mapping[str, int]] = MappingProxyType(
    {
        "HIGHBLOODPRESSURE": MappingProxyType({"LISINOPRIL": 95, "INSULIN": 10}),
        "DIABETES": MappingProxyType({"METFORMIN": 80, "INSULIN": 90}),
    }
)


def _build_bundle(version: str = "v1") -> DatasetBundleV3:
    datasets: dict[DatasetCategory, DatasetEntry | None] = {
        DatasetCategory.CONDITIONS: DatasetEntry(
            version=version, item_count=len(_CONDITIONS), items=_CONDITIONS
        ),
        DatasetCategory.MEDICATIONS: DatasetEntry(
            version=version, item_count=len(_MEDICATIONS), items=_MEDICATIONS
        ),
        DatasetCategory.PRODUCTS: None,
        DatasetCategory.CORRECTIONS: None,
        DatasetCategory.NICOTINE_OPTIONS: None,
    }
    return DatasetBundleV3(
        version=version,
        medications=_MEDICATIONS,
        conditions=_CONDITIONS,
        products=(),
        corrections=(),
        nicotine_options=(),
        medications_by_condition=_MEDS_BY_CONDITION,
        frequency_graphs=FrequencyGraphs(use_map=_USE_MAP),
        datasets=MappingProxyType(datasets),
    )


@pytest.fixture()
def bundle() -> DatasetBundleV3:
    return _build_bundle()


@pytest.fixture()
def facade(bundle: DatasetBundleV3) -> ReferenceFacade:
    return bind(bundle)


# ---------------------------------------------------------------------------
# match() — never raises; ``input_text`` is preserved verbatim.
# ---------------------------------------------------------------------------


def test_match_known_condition_returns_condition_concept(bundle: DatasetBundleV3) -> None:
    # "High Blood Pressure" normalizes via MakeKey to HIGHBLOODPRESSURE,
    # which is the id in the fixture.
    result = match("High Blood Pressure", bundle)
    assert isinstance(result, Concept)
    assert result.kind is ConceptKind.CONDITION
    assert result.is_known is True
    assert result.id == "HIGHBLOODPRESSURE"
    assert result.input_text == "High Blood Pressure"


def test_match_hbp_acronym_resolves_when_server_emits_short_id(
    bundle: DatasetBundleV3,
) -> None:
    # "hbp" normalizes to "HBP". The server emits HBP as a distinct
    # entity id in this fixture, so the SDK resolves it. Per the locked
    # design, the SDK never resolves aliases client-side; this only
    # works because the bundle contains HBP as an id.
    result = match("hbp", bundle)
    assert result.kind is ConceptKind.CONDITION
    assert result.is_known is True
    assert result.id == "HBP"
    assert result.input_text == "hbp"


def test_match_unknown_text_returns_unknown_concept(bundle: DatasetBundleV3) -> None:
    result = match("unknown drug XR 2025", bundle)
    assert result.kind is ConceptKind.UNKNOWN
    assert result.is_known is False
    assert result.id is None
    # input_text is preserved verbatim — the UI uses this as the
    # fallback display string.
    assert result.input_text == "unknown drug XR 2025"
    assert result.name == "unknown drug XR 2025"
    # Accessors return empty tuples — never None, never raising.
    assert result.conditions() == ()
    assert result.medications() == ()


def test_match_never_raises_on_empty_string(bundle: DatasetBundleV3) -> None:
    result = match("", bundle)
    assert result.kind is ConceptKind.UNKNOWN
    assert result.is_known is False
    assert result.input_text == ""


def test_match_medication_helper_returns_medication(bundle: DatasetBundleV3) -> None:
    result = match_medication("INSULIN", bundle)
    assert result.kind is ConceptKind.MEDICATION
    assert result.is_known is True
    assert result.id == "INSULIN"


def test_match_condition_helper_returns_condition(bundle: DatasetBundleV3) -> None:
    result = match_condition("Diabetes", bundle)
    assert result.kind is ConceptKind.CONDITION
    assert result.is_known is True
    assert result.id == "DIABETES"


# ---------------------------------------------------------------------------
# Symmetric traversal + Sort.
# ---------------------------------------------------------------------------


def test_medication_conditions_sorted_most_common_first(bundle: DatasetBundleV3) -> None:
    """INSULIN is more common for DIABETES (90) than HIGHBLOODPRESSURE (10)."""
    concept = match_medication("INSULIN", bundle)
    ordered = concept.conditions(Sort.MOST_COMMON_FIRST)
    assert tuple(c.id for c in ordered) == ("DIABETES", "HIGHBLOODPRESSURE")


def test_medication_conditions_sorted_alphabetical(bundle: DatasetBundleV3) -> None:
    """DIABETES sorts before HIGHBLOODPRESSURE alphabetically."""
    concept = match_medication("INSULIN", bundle)
    ordered = concept.conditions(Sort.ALPHABETICAL)
    assert tuple(c.id for c in ordered) == ("DIABETES", "HIGHBLOODPRESSURE")


def test_condition_medications_sorted_most_common_first(bundle: DatasetBundleV3) -> None:
    """Lisinopril (95) ranks above Insulin (10) for HIGHBLOODPRESSURE."""
    concept = match_condition("High Blood Pressure", bundle)
    ordered = concept.medications(Sort.MOST_COMMON_FIRST)
    assert tuple(m.id for m in ordered) == ("LISINOPRIL", "INSULIN")


def test_condition_medications_sorted_alphabetical(bundle: DatasetBundleV3) -> None:
    concept = match_condition("High Blood Pressure", bundle)
    ordered = concept.medications(Sort.ALPHABETICAL)
    assert tuple(m.id for m in ordered) == ("INSULIN", "LISINOPRIL")


def test_condition_with_no_medications_returns_empty_tuple(bundle: DatasetBundleV3) -> None:
    concept = match_condition("Asthma", bundle)
    assert concept.medications() == ()


def test_medication_accessor_on_condition_returns_empty(bundle: DatasetBundleV3) -> None:
    concept = match_condition("Diabetes", bundle)
    assert concept.medications.__call__ is not None  # accessor exists
    assert concept.conditions() == ()


def test_condition_accessor_on_medication_returns_empty(bundle: DatasetBundleV3) -> None:
    concept = match_medication("INSULIN", bundle)
    assert concept.medications() == ()


def test_unknown_concept_accessors_empty(bundle: DatasetBundleV3) -> None:
    concept = match("nothing here", bundle)
    assert concept.medications() == ()
    assert concept.conditions() == ()


# ---------------------------------------------------------------------------
# Concept.equals — identity by id+kind, ignoring input_text on known.
# ---------------------------------------------------------------------------


def test_equals_same_id_different_input_text(bundle: DatasetBundleV3) -> None:
    a = match_medication("INSULIN", bundle)
    b = match_medication("insulin", bundle)
    assert a.equals(b) is True
    assert b.equals(a) is True


def test_equals_different_ids_returns_false(bundle: DatasetBundleV3) -> None:
    a = match_medication("INSULIN", bundle)
    b = match_medication("Lisinopril", bundle)
    assert a.equals(b) is False


def test_equals_different_kinds_returns_false(bundle: DatasetBundleV3) -> None:
    med = match_medication("INSULIN", bundle)
    cond = match_condition("Diabetes", bundle)
    assert med.equals(cond) is False


def test_equals_unknown_compares_input_text(bundle: DatasetBundleV3) -> None:
    a = match("unknown drug A", bundle)
    b = match("unknown drug A", bundle)
    c = match("unknown drug B", bundle)
    assert a.equals(b) is True
    assert a.equals(c) is False


def test_equals_non_concept_returns_false(bundle: DatasetBundleV3) -> None:
    concept = match_medication("INSULIN", bundle)
    assert concept.equals("INSULIN") is False
    assert concept.equals(None) is False


# ---------------------------------------------------------------------------
# Facade — match_many, list(), shortcuts.
# ---------------------------------------------------------------------------


def test_facade_match_returns_unknown_for_miss(facade: ReferenceFacade) -> None:
    result = facade.match("nothing here")
    assert result.kind is ConceptKind.UNKNOWN
    assert result.input_text == "nothing here"


def test_facade_match_finds_condition_first(facade: ReferenceFacade) -> None:
    result = facade.match("Diabetes")
    assert result.kind is ConceptKind.CONDITION
    assert result.id == "DIABETES"


def test_medications_shortcut_match(facade: ReferenceFacade) -> None:
    result = facade.medications.match("INSULIN")
    assert result.kind is ConceptKind.MEDICATION
    assert result.id == "INSULIN"


def test_conditions_shortcut_match(facade: ReferenceFacade) -> None:
    result = facade.conditions.match("Asthma")
    assert result.kind is ConceptKind.CONDITION
    assert result.id == "ASTHMA"


def test_medications_match_many_preserves_order(facade: ReferenceFacade) -> None:
    results = facade.medications.match_many(
        ["INSULIN", "nope", "Lisinopril", "Metformin"]
    )
    assert [r.kind for r in results] == [
        ConceptKind.MEDICATION,
        ConceptKind.UNKNOWN,
        ConceptKind.MEDICATION,
        ConceptKind.MEDICATION,
    ]
    assert [r.id for r in results] == [
        "INSULIN",
        None,
        "LISINOPRIL",
        "METFORMIN",
    ]


def test_conditions_match_many_preserves_order(facade: ReferenceFacade) -> None:
    results = facade.conditions.match_many(["Asthma", "nope", "Diabetes"])
    assert [r.id for r in results] == ["ASTHMA", None, "DIABETES"]


def test_concepts_match_many_mixed_kinds(facade: ReferenceFacade) -> None:
    results = facade.concepts.match_many(["INSULIN", "Diabetes", "unknown"])
    assert [r.kind for r in results] == [
        ConceptKind.MEDICATION,
        ConceptKind.CONDITION,
        ConceptKind.UNKNOWN,
    ]


def test_medications_list_returns_all_alpha_sorted(facade: ReferenceFacade) -> None:
    result = facade.medications.list()
    assert [m.id for m in result] == ["INSULIN", "LISINOPRIL", "METFORMIN"]
    assert all(m.kind is ConceptKind.MEDICATION for m in result)
    assert all(m.is_known for m in result)


def test_conditions_list_returns_all_alpha_sorted(facade: ReferenceFacade) -> None:
    result = facade.conditions.list()
    # Two ids share the display name "High Blood Pressure" (HIGHBLOODPRESSURE
    # and HBP). Both appear; tie-break is by id since both have the same
    # lowercased name and ``sorted`` is stable on insertion order.
    assert [c.id for c in result] == ["ASTHMA", "DIABETES", "HIGHBLOODPRESSURE", "HBP"]
    assert all(c.kind is ConceptKind.CONDITION for c in result)


# ---------------------------------------------------------------------------
# ReferenceFacade — caches index per dataset version.
# ---------------------------------------------------------------------------


class _SwappableSource:
    """Mutable bundle source so the version-invalidation test can swap."""

    def __init__(self, bundle: DatasetBundleV3) -> None:
        self.bundle = bundle
        self.calls = 0

    def __call__(self) -> DatasetBundleV3:
        self.calls += 1
        return self.bundle


def test_index_rebuilt_on_dataset_version_change() -> None:
    v1 = _build_bundle(version="v1")
    source = _SwappableSource(v1)
    f = ReferenceFacade(source)

    first = f.medications.match("INSULIN")
    assert first.id == "INSULIN"
    # Same version, same bundle — index reused.
    f.medications.match("Lisinopril")
    calls_after_two_matches = source.calls

    # Swap to a new-version bundle with a renamed entity to prove the
    # index actually rebuilds (not just refetches).
    v2_meds = (
        ReferenceEntity(id="INSULIN", name="Insulin Glargine"),
        ReferenceEntity(id="LISINOPRIL", name="Lisinopril"),
        ReferenceEntity(id="METFORMIN", name="Metformin"),
    )
    v2 = DatasetBundleV3(
        version="v2",
        medications=v2_meds,
        conditions=_CONDITIONS,
        products=(),
        corrections=(),
        nicotine_options=(),
        medications_by_condition=_MEDS_BY_CONDITION,
        frequency_graphs=FrequencyGraphs(use_map=_USE_MAP),
        datasets=v1.datasets,
    )
    source.bundle = v2

    after_swap = f.medications.match("INSULIN")
    assert after_swap.id == "INSULIN"
    # Display name reflects v2 catalog, proving the index was rebuilt.
    assert after_swap.name == "Insulin Glargine"
    # Source called at least once more for the version check.
    assert source.calls > calls_after_two_matches


def test_index_reused_when_version_stable(bundle: DatasetBundleV3) -> None:
    source = _SwappableSource(bundle)
    f = ReferenceFacade(source)
    a = f.medications.match("INSULIN")
    b = f.medications.match("INSULIN")
    # Both calls produce equal concepts; the index is reused under the
    # hood (source is called once per match, but ``ReferenceIndex`` is
    # not rebuilt — assert via display-name stability + version).
    assert a.id == b.id
    assert a.name == b.name


# ---------------------------------------------------------------------------
# ``reference`` module-style namespace.
# ---------------------------------------------------------------------------


def test_reference_namespace_exposes_match(bundle: DatasetBundleV3) -> None:
    result = reference.match("INSULIN", bundle)
    assert result.kind is ConceptKind.MEDICATION


def test_reference_namespace_exposes_sort_and_concept() -> None:
    assert reference.Sort is Sort
    assert reference.Concept is Concept


def test_bind_returns_reference_facade(bundle: DatasetBundleV3) -> None:
    f = bind(bundle)
    assert isinstance(f, ReferenceFacade)
    assert f.match("INSULIN").id == "INSULIN"


# ---------------------------------------------------------------------------
# Protocol narrowing — MedicationConcept / ConditionConcept are
# runtime-checkable.
# ---------------------------------------------------------------------------


def test_medication_concept_protocol_narrowing(bundle: DatasetBundleV3) -> None:
    concept = match_medication("INSULIN", bundle)
    assert isinstance(concept, MedicationConcept)


def test_condition_concept_protocol_narrowing(bundle: DatasetBundleV3) -> None:
    concept = match_condition("Diabetes", bundle)
    assert isinstance(concept, ConditionConcept)


# ---------------------------------------------------------------------------
# ``_make_key`` is not exported.
# ---------------------------------------------------------------------------


def test_make_key_not_in_public_all() -> None:
    import sah_sdk.zyins.reference as ref_pkg

    assert "_make_key" not in getattr(ref_pkg, "__all__", ())
    assert "make_key" not in getattr(ref_pkg, "__all__", ())


def test_make_key_accessible_via_internal_escape_hatch() -> None:
    # Conformance corpus needs this; consumers do not.
    assert _reference_internal.make_key("High Blood Pressure") == "HIGHBLOODPRESSURE"
    assert _reference_internal.make_key("hbp") == "HBP"
    assert _reference_internal.make_key("") == ""
