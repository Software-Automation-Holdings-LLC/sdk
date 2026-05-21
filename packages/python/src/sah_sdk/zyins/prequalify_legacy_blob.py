"""Raw-blob variant of ``prequalify``.

The typed :class:`~.prequalify.PrequalifyInput` surface builds the wire body
from a structured request. Some long-standing consumers (bpp2.0's
``prepEncObj`` / ``prepEncObjV2``) already produce that same wire body via
their own encoder and would otherwise have to restructure their code to
pass through the typed surface. This module exposes a parallel entry point
that accepts the pre-encoded payload verbatim and reuses the rest of the
prequalify transport — auth headers, idempotency-key derivation, error
funnel, response parsing.

The server accepts both shapes on the same ``/v1/prequalify`` path; this
module exists only so the SDK does not force the consumer to restructure
their encoder.

Mirror of ``packages/ts/src/zyins/prequalifyLegacyBlob.ts``.
"""

from __future__ import annotations

import json
from typing import Any

from .prequalify import PrequalifyResult, parse_prequalify_response


def encode_legacy_blob(encoded_payload: dict[str, Any]) -> str:
    """Serialize the legacy payload to JSON exactly as it will hit the wire.

    Exposed as a standalone helper so callers driving signed-request
    construction (HMAC) can compute the body once and feed it to both the
    signature step and the dispatch step.
    """
    if not isinstance(encoded_payload, dict):
        raise TypeError(
            "prequalify.legacy_blob: encoded_payload must be a dict; "
            f"got {type(encoded_payload).__name__}"
        )
    return json.dumps(encoded_payload, separators=(",", ":"))


def parse_legacy_blob_response(body: str) -> PrequalifyResult:
    """Parse the engine response identical to the typed prequalify path."""
    return parse_prequalify_response(body)
