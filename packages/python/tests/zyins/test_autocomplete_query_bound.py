"""Spec for the query-length-unbounded fuzzy fallback.

``DefaultAutocompleteAlgorithm.rank`` tokenizes caller-supplied typeahead
text with no length cap. When the literal prefilter misses, the default
fuzzy fallback compares every query word with every token of every
candidate and recomputes Double Metaphone on the candidate token for
each pair. ``limit`` only trims the list returned after that scan.
"""

from __future__ import annotations

import asyncio
import time

from sah_sdk.zyins.reference.autocomplete_algorithm import (
    AutocompleteOptions,
    DefaultAutocompleteAlgorithm,
)
from sah_sdk.zyins.reference.concept import Concept, ConceptKind
from sah_sdk.zyins.reference.sort import Sort

_CATALOG_SIZE = 500
_BASELINE_WORDS = 4
_ATTACK_WORDS = 800
_SCALE = 5
_FLOOR_S = 0.05


def _catalog(n: int) -> list[Concept]:
    return [
        Concept(
            id=f"C{i}",
            name=f"Condition Alpha {i}",
            kind=ConceptKind.CONDITION,
            is_known=True,
            input_text="",
        )
        for i in range(n)
    ]


def _query(words: int) -> str:
    return " ".join(["qx"] * words)


def _assert_bounded(baseline_s: float, observed_s: float) -> None:
    limit = max(_FLOOR_S, baseline_s * _SCALE)
    assert observed_s <= limit, (
        f"autocomplete rank took {observed_s:.3f}s; limit {limit:.3f}s "
        f"(baseline {baseline_s:.3f}s)"
    )


def test_rank_long_unmatched_query_stays_within_baseline() -> None:
    algo = DefaultAutocompleteAlgorithm()
    candidates = _catalog(_CATALOG_SIZE)
    options = AutocompleteOptions(limit=1)

    baseline_s, baseline_n = asyncio.run(_elapsed(algo, _query(_BASELINE_WORDS), candidates, options))
    attack_s, attack_n = asyncio.run(_elapsed(algo, _query(_ATTACK_WORDS), candidates, options))

    assert baseline_n == 0
    assert attack_n == 0
    _assert_bounded(baseline_s, attack_s)


def test_rank_alphabetical_long_unmatched_query_stays_within_baseline() -> None:
    algo = DefaultAutocompleteAlgorithm()
    candidates = _catalog(_CATALOG_SIZE)
    options = AutocompleteOptions(limit=1, sort=Sort.ALPHABETICAL)

    baseline_s, _ = asyncio.run(_elapsed(algo, _query(_BASELINE_WORDS), candidates, options))
    attack_s, attack_n = asyncio.run(_elapsed(algo, _query(_ATTACK_WORDS), candidates, options))

    assert attack_n == 0
    _assert_bounded(baseline_s, attack_s)


async def _elapsed(
    algo: DefaultAutocompleteAlgorithm,
    query: str,
    candidates: list[Concept],
    options: AutocompleteOptions,
) -> tuple[float, int]:
    started = time.perf_counter()
    suggestions = await algo.rank(query, candidates, options)
    return time.perf_counter() - started, len(suggestions)
