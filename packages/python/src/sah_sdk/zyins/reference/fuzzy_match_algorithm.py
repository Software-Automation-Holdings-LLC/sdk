"""``FuzzyMatchAlgorithm`` — typo-tolerant text -> single Concept resolution.

Mirror of ``packages/ts/src/zyins/reference/FuzzyMatchAlgorithm.ts``. An
opt-in :class:`~sah_sdk.zyins.reference.match_algorithm.MatchAlgorithm`
that recovers misspellings the
:class:`~sah_sdk.zyins.reference.match_algorithm.DefaultMatchAlgorithm`
(exact ``_make_key`` + word-order-invariant ``_check_key``) cannot. The
default stays the default; construct this explicitly to opt in.

Pipeline — a tiered cascade, ranked by TIER FIRST, then by candidate
frequency (Algolia-style successive tie-break, NOT one blended score):

  1. exact      — ``_make_key`` id/name equality (identity-preserving)
  2. prefix     — candidate key starts with the query key (or vice versa)
  3. damerau    — OSA edit distance within a length-scaled band
                  (``sertaline`` -> ``sertraline``, ``chrons`` -> ``crohns``)
  4. phonetic   — Double Metaphone primary-code equality
                  (``tylonol`` -> ``tylenol``, both encode ``TLNL``)
  5. synonym    — alias equality, only if the Concept exposes ``aliases``
                  (today's :class:`Concept` does NOT — tier is skipped)

The first non-empty tier wins; within it the best candidate is chosen by
lowest edit distance, then frequency (higher first), then a deterministic
name/id tie-break so the result is reproducible across the language ports.

Parity-hardening rules (the cross-language determinism contract):
  1. Both query and every candidate string are NFC-normalized before any
     comparison.
  2. Lowercasing is locale-invariant (ASCII ``str.lower()``).
  3. When tier + edit distance + frequency are all equal, ties break by
     normalized candidate name, then ``id`` — stable, reproducible output.
  4. The Double Metaphone encoder is validated against the shared 102-term
     vector fixture reused by every port.

Synchronous, pure, dependency-free, and safe to share across concurrent
calls — the instance holds no mutable per-call state. Candidate metaphone
codes are pre-computed lazily per candidate-pool identity for speed.
"""

from __future__ import annotations

import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from ._damerau_osa import (
    fuzzy_threshold_for_length,
    optimal_string_alignment_distance,
)
from ._double_metaphone import double_metaphone
from ._make_key import _make_key
from .concept import Concept, ConceptKind

# Sentinel sorting last for ``null`` ids so the tie-break order is total.
# Mirrors the TS U+FFFF sentinel.
_ID_SENTINEL = "￿"
_EMPTY_FREQUENCIES: Mapping[str, int] = {}


@dataclass(frozen=True, slots=True)
class _ScoredCandidate:
    """A candidate with its edit distance, pre-tie-break."""

    concept: Concept
    distance: int


