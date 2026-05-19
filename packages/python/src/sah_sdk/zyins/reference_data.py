"""Reference-data sub-client.

Returns raw reference tables (conditions, medications, drug aliases,
state restrictions, etc.) keyed by a ``kind`` discriminator. The
response shape varies by ``kind`` — callers receive a typed
:class:`ReferenceDataResponse` with the raw payload preserved as a
dict so they can pick out the fields they need.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from ..core.wire import load_json_object, request_id_from_envelope


class ReferenceDataResponse(BaseModel):
    """A reference-data lookup result."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    kind: str
    data: dict[str, Any] = {}
    request_id: str = ""


def parse_reference_data(body: str, *, kind: str) -> ReferenceDataResponse:
    raw = load_json_object(body, context="reference_data")
    nested = raw.get("data")
    if isinstance(nested, dict):
        data = nested
    elif isinstance(raw, dict) and nested is None:
        data = {k: v for k, v in raw.items() if k != "request_id"}
    else:
        data = {}
    return ReferenceDataResponse(
        kind=kind,
        data=data,
        request_id=request_id_from_envelope(raw),
    )
