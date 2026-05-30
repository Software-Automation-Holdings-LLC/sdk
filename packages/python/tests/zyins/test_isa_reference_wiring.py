"""``Isa.zyins.reference`` wiring tests.

Asserts the locked surface from ``docs/sdk-syntax-proposal.md``:

* ``isa.zyins.reference`` exposes :meth:`match` / :meth:`match_many`.
* ``isa.zyins.medications.match(...)`` and
  ``isa.zyins.conditions.match(...)`` shortcuts resolve through the
  same cached index as ``isa.zyins.reference``.
* The bundle is bound via ``set_dataset_bundle()``; calling a matcher
  before binding raises :class:`IsaConfigError` with a recipe.

These tests construct the :class:`Isa` via :meth:`with_bearer` —
no network round-trip — and supply a fixture bundle directly.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from types import MappingProxyType

import pytest

from sah_sdk import Isa
from sah_sdk.core.env import IsaConfigError
from sah_sdk.zyins.datasets_v3 import (
    DatasetBundleV3,
    DatasetCategory,
    DatasetEntry,
    FrequencyGraphs,
    ReferenceEntity,
)
from sah_sdk.zyins.reference import ConceptKind

_CONDITIONS = (
    ReferenceEntity(id="HIGHBLOODPRESSURE", name="High Blood Pressure"),
    ReferenceEntity(id="DIABETES", name="Diabetes"),
)
_MEDICATIONS = (
    ReferenceEntity(id="LISINOPRIL", name="Lisinopril"),
    ReferenceEntity(id="INSULIN", name="Insulin"),
)
_MEDS_BY_CONDITION: Mapping[str, Sequence[str]] = MappingProxyType(
    {
        "HIGHBLOODPRESSURE": ("LISINOPRIL",),
        "DIABETES": ("INSULIN",),
    }
)


def _bundle(version: str = "v1") -> DatasetBundleV3:
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
        frequency_graphs=FrequencyGraphs(),
        datasets=MappingProxyType(datasets),
    )


@pytest.fixture()
def isa() -> Isa:
    return Isa.with_bearer("isa_test_token_xxxxxxxxxxxxxxxxxxxx")


def test_reference_requires_bundle_before_use(isa: Isa) -> None:
    with pytest.raises(IsaConfigError) as exc_info:
        isa.zyins.reference.match("INSULIN")
    assert "set_dataset_bundle" in str(exc_info.value)


def test_set_dataset_bundle_enables_match(isa: Isa) -> None:
    isa.zyins.set_dataset_bundle(_bundle())
    result = isa.zyins.reference.match("INSULIN")
    assert result.kind is ConceptKind.MEDICATION
    assert result.id == "INSULIN"


def test_medications_shortcut_on_isa(isa: Isa) -> None:
    isa.zyins.set_dataset_bundle(_bundle())
    result = isa.zyins.medications.match("Lisinopril")
    assert result.kind is ConceptKind.MEDICATION
    assert result.id == "LISINOPRIL"


def test_conditions_shortcut_on_isa(isa: Isa) -> None:
    isa.zyins.set_dataset_bundle(_bundle())
    result = isa.zyins.conditions.match("Diabetes")
    assert result.kind is ConceptKind.CONDITION
    assert result.id == "DIABETES"


def test_reference_match_unknown_never_raises(isa: Isa) -> None:
    isa.zyins.set_dataset_bundle(_bundle())
    result = isa.zyins.reference.match("not in catalog")
    assert result.kind is ConceptKind.UNKNOWN
    assert result.is_known is False
    assert result.input_text == "not in catalog"


def test_dataset_version_swap_rebuilds_index(isa: Isa) -> None:
    isa.zyins.set_dataset_bundle(_bundle(version="v1"))
    first = isa.zyins.medications.match("INSULIN")
    assert first.name == "Insulin"

    renamed = (
        ReferenceEntity(id="LISINOPRIL", name="Lisinopril"),
        ReferenceEntity(id="INSULIN", name="Insulin Glargine"),
    )
    v2 = DatasetBundleV3(
        version="v2",
        medications=renamed,
        conditions=_CONDITIONS,
        products=(),
        corrections=(),
        nicotine_options=(),
        medications_by_condition=_MEDS_BY_CONDITION,
        frequency_graphs=FrequencyGraphs(),
        datasets=_bundle().datasets,
    )
    isa.zyins.set_dataset_bundle(v2)
    second = isa.zyins.medications.match("INSULIN")
    assert second.name == "Insulin Glargine"
