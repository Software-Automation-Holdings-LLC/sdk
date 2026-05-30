"""Per-release frozen table of bundled API versions per surface.

The ISA API is a federation of independently versioned surfaces — each
ships its own version history. The SDK exposes no global "current"
version; instead this module is the audit surface that answers "which
version of each surface does this SDK release talk to?" without
inspecting the wire.

See ``docs/sdk-syntax-proposal.md`` §2.7 ("Versioning — per-surface, not
global") for the locked cross-language contract; the same table is
exported by every language SDK (TS ``BundledApiVersions``, Go
``BundledAPIVersions``, C# ``BundledApiVersions.Map``, PHP
``BundledApiVersions::MAP``).

Resolution per call is::

    api_version.get(surface, BUNDLED_API_VERSIONS[surface])

— there is **no** shorthand string form (``api_version="v3"``) and **no**
``default`` key. Both would assert a uniformity that does not exist.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

#: Frozen per-surface bundled API versions for this SDK release.
#:
#: Read-only — wrapped in :class:`types.MappingProxyType` so a consumer
#: who treats it as a regular ``dict`` cannot silently mutate the SDK's
#: shipped defaults. The Phase 5 ``v3`` cut-over of the v2 surfaces is
#: scheduled per the v3 freeze plan; bumping a row here is the auditable
#: signal that the SDK release now talks to the new version.
BUNDLED_API_VERSIONS: Final[Mapping[str, str]] = MappingProxyType(
    {
        "prequalify": "v2",
        "quote": "v2",
        "datasets": "v2",
        "reference": "v2",
        "sessions": "v1",
        "branding": "v1",
        "cases": "v1",
    }
)


def resolve_api_version(
    override: Mapping[str, str] | None,
    surface: str,
) -> str:
    """Resolve the effective API version for a surface.

    ``override`` is the per-instance per-surface map passed at
    :class:`Isa` construction; ``None`` means "use bundled defaults for
    every surface". Unknown surfaces fall through to the bundled table —
    a :class:`KeyError` here is a programming error in the SDK (a caller
    is asking for a surface the SDK does not know about), not a runtime
    fallback path.

    :raises KeyError: when ``surface`` is absent from both the override
        and the bundled table.
    """
    if override is not None:
        pinned = override.get(surface)
        if pinned is not None:
            return pinned
    return BUNDLED_API_VERSIONS[surface]


__all__ = ["BUNDLED_API_VERSIONS", "resolve_api_version"]
