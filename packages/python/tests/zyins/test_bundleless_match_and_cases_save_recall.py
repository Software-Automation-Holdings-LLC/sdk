"""Tests for the locked bundleless top-level surface.

Covers:

* ``isa.zyins.medications.match(text)`` / ``conditions.match(text)`` /
  ``concepts.match(text)`` work without a bundle argument when a
  ``dataset_bundle_fetcher`` is wired on the parent :class:`Isa`.
* The fetcher is invoked exactly once even under concurrent first
  calls (cache invalidation only happens on version change).
* ``isa.zyins.cases.save(record)`` and ``isa.zyins.cases.recall(id,
  recall_token)`` round-trip through an injected
  :class:`CaseStorage` adapter.
* The cases facade still forwards legacy verbs (``share``, ``email``)
  to ``ZyInsClient.cases``.
"""

from __future__ import annotations

import threading
import uuid
from collections.abc import Mapping, Sequence
from types import MappingProxyType
from typing import Any

import pytest

from sah_sdk import Isa
from sah_sdk.core.env import IsaConfigError
from sah_sdk.zyins.cases import CaseRecord, CasesFacade, PutResult
from sah_sdk.zyins.cases_storage import CaseStorage
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


# ---------------------------------------------------------------------------
# Bundleless top-level reference.match — cache-backed, never bundle-required.
# ---------------------------------------------------------------------------


class _FetcherSpy:
    """Counts calls so we can assert the bundle is fetched exactly once."""

    def __init__(self, bundle_versions: list[DatasetBundleV3]) -> None:
        self._bundles = bundle_versions
        self._idx = 0
        self.calls = 0
        self.lock = threading.Lock()

    def __call__(self) -> DatasetBundleV3:
        with self.lock:
            self.calls += 1
            bundle = self._bundles[min(self._idx, len(self._bundles) - 1)]
            return bundle


def test_bundleless_medications_match_fetches_lazily() -> None:
    spy = _FetcherSpy([_bundle()])
    isa = Isa.with_bearer(
        "isa_test_token_xxxxxxxxxxxxxxxxxxxx",
        dataset_bundle_fetcher=spy,
    )

    assert spy.calls == 0, "fetcher must not be invoked before first match()"

    result = isa.zyins.medications.match("Insulin")
    assert result.kind is ConceptKind.MEDICATION
    assert result.id == "INSULIN"
    assert spy.calls == 1


def test_bundleless_conditions_match_fetches_lazily() -> None:
    spy = _FetcherSpy([_bundle()])
    isa = Isa.with_bearer(
        "isa_test_token_xxxxxxxxxxxxxxxxxxxx",
        dataset_bundle_fetcher=spy,
    )

    result = isa.zyins.conditions.match("Diabetes")
    assert result.kind is ConceptKind.CONDITION
    assert result.id == "DIABETES"


def test_bundleless_concepts_match() -> None:
    spy = _FetcherSpy([_bundle()])
    isa = Isa.with_bearer(
        "isa_test_token_xxxxxxxxxxxxxxxxxxxx",
        dataset_bundle_fetcher=spy,
    )

    med = isa.zyins.concepts.match("Lisinopril")
    assert med.kind is ConceptKind.MEDICATION
    cond = isa.zyins.concepts.match("HIGHBLOODPRESSURE")
    assert cond.kind is ConceptKind.CONDITION
    unknown = isa.zyins.concepts.match("not in catalog")
    assert unknown.kind is ConceptKind.UNKNOWN


def test_bundleless_match_caches_across_calls() -> None:
    """Same dataset version → the fetcher is hit exactly once."""
    spy = _FetcherSpy([_bundle(version="v1")])
    isa = Isa.with_bearer(
        "isa_test_token_xxxxxxxxxxxxxxxxxxxx",
        dataset_bundle_fetcher=spy,
    )

    isa.zyins.medications.match("Insulin")
    isa.zyins.conditions.match("Diabetes")
    isa.zyins.concepts.match("Lisinopril")
    isa.zyins.medications.match("Insulin")

    assert spy.calls == 1, "the bundle must be cached across kinds + repeats"


def test_bundleless_match_invalidates_on_version_change() -> None:
    """Once ``set_dataset_bundle`` is called with a new version, the
    facade rebuilds the index — mirrors the TS ``ReferenceBundleCache``
    behavior."""
    spy = _FetcherSpy([_bundle(version="v1")])
    isa = Isa.with_bearer(
        "isa_test_token_xxxxxxxxxxxxxxxxxxxx",
        dataset_bundle_fetcher=spy,
    )

    first = isa.zyins.medications.match("Insulin")
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

    second = isa.zyins.medications.match("Insulin")
    assert second.name == "Insulin Glargine"


def test_bundleless_match_without_fetcher_raises() -> None:
    """No fetcher and no pre-warmed bundle → IsaConfigError with recipe."""
    isa = Isa.with_bearer("isa_test_token_xxxxxxxxxxxxxxxxxxxx")
    with pytest.raises(IsaConfigError) as exc_info:
        isa.zyins.medications.match("Insulin")
    msg = str(exc_info.value)
    assert "set_dataset_bundle" in msg
    assert "dataset_bundle_fetcher" in msg


def test_bundleless_match_pre_warm_skips_fetcher() -> None:
    """``set_dataset_bundle`` before first match() must skip the fetcher."""
    spy = _FetcherSpy([_bundle()])
    isa = Isa.with_bearer(
        "isa_test_token_xxxxxxxxxxxxxxxxxxxx",
        dataset_bundle_fetcher=spy,
    )
    isa.zyins.set_dataset_bundle(_bundle())
    isa.zyins.medications.match("Insulin")
    assert spy.calls == 0


