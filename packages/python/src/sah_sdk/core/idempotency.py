"""Idempotency key generation.

Mirrors the TS ``deriveIdempotencyKey`` helper, but simplified to the
post-#286 contract: the platform only requires a per-request unique
string on POST/PUT/DELETE. We default to a UUID v4 and let the caller
pass an explicit key when they need replay semantics.
"""

from __future__ import annotations

import uuid


def generate_idempotency_key() -> str:
    """Return a fresh UUID v4 string suitable for ``Idempotency-Key``."""
    return str(uuid.uuid4())
