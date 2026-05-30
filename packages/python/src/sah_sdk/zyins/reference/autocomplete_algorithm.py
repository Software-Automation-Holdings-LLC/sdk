"""``AutocompleteAlgorithm`` adapter — ranked :class:`Suggestion` list.

Mirror of ``packages/ts/src/zyins/reference/AutocompleteAlgorithm.ts``
and a semantic port of the bpp2.0 reference algorithm at
``src/sah-ui/Input/TextField/useAutocomplete.js`` (the worker body).

The default algorithm is the locked-spec **bucketed-frequency-boost**
algorithm:

  1. Tokenize the query and each candidate name on whitespace,
     uppercase, ASCII-alphanumeric strip.
  2. Categorize each candidate into one of six buckets, priority
     high-to-low:
       0. ``startsWith`` — option starts with the literal input;
          sub-sort by option word-count ascending.
       1. ``sameWords`` — identical word sets + same word count.
       2. ``independentWordIntersection`` — every input word appears in
          the option.
       3. ``wordCountNoTolerance[d]`` — option contains all input words
          + ``d`` extras; sub-sort by ``d`` ascending.
       4. ``sameNumWithTolerance`` — same word count, different sets.
       5. ``wordCountWithTolerance[d]`` — ``d`` words differ or are
          extra; sub-sort by ``d`` ascending.
  3. Within each bucket, apply the frequency boost:
       ``scale = max(1, total_groups - group_index)``
       ``score(option) = (frequency[id] + 1) * scale``
     Sort descending by score; ties alphabetical ascending. If no
     candidate has a frequency entry, skip the frequency sort and
     preserve insertion order.
  4. Flatten the buckets in priority order, de-dup by id, truncate to
     ``limit``.

The :meth:`rank` method is ``async`` so callers can swap in
implementations that hit the network (e.g. a server-side ranker)
without breaking the public surface. The default body is fully
synchronous.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field, replace
from typing import Any, Protocol, runtime_checkable

from .concept import Concept, ConceptKind
from .sort import Sort
from .suggestion import Suggestion

_WHITESPACE_RE = re.compile(r"\s+")
_NON_ALNUM_RE = re.compile(r"[^A-Z0-9]")


def _tokenize(text: str) -> list[str]:
    """Replicate the JS ``tokenizeString`` helper.

    Uppercase, split on whitespace, strip non-alphanumeric per token,
    drop empties.
    """
    upper = text.upper()
    parts = _WHITESPACE_RE.split(upper)
    out: list[str] = []
    for part in parts:
        cleaned = _NON_ALNUM_RE.sub("", part)
        if cleaned:
            out.append(cleaned)
    return out


@dataclass(frozen=True, slots=True)
class AutocompleteOptions:
    """Options for :meth:`AutocompleteAlgorithm.rank`.

    Fields
    ------
    limit
        Maximum number of :class:`Suggestion` results to return.
    kinds
        Tuple of :class:`ConceptKind` values to consider; candidates of
        other kinds are filtered out before ranking. Empty tuple ==
        "all kinds".
    frequencies
        Optional ``{concept_id: prescription_count}`` map driving the
        within-bucket frequency boost. ``None`` lets bound facades supply
        catalog frequencies; empty == "no frequency data; preserve
        insertion order within each bucket."
    starts_with_only
        If ``True``, only candidates whose name starts with the
        literal input are considered. Mirrors the
        ``autocompleteFromStartOnly`` flag on the JS hook.
    sort
        Result ordering. :attr:`Sort.MOST_COMMON_FIRST` (default) keeps
        the bucketed relevance + frequency-boost order.
        :attr:`Sort.ALPHABETICAL` keeps the same relevance FILTER — only
        matching candidates are returned — but emits them in a flat
        case-insensitive A→Z order by display name, for an A-Z toggle in
        a narrowing UI.
    """

    limit: int = 25
    kinds: Sequence[ConceptKind] = field(default_factory=tuple)
    frequencies: Mapping[str, int] | None = None
    starts_with_only: bool = False
    sort: Sort = Sort.MOST_COMMON_FIRST


@runtime_checkable
class AutocompleteAlgorithm(Protocol):
    """Protocol — rank candidates against a free-text query.

    Implementations MUST be side-effect-free. ``async def`` so
    swappable network-backed implementations are first-class.
    """

    async def rank(
        self,
        query: str,
        candidates: Sequence[Concept],
        options: AutocompleteOptions,
    ) -> list[Suggestion]:
        """Return up to ``options.limit`` suggestions ranked best-first."""
        ...


@dataclass(frozen=True, slots=True)
class _AutocompleteConfig:
    version_tag: str | None = None


class DefaultAutocompleteAlgorithm:
    """Reference implementation — bucketed frequency-boosted ranking.

    See the module docstring for the algorithm. The implementation is
    pure-Python and allocation-bounded by the candidate count; on a
    dataset of ~3.4k conditions a single call costs ~5ms on a modern
    laptop.
    """

    __slots__ = ("_config",)

    _config: _AutocompleteConfig

    def __init__(self, *, version_tag: str | None = None) -> None:
        self._config = _AutocompleteConfig(version_tag=version_tag)

    @property
    def version_tag(self) -> str | None:
        return self._config.version_tag

    def clone(self, **overrides: Any) -> DefaultAutocompleteAlgorithm:
        """Return a fresh instance with selected fields overridden.

        >>> a = DefaultAutocompleteAlgorithm()
        >>> a.clone(version_tag='2026.05.29').version_tag
        '2026.05.29'
        """
        new_config = replace(self._config, **overrides)
        return DefaultAutocompleteAlgorithm(version_tag=new_config.version_tag)

    async def rank(
        self,
        query: str,
        candidates: Sequence[Concept],
        options: AutocompleteOptions,
    ) -> list[Suggestion]:
        """Synchronous body wrapped in an async shell.

        The shell exists so network-backed replacements can ``await``
        without changing the public surface; the default body never
        ``await``s.
        """
        if not query.strip() or not candidates or options.limit <= 0:
            return []

        wanted_kinds = set(options.kinds) if options.kinds else None
        filtered: list[Concept] = []
        for candidate in candidates:
            if wanted_kinds is not None and candidate.kind not in wanted_kinds:
                continue
            filtered.append(candidate)
        if not filtered:
            return []

        words_in_input = _tokenize(query)
        if not words_in_input:
            return []
        upper_input = query.upper()
        start_input = " ".join(words_in_input)

        # 1. Filter — the JS algorithm applies a coarse pre-filter before
        # categorizing. Replicate it so the bucket walker only sees
        # plausible candidates.
        pre_filtered: list[Concept] = []
        if options.starts_with_only:
            for candidate in filtered:
                if candidate.name.upper().replace("(", "").startswith(start_input):
                    pre_filtered.append(candidate)
        else:
            cleaned_input = " ".join(words_in_input)
            for candidate in filtered:
                cleaned_name = candidate.name.upper().replace("(", "")
                if len(words_in_input) < 2:
                    if cleaned_input in cleaned_name:
                        pre_filtered.append(candidate)
                    continue
                # Multi-word query: keep candidates where at most one input
                # word is missing from the option's TOKEN SET (not a substring
                # of the display name) — mirrors the locked TS ranker, which
                # counts a miss only when the token is absent after the same
                # normalization.
                option_tokens = set(_tokenize(candidate.name))
                missing = sum(1 for w in words_in_input if w not in option_tokens)
                if missing <= 1:
                    pre_filtered.append(candidate)

        if not pre_filtered:
            return []

        # 2. Bucket.
        buckets: list[list[Concept]] = [[] for _ in range(6)]
        # word_count_no_tolerance and word_count_with_tolerance are
        # by-distance dicts; flatten at the end.
        no_tol_by_d: dict[int, list[Concept]] = {}
        with_tol_by_d: dict[int, list[Concept]] = {}
        independent_intersection: list[Concept] = []

        for candidate in pre_filtered:
            cleaned_name = candidate.name.replace("(", "")
            words_in_option = _tokenize(cleaned_name)
            set_option = set(words_in_option)
            set_input = set(words_in_input)
            is_superset = all(w in set_option for w in words_in_input)
            is_start_match = cleaned_name.upper().startswith(start_input)
            same_length = len(words_in_option) == len(words_in_input)
            length_diff = abs(len(words_in_input) - len(words_in_option))

            if is_start_match:
                buckets[0].append(candidate)
            elif same_length and set_input == set_option:
                buckets[1].append(candidate)
            elif is_superset:
                no_tol_by_d.setdefault(length_diff, []).append(candidate)
            elif words_in_input and all(w in cleaned_name.upper() for w in words_in_input):
                independent_intersection.append(candidate)
            elif same_length:
                buckets[4].append(candidate)
            else:
                with_tol_by_d.setdefault(length_diff, []).append(candidate)

        # Sub-sort startsWith by option word count ascending.
        buckets[0].sort(key=lambda c: len(_tokenize(c.name)))
        # Flatten no-tolerance and with-tolerance bucket-dicts by
        # ascending distance.
        no_tol_flat: list[Concept] = []
        for d in sorted(no_tol_by_d):
            no_tol_flat.extend(no_tol_by_d[d])
        with_tol_flat: list[Concept] = []
        for d in sorted(with_tol_by_d):
            with_tol_flat.extend(with_tol_by_d[d])

        grouped: list[list[Concept]] = [
            buckets[0],  # startsWith
            buckets[1],  # sameWords
            independent_intersection,
            no_tol_flat,  # wordCountNoTolerance flattened
            buckets[4],  # sameNumWithTolerance
            with_tol_flat,  # wordCountWithTolerance flattened
        ]

        # 3. Order within the matched set. Alphabetical flattens every
        # bucket into one A→Z group (the relevance filter already decided
        # membership); the default boosts by frequency within each bucket.
        frequencies = options.frequencies or {}
        if options.sort is Sort.ALPHABETICAL:
            grouped = [_flatten_alphabetical(grouped)]
        else:
            grouped = _apply_frequency_sort(grouped, frequencies)

        # 4. Flatten + dedupe by id (or name for unknown), then cap.
        # Each suggestion's score is the bucket-boosted value
        # ``(frequency + 1) * scale`` used as the sort key — NOT the raw
        # catalog frequency — so consumers logging or comparing ``score`` see
        # the same ranking signal the algorithm sorted on, matching the TS
        # ``computeScoreLookup`` output.
        score_lookup = _compute_score_lookup(grouped, frequencies)
        out_suggestions: list[Suggestion] = []
        seen: set[str] = set()
        for group in grouped:
            for candidate in group:
                dedupe_key = candidate.id or f"_unk:{candidate.name}"
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                score = score_lookup.get(dedupe_key, 0.0)
                # Locate the matched span (best-effort): position of the
                # uppercase query in the uppercase candidate name.
                upper_name = candidate.name.upper()
                if upper_input and upper_input in upper_name:
                    start = upper_name.index(upper_input)
                    span = (start, start + len(upper_input))
                else:
                    span = (0, 0)
                out_suggestions.append(
                    Suggestion(
                        concept=Concept(
                            id=candidate.id,
                            name=candidate.name,
                            kind=candidate.kind,
                            is_known=candidate.is_known,
                            input_text=query,
                            _index=candidate._index,
                        ),
                        score=score,
                        matched_span=span,
                        rank=len(out_suggestions),
                    )
                )
                if len(out_suggestions) >= options.limit:
                    return out_suggestions
        return out_suggestions


def _flatten_alphabetical(grouped: list[list[Concept]]) -> list[Concept]:
    """Collapse every relevance bucket into one case-insensitive A→Z group.

    De-dupes by id (first occurrence across buckets wins before the sort)
    so a concept appearing in two buckets is not double-listed. Ties break
    by case-sensitive name then id for stable, cross-language output.
    """
    seen: set[str] = set()
    flat: list[Concept] = []
    for group in grouped:
        for candidate in group:
            key = candidate.id or f"_unk:{candidate.name}"
            if key in seen:
                continue
            seen.add(key)
            flat.append(candidate)
    flat.sort(key=lambda c: (c.name.lower(), c.name, c.id or ""))
    return flat


def _apply_frequency_sort(
    grouped: list[list[Concept]], frequencies: Mapping[str, int]
) -> list[list[Concept]]:
    """Replicate the JS ``applyFrequencySorting`` semantics.

    Returns the groups unchanged when no candidate has a frequency
    entry. Otherwise sorts each group descending by
    ``(frequency + 1) * scale_factor`` with alphabetical ties.
    """
    if not frequencies:
        return grouped
    flat = [c for group in grouped for c in group]
    total_groups = len(grouped)
    found = any((c.id or "") in frequencies for c in flat)
    if not found:
        return grouped

    scores: dict[int, float] = {}
    for group_index, group in enumerate(grouped):
        scale = max(1, total_groups - group_index)
        for c in group:
            cid = c.id or ""
            scores[id(c)] = (frequencies.get(cid, 0) + 1) * scale

    sorted_groups: list[list[Concept]] = []
    for group in grouped:
        sorted_groups.append(
            sorted(
                group,
                key=lambda c: (-scores.get(id(c), 0), c.name.lower()),
            )
        )
    return sorted_groups


def _compute_score_lookup(
    grouped: list[list[Concept]], frequencies: Mapping[str, int]
) -> dict[str, float]:
    """Map each candidate's dedupe key to its bucket-boosted score.

    Mirrors the JS ``computeScoreLookup``: within bucket ``group_index`` of
    ``total_groups``, the score is ``(frequency + 1) * max(1, total - index)``.
    First occurrence across buckets wins, matching the dedupe order of the
    emit loop. Runs unconditionally — the ``+ 1`` base means every candidate
    carries a positive score even when no frequency table is supplied.
    """
    total_groups = len(grouped)
    out: dict[str, float] = {}
    for group_index, group in enumerate(grouped):
        scale = max(1, total_groups - group_index)
        for c in group:
            key = c.id or f"_unk:{c.name}"
            if key in out:
                continue
            freq = frequencies.get(c.id or "", 0) + 1
            out[key] = float(freq * scale)
    return out


__all__ = [
    "AutocompleteAlgorithm",
    "AutocompleteOptions",
    "DefaultAutocompleteAlgorithm",
]
