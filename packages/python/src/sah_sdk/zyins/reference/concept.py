"""``Concept`` handles returned by :func:`match`.

Mirror of ``packages/ts/src/zyins/reference.ts``. A :class:`Concept`
carries the opaque entity id, the display name, the discriminator
:class:`ConceptKind`, the ``is_known`` flag, and the verbatim
``input_text`` passed to :func:`match`. Symmetric accessors
``conditions(sort)`` and ``medications(sort)`` traverse the v3 id-keyed
maps via a bound :class:`~sah_sdk.zyins.reference.index.ReferenceIndex`
— never via client-side key derivation.

Construction is intentionally private. Consumers always receive a
:class:`Concept` from :func:`sah_sdk.zyins.reference.match` or one of
the bound matchers; they never instantiate one directly. The frozen
dataclass and unrelated typing protocol keep the public surface a
shape, not an API the consumer is supposed to subclass.

``MedicationConcept`` and ``ConditionConcept`` are
:func:`typing.runtime_checkable` protocols that narrow ``kind``. They
exist so static checkers can distinguish the two without forcing
consumers into a class hierarchy.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Protocol, runtime_checkable

from .sort import Sort

if TYPE_CHECKING:
    from .index import ReferenceIndex
    from .reference_index import ReferenceIndex as AdapterReferenceIndex


class ConceptKind(str, Enum):
    """Discriminator on a :class:`Concept` handle."""

    MEDICATION = "medication"
    CONDITION = "condition"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class Concept:
    """Handle returned by :func:`sah_sdk.zyins.reference.match`.

    ``id`` is opaque (today: server-side ``MakeKey`` form). ``name`` is
    the display string. ``input_text`` preserves the caller's raw input
    verbatim — including for unknowns, where ``name`` falls back to
    ``input_text`` so a UI always has something to render.

    The match-never-rejects invariant: an unknown entity returns a
    :class:`Concept` with ``kind=ConceptKind.UNKNOWN``, ``is_known=False``,
    ``id=None``, and accessors that return ``()``. Unknowns are signals
    to the downstream system, not errors.
    """

    id: str | None
    name: str
    kind: ConceptKind
    is_known: bool
    input_text: str
    # Bound index, private — consumers never inspect it. ``compare=False``
    # because equality is contractually shape-based: ``id`` + ``kind``
    # determine identity, not the bundle the handle was built from.
    _index: ReferenceIndex | AdapterReferenceIndex | None = field(
        default=None, repr=False, compare=False
    )

    # ------------------------------------------------------------------
    # Symmetric traversal accessors.
    # ------------------------------------------------------------------

    def conditions(self, sort: Sort = Sort.MOST_COMMON_FIRST) -> tuple[Concept, ...]:
        """Conditions associated with this concept.

        Defined for medication handles. Condition and unknown handles
        return an empty tuple. Sort defaults to
        :attr:`Sort.MOST_COMMON_FIRST`.
        """
        if (
            self.kind is not ConceptKind.MEDICATION
            or self._index is None
            or self.id is None
        ):
            return ()
        return self._index.conditions_for_medication(self.id, self.input_text, sort)

    def medications(self, sort: Sort = Sort.MOST_COMMON_FIRST) -> tuple[Concept, ...]:
        """Medications associated with this concept.

        Defined for condition handles. Medication and unknown handles
        return an empty tuple. Sort defaults to
        :attr:`Sort.MOST_COMMON_FIRST`.
        """
        if (
            self.kind is not ConceptKind.CONDITION
            or self._index is None
            or self.id is None
        ):
            return ()
        return self._index.medications_for_condition(self.id, self.input_text, sort)

    # ------------------------------------------------------------------
    # Tier 3 sugar.
    # ------------------------------------------------------------------

    def equals(self, other: object) -> bool:
        """Identity-by-shape comparison.

        Two concepts are equal iff they share both ``kind`` and ``id``.
        ``input_text`` is intentionally ignored — callers expect
        ``match("INSULIN").equals(match("insulin"))`` to be ``True``.
        Unknown handles are equal only when ``input_text`` matches
        because there is no ``id`` to compare on.
        """
        if not isinstance(other, Concept):
            return False
        if self.kind != other.kind:
            return False
        if self.kind is ConceptKind.UNKNOWN:
            return self.input_text == other.input_text
        return self.id == other.id


@runtime_checkable
class MedicationConcept(Protocol):
    """A :class:`Concept` whose ``kind`` is statically ``MEDICATION``.

    Runtime-checkable so consumers can write
    ``isinstance(concept, MedicationConcept)`` for narrowing. Mirrors
    the TS ``MedicationConcept`` interface.
    """

    id: str | None
    name: str
    kind: ConceptKind
    is_known: bool
    input_text: str

    def conditions(self, sort: Sort = ...) -> Sequence[Concept]: ...
    def medications(self, sort: Sort = ...) -> Sequence[Concept]: ...
    def equals(self, other: object) -> bool: ...


@runtime_checkable
class ConditionConcept(Protocol):
    """A :class:`Concept` whose ``kind`` is statically ``CONDITION``.

    Runtime-checkable so consumers can write
    ``isinstance(concept, ConditionConcept)`` for narrowing. Mirrors
    the TS ``ConditionConcept`` interface.
    """

    id: str | None
    name: str
    kind: ConceptKind
    is_known: bool
    input_text: str

    def conditions(self, sort: Sort = ...) -> Sequence[Concept]: ...
    def medications(self, sort: Sort = ...) -> Sequence[Concept]: ...
    def equals(self, other: object) -> bool: ...


__all__ = [
    "Concept",
    "ConceptKind",
    "ConditionConcept",
    "MedicationConcept",
]
