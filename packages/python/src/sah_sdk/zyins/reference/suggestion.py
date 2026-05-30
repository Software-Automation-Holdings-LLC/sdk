"""``Suggestion`` — a ranked :class:`Concept` returned by autocomplete.

Mirror of ``packages/ts/src/zyins/reference/Suggestion.ts``. A
:class:`Suggestion` extends the :class:`Concept` shape with three
ranking-specific fields populated by the
:class:`~sah_sdk.zyins.reference.autocomplete_algorithm.AutocompleteAlgorithm`
that produced it.

Construction is reserved for autocomplete algorithms; consumers
receive :class:`Suggestion` instances from the algorithm and read
their fields.
"""

from __future__ import annotations

from dataclasses import dataclass

from .concept import Concept, ConceptKind


@dataclass(frozen=True, slots=True)
class Suggestion:
    """Ranked concept handle returned by autocomplete.

    Fields
    ------
    concept
        The underlying :class:`Concept` handle. Carries the opaque
        ``id``, display ``name``, ``kind`` discriminator, ``is_known``
        flag, ``input_text``, and any bound reference index.
    score
        The numerical score produced by the ranking algorithm. Higher
        is better. The absolute magnitude is algorithm-specific; only
        ordering is portable.
    matched_span
        The span of ``concept.input_text`` (as ``(start, end)`` byte
        offsets, half-open) that triggered the match. ``(0, 0)`` when
        the algorithm cannot localize a span.
    rank
        The zero-indexed position of this suggestion within the
        algorithm's returned list, after sorting. Stable across
        equal-score ties.
    """

    concept: Concept
    score: float
    matched_span: tuple[int, int]
    rank: int

    # ------------------------------------------------------------------
    # Pass-through accessors so call sites don't reach into ``.concept``
    # for the common fields. Mirrors the TS ``Suggestion`` shape which
    # composes via interface extension rather than nesting.
    # ------------------------------------------------------------------

    @property
    def id(self) -> str | None:
        return self.concept.id

    @property
    def name(self) -> str:
        return self.concept.name

    @property
    def kind(self) -> ConceptKind:
        return self.concept.kind

    @property
    def is_known(self) -> bool:
        return self.concept.is_known

    @property
    def input_text(self) -> str:
        return self.concept.input_text


__all__ = ["Suggestion"]
