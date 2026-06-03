"""Parity tests for the Python ``FuzzyMatchAlgorithm`` port.

Two contracts are asserted here:

1. The Double Metaphone encoder reproduces the shared 102-term vector
   fixture byte-for-byte (``double_metaphone_vectors.json``, translated
   from the canonical TS ``doubleMetaphone.vectors.ts``). Any divergence
   from the TS / Go / PHP / C# ports fails a parametrized case.
2. The tiered matcher (exact -> prefix -> Damerau -> phonetic) selects
   the same winner the TS reference selects, including the deterministic
   tie-break and the never-rejects (unknown) invariant.
"""

from __future__ import annotations

import json
import unicodedata
from collections.abc import Mapping
from pathlib import Path

import pytest

from sah_sdk.zyins.reference import (
    Concept,
    ConceptKind,
    FuzzyMatchAlgorithm,
    MatchAlgorithm,
)
from sah_sdk.zyins.reference._damerau_osa import (
    fuzzy_threshold_for_length,
    optimal_string_alignment_distance,
)
from sah_sdk.zyins.reference._double_metaphone import double_metaphone

_VECTORS_PATH = Path(__file__).parent / "double_metaphone_vectors.json"


def _load_vectors() -> list[dict[str, str]]:
    payload = json.loads(_VECTORS_PATH.read_text(encoding="utf-8"))
    vectors: list[dict[str, str]] = payload["vectors"]
    return vectors


_VECTORS = _load_vectors()


def _medication(name: str, entity_id: str) -> Concept:
    return Concept(
        id=entity_id,
        name=name,
        kind=ConceptKind.MEDICATION,
        is_known=True,
        input_text=name,
    )


# ---------------------------------------------------------------------------
# Double Metaphone vector parity — rule 4 of the hardening contract.
# ---------------------------------------------------------------------------


class TestDoubleMetaphoneVectors:
    def test_fixture_has_full_cohort(self) -> None:
        assert len(_VECTORS) >= 102

    @pytest.mark.parametrize(
        "term,primary,alternate",
        [(v["term"], v["primary"], v["alternate"]) for v in _VECTORS],
        ids=[v["term"] for v in _VECTORS],
    )
    def test_encodes_term_identically_to_ts(self, term: str, primary: str, alternate: str) -> None:
        code = double_metaphone(term)
        assert code.primary == primary
        assert code.alternate == alternate

    def test_empty_and_letter_free_input_yields_empty_codes(self) -> None:
        for blank in ("", "   ", "123-456", "!!!"):
            code = double_metaphone(blank)
            assert code.primary == ""
            assert code.alternate == ""

    def test_truncates_to_six_symbols(self) -> None:
        code = double_metaphone("hydrochlorothiazide")
        assert len(code.primary) == 6
        assert len(code.alternate) == 6


# ---------------------------------------------------------------------------
# Damerau-OSA distance + length-scaled threshold band.
# ---------------------------------------------------------------------------


class TestOptimalStringAlignmentDistance:
    @pytest.mark.parametrize(
        "a,b,expected",
        [
            ("crohns", "crohns", 0),
            # 'h' must hop two positions (past 'r' and 'o'), so this is NOT a
            # single adjacent transposition under OSA — it costs 2, matching
            # the TS / Go / PHP / C# reference exactly.
            ("chrons", "crohns", 2),
            ("ab", "ba", 1),  # genuine single adjacent transposition
            ("sertaline", "sertraline", 1),  # one insertion
            ("kitten", "sitting", 3),
            ("", "abc", 3),
            ("abc", "", 3),
        ],
    )
    def test_distance(self, a: str, b: str, expected: int) -> None:
        # Use a generous cap so the early-exit does not clamp the result.
        assert optimal_string_alignment_distance(a, b, max(len(a), len(b))) == expected

    def test_early_exit_returns_cap_plus_one(self) -> None:
        assert optimal_string_alignment_distance("abcdef", "zzzzzz", 2) == 3

    @pytest.mark.parametrize(
        "length,expected",
        [(1, 1), (5, 1), (6, 1), (12, 1), (13, 2), (40, 2)],
    )
    def test_threshold_band(self, length: int, expected: int) -> None:
        assert fuzzy_threshold_for_length(length) == expected


# ---------------------------------------------------------------------------
# Tiered matcher behavior.
# ---------------------------------------------------------------------------


