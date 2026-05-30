"""Internal ``_make_key`` normalizer for the reference namespace.

Mirror of Go's ``MakeKey`` in ``go/zyins/models/makekey.go`` and the TS
``makeKey`` helper in ``packages/ts/src/zyins/reference.ts``: uppercase
the string first, then strip every character that is not ASCII
alphanumeric.

    "High Blood Pressure" -> "HIGHBLOODPRESSURE"

This module is private to :mod:`sah_sdk.zyins.reference`. The leading
underscore on the filename is the discoverability signal: consumers
must use :func:`sah_sdk.zyins.reference.match` and never compute keys
themselves. The conformance corpus pokes at the function through the
explicit ``_internal`` escape hatch on the package facade.
"""

from __future__ import annotations


def _make_key(text: str) -> str:
    """Normalize free text to the server's opaque entity key form.

    Uppercase first so locale-specific casefolding does not change
    which bytes survive the alphanumeric strip. Returns an empty
    string when the input contains no ASCII alphanumerics; callers
    treat empty as ``unknown``.
    """
    upper = text.upper()
    chars: list[str] = []
    for ch in upper:
        code = ord(ch)
        is_digit = 0x30 <= code <= 0x39
        is_upper = 0x41 <= code <= 0x5A
        if is_digit or is_upper:
            chars.append(ch)
    return "".join(chars)


__all__ = ["_make_key"]
