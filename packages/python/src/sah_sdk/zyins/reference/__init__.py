"""``sah_sdk.zyins.reference`` — typed reference catalog access.

Locked-design public surface per the v3-freeze plan and
``docs/sdk-syntax-proposal.md`` §reference. Mirror of
``packages/ts/src/zyins/reference.ts``; the same shape ships in every
language with PEP 8 snake_case naming on the Python side.

Symbols
-------

The package re-exports its core symbols at the top level so consumers
write::

    from sah_sdk.zyins.reference import match, Sort, Concept

* :class:`Concept`, :class:`MedicationConcept`, :class:`ConditionConcept`
  — concept handles (a frozen dataclass + two runtime-checkable
  Protocols for static narrowing).
* :class:`ConceptKind` — discriminator enum.
* :class:`Sort` — namespaced sort orders for symmetric accessors.
* :func:`match` — bundle-bound entry point. Never raises; unknown text
  returns a :class:`Concept` with ``is_known=False``.
* :class:`ReferenceFacade` — the object wired into
  ``Isa.zyins.reference`` (and shortcuts at ``Isa.zyins.medications`` /
  ``Isa.zyins.conditions``). Holds a cached
  :class:`~sah_sdk.zyins.reference.index.ReferenceIndex`, rebuilt
  whenever the underlying :class:`DatasetBundleV3` ``version`` changes.

Invariants
----------

* :func:`_make_key` is INTERNAL. The lookup path is
  ``free text -> _make_key -> id-keyed map``; consumers never compute
  keys themselves. The conformance corpus pokes at it through the
  explicit ``_internal`` escape hatch.
* :func:`match` and the bound matchers never raise. Unknown text
  returns a handle with ``is_known=False``, accessors return ``()``, and
  ``input_text`` preserves the original string. Unknowns are signals
  to the downstream system, not errors.
* Lookups use the server's id-keyed maps verbatim. The SDK does not
  re-derive keys.
* Aliases are resolved server-side and intentionally NOT surfaced —
  consumers compare on ``id`` via :meth:`Concept.equals` instead.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import ClassVar

from ..datasets_v3 import DatasetBundleV3
from . import concept as _concept_module
from . import sort as _sort_module
from ._make_key import _make_key
from .autocomplete_algorithm import (
    AutocompleteAlgorithm,
    AutocompleteOptions,
    DefaultAutocompleteAlgorithm,
)
from .autocorrector import (
    AutocorrectAppliedEvent,
    AutocorrectMode,
    Autocorrector,
    DefaultAutocorrector,
)
from .autocorrector import create as autocorrector_create
from .concept import (
    Concept,
    ConceptKind,
    ConditionConcept,
    MedicationConcept,
)
from .index import ReferenceIndex
from .match_algorithm import DefaultMatchAlgorithm, MatchAlgorithm
from .reference_index import ReferenceIndex as AdapterReferenceIndex
from .sort import Sort
from .suggestion import Suggestion

# ---------------------------------------------------------------------------
# Bundle-bound match().
#
# The public ``match()`` entry point takes only ``text`` — the bundle is
# bound by the :class:`ReferenceFacade` (or by the bundle-bound matcher
# returned by :func:`bind`). This matches the locked TS signature where
# the bundle is implicit in the namespace.
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class _KindMatcher:
    """Matcher bound to a single :class:`ReferenceIndex` and entity kind.

    Wired onto ``Isa.zyins.medications`` / ``Isa.zyins.conditions`` as
    the locked shortcut surface. Exposes ``.match(text)`` /
    ``.match_many(texts)`` / ``.list()`` so consumers write
    ``isa.zyins.medications.match("hbp")`` without ever touching the
    bundle directly.

    ``_index_source`` is a zero-arg callable so the facade can rebuild
    the index when the dataset version changes without invalidating the
    matcher object itself.
    """

    _index_source: Callable[[], ReferenceIndex]
    _kind: ConceptKind

    def match(self, text: str) -> Concept:
        """Resolve free text against this kind's catalog. Never raises."""
        index = self._index_source()
        if self._kind is ConceptKind.MEDICATION:
            entity_id = index.lookup_medication(text)
            if entity_id is not None:
                return index.build_medication_concept(entity_id, text)
        elif self._kind is ConceptKind.CONDITION:
            entity_id = index.lookup_condition(text)
            if entity_id is not None:
                return index.build_condition_concept(entity_id, text)
        return index.build_unknown_concept(text)

    def match_many(self, texts: Sequence[str]) -> list[Concept]:
        """Resolve a batch of free-text inputs in order.

        Convenience over a list-comprehension on :meth:`match`; the
        index is fetched once for the whole batch so a dataset-version
        check does not pay per item.
        """
        index = self._index_source()
        matcher = _kind_matcher_for_index(self._kind, index)
        return [matcher(text) for text in texts]

    def list(self) -> list[Concept]:
        """Every known concept of this kind, sorted alphabetically.

        Built once at :class:`ReferenceIndex` construction; the call is
        a tuple-to-list copy.
        """
        index = self._index_source()
        if self._kind is ConceptKind.MEDICATION:
            return list(index.all_medication_concepts())
        if self._kind is ConceptKind.CONDITION:
            return list(index.all_condition_concepts())
        return []