class FuzzyMatchAlgorithm:
    """Typo-tolerant matcher. Opt-in alternative to ``DefaultMatchAlgorithm``.

    >>> matcher = FuzzyMatchAlgorithm()
    >>> # matcher.match("sertaline", medications).id  -> "SERTRALINE"
    >>> # matcher.match("tylonol", medications).id     -> "TYLENOL"
    """

    __slots__ = ("_frequencies", "_metaphone_cache", "_version_tag")

    _frequencies: Mapping[str, int]
    _version_tag: str | None

    def __init__(
        self,
        *,
        frequencies: Mapping[str, int] | None = None,
        version_tag: str | None = None,
    ) -> None:
        self._frequencies = _EMPTY_FREQUENCIES if frequencies is None else frequencies
        self._version_tag = version_tag
        # Keyed by ``id(candidates)`` -> primary metaphone code per concept.
        # A plain dict (not a WeakValueDictionary) because the cached map
        # holds the candidate Concepts themselves; the cache is per-instance
        # and short-lived relative to the candidate pool.
        self._metaphone_cache: dict[int, dict[int, str]] = {}

    @property
    def version_tag(self) -> str | None:
        """Opaque tag tracking the version of this matcher / its frequency map."""
        return self._version_tag

    def clone(self, **overrides: Any) -> FuzzyMatchAlgorithm:
        """Return a new matcher with selected fields overridden.

        >>> FuzzyMatchAlgorithm().clone(version_tag="2026.06.02").version_tag
        '2026.06.02'
        """
        next_version_tag = overrides.get("version_tag", self._version_tag)
        next_frequencies = overrides.get("frequencies", self._frequencies)
        return FuzzyMatchAlgorithm(frequencies=next_frequencies, version_tag=next_version_tag)

    def match(self, query: str, candidates: Sequence[Concept]) -> Concept:
        """Resolve ``query`` against ``candidates``. Never raises.

        On a miss (empty key or every tier empty) returns an unknown
        :class:`Concept` preserving ``input_text=query``.
        """
        query_key = _make_key(query)
        if not query_key:
            return _unknown(query)

        tier = self._first_non_empty_tier(query, query_key, candidates)
        if tier is None:
            return _unknown(query)
        winner = self._best_in_tier(tier)
        return _resolved(winner, query) if winner is not None else _unknown(query)

    def _first_non_empty_tier(
        self, query: str, query_key: str, candidates: Sequence[Concept]
    ) -> list[_ScoredCandidate] | None:
        """Evaluate tiers in order; return the first with any hit, else ``None``."""
        exact = _collect_exact(query_key, candidates)
        if exact:
            return exact

        prefix = _collect_prefix(query_key, candidates)
        if prefix:
            return prefix

        damerau = _collect_damerau(query_key, candidates)
        if damerau:
            return damerau

        phonetic = self._collect_phonetic(query, candidates)
        if phonetic:
            return phonetic

        synonym = _collect_synonym(query, candidates)
        if synonym:
            return synonym

        return None

    def _best_in_tier(self, tier: Sequence[_ScoredCandidate]) -> Concept | None:
        """Pick the winner: lowest distance, then frequency, then name/id."""
        best: _ScoredCandidate | None = None
        for candidate in tier:
            if best is None or self._outranks(candidate, best):
                best = candidate
        return best.concept if best is not None else None

    def _outranks(self, a: _ScoredCandidate, b: _ScoredCandidate) -> bool:
        if a.distance != b.distance:
            return a.distance < b.distance
        a_freq = self._frequency_of(a.concept)
        b_freq = self._frequency_of(b.concept)
        if a_freq != b_freq:
            return a_freq > b_freq
        return _compare_for_tie_break(a.concept, b.concept) < 0

    def _frequency_of(self, concept: Concept) -> int:
        if concept.id is None:
            return 0
        return self._frequencies.get(concept.id, 0)

    def _collect_phonetic(
        self, query: str, candidates: Sequence[Concept]
    ) -> list[_ScoredCandidate]:
        query_code = double_metaphone(_normalize_for_compare(query)).primary
        if query_code == "":
            return []
        codes = self._candidate_codes(candidates)
        hits: list[_ScoredCandidate] = []
        for candidate in candidates:
            if codes.get(id(candidate)) == query_code:
                hits.append(_ScoredCandidate(concept=candidate, distance=0))
        return hits

    def _candidate_codes(self, candidates: Sequence[Concept]) -> dict[int, str]:
        """Lazily pre-compute (and cache) each candidate's primary code."""
        cache_key = id(candidates)
        cached = self._metaphone_cache.get(cache_key)
        if cached is not None:
            return cached
        codes: dict[int, str] = {}
        for candidate in candidates:
            codes[id(candidate)] = double_metaphone(_normalize_for_compare(candidate.name)).primary
        self._metaphone_cache[cache_key] = codes
        return codes