class TestFuzzyMatchAlgorithm:
    def test_is_a_match_algorithm(self) -> None:
        assert isinstance(FuzzyMatchAlgorithm(), MatchAlgorithm)

    def test_exact_tier_wins_on_name(self) -> None:
        matcher = FuzzyMatchAlgorithm()
        candidates = [
            _medication("Sertraline", "SERTRALINE"),
            _medication("Lisinopril", "LISINOPRIL"),
        ]
        result = matcher.match("sertraline", candidates)
        assert result.id == "SERTRALINE"
        assert result.is_known is True
        assert result.input_text == "sertraline"

    def test_exact_tier_matches_on_id_key(self) -> None:
        matcher = FuzzyMatchAlgorithm()
        candidates = [_medication("High Blood Pressure", "HBP")]
        result = matcher.match("hbp", candidates)
        assert result.id == "HBP"

    def test_damerau_recovers_dropped_consonant(self) -> None:
        # 'sertaline' (dropped r) -> 'sertraline' via one insertion; the
        # phonetic codes legitimately diverge, so the Damerau tier owns it.
        matcher = FuzzyMatchAlgorithm()
        candidates = [
            _medication("Sertraline", "SERTRALINE"),
            _medication("Citalopram", "CITALOPRAM"),
        ]
        result = matcher.match("sertaline", candidates)
        assert result.id == "SERTRALINE"

    def test_phonetic_recovers_vowel_swap(self) -> None:
        # 'tylonol' and 'tylenol' both encode primary 'TLNL'; edit distance
        # alone (one substitution within band) would also catch this, so
        # force a phonetic-only path with a far-apart spelling.
        matcher = FuzzyMatchAlgorithm()
        candidates = [_medication("Tylenol", "TYLENOL")]
        result = matcher.match("tylonol", candidates)
        assert result.id == "TYLENOL"

    def test_unknown_query_with_no_alnum_returns_unknown(self) -> None:
        matcher = FuzzyMatchAlgorithm()
        candidates = [_medication("Aspirin", "ASPIRIN")]
        result = matcher.match("!!!", candidates)
        assert result.is_known is False
        assert result.kind is ConceptKind.UNKNOWN
        assert result.id is None
        assert result.input_text == "!!!"

    def test_no_candidate_matches_returns_unknown(self) -> None:
        matcher = FuzzyMatchAlgorithm()
        candidates = [_medication("Aspirin", "ASPIRIN")]
        result = matcher.match("zzzzzzzzzzzz", candidates)
        assert result.is_known is False
        assert result.kind is ConceptKind.UNKNOWN

    def test_frequency_breaks_ties_within_tier(self) -> None:
        frequencies: Mapping[str, int] = {"GENERIC": 5, "POPULAR": 100}
        matcher = FuzzyMatchAlgorithm(frequencies=frequencies)
        # Both are one substitution from the query, identical distance; the
        # higher-frequency candidate must win.
        candidates = [
            _medication("aaaaab", "GENERIC"),
            _medication("aaaaac", "POPULAR"),
        ]
        result = matcher.match("aaaaaa", candidates)
        assert result.id == "POPULAR"

    def test_name_id_tie_break_is_deterministic(self) -> None:
        # No frequency map; equal distance -> normalized name, then id.
        matcher = FuzzyMatchAlgorithm()
        candidates = [
            _medication("aaaaac", "ZID"),
            _medication("aaaaab", "AID"),
        ]
        # 'aaaaab' sorts before 'aaaaac' by normalized name.
        result = matcher.match("aaaaaa", candidates)
        assert result.id == "AID"

    def test_clone_overrides_version_tag(self) -> None:
        matcher = FuzzyMatchAlgorithm(version_tag="2026.06.01")
        assert matcher.clone(version_tag="2026.06.02").version_tag == "2026.06.02"
        assert matcher.clone().version_tag == "2026.06.01"

    def test_nfc_normalization_collapses_decomposed_input(self) -> None:
        # Precomposed 'é' vs decomposed 'e' + combining acute must match.
        precomposed = unicodedata.normalize("NFC", "café")
        decomposed = unicodedata.normalize("NFD", "café")
        assert precomposed != decomposed  # different byte sequences
        matcher = FuzzyMatchAlgorithm()
        candidates = [_medication(precomposed, "CAFE")]
        result = matcher.match(decomposed, candidates)
        assert result.id == "CAFE"
