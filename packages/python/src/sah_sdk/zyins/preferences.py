"""Preferences sub-client — ``/v1/preferences``.

Preferences are an opaque JSON document stored per (email,
license_order). The SDK does not interpret the document; callers
serialize their own settings shape and pass through.

See ``docs/design/cases-email-branding-surface.md`` for #149 auth
elevation context.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


class PreferencesSetInput(BaseModel):
    """Input for :meth:`PreferencesSubClient.set`."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    prefs: dict[str, Any]

    @field_validator("prefs")
    @classmethod
    def _v_prefs(cls, value: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise ValueError("preferences.set: prefs must be an object")
        return value

    def to_wire_body(self) -> str:
        return json.dumps({"prefs": self.prefs}, separators=(",", ":"))


class PreferencesResult(BaseModel):
    """Result of :meth:`PreferencesSubClient.lookup` / ``set``."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    prefs: dict[str, Any]


def _unwrap_envelope(raw: str) -> dict[str, Any]:
    if not raw:
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        return {}
    data = parsed.get("data")
    if isinstance(data, dict):
        return data
    return parsed


def parse_preferences_response(
    raw: str, *, fallback: dict[str, Any] | None = None
) -> PreferencesResult:
    """Parse a preferences response.

    Falls back to ``fallback`` (typically the original set-request body)
    when the server returns an empty body — POST responses may omit a
    body when no extra data is returned.
    """
    if not raw:
        return PreferencesResult(prefs=fallback or {})
    root = _unwrap_envelope(raw)
    prefs = root.get("prefs")
    if isinstance(prefs, dict):
        return PreferencesResult(prefs=prefs)
    if root and isinstance(root, dict):
        return PreferencesResult(prefs=root)
    return PreferencesResult(prefs=fallback or {})