@dataclass(frozen=True, slots=True)
class _ConceptMatcher:
    """Kind-agnostic matcher (``Isa.zyins.reference.concepts``)."""

    _index_source: Callable[[], ReferenceIndex]

    def match(self, text: str) -> Concept:
        index = self._index_source()
        hit = index.lookup_either(text)
        if hit is None:
            return index.build_unknown_concept(text)
        kind, entity_id = hit
        if kind is ConceptKind.MEDICATION:
            return index.build_medication_concept(entity_id, text)
        return index.build_condition_concept(entity_id, text)

    def match_many(self, texts: Sequence[str]) -> list[Concept]:
        index = self._index_source()
        return [self._match_with_index(index, text) for text in texts]

    @staticmethod
    def _match_with_index(index: ReferenceIndex, text: str) -> Concept:
        hit = index.lookup_either(text)
        if hit is None:
            return index.build_unknown_concept(text)
        kind, entity_id = hit
        if kind is ConceptKind.MEDICATION:
            return index.build_medication_concept(entity_id, text)
        return index.build_condition_concept(entity_id, text)


def _kind_matcher_for_index(
    kind: ConceptKind, index: ReferenceIndex
) -> Callable[[str], Concept]:
    """Closure over a fixed index — used by :meth:`_KindMatcher.match_many`."""
    if kind is ConceptKind.MEDICATION:

        def medication(text: str) -> Concept:
            entity_id = index.lookup_medication(text)
            if entity_id is None:
                return index.build_unknown_concept(text)
            return index.build_medication_concept(entity_id, text)

        return medication

    def condition(text: str) -> Concept:
        entity_id = index.lookup_condition(text)
        if entity_id is None:
            return index.build_unknown_concept(text)
        return index.build_condition_concept(entity_id, text)

    return condition


# ---------------------------------------------------------------------------
# Facade — owns the cached :class:`ReferenceIndex` and the kind shortcuts.
# ---------------------------------------------------------------------------


class ReferenceFacade:
    """``isa.zyins.reference`` — typed catalog access bound to a dataset source.

    The facade is constructed once per :class:`Isa` (or per
    :class:`ZyInsClient`) and holds a cached :class:`ReferenceIndex`
    keyed by the underlying :class:`DatasetBundleV3` ``version``. Each
    :meth:`match` call (and each call through the kind shortcuts)
    invokes the bundle source, compares the version, and rebuilds the
    index if it changed. This satisfies the locked invariant:

        Build text -> id index lazily from cached ``datasets.get()``,
        rebuild on dataset version change.

    The facade is intentionally call-driven, not background-refreshed:
    consumers control when bundles refresh by deciding when to call
    ``datasets.get()``. The facade only owns the derived index.
    """

    __slots__ = (
        "_bundle_source",
        "_index",
        "_indexed_version",
        "concepts",
        "conditions",
        "medications",
    )

    _bundle_source: Callable[[], DatasetBundleV3]
    _index: ReferenceIndex | None
    _indexed_version: str | None
    medications: _KindMatcher
    conditions: _KindMatcher
    concepts: _ConceptMatcher

    def __init__(self, bundle_source: Callable[[], DatasetBundleV3]) -> None:
        self._bundle_source = bundle_source
        self._index = None
        self._indexed_version = None
        self.medications = _KindMatcher(self._current_index, ConceptKind.MEDICATION)
        self.conditions = _KindMatcher(self._current_index, ConceptKind.CONDITION)
        self.concepts = _ConceptMatcher(self._current_index)

    # ------------------------------------------------------------------
    # match() — kind-agnostic. Delegates to ``concepts.match`` so the
    # version check runs in one place.
    # ------------------------------------------------------------------

    def match(self, text: str) -> Concept:
        """Resolve free text against the catalog. Never raises.

        Tries conditions first (the typical "the user typed a symptom"
        case), then medications. Returns an unknown handle on a miss.
        Mirrors :func:`packages/ts/src/zyins/reference.ts::matchConcept`.
        """
        return self.concepts.match(text)

    def match_many(self, texts: Sequence[str]) -> list[Concept]:
        """Resolve a batch of free-text inputs in order."""
        return self.concepts.match_many(texts)

    # ------------------------------------------------------------------
    # Internal — index caching.
    # ------------------------------------------------------------------

    def _current_index(self) -> ReferenceIndex:
        bundle = self._bundle_source()
        if self._index is None or self._indexed_version != bundle.version:
            self._index = ReferenceIndex.from_bundle(bundle)
            self._indexed_version = bundle.version
        return self._index


# ---------------------------------------------------------------------------
# Module-level convenience — bundle + text in one call.
# ---------------------------------------------------------------------------


def match(text: str, bundle: DatasetBundleV3) -> Concept:
    """Resolve free text against ``bundle`` without specifying a kind.

    Module-level entry point for consumers who already hold a
    :class:`DatasetBundleV3` and don't want to construct a
    :class:`ReferenceFacade`. Never raises.
    """
    index = ReferenceIndex.from_bundle(bundle)
    hit = index.lookup_either(text)
    if hit is None:
        return index.build_unknown_concept(text)
    kind, entity_id = hit
    if kind is ConceptKind.MEDICATION:
        return index.build_medication_concept(entity_id, text)
    return index.build_condition_concept(entity_id, text)


