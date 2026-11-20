"""Place caller-supplied values into request paths.

A value spliced into a path must address exactly one segment, as seen by
every hop that reads it: the client, any gateway in front of the API, and
the server. Percent-encoding alone does not guarantee that. ``.`` and
``..`` pass through encoding unchanged and are removed as dot segments,
and a gateway that decodes once turns an encoded ``/`` back into a real
separator. Either way the request, and the credentials attached to it,
lands on another route.
"""

from __future__ import annotations

from urllib.parse import quote

# Bytes some hop may treat as a segment boundary once decoded: the path
# separator, the backslash some servers fold into it, and the percent sign
# that would hide either from a single decode.
_SEPARATORS = frozenset("/\\%")


def path_segment(value: str) -> str:
    """Return ``value`` percent-encoded as exactly one URL path segment.

    Raises:
        ValueError: for a non-string, the empty string, ``.`` and ``..``,
            and any value containing ``/``, ``\\``, or ``%``.
    """
    if (
        not isinstance(value, str)
        or value in ("", ".", "..")
        or not _SEPARATORS.isdisjoint(value)
    ):
        raise ValueError(f"{value!r} is not a single path segment")
    return quote(value, safe="")
