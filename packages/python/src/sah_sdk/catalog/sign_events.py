"""Generated catalog module — do not hand-edit; rerun the generator.

Produced by ``packages/python/scripts/gen_catalog.py``.
Regenerate with ``python packages/python/scripts/gen_catalog.py``.
"""
# Source data:
#   - isa-platform/shared/go/events/registry.go
from __future__ import annotations

from enum import Enum


class SignEvent(str, Enum):
    """RapidSign webhook event types.

    The wire string is the EventBridge ``detail-type`` value the platform emits.
    """

    DocumentSigned = 'document.signed'


SignEventLabels: dict[str, str] = {
    'document.signed': 'DocumentSigned',
}
