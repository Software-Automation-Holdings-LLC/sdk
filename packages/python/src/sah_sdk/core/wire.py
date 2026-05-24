"""Shared wire-format and JSON response helpers."""

from __future__ import annotations

import json
from typing import Any

from ..zyins.applicant import Applicant, NicotineUsageInput


def applicant_to_wire_dict(applicant: Applicant) -> dict[str, Any]:
    """Serialize an applicant for legacy request bodies.

    .. deprecated::
        New code should use the flat wire serialization in
        ``prequalify._serialize_wire_body``. This helper exists only for
        code paths (e.g. quote) that have not yet migrated to the flat
        shape.
    """
    nicotine_use = applicant.nicotine_use
    # Accept both NicotineUsageInput (modern) and NicotineUsage (deprecated).
    nicotine_value: str | dict[str, Any]
    if isinstance(nicotine_use, NicotineUsageInput):
        nicotine_value = {"last_used": nicotine_use.last_used.value}
        if nicotine_use.product_usage:
            nicotine_value["product_usage"] = [
                {"type": p.type, "frequency": p.frequency} for p in nicotine_use.product_usage
            ]
    else:
        nicotine_value = nicotine_use.value

    payload: dict[str, Any] = {
        "dob": applicant.dob,
        "sex": applicant.sex.value,
        "height_inches": applicant.height_inches,
        "weight_pounds": applicant.weight_pounds,
        "state": applicant.state,
        "nicotine_use": nicotine_value,
        "medications": [m.model_dump() for m in applicant.medications],
        "conditions": [c.model_dump() for c in applicant.conditions],
    }
    if applicant.zip is not None:
        payload["zip"] = applicant.zip
    return payload


def load_json_value(body: str, *, context: str) -> Any:
    """Parse a JSON response body, returning ``None`` for empty bodies."""
    if not body:
        return None
    try:
        return json.loads(body)
    except (ValueError, json.JSONDecodeError) as exc:
        raise ValueError(f"{context}: failed to parse response body: {exc}") from exc


def load_json_object(body: str, *, context: str) -> dict[str, Any]:
    """Parse a JSON object root; non-objects become empty dicts."""
    raw = load_json_value(body, context=context)
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    return {}


def request_id_from_envelope(raw: dict[str, Any]) -> str:
    """Read ``request_id`` from a top-level response envelope."""
    value = raw.get("request_id")
    return str(value) if value is not None else ""
