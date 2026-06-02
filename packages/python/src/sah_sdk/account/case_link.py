"""Zero-knowledge case share-link assembly + parsing.

Byte-compatible with the TypeScript SDK's ``account/caseWire.ts``. The link is
the capability: it carries the case code in the path and the decryption key in
the ``#k=`` fragment. These helpers never log it.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote as urlquote
from urllib.parse import unquote

#: Default share-link viewer origin. The SDK appends ``/<code>#k=<key>``; the
#: base omits any path segment so a deployment can point it at any host
#: without re-encoding the path shape.
DEFAULT_CASE_VIEWER_BASE_URL = "https://link.isaapi.com"

#: Delimits the path from the fragment key in a share link.
_FRAGMENT_KEY_PREFIX = "#k="


@dataclass(frozen=True, slots=True)
class ParsedLink:
    """A case's code and fragment key, parsed out of a share link."""

    #: The case identifier from the link's last path segment.
    code: str
    #: The base64url data key from the ``#k=`` fragment.
    key_fragment: str


def assemble_link(viewer_base_url: str, code: str, key_fragment: str) -> str:
    """Build ``{base}/<code>#k=<key_fragment>``, stripping a trailing slash on
    the viewer base. The code is the only path segment added; any product
    prefix rides inside the configured base URL."""
    base = viewer_base_url.rstrip("/")
    return f"{base}/{urlquote(code, safe='')}{_FRAGMENT_KEY_PREFIX}{key_fragment}"


def parse_link(link: str) -> ParsedLink:
    """Parse a share link into its case code and fragment key. Accepts both
    the current single-segment shape (``{base}/<code>#k=<key>``) and the legacy
    ``{base}/c/<id>#k=<key>`` shape, so links shared before the format change
    keep opening. The code is the last non-empty path segment."""
    if not link:
        raise ValueError("account: cases.open requires a non-empty link")
    hash_at = link.find(_FRAGMENT_KEY_PREFIX)
    if hash_at < 0:
        raise ValueError("account: cases.open link is missing its #k= fragment key")
    key_fragment = link[hash_at + len(_FRAGMENT_KEY_PREFIX) :]
    if not key_fragment:
        raise ValueError("account: cases.open link has an empty #k= fragment key")
    code = _last_path_segment(link[:hash_at])
    if not code:
        raise ValueError(
            "account: cases.open link must carry a case id before #k=<key>"
        )
    return ParsedLink(code=unquote(code), key_fragment=key_fragment)


def _last_path_segment(path: str) -> str:
    """Return the final non-empty ``/``-delimited segment of ``path``."""
    for segment in reversed(path.split("/")):
        if segment:
            return segment
    return ""


__all__ = ["DEFAULT_CASE_VIEWER_BASE_URL", "ParsedLink", "assemble_link", "parse_link"]
