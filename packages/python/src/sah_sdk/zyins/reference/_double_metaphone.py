"""Double Metaphone phonetic encoder — the phonetic tier's metric.

Mirror of ``packages/ts/src/zyins/reference/_doubleMetaphone.ts``, itself
a port of Lawrence Philips' algorithm from the Apache Commons Codec
reference (``org.apache.commons.codec.language.DoubleMetaphone``).

Returns a ``(primary, alternate)`` pair of phonetic codes. Two strings
that sound alike share a code (``sertaline`` and ``sertraline`` both
encode primary ``SRTRLN``; ``tylonol`` and ``tylenol`` both ``TLNL``),
which lets the fuzzy matcher recover misspellings edit distance misses.

This is a cross-language contract surface: the TS / Go / PHP / C# / Python
ports MUST reproduce the same codes for the vector fixture in
``doubleMetaphone.vectors`` (the Python copy lives at
``tests/zyins/reference/double_metaphone_vectors.json``). The branch
structure is kept identical to the TS source on purpose — that file is the
canonical reference, and any divergence is a parity bug.

Determinism notes for the ports:
  - Input is upper-cased with a locale-invariant fold before encoding.
    Python ``str.upper()`` is already invariant for ASCII.
  - Only ASCII A-Z is processed; any other character is skipped, so the
    caller is responsible for NFC-normalizing before calling.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Classic Double Metaphone truncates to 4, which is too lossy for the long
# compound terms in the medical catalog. A 6-symbol code keeps enough
# signal that near-homophone drug names collide (``sertraline`` /
# ``sertaline`` -> ``SRTRLN``) while staying short enough to pool genuine
# homophones. This is the value the cross-language vector fixture pins.
_DEFAULT_MAX_CODE_LEN = 6
_VOWELS = "AEIOUY"
_SILENT_START = ("GN", "KN", "PN", "WR", "PS")
_L_R_N_M_B_H_F_V_W_SPACE = " BHFVW"
_ES_EP_EB_EL_EY_IB_IL_IN_IE_EI_ER = (
    "ES",
    "EP",
    "EB",
    "EL",
    "EY",
    "IB",
    "IL",
    "IN",
    "IE",
    "EI",
    "ER",
)
_L_T_K_S_N_M_B_Z = "LTKSNMBZ"
_NON_LETTER = re.compile(r"[^A-Z]")
_SLAVO_GERMANIC = re.compile(r"[WK]|CZ|WITZ")


@dataclass(frozen=True, slots=True)
class DoubleMetaphoneCode:
    """Phonetic code pair: identical when the word has no alternate reading."""

    primary: str
    alternate: str


class _CodeBuilder:
    """Mutable accumulator for the primary + alternate codes.

    Encapsulates the "append the same to both / append divergent to each"
    pattern so the step functions stay declarative. Mirrors the TS
    ``CodeBuilder`` class.
    """

    __slots__ = ("_alternate", "_max_length", "_primary")

    def __init__(self, max_length: int) -> None:
        self._primary = ""
        self._alternate = ""
        self._max_length = max_length

    def append(self, primary: str, alternate: str | None = None) -> None:
        self._primary += primary
        self._alternate += primary if alternate is None else alternate

    def done(self) -> bool:
        return len(self._primary) >= self._max_length and len(self._alternate) >= self._max_length

    def build(self) -> DoubleMetaphoneCode:
        return DoubleMetaphoneCode(
            primary=self._primary[: self._max_length],
            alternate=self._alternate[: self._max_length],
        )


class _Word:
    """Cursor over the upper-cased input with bounds-safe helpers.

    Mirrors the TS ``Word`` class: ``at``/``slice`` clamp to the string
    bounds and return ``""`` out of range, so the step functions index
    freely without guarding every access.
    """

    __slots__ = ("value",)

    def __init__(self, value: str) -> None:
        self.value = value

    @property
    def length(self) -> int:
        return len(self.value)

    def at(self, index: int) -> str:
        if index < 0 or index >= len(self.value):
            return ""
        return self.value[index]

    def slice(self, start: int, end: int) -> str:
        lo = max(0, start)
        hi = min(len(self.value), end)
        if hi <= lo:
            return ""
        return self.value[lo:hi]

    def is_vowel(self, index: int) -> bool:
        ch = self.at(index)
        return ch != "" and ch in _VOWELS

    def is_slavo_germanic(self) -> bool:
        return _SLAVO_GERMANIC.search(self.value) is not None

    def contains(self, start: int, length: int, *candidates: str) -> bool:
        target = self.slice(start, start + length)
        return target in candidates


def double_metaphone(text: str, max_length: int = _DEFAULT_MAX_CODE_LEN) -> DoubleMetaphoneCode:
    """Encode ``text`` into its Double Metaphone primary + alternate codes.

    Non-letters are dropped before encoding; an empty or letter-free
    input yields empty codes. Mirrors ``doubleMetaphone`` in the TS source.
    """
    cleaned = _NON_LETTER.sub("", text.upper())
    if cleaned == "":
        return DoubleMetaphoneCode(primary="", alternate="")

    word = _Word(cleaned)
    code = _CodeBuilder(max_length)
    index = _skip_silent_start(word)
    if word.at(0) == "X":
        code.append("S")
        index = 1

    while index < word.length and not code.done():
        index = _step(word, code, index)
    return code.build()


def _skip_silent_start(word: _Word) -> int:
    """Skip the silent leading clusters (GN, KN, PN, WR, PS) Philips strips."""
    head = word.slice(0, 2)
    return 1 if head in _SILENT_START else 0


def _step(word: _Word, code: _CodeBuilder, index: int) -> int:
    """Encode the character at ``index`` and return the next index.

    One branch per consonant family; vowels only contribute at position 0.
    Mirrors the TS ``step`` switch branch-for-branch.
    """
    ch = word.at(index)
    if ch in ("A", "E", "I", "O", "U", "Y"):
        if index == 0:
            code.append("A")
        return index + 1
    if ch == "B":
        code.append("P")
        return index + 2 if word.at(index + 1) == "B" else index + 1
    if ch == "C":
        return _step_c(word, code, index)
    if ch == "Ç":
        code.append("S")
        return index + 1
    if ch == "D":
        return _step_d(word, code, index)
    if ch == "F":
        code.append("F")
        return index + 2 if word.at(index + 1) == "F" else index + 1
    if ch == "G":
        return _step_g(word, code, index)
    if ch == "H":
        return _step_h(word, code, index)
    if ch == "J":
        return _step_j(word, code, index)
    if ch == "K":
        code.append("K")
        return index + 2 if word.at(index + 1) == "K" else index + 1
    if ch == "L":
        return _step_l(word, code, index)
    if ch == "M":
        code.append("M")
        return index + 2 if _is_m_silent_doubled(word, index) else index + 1
    if ch == "N":
        code.append("N")
        return index + 2 if word.at(index + 1) == "N" else index + 1
    if ch == "Ñ":
        code.append("N")
        return index + 1
    if ch == "P":
        return _step_p(word, code, index)
    if ch == "Q":
        code.append("K")
        return index + 2 if word.at(index + 1) == "Q" else index + 1
    if ch == "R":
        return _step_r(word, code, index)
    if ch == "S":
        return _step_s(word, code, index)
    if ch == "T":
        return _step_t(word, code, index)
    if ch == "V":
        code.append("F")
        return index + 2 if word.at(index + 1) == "V" else index + 1
    if ch == "W":
        return _step_w(word, code, index)
    if ch == "X":
        return _step_x(word, code, index)
    if ch == "Z":
        return _step_z(word, code, index)
    return index + 1


def _step_c(word: _Word, code: _CodeBuilder, index: int) -> int:
    if _condition_c0(word, index):
        code.append("K")
        return index + 2
    if index == 0 and word.contains(index, 6, "CAESAR"):
        code.append("S")
        return index + 2
    if word.contains(index, 2, "CH"):
        return _step_ch(word, code, index)
    if word.contains(index, 2, "CZ") and not word.contains(index - 2, 4, "WICZ"):
        code.append("S", "X")
        return index + 2
    if word.contains(index + 1, 3, "CIA"):
        code.append("X")
        return index + 3
    if word.contains(index, 2, "CC") and not (index == 1 and word.at(0) == "M"):
        return _step_cc(word, code, index)
    if word.contains(index, 2, "CK", "CG", "CQ"):
        code.append("K")
        return index + 2
    if word.contains(index, 2, "CI", "CE", "CY"):
        if word.contains(index, 3, "CIO", "CIE", "CIA"):
            code.append("S", "X")
        else:
            code.append("S")
        return index + 2
    code.append("K")
    if word.contains(index + 1, 2, " C", " Q", " G"):
        return index + 3
    if word.contains(index + 1, 1, "C", "K", "Q") and not word.contains(index + 1, 2, "CE", "CI"):
        return index + 2
    return index + 1


def _condition_c0(word: _Word, index: int) -> bool:
    if word.contains(index, 4, "CHIA"):
        return True
    if index <= 1:
        return False
    if word.is_vowel(index - 2):
        return False
    if not word.contains(index - 1, 3, "ACH"):
        return False
    c = word.at(index + 2)
    return (c not in ("I", "E")) or word.contains(index - 2, 6, "BACHER", "MACHER")


def _step_cc(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.contains(index + 2, 1, "I", "E", "H") and not word.contains(index + 2, 2, "HU"):
        if (index == 1 and word.at(index - 1) == "A") or word.contains(
            index - 1, 5, "UCCEE", "UCCES"
        ):
            code.append("KS")
        else:
            code.append("X")
        return index + 3
    code.append("K")
    return index + 2


def _step_ch(word: _Word, code: _CodeBuilder, index: int) -> int:
    if index > 0 and word.contains(index, 4, "CHAE"):
        code.append("K", "X")
        return index + 2
    if _condition_ch0(word, index) or _condition_ch1(word, index):
        code.append("K")
        return index + 2
    if index > 0:
        code.append("K" if word.contains(0, 2, "MC") else "X", "K")
    else:
        code.append("X")
    return index + 2


def _condition_ch0(word: _Word, index: int) -> bool:
    if index != 0:
        return False
    if not word.contains(index + 1, 5, "HARAC", "HARIS") and not word.contains(
        index + 1, 3, "HOR", "HYM", "HIA", "HEM"
    ):
        return False
    return not word.contains(0, 5, "CHORE")


def _condition_ch1(word: _Word, index: int) -> bool:
    return (
        word.contains(0, 4, "VAN ", "VON ")
        or word.contains(0, 3, "SCH")
        or word.contains(index - 2, 6, "ORCHES", "ARCHIT", "ORCHID")
        or word.contains(index + 2, 1, "T", "S")
        or (
            (word.contains(index - 1, 1, "A", "O", "U", "E") or index == 0)
            and (
                word.contains(index + 2, 1, *_L_R_N_M_B_H_F_V_W_SPACE)
                or index + 1 == word.length - 1
            )
        )
    )


def _step_d(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.contains(index, 2, "DG"):
        if word.contains(index + 2, 1, "I", "E", "Y"):
            code.append("J")
            return index + 3
        code.append("TK")
        return index + 2
    code.append("T")
    return index + 2 if word.contains(index, 2, "DT", "DD") else index + 1


def _step_g(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.at(index + 1) == "H":
        return _step_gh(word, code, index)
    if word.at(index + 1) == "N":
        return _step_gn(word, code, index)
    if word.contains(index + 1, 2, "LI") and not word.is_slavo_germanic():
        code.append("KL", "L")
        return index + 2
    if index == 0 and (
        word.at(index + 1) == "Y" or word.contains(index + 1, 2, *_ES_EP_EB_EL_EY_IB_IL_IN_IE_EI_ER)
    ):
        code.append("K", "J")
        return index + 2
    if (
        (word.contains(index + 1, 2, "ER") or word.at(index + 1) == "Y")
        and not word.contains(0, 6, "DANGER", "RANGER", "MANGER")
        and not word.contains(index - 1, 1, "E", "I")
        and not word.contains(index - 1, 3, "RGY", "OGY")
    ):
        code.append("K", "J")
        return index + 2
    if word.contains(index + 1, 1, "E", "I", "Y") or word.contains(index - 1, 4, "AGGI", "OGGI"):
        if (
            word.contains(0, 4, "VAN ", "VON ")
            or word.contains(0, 3, "SCH")
            or word.contains(index + 1, 2, "ET")
        ):
            code.append("K")
        elif word.contains(index + 1, 3, "IER"):
            code.append("J")
        else:
            code.append("J", "K")
        return index + 2
    code.append("K")
    return index + 2 if word.at(index + 1) == "G" else index + 1


def _step_gh(word: _Word, code: _CodeBuilder, index: int) -> int:
    if index > 0 and not word.is_vowel(index - 1):
        code.append("K")
        return index + 2
    if index == 0:
        code.append("J" if word.at(index + 2) == "I" else "K")
        return index + 2
    if (
        (index > 1 and word.contains(index - 2, 1, "B", "H", "D"))
        or (index > 2 and word.contains(index - 3, 1, "B", "H", "D"))
        or (index > 3 and word.contains(index - 4, 1, "B", "H"))
    ):
        return index + 2
    if (
        index > 2
        and word.at(index - 1) == "U"
        and word.contains(index - 3, 1, "C", "G", "L", "R", "T")
    ):
        code.append("F")
    elif index > 0 and word.at(index - 1) != "I":
        code.append("K")
    return index + 2


def _step_gn(word: _Word, code: _CodeBuilder, index: int) -> int:
    if index == 1 and word.is_vowel(0) and not word.is_slavo_germanic():
        code.append("KN", "N")
    elif (
        not word.contains(index + 2, 2, "EY")
        and word.at(index + 1) != "Y"
        and not word.is_slavo_germanic()
    ):
        code.append("N", "KN")
    else:
        code.append("KN")
    return index + 2


def _step_h(word: _Word, code: _CodeBuilder, index: int) -> int:
    if (index == 0 or word.is_vowel(index - 1)) and word.is_vowel(index + 1):
        code.append("H")
        return index + 2
    return index + 1


def _step_j(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.contains(index, 4, "JOSE") or word.contains(0, 4, "SAN "):
        if (index == 0 and word.at(index + 4) == " ") or word.contains(0, 4, "SAN "):
            code.append("H")
        else:
            code.append("J", "H")
        return index + 1
    if index == 0 and not word.contains(index, 4, "JOSE"):
        code.append("J", "A")
    elif (
        word.is_vowel(index - 1)
        and not word.is_slavo_germanic()
        and (word.at(index + 1) == "A" or word.at(index + 1) == "O")
    ):
        code.append("J", "H")
    elif index == word.length - 1:
        code.append("J", "")
    elif not word.contains(index + 1, 1, *_L_T_K_S_N_M_B_Z) and not word.contains(
        index - 1, 1, "S", "K", "L"
    ):
        code.append("J")
    return index + 2 if word.at(index + 1) == "J" else index + 1


def _step_l(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.at(index + 1) == "L":
        if _condition_l0(word, index):
            code.append("L", "")
        else:
            code.append("L")
        return index + 2
    code.append("L")
    return index + 1


def _condition_l0(word: _Word, index: int) -> bool:
    if index == word.length - 3 and word.contains(index - 1, 4, "ILLO", "ILLA", "ALLE"):
        return True
    return (
        word.contains(word.length - 2, 2, "AS", "OS") or word.contains(word.length - 1, 1, "A", "O")
    ) and word.contains(index - 1, 4, "ALLE")


def _step_p(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.at(index + 1) == "H":
        code.append("F")
        return index + 2
    code.append("P")
    return index + 2 if word.contains(index + 1, 1, "P", "B") else index + 1


def _step_r(word: _Word, code: _CodeBuilder, index: int) -> int:
    if (
        index == word.length - 1
        and not word.is_slavo_germanic()
        and word.contains(index - 2, 2, "IE")
        and not word.contains(index - 4, 2, "ME", "MA")
    ):
        code.append("", "R")
    else:
        code.append("R")
    return index + 2 if word.at(index + 1) == "R" else index + 1


def _step_s(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.contains(index - 1, 3, "ISL", "YSL"):
        return index + 1
    if index == 0 and word.contains(index, 5, "SUGAR"):
        code.append("X", "S")
        return index + 1
    if word.contains(index, 2, "SH"):
        code.append("S" if word.contains(index + 1, 4, "HEIM", "HOEK", "HOLM", "HOLZ") else "X")
        return index + 2
    if word.contains(index, 3, "SIO", "SIA") or word.contains(index, 4, "SIAN"):
        # The reference primary is ``isSlavoGermanic() ? 'S' : 'S'`` — always
        # 'S'; only the alternate varies. Collapsed to a literal here so the
        # linter does not flag the no-op ternary; behavior is identical.
        code.append("S", "S" if word.is_slavo_germanic() else "X")
        return index + 3
    if (index == 0 and word.contains(index + 1, 1, "M", "N", "L", "W")) or word.contains(
        index + 1, 1, "Z"
    ):
        code.append("S", "X")
        return index + 2 if word.at(index + 1) == "Z" else index + 1
    if word.contains(index, 2, "SC"):
        return _step_sc(word, code, index)
    if index == word.length - 1 and word.contains(index - 2, 2, "AI", "OI"):
        code.append("", "S")
    else:
        code.append("S")
    return index + 2 if word.contains(index + 1, 1, "S", "Z") else index + 1


def _step_sc(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.at(index + 2) == "H":
        if word.contains(index + 3, 2, "OO", "ER", "EN", "UY", "ED", "EM"):
            code.append("X" if word.contains(index + 3, 2, "ER", "EN") else "SK", "SK")
        elif index == 0 and not word.is_vowel(3) and word.at(3) != "W":
            code.append("X", "S")
        else:
            code.append("X")
        return index + 3
    if word.contains(index + 2, 1, "I", "E", "Y"):
        code.append("S")
        return index + 3
    code.append("SK")
    return index + 3


def _step_t(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.contains(index, 4, "TION"):
        code.append("X")
        return index + 3
    if word.contains(index, 3, "TIA", "TCH"):
        code.append("X")
        return index + 3
    if word.contains(index, 2, "TH") or word.contains(index, 3, "TTH"):
        if (
            word.contains(index + 2, 2, "OM", "AM")
            or word.contains(0, 4, "VAN ", "VON ")
            or word.contains(0, 3, "SCH")
        ):
            code.append("T")
        else:
            code.append("0", "T")
        return index + 2
    code.append("T")
    return index + 2 if word.contains(index + 1, 1, "T", "D") else index + 1


def _step_w(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.contains(index, 2, "WR"):
        code.append("R")
        return index + 2
    if index == 0 and (word.is_vowel(index + 1) or word.contains(index, 2, "WH")):
        if word.is_vowel(index + 1):
            code.append("A", "F")
        else:
            code.append("A")
        return index + 1
    if (
        (index == word.length - 1 and word.is_vowel(index - 1))
        or word.contains(index - 1, 5, "EWSKI", "EWSKY", "OWSKI", "OWSKY")
        or word.contains(0, 3, "SCH")
    ):
        code.append("", "F")
        return index + 1
    if word.contains(index, 4, "WICZ", "WITZ"):
        code.append("TS", "FX")
        return index + 4
    return index + 1


def _step_x(word: _Word, code: _CodeBuilder, index: int) -> int:
    if not (
        index == word.length - 1
        and (word.contains(index - 3, 3, "IAU", "EAU") or word.contains(index - 2, 2, "AU", "OU"))
    ):
        code.append("KS")
    return index + 2 if word.contains(index + 1, 1, "C", "X") else index + 1


def _step_z(word: _Word, code: _CodeBuilder, index: int) -> int:
    if word.at(index + 1) == "H":
        code.append("J")
        return index + 2
    if word.contains(index + 1, 2, "ZO", "ZI", "ZA") or (
        word.is_slavo_germanic() and index > 0 and word.at(index - 1) != "T"
    ):
        code.append("S", "TS")
    else:
        code.append("S")
    return index + 2 if word.at(index + 1) == "Z" else index + 1


def _is_m_silent_doubled(word: _Word, index: int) -> bool:
    return (
        word.contains(index - 1, 3, "UMB")
        and (index + 1 == word.length - 1 or word.contains(index + 2, 2, "ER"))
    ) or word.at(index + 1) == "M"


__all__ = ["DoubleMetaphoneCode", "double_metaphone"]
