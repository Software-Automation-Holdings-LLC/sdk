"""Public license-lifecycle sub-client.

Mirrors the proto ``LicensesService.PublicCheck`` and
``LicensesService.PublicDeactivate`` operations defined in
``shared/schemas/api/zyins/v1/licenses.proto``. Targets the canonical
public endpoints ``/v1/licenses/check`` and ``/v1/licenses/deactivate``.

The pre-existing :mod:`license` sub-client (singular) targets the
authenticated ``/v1/license/*`` self-status endpoints and remains for
callers already using it; new code SHOULD use this module.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


def _require_non_empty(value: str, field_name: str) -> str:
    if not value or not value.strip():
        raise ValueError(f"licenses: {field_name} must be non-empty")
    return value


class LicenseCheckInput(BaseModel):
    """Input for :meth:`LicenseSubClient.check`."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    email: str
    keycode: str
    device_id: str = ""
    license_key: str = ""

    @field_validator("email")
    @classmethod
    def _v_email(cls, value: str) -> str:
        return _require_non_empty(value, "email")

    @field_validator("keycode")
    @classmethod
    def _v_keycode(cls, value: str) -> str:
        return _require_non_empty(value, "keycode")

    def to_wire_body(self) -> str:
        payload: dict[str, str] = {"email": self.email, "keycode": self.keycode}
        if self.device_id:
            payload["device_id"] = self.device_id
        if self.license_key:
            payload["license_key"] = self.license_key
        return json.dumps(payload, separators=(",", ":"))


class LicenseCheckResult(BaseModel):
    """Output of :meth:`LicenseSubClient.check`."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    status: str = ""


class LicenseDeactivateInput(BaseModel):
    """Input for :meth:`LicenseSubClient.deactivate`."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    email: str
    keycode: str
    device_id: str = ""

    @field_validator("email")
    @classmethod
    def _v_email(cls, value: str) -> str:
        return _require_non_empty(value, "email")

    @field_validator("keycode")
    @classmethod
    def _v_keycode(cls, value: str) -> str:
        return _require_non_empty(value, "keycode")

    def to_wire_body(self) -> str:
        payload: dict[str, str] = {"email": self.email, "keycode": self.keycode}
        if self.device_id:
            payload["device_id"] = self.device_id
        return json.dumps(payload, separators=(",", ":"))


class LicenseDeactivateResult(BaseModel):
    """Output of :meth:`LicenseSubClient.deactivate`."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    status: str = ""


def _unwrap_envelope(raw: str, *, context: str) -> dict[str, Any]:
    """Return the inner data object for an ADR-012 envelope or the bare body."""
    if not raw:
        raise ValueError(f"{context}: response body was empty")
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError(f"{context}: response body was not a JSON object")
    data = parsed.get("data")
    if isinstance(data, dict):
        return data
    return parsed


def parse_check_response(raw: str) -> LicenseCheckResult:
    return LicenseCheckResult.model_validate(
        _unwrap_envelope(raw, context="licenses.check"),
    )


def parse_deactivate_response(raw: str) -> LicenseDeactivateResult:
    return LicenseDeactivateResult.model_validate(
        _unwrap_envelope(raw, context="licenses.deactivate"),
    )
