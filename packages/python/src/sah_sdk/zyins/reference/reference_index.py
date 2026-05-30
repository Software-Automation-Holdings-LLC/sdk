"""``ReferenceIndex`` — inline-row-shape catalog index for the adapters.

Mirror of ``packages/ts/src/zyins/reference/referenceIndex.ts``. The
index materializes the catalog into the shapes the adapters actually
consume:

  * ``concepts`` — flat list of :class:`Concept` handles (id-keyed),
    pre-bound to this index so symmetric traversal works.
  * ``frequencies`` — aggregate ``concept_id -> prescription_count``
    map. For a condition, ``prescription_count`` is the sum of its
    ``treated_with`` counts (how often it's prescribed for); for a
    medication, the sum of its ``used_for`` counts.
  * ``typo_map`` — uppercase ``from -> to`` map built from inline
    ``spelling_corrections.items`` or legacy ``corrections.items``.

This module is the new entry point that the autocorrect / match /
autocomplete adapters consume. The legacy :mod:`sah_sdk.zyins.reference.index`
remains for the matcher facade until that path migrates.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field, replace
from types import MappingProxyType

from ..datasets_v3 import DatasetBundleV3
from .concept import Concept, ConceptKind
from .sort import Sort


@dataclass(frozen=True, slots=True)
class ReferenceIndex:
    """Adapter-facing read-only index over a :class:`DatasetBundleV3`.

    Built once per dataset version via :meth:`from_bundle`. Frozen +
    slotted so accidental mutation is impossible.
    """

    version: str
    concepts: Sequence[Concept]
    medications: Sequence[Concept]
    conditions: Sequence[Concept]
    frequencies: Mapping[str, int]
    typo_map: Mapping[str, str]
    medications_by_condition: Mapping[str, Sequence[str]]
    conditions_by_medication: Mapping[str, Sequence[str]]
    use_map: Mapping[str, Mapping[str, int]]
    # Reverse-lookup tables used by the facade for direct id resolution.
    _concept_by_id: Mapping[str, Concept] = field(repr=False, compare=False)

    def __post_init__(self) -> None:
        conditions = tuple(replace(c, _index=self) for c in self.conditions)
        medications = tuple(replace(c, _index=self) for c in self.medications)
        concepts = conditions + medications
        if not concepts and self.concepts:
            concepts = tuple(replace(c, _index=self) for c in self.concepts)
        concept_by_id = {c.id: c for c in concepts if c.id is not None}

        object.__setattr__(self, "concepts", concepts)
        object.__setattr__(self, "medications", medications)
        object.__setattr__(self, "conditions", conditions)
        object.__setattr__(self, "_concept_by_id", MappingProxyType(concept_by_id))

    @classmethod
    def from_bundle(cls, bundle: DatasetBundleV3) -> ReferenceIndex:
        """Build a :class:`ReferenceIndex` from an inline-row bundle.

        Falls back to the legacy maps-shape (``medications`` /
        ``conditions`` ReferenceEntity tuples + ``frequency_graphs``)
        when the inline rows are empty so the same code path handles
        pre- and post-cutover wire payloads.
        """
        conditions: list[Concept] = []
        medications: list[Concept] = []
        frequencies: dict[str, int] = {}

        if bundle.condition_rows:
            for row in bundle.condition_rows:
                conditions.append(
                    Concept(
                        id=row.id,
                        name=row.name,
                        kind=ConceptKind.CONDITION,
                        is_known=True,
                        input_text=row.name,
                        _index=None,
                    )
                )
                # Aggregate frequency: how often this condition was
                # observed (== sum of its prescribed-for rows).
                total = sum(rel.prescription_count for rel in row.treated_with)
                if total:
                    frequencies[row.id] = total
        else:
            for entity in bundle.conditions:
                conditions.append(
                    Concept(
                        id=entity.id,
                        name=entity.name,
                        kind=ConceptKind.CONDITION,
                        is_known=True,
                        input_text=entity.name,
                        _index=None,
                    )
                )

        if bundle.medication_rows:
            for med_row in bundle.medication_rows:
                medications.append(
                    Concept(
                        id=med_row.id,
                        name=med_row.name,
                        kind=ConceptKind.MEDICATION,
                        is_known=True,
                        input_text=med_row.name,
                        _index=None,
                    )
                )
                med_total = sum(rel.prescription_count for rel in med_row.used_for)
                if med_total:
                    frequencies[med_row.id] = frequencies.get(med_row.id, 0) + med_total
        else:
            for entity in bundle.medications:
                medications.append(
                    Concept(
                        id=entity.id,
                        name=entity.name,
                        kind=ConceptKind.MEDICATION,
                        is_known=True,
                        input_text=entity.name,
                        _index=None,
                    )
                )
            # Maps-shape fallback: derive aggregate frequencies from
            # ``use_map`` sums. Each condition's row sums med counts;
            # each med's count rolls up across conditions.
            for cond_id, freq_row in bundle.frequency_graphs.use_map.items():
                cond_total = 0
                for med_id, count in freq_row.items():
                    frequencies[med_id] = frequencies.get(med_id, 0) + count
                    cond_total += count
                if cond_total and not bundle.condition_rows:
                    frequencies[cond_id] = frequencies.get(cond_id, 0) + cond_total

        typo_map: dict[str, str] = {}
        for spl_row in bundle.spelling_corrections:
            typo_map[spl_row.from_.upper()] = spl_row.to.upper()
        if not typo_map:
            for correction in bundle.corrections:
                typo_map[correction.id.upper()] = correction.name.upper()

        conditions_by_medication: dict[str, list[str]] = {}
        for condition_id, med_ids in bundle.medications_by_condition.items():
            for med_id in med_ids:
                conditions_by_medication.setdefault(med_id, []).append(condition_id)

        index = cls(
            version=bundle.version,
            concepts=tuple(conditions) + tuple(medications),
            medications=tuple(medications),
            conditions=tuple(conditions),
            frequencies=MappingProxyType(frequencies),
            typo_map=MappingProxyType(typo_map),
            medications_by_condition=bundle.medications_by_condition,
            conditions_by_medication=MappingProxyType(
                {k: tuple(v) for k, v in conditions_by_medication.items()}
            ),
            use_map=bundle.frequency_graphs.use_map,
            _concept_by_id=MappingProxyType({}),
        )
        return index

    def concept_for_id(self, entity_id: str) -> Concept | None:
        """Return the :class:`Concept` for ``entity_id`` or ``None``."""
        return self._concept_by_id.get(entity_id)

    def conditions_for_medication(
        self, medication_id: str, input_text: str, sort: Sort
    ) -> tuple[Concept, ...]:
        ids = self.conditions_by_medication.get(medication_id, ())
        return tuple(
            replace(concept, input_text=input_text)
            for concept in self._ordered_concepts(ids, sort, medication_id)
            if concept.kind is ConceptKind.CONDITION
        )

    def medications_for_condition(
        self, condition_id: str, input_text: str, sort: Sort
    ) -> tuple[Concept, ...]:
        ids = self.medications_by_condition.get(condition_id, ())
        return tuple(
            replace(concept, input_text=input_text)
            for concept in self._ordered_concepts(ids, sort, condition_id)
            if concept.kind is ConceptKind.MEDICATION
        )

    def _ordered_concepts(
        self, entity_ids: Sequence[str], sort: Sort, anchor_id: str
    ) -> tuple[Concept, ...]:
        concepts = [self._concept_by_id[eid] for eid in entity_ids if eid in self._concept_by_id]
        if sort is Sort.ALPHABETICAL:
            concepts.sort(key=lambda c: c.name.lower())
        else:
            concepts.sort(key=lambda c: -self._frequency(anchor_id, c.id or ""))
        return tuple(concepts)

    def _frequency(self, anchor_id: str, entity_id: str) -> int:
        frequencies = self.use_map.get(anchor_id, {})
        if entity_id in frequencies:
            return frequencies[entity_id]
        return self.use_map.get(entity_id, {}).get(anchor_id, 0)


__all__ = ["ReferenceIndex"]
