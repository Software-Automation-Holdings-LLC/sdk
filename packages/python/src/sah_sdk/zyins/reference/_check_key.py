"""Internal ``_check_key`` normalizer for the reference namespace.

Mirror of the engine's ``CondNameMakeCheckKey`` (Go
``go/zyins/utils/strings/normalize.go``, Perl ``cond_name_make_check_key_xs``)
and the TS ``_checkKey`` helper: uppercase the string, strip every
character that is not ASCII alphanumeric, then SORT the surviving
characters ascending. Digits (0x30-0x39) sort before letters
(0x41-0x5A), byte-identical to the engine.

    "SEVERE COPD"   -> "CCDEEOPRSV"
    "COPD (SEVERE)" -> "CCDEEOPRSV"   (collapses — word-order invariant)
    "COPD (MILD)"   -> "CCDDILMOP"    (distinct — severity preserved)

Used ONLY for word-order-invariant NAME matching. Opaque catalog ids
(e.g. ``HIGHBLOODPRESSURE``, ``cond_<ULID>``) are never keyed this way —
sorting an id would let unrelated ids collide. Id and exact-name lookups
stay on :func:`_make_key`.

This module is private to :mod:`sah_sdk.zyins.reference`.
"""

from __future__ import annotations


def _check_key(text: str) -> str:
    """Normalize free text to the engine's sorted condition check-key."""
    upper = text.upper()
    chars: list[str] = []
    for ch in upper:
        code = ord(ch)
        is_digit = 0x30 <= code <= 0x39
        is_upper = 0x41 <= code <= 0x5A
        if is_digit or is_upper:
            chars.append(ch)
    chars.sort()
    return "".join(chars)


__all__ = ["_check_key"]