def match_medication(text: str, bundle: DatasetBundleV3) -> Concept:
    """Resolve free text against the medication catalog of ``bundle``."""
    index = ReferenceIndex.from_bundle(bundle)
    entity_id = index.lookup_medication(text)
    if entity_id is None:
        return index.build_unknown_concept(text)
    return index.build_medication_concept(entity_id, text)


def match_condition(text: str, bundle: DatasetBundleV3) -> Concept:
    """Resolve free text against the condition catalog of ``bundle``."""
    index = ReferenceIndex.from_bundle(bundle)
    entity_id = index.lookup_condition(text)
    if entity_id is None:
        return index.build_unknown_concept(text)
    return index.build_condition_concept(entity_id, text)


def bind(bundle: DatasetBundleV3) -> ReferenceFacade:
    """Build a :class:`ReferenceFacade` bound to a single ``bundle``.

    The facade still version-checks on every call, so passing a
    fresh-versioned bundle into a re-binding of the source rebuilds
    the index.
    """
    return ReferenceFacade(lambda: bundle)


# ---------------------------------------------------------------------------
# ``reference`` alias — supports the consumer-facing ``reference`` symbol
# documented in the locked sdk-syntax-proposal::
#
#     from sah_sdk.zyins.reference import reference
#     reference.match(text, bundle)
#
# Implemented as a tiny module-style namespace object so the
# import-as-namespace pattern works without forcing consumers to
# reach into ``sah_sdk.zyins.reference`` as a package vs a function.
# ---------------------------------------------------------------------------


class _ReferenceNamespace:
    """Module-style namespace exposing :func:`match`, :class:`Sort`, etc.

    Pure sugar so consumers can write ``reference.match(text, bundle)``
    without importing the function separately. The facade returned by
    :func:`bind` is the bundle-bound equivalent; this object is the
    bundle-free one. The class is never instantiated by consumers; the
    module-level :data:`reference` singleton is the only handle.

    The type re-exports are stored as :data:`ClassVar` references so
    static checkers see them as class attributes rather than instance
    fields — preventing accidental subclassing and per-instance
    shadowing.
    """

    Sort: ClassVar[type[_sort_module.Sort]] = _sort_module.Sort
    Concept: ClassVar[type[_concept_module.Concept]] = _concept_module.Concept
    ConceptKind: ClassVar[type[_concept_module.ConceptKind]] = _concept_module.ConceptKind
    # ``MedicationConcept`` / ``ConditionConcept`` are runtime-checkable
    # Protocols, not concrete classes. We expose them as ``type[Protocol]``
    # for ``isinstance`` narrowing on the consumer side; mypy's
    # ``[type-abstract]`` check is silenced because the Protocols are
    # intentionally non-instantiable.
    MedicationConcept: ClassVar[type[_concept_module.MedicationConcept]] = (
        _concept_module.MedicationConcept  # type: ignore[type-abstract]
    )
    ConditionConcept: ClassVar[type[_concept_module.ConditionConcept]] = (
        _concept_module.ConditionConcept  # type: ignore[type-abstract]
    )

    @staticmethod
    def match(text: str, bundle: DatasetBundleV3, /) -> _concept_module.Concept:
        return match(text, bundle)

    @staticmethod
    def match_medication(
        text: str, bundle: DatasetBundleV3, /
    ) -> _concept_module.Concept:
        return match_medication(text, bundle)

    @staticmethod
    def match_condition(
        text: str, bundle: DatasetBundleV3, /
    ) -> _concept_module.Concept:
        return match_condition(text, bundle)

    @staticmethod
    def bind(bundle: DatasetBundleV3, /) -> ReferenceFacade:
        return bind(bundle)


reference: _ReferenceNamespace = _ReferenceNamespace()


# ---------------------------------------------------------------------------
# Conformance escape hatch — exposes ``_make_key`` for the cross-language
# parity corpus. Not part of the public consumer surface; intentionally
# omitted from ``__all__``.
# ---------------------------------------------------------------------------


class _Internal:
    """Conformance escape hatch. Not part of the public surface."""

    make_key = staticmethod(_make_key)


_internal = _Internal()


__all__ = [
    "AdapterReferenceIndex",
    "AutocompleteAlgorithm",
    "AutocompleteOptions",
    "AutocorrectAppliedEvent",
    "AutocorrectMode",
    "Autocorrector",
    "Concept",
    "ConceptKind",
    "ConditionConcept",
    "DefaultAutocompleteAlgorithm",
    "DefaultAutocorrector",
    "DefaultMatchAlgorithm",
    "MatchAlgorithm",
    "MedicationConcept",
    "ReferenceFacade",
    "ReferenceIndex",
    "Sort",
    "Suggestion",
    "autocorrector_create",
    "bind",
    "match",
    "match_condition",
    "match_medication",
    "reference",
]
