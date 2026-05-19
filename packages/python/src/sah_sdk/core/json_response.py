"""JSON response parsing helpers for API envelopes."""

from __future__ import annotations

from typing import Any

from .wire import load_json_object, load_json_value, request_id_from_envelope


def dataset_items_from_body(body: str) -> list[Any]:
    """Normalize a datasets list response to a sequence of item dicts."""
    raw = load_json_value(body, context="datasets.list")
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        items = raw.get("data") or raw.get("datasets")
        if isinstance(items, list):
            return items
    return []


def inner_data_object(body: str, *, context: str) -> dict[str, Any]:
    """Unwrap a ``data`` field when present; otherwise return the object root."""
    raw = load_json_object(body, context=context)
    inner = raw.get("data", raw)
    if isinstance(inner, dict):
        return inner
    return {}


def inner_data_with_request_id(
    body: str, *, context: str
) -> tuple[dict[str, Any], str]:
    """Unwrap ``data`` while preserving a top-level ``request_id``."""
    raw = load_json_object(body, context=context)
    request_id = request_id_from_envelope(raw)
    inner = raw.get("data", raw)
    if isinstance(inner, dict):
        return inner, request_id
    return {}, request_id
