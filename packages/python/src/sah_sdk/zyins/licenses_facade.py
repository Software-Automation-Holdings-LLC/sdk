"""``isa.zyins.licenses`` — license lifecycle (activate / check / deactivate).

Every method accepts optional arguments; missing fields fall back to the
credentials the parent :class:`Isa` was constructed with. The first
successful :meth:`LicenseFacade.activate` updates the shared credential
state in place so subsequent calls (prequalify, cases.create, …) sign
with the new license key automatically — no caller re-bootstrap.

These three operations target the bootstrap endpoints
``/v2/licenses/{activate,check,deactivate}`` which sit OUTSIDE
``AuthMiddleware`` on the server: ``activate`` is the call that MINTS
the ``licenseKey``, so we cannot sign requests with a credential we do
not yet have. Headers carry only ``Idempotency-Key`` and ``X-Device-ID``;
no HMAC signature, no ``Authorization`` header.

The public Python dataclass shape (``LicenseActivateResult.license_key``)
is preserved; only the wire parsing adapts to the v2 envelope shape
(``data.licenseKey`` flat, not nested under ``auth``).

Mirror of ``packages/ts/src/zyins/license.ts``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from ..core.idempotency import generate_idempotency_key
from ..core.transport import HttpTransport, Transport, raise_for_status

if TYPE_CHECKING:
    from .credential_state import IsaCredentialState


_ACTIVATE_PATH = "/v2/licenses/activate"
_CHECK_PATH = "/v2/licenses/check"
_DEACTIVATE_PATH = "/v2/licenses/deactivate"
_DEACTIVATED_STATUS = "inactive"
# Legacy v1 word; accepted for back-compat against any server still
# emitting the old wire string.
_DEACTIVATED_STATUS_LEGACY = "deactivated"


@dataclass(frozen=True, slots=True)
class LicenseActivateResult:
    status: str = ""
    license_key: str = ""
    remaining_activations: int = 0


@dataclass(frozen=True, slots=True)
class LicenseCheckResult:
    status: str = ""


@dataclass(frozen=True, slots=True)
class LicenseDeactivateResult:
    status: str = ""


class LicenseFacade:
    """Credential-aware licenses facade.

    Constructor takes the shared :class:`IsaCredentialState` plus the
    transport seam; every method fills missing args from the state's
    snapshot.
    """

    __slots__ = ("_base_url", "_state", "_transport")

    def __init__(
        self,
        *,
        state: IsaCredentialState,
        base_url: str,
        transport: Transport | None = None,
        clock: Any | None = None,
    ) -> None:
        self._state = state
        self._base_url = base_url.rstrip("/")
        self._transport = transport or HttpTransport()

    def activate(
        self,
        *,
        email: str | None = None,
        keycode: str | None = None,
        device_id: str | None = None,
    ) -> LicenseActivateResult:
        snap = self._state.snapshot()
        resolved_device = device_id if device_id is not None else snap.device_id
        body = json.dumps(
            {
                "email": email if email is not None else snap.email,
                "keycode": keycode if keycode is not None else snap.keycode,
                "deviceId": resolved_device,
            },
            separators=(",", ":"),
        )
        raw = self._dispatch("POST", _ACTIVATE_PATH, body=body, device_id=resolved_device)
        result = _parse_activate(raw)
        if result.license_key:
            self._state.refresh_license_key(result.license_key)
        return result

    def check(
        self,
        *,
        email: str | None = None,
        keycode: str | None = None,
        device_id: str | None = None,
        license_key: str | None = None,
    ) -> LicenseCheckResult:
        snap = self._state.snapshot()
        payload: dict[str, str] = {
            "email": email if email is not None else snap.email,
            "keycode": keycode if keycode is not None else snap.keycode,
        }
        resolved_device = device_id if device_id is not None else snap.device_id
        if resolved_device:
            payload["deviceId"] = resolved_device
        resolved_key = license_key if license_key is not None else snap.license_key
        if resolved_key:
            payload["licenseKey"] = resolved_key
        body = json.dumps(payload, separators=(",", ":"))
        raw = self._dispatch("POST", _CHECK_PATH, body=body, device_id=resolved_device)
        return _parse_check(raw)

    def deactivate(
        self,
        *,
        email: str | None = None,
        keycode: str | None = None,
        device_id: str | None = None,
    ) -> LicenseDeactivateResult:
        snap = self._state.snapshot()
        payload: dict[str, str] = {
            "email": email if email is not None else snap.email,
            "keycode": keycode if keycode is not None else snap.keycode,
        }
        resolved_device = device_id if device_id is not None else snap.device_id
        if resolved_device:
            payload["deviceId"] = resolved_device
        body = json.dumps(payload, separators=(",", ":"))
        raw = self._dispatch("POST", _DEACTIVATE_PATH, body=body, device_id=resolved_device)
        result = _parse_deactivate(raw)
        self._state.clear_license_key()
        return result

    def _dispatch(self, method: str, path: str, *, body: str, device_id: str) -> str:
        # Bootstrap-only headers. activate is the call that MINTS the
        # license key — signing here would require a credential the
        # client does not yet have. The server tracks the activation
        # slot by X-Device-ID; no Authorization, no HMAC signature.
        headers: dict[str, str] = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Idempotency-Key": generate_idempotency_key(),
        }
        if device_id:
            headers["X-Device-ID"] = device_id
        response = self._transport.request(
            method,
            f"{self._base_url}{path}",
            headers=headers,
            body=body,
        )
        raise_for_status(response)
        return response.body


def _unwrap(raw: str, *, context: str) -> dict[str, Any]:
    if not raw:
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError(f"{context}: response body was not a JSON object")
    data = parsed.get("data")
    if isinstance(data, dict):
        return data
    return parsed


def _parse_activate(raw: str) -> LicenseActivateResult:
    root = _unwrap(raw, context="licenses.activate")
    # v2 wire shape: data.licenseKey at top of data. Legacy v1 nested
    # under data.auth.license_key is still accepted for back-compat.
    license_key = ""
    candidate = root.get("licenseKey") or root.get("license_key")
    if isinstance(candidate, str):
        license_key = candidate
    if not license_key:
        auth = root.get("auth")
        if isinstance(auth, dict):
            nested = auth.get("licenseKey") or auth.get("license_key")
            if isinstance(nested, str):
                license_key = nested
    remaining = root.get("remainingActivations")
    if remaining is None:
        remaining = root.get("remaining_activations")
    if remaining is None:
        remaining = 0
    try:
        remaining_int = int(remaining)
    except (TypeError, ValueError):
        remaining_int = 0
    status = root.get("status")
    return LicenseActivateResult(
        status=status if isinstance(status, str) else "",
        license_key=license_key,
        remaining_activations=remaining_int,
    )


def _parse_check(raw: str) -> LicenseCheckResult:
    root = _unwrap(raw, context="licenses.check")
    status = root.get("status")
    return LicenseCheckResult(status=status if isinstance(status, str) else "")


def _parse_deactivate(raw: str) -> LicenseDeactivateResult:
    root = _unwrap(raw, context="licenses.deactivate")
    status = root.get("status")
    if status not in (_DEACTIVATED_STATUS, _DEACTIVATED_STATUS_LEGACY):
        raise ValueError("licenses.deactivate: response missing inactive status")
    return LicenseDeactivateResult(status=status if isinstance(status, str) else "")