def _normalize_for_compare(text: str) -> str:
    """NFC-normalize, then locale-invariant lowercase (rules 1 + 2)."""
    return unicodedata.normalize("NFC", text).lower()


def _collect_exact(query_key: str, candidates: Sequence[Concept]) -> list[_ScoredCandidate]:
    hits: list[_ScoredCandidate] = []
    for candidate in candidates:
        if _make_key(candidate.name) == query_key:
            hits.append(_ScoredCandidate(concept=candidate, distance=0))
            continue
        if candidate.id is not None and _make_key(candidate.id) == query_key:
            hits.append(_ScoredCandidate(concept=candidate, distance=0))
    return hits


def _collect_prefix(query_key: str, candidates: Sequence[Concept]) -> list[_ScoredCandidate]:
    hits: list[_ScoredCandidate] = []
    for candidate in candidates:
        name_key = _make_key(candidate.name)
        if name_key == query_key:
            continue  # exact, not prefix
        if name_key.startswith(query_key) or query_key.startswith(name_key):
            hits.append(
                _ScoredCandidate(
                    concept=candidate,
                    distance=abs(len(name_key) - len(query_key)),
                )
            )
    return hits


def _collect_damerau(query_key: str, candidates: Sequence[Concept]) -> list[_ScoredCandidate]:
    threshold = fuzzy_threshold_for_length(len(query_key))
    hits: list[_ScoredCandidate] = []
    for candidate in candidates:
        name_key = _make_key(candidate.name)
        if name_key == "" or name_key == query_key:
            continue
        distance = optimal_string_alignment_distance(query_key, name_key, threshold)
        if distance <= threshold:
            hits.append(_ScoredCandidate(concept=candidate, distance=distance))
    return hits


def _collect_synonym(query: str, candidates: Sequence[Concept]) -> list[_ScoredCandidate]:
    """Alias tier. Inert until :class:`Concept` surfaces ``aliases``.

    Reads ``aliases`` defensively via ``getattr`` so the cross-language
    contract is one signature, not a future breaking change.
    """
    query_key = _make_key(query)
    hits: list[_ScoredCandidate] = []
    for candidate in candidates:
        aliases = getattr(candidate, "aliases", None)
        if aliases is None:
            continue
        if any(_make_key(alias) == query_key for alias in aliases):
            hits.append(_ScoredCandidate(concept=candidate, distance=0))
    return hits


def _compare_for_tie_break(a: Concept, b: Concept) -> int:
    """Rule 3: deterministic final tie-break by normalized name, then ``id``.

    ``None`` ids (never reached for known candidates) sort last so the
    order is total. Uses code-point ordering — NOT locale collation — so
    the comparison is locale-invariant and identical across the ports.
    """
    a_name = _normalize_for_compare(a.name)
    b_name = _normalize_for_compare(b.name)
    if a_name < b_name:
        return -1
    if a_name > b_name:
        return 1
    a_id = a.id if a.id is not None else _ID_SENTINEL
    b_id = b.id if b.id is not None else _ID_SENTINEL
    if a_id < b_id:
        return -1
    if a_id > b_id:
        return 1
    return 0


def _resolved(candidate: Concept, query: str) -> Concept:
    # Re-stamp ``input_text`` so the returned concept carries the raw
    # query, matching ``DefaultMatchAlgorithm`` and the locked surface
    # contract on ``Concept.input_text``.
    return Concept(
        id=candidate.id,
        name=candidate.name,
        kind=candidate.kind,
        is_known=True,
        input_text=query,
        _index=candidate._index,
    )


def _unknown(query: str) -> Concept:
    return Concept(
        id=None,
        name=query,
        kind=ConceptKind.UNKNOWN,
        is_known=False,
        input_text=query,
        _index=None,
    )


__all__ = ["FuzzyMatchAlgorithm"]