def test_bundleless_match_concurrent_first_call_fetches_once() -> None:
    """asyncio.Lock-style guarantee on a sync Lock — exactly one fetch."""
    spy = _FetcherSpy([_bundle()])
    isa = Isa.with_bearer(
        "isa_test_token_xxxxxxxxxxxxxxxxxxxx",
        dataset_bundle_fetcher=spy,
    )

    results: list[Any] = []

    def worker() -> None:
        results.append(isa.zyins.medications.match("Insulin"))

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert spy.calls == 1, "the dataset_bundle_fetcher must be called exactly once"
    assert len(results) == 8
    assert all(r.id == "INSULIN" for r in results)


# ---------------------------------------------------------------------------
# cases.save / cases.recall — through an injected CaseStorage adapter.
# ---------------------------------------------------------------------------


class _InMemoryCaseStorage:
    """Test adapter — round-trips records through an in-memory dict.

    Satisfies the :class:`CaseStorage` Protocol structurally. Used to
    pin the locked save/recall contract without depending on the
    not-yet-merged ``ZeroKnowledgeCaseStorage`` default from PR #365.
    """

    def __init__(self) -> None:
        self._store: dict[str, tuple[CaseRecord, str]] = {}
        self.put_calls = 0
        self.get_calls = 0

    def put(self, record: CaseRecord) -> PutResult:
        self.put_calls += 1
        id_ = uuid.uuid4().hex
        token = uuid.uuid4().hex
        self._store[id_] = (record, token)
        return PutResult(id=id_, recall_token=token)

    def get(self, id: str, recall_token: str | None = None) -> CaseRecord | None:
        self.get_calls += 1
        hit = self._store.get(id)
        if hit is None:
            return None
        record, token = hit
        if recall_token != token:
            return None
        return record


def test_cases_save_round_trips_through_storage() -> None:
    storage = _InMemoryCaseStorage()
    isa = Isa.with_bearer(
        "isa_test_token_xxxxxxxxxxxxxxxxxxxx",
        case_storage=storage,
    )

    record = CaseRecord(product="zyins", payload={"input": "<xml/>"})
    result = isa.zyins.cases.save(record)

    assert isinstance(result, PutResult)
    assert result.id
    assert result.recall_token is not None
    assert storage.put_calls == 1

    recalled = isa.zyins.cases.recall(result.id, result.recall_token)
    assert recalled == record
    assert storage.get_calls == 1


def test_cases_recall_returns_none_for_unknown_id() -> None:
    storage = _InMemoryCaseStorage()
    isa = Isa.with_bearer(
        "isa_test_token_xxxxxxxxxxxxxxxxxxxx",
        case_storage=storage,
    )

    assert isa.zyins.cases.recall("never-existed", "no-token") is None


def test_cases_recall_returns_none_on_wrong_token() -> None:
    storage = _InMemoryCaseStorage()
    isa = Isa.with_bearer(
        "isa_test_token_xxxxxxxxxxxxxxxxxxxx",
        case_storage=storage,
    )

    saved = isa.zyins.cases.save(CaseRecord(product="zyins", payload={"x": 1}))
    assert isa.zyins.cases.recall(saved.id, "wrong-token") is None


def test_cases_save_without_storage_defaults_to_zero_knowledge() -> None:
    """No ``case_storage=`` → adapter defaults to ZeroKnowledgeCaseStorage.

    Per the locked SDK syntax (PR #365), the default adapter is
    :class:`ZeroKnowledgeCaseStorage`. It encrypts payloads client-side
    and posts opaque ciphertext on the wire — so a ``save`` call
    without explicit ``case_storage=`` does not raise; it routes
    through the default. Validating its put-call below would require a
    wire transport, which is out of scope for this unit test — here we
    only assert the default-resolution path resolves.
    """
    from sah_sdk.zyins.cases.zero_knowledge import ZeroKnowledgeCaseStorage

    isa = Isa.with_bearer("isa_test_token_xxxxxxxxxxxxxxxxxxxx")
    resolved = isa.zyins._require_case_storage()
    assert isinstance(resolved, ZeroKnowledgeCaseStorage)


def test_cases_facade_forwards_legacy_verbs() -> None:
    """``isa.zyins.cases.share`` / ``.email`` continue to reach the
    underlying ``ZyInsClient.cases`` sub-client."""
    isa = Isa.with_bearer("isa_test_token_xxxxxxxxxxxxxxxxxxxx")
    cases = isa.zyins.cases
    assert isinstance(cases, CasesFacade)
    # The forwarded attribute is the bound method on ZyInsClient.cases.
    assert callable(getattr(cases, "share", None))
    assert callable(getattr(cases, "email", None))


def test_case_storage_runtime_checkable() -> None:
    """The ``CaseStorage`` Protocol is :func:`runtime_checkable` —
    duck-typed adapters satisfy ``isinstance``."""
    assert isinstance(_InMemoryCaseStorage(), CaseStorage)


def test_with_keycode_passes_case_storage_and_fetcher() -> None:
    """The kwarg propagates through ``with_keycode`` / ``with_license``."""
    storage = _InMemoryCaseStorage()
    spy = _FetcherSpy([_bundle()])
    isa = Isa.with_keycode(
        "SDV-HWH-WDD",
        "john.doe@acme-agency.com",
        case_storage=storage,
        dataset_bundle_fetcher=spy,
    )

    saved = isa.zyins.cases.save(CaseRecord(product="zyins", payload={"a": 1}))
    assert saved.id
    result = isa.zyins.medications.match("Insulin")
    assert result.id == "INSULIN"
