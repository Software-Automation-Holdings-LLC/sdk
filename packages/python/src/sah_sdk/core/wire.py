"""Shared wire-format and JSON response helpers."""

from __future__ import annotations

import json
from typing import Any

from ..zyins.applicant import Applicant, sex_wire_code


def applicant_to_wire_dict(applicant: Applicant) -> dict[str, Any]:
    """Serialize an applicant for prequalify/quote request bodies."""
    payload: dict[str, Any] = {
        "dob": applicant.dob,
        "sex": sex_wire_code(applicant.sex),
        "height_inches": applicant.height_inches,
        "weight_pounds": applicant.weight_pounds,
        "state": applicant.state,
        "nicotine_use": applicant.nicotine_use.value,
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
