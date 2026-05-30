"""``ReferenceIndex`` — text→id lookup wrapped around a v3 dataset bundle.

The reference namespace materializes a single :class:`ReferenceIndex`
per :class:`~sah_sdk.zyins.datasets_v3.DatasetBundleV3`. The index owns:

* The forward id→name maps for medications and conditions.
* The id-keyed ``medications_by_condition`` map (pass-through from the
  server) and a derived ``conditions_by_medication`` reverse map built
  once at construction.
* The ``frequency_graphs.use_map`` for ``Sort.MOST_COMMON_FIRST``
  ordering.

Lookups go through :func:`_make_key` once per :func:`match` call and hit
the id-keyed maps directly. No client-side key normalization is layered
on top of the server's contract.

Per the locked design, the index is built lazily from a cached
``datasets.get()`` response and rebuilt when the bundle's ``version``
changes. The :class:`ReferenceFacade` owns the cache; this module
exposes the data structure.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from types import MappingProxyType

from ..datasets_v3 import DatasetBundleV3
from ._make_key import _make_key
from .concept import Concept, ConceptKind
from .sort import Sort


@dataclass(frozen=True, slots=True)
class ReferenceIndex:
    """Read-only text→id index over a :class:`DatasetBundleV3`.

    Built once per dataset version via :meth:`from_bundle`. Holds the
    handful of maps the :func:`match` / symmetric traversal accessors
    need, all derived from the server's id-keyed v3 shape with zero
    re-normalization.
    """

    version: str
    condition_names: Mapping[str, str]
    medication_names: Mapping[str, str]
    medications_by_condition: Mapping[str, Sequence[str]]
    conditions_by_medication: Mapping[str, Sequence[str]]
    use_map: Mapping[str, Mapping[str, int]]
    # Pre-built sorted id tuples for the ``.list()`` accessors so the
    # sugar does not pay a sort cost per call.
    _condition_ids_alpha: tuple[str, ...] = field(repr=False, compare=False)
    _medication_ids_alpha: tuple[str, ...] = field(repr=False, compare=False)

    # ------------------------------------------------------------------
    # Construction.
    # ------------------------------------------------------------------

    @classmethod
    def from_bundle(cls, bundle: DatasetBundleV3) -> ReferenceIndex:
        """Build a :class:`ReferenceIndex` from a :class:`DatasetBundleV3`.

        O(N) over the bundle's entity lists plus O(M) over the
        ``medications_by_condition`` cross-product to build the reverse
        map. The bundle is consumed read-only; no mutation occurs.
        """
        condition_names = {e.id: e.name for e in bundle.conditions}
        medication_names = {e.id: e.name for e in bundle.medications}

        conditions_by_medication: dict[str, list[str]] = {}
        for condition_id, med_ids in bundle.medications_by_condition.items():
            for med_id in med_ids:
                conditions_by_medication.setdefault(med_id, []).append(condition_id)

        # Sorted display-order tuples for ``.list()``. Sorting once at
        # build time keeps the consumer accessor allocation-free apart
        # from the wrapping tuple.
        condition_ids_alpha = tuple(
            sorted(condition_names, key=lambda i: condition_names[i].lower())
        )
        medication_ids_alpha = tuple(
            sorted(medication_names, key=lambda i: medication_names[i].lower())
        )

        return cls(
            version=bundle.version,
            condition_names=MappingProxyType(condition_names),
            medication_names=MappingProxyType(medication_names),
            medications_by_condition=bundle.medications_by_condition,
            conditions_by_medication=MappingProxyType(
                {k: tuple(v) for k, v in conditions_by_medication.items()}
            ),
            use_map=bundle.frequency_graphs.use_map,
            _condition_ids_alpha=condition_ids_alpha,
            _medication_ids_alpha=medication_ids_alpha,
        )

    # ------------------------------------------------------------------
    # Lookup.
    # ------------------------------------------------------------------

    def lookup_medication(self, text: str) -> str | None:
        """Resolve free text to a medication id, or ``None`` on miss."""
        key = _make_key(text)
        if not key:
            return None
        return key if key in self.medication_names else None

    def lookup_condition(self, text: str) -> str | None:
        """Resolve free text to a condition id, or ``None`` on miss."""
        key = _make_key(text)
        if not key:
            return None
        return key if key in self.condition_names else None

    def lookup_either(self, text: str) -> tuple[ConceptKind, str] | None:
        """Resolve free text against conditions first, then medications.

        Mirrors the TS ``matchConcept`` precedence: conditions first
        (the typical "the user typed a symptom" case), then medications.
        Returns ``None`` on a miss in both catalogs.
        """
        key = _make_key(text)
        if not key:
            return None
        if key in self.condition_names:
            return ConceptKind.CONDITION, key
        if key in self.medication_names:
            return ConceptKind.MEDICATION, key
        return None

    def medication_name(self, entity_id: str) -> str | None:
        return self.medication_names.get(entity_id)

    def condition_name(self, entity_id: str) -> str | None:
        return self.condition_names.get(entity_id)

    # ------------------------------------------------------------------
    # Symmetric traversal — used by Concept.conditions / .medications.
    # ------------------------------------------------------------------

    def conditions_for_medication(
        self, medication_id: str, input_text: str, sort: Sort
    ) -> tuple[Concept, ...]:
        """Conditions a given medication participates in, ordered by ``sort``."""
        ids = self.conditions_by_medication.get(medication_id, ())
        ordered = self._sort_ids(
            ids,
            sort=sort,
            name_of=self.condition_name,
            frequency_of=lambda cid: self._frequency(medication_id, cid),
        )
        return tuple(
            self._build_condition_concept(cid, input_text) for cid in ordered
        )

    def medications_for_condition(
        self, condition_id: str, input_text: str, sort: Sort
    ) -> tuple[Concept, ...]:
        """Medications associated with a given condition, ordered by ``sort``."""
        ids = self.medications_by_condition.get(condition_id, ())
        ordered = self._sort_ids(
            ids,
            sort=sort,
            name_of=self.medication_name,
            frequency_of=lambda mid: self._frequency(mid, condition_id),
        )
        return tuple(
            self._build_medication_concept(mid, input_text) for mid in ordered
        )

    # ------------------------------------------------------------------
    # ``.list()`` sugar.
    # ------------------------------------------------------------------

    def all_medication_concepts(self) -> tuple[Concept, ...]:
        return tuple(
            self._build_medication_concept(mid, self.medication_names[mid])
            for mid in self._medication_ids_alpha
        )

    def all_condition_concepts(self) -> tuple[Concept, ...]:
        return tuple(
            self._build_condition_concept(cid, self.condition_names[cid])
            for cid in self._condition_ids_alpha
        )

    # ------------------------------------------------------------------
    # Concept construction (private — public path is :func:`match`).
    # ------------------------------------------------------------------

    def build_medication_concept(self, entity_id: str, input_text: str) -> Concept:
        return self._build_medication_concept(entity_id, input_text)

    def build_condition_concept(self, entity_id: str, input_text: str) -> Concept:
        return self._build_condition_concept(entity_id, input_text)

    def build_unknown_concept(self, input_text: str) -> Concept:
        return Concept(
            id=None,
            name=input_text,
            kind=ConceptKind.UNKNOWN,
            is_known=False,
            input_text=input_text,
            _index=None,
        )

    # ------------------------------------------------------------------
    # Internals.
    # ------------------------------------------------------------------

    def _frequency(self, medication_id: str, condition_id: str) -> int:
        row = self.use_map.get(condition_id)
        if row is None:
            return 0
        return row.get(medication_id, 0)

    def _build_medication_concept(self, entity_id: str, input_text: str) -> Concept:
        return Concept(
            id=entity_id,
            name=self.medication_names.get(entity_id, input_text),
            kind=ConceptKind.MEDICATION,
            is_known=True,
            input_text=input_text,
            _index=self,
        )

    def _build_condition_concept(self, entity_id: str, input_text: str) -> Concept:
        return Concept(
            id=entity_id,
            name=self.condition_names.get(entity_id, input_text),
            kind=ConceptKind.CONDITION,
            is_known=True,
            input_text=input_text,
            _index=self,
        )

    @staticmethod
    def _sort_ids(
        ids: Sequence[str],
        *,
        sort: Sort,
        name_of: Callable[[str], str | None],
        frequency_of: Callable[[str], int],
    ) -> tuple[str, ...]:
        # Stable sort: ties preserve input order (the server's display
        # order). For frequency, sort descending; for name, ascending
        # case-insensitive.
        indexed = list(enumerate(ids))
        if sort is Sort.ALPHABETICAL:
            indexed.sort(
                key=lambda pair: ((name_of(pair[1]) or pair[1]).lower(), pair[0])
            )
        else:
            indexed.sort(key=lambda pair: (-frequency_of(pair[1]), pair[0]))
        return tuple(pair[1] for pair in indexed)


__all__ = ["ReferenceIndex"]
