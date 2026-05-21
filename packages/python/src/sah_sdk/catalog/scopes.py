"""Generated catalog module — do not hand-edit; rerun the generator.

Produced by ``packages/python/scripts/gen_catalog.py``.
Regenerate with ``python packages/python/scripts/gen_catalog.py``.
"""
# Source data:
#   - isa-platform/shared/schemas/api/isa/v1/common.proto
from __future__ import annotations

from enum import Enum


class Scope(str, Enum):
    """Bearer-token scopes recognized across the ISA platform.

    Mirrors the ``api.isa.v1.Scope`` proto enum's wire-form values; new
    scopes ship here when added upstream.
    """

    """send signer notification emails."""
    RapidsignDocumentsNotify = 'rapidsign:documents:notify'
    """fetch signature state and signed PDFs."""
    RapidsignDocumentsRead = 'rapidsign:documents:read'
    """submit signatures."""
    RapidsignDocumentsSign = 'rapidsign:documents:sign'
    """create new documents."""
    RapidsignDocumentsWrite = 'rapidsign:documents:write'


ScopeDescriptions: dict[str, str] = {
    'rapidsign:documents:notify': 'send signer notification emails.',
    'rapidsign:documents:read': 'fetch signature state and signed PDFs.',
    'rapidsign:documents:sign': 'submit signatures.',
    'rapidsign:documents:write': 'create new documents.',
}
