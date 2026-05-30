"""``MatchAlgorithm`` adapter — free text to a single :class:`Concept`.

Mirror of ``packages/ts/src/zyins/reference/MatchAlgorithm.ts``. The
adapter exposes the ``smart_cmp`` semantics (normalize via
``_make_key`` then exact key lookup) as a swappable Protocol so
consumers can:

  * wholesale-replace it with a custom algorithm (e.g. fuzzy match), or
  * decorate :class:`DefaultMatchAlgorithm` via ``.clone(...)``, or
  * compose multiple matchers in a wrapper.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Any, Protocol, runtime_checkable

from ._make_key import _make_key
from .concept import Concept, ConceptKind


@runtime_checkable
class MatchAlgorithm(Protocol):
    """Protocol — resolve free text against a candidate set.

    Implementations MUST be side-effect-free and MUST NOT raise. On a
    miss they MUST return an unknown :class:`Concept` (kind
    ``UNKNOWN``, ``is_known=False``).
    """

    def match(self, query: str, candidates: Sequence[Concept]) -> Concept:
        """Return the matching concept or an unknown handle."""
        ...


@dataclass(frozen=True, slots=True)
class _MatchAlgorithmConfig:
    version_tag: str | None = None


class DefaultMatchAlgorithm:
    """Reference implementation — uppercase + ASCII-alphanumeric strip + exact lookup.

    Mirrors Go ``MakeKey`` and the TS ``smart_cmp`` semantics. Candidate
    ids are opaque, so lookup compares normalized display names rather
    than deriving meaning from the id.
    """

    __slots__ = ("_config",)

    _config: _MatchAlgorithmConfig

    def __init__(self, *, version_tag: str | None = None) -> None:
        self._config = _MatchAlgorithmConfig(version_tag=version_tag)

    @property
    def version_tag(self) -> str | None:
        """Opaque dataset-version tag, or ``None`` when unspecified."""
        return self._config.version_tag

    def clone(self, **overrides: Any) -> DefaultMatchAlgorithm:
        """Return a fresh instance with selected fields overridden.

        >>> m = DefaultMatchAlgorithm()
        >>> m.clone(version_tag='2026.05.29').version_tag
        '2026.05.29'
        """
        new_config = replace(self._config, **overrides)
        return DefaultMatchAlgorithm(version_tag=new_config.version_tag)

    def match(self, query: str, candidates: Sequence[Concept]) -> Concept:
        """Resolve ``query`` against ``candidates``. Never raises.

        On a miss returns an unknown :class:`Concept` preserving
        ``input_text=query``.
        """
        key = _make_key(query)
        if not key:
            return _unknown(query)
        for candidate in candidates:
            if _make_key(candidate.name) == key:
                # Re-stamp ``input_text`` so the returned concept
                # carries the raw query, matching the locked surface
                # contract on ``Concept.input_text``.
                return Concept(
                    id=candidate.id,
                    name=candidate.name,
                    kind=candidate.kind,
                    is_known=True,
                    input_text=query,
                    _index=candidate._index,
                )
        return _unknown(query)


def _unknown(query: str) -> Concept:
    return Concept(
        id=None,
        name=query,
        kind=ConceptKind.UNKNOWN,
        is_known=False,
        input_text=query,
        _index=None,
    )


__all__ = [
    "DefaultMatchAlgorithm",
    "MatchAlgorithm",
]
