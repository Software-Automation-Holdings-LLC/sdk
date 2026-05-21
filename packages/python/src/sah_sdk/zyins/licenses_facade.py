"""``isa.zyins.licenses`` — license lifecycle (activate / check / deactivate).

Every method accepts optional arguments; missing fields fall back to the
credentials the parent :class:`Isa` was constructed with. The first
successful :meth:`LicensesFacade.activate` updates the shared credential
state in place so subsequent calls (prequalify, cases.create, …) sign
with the new license key automatically — no caller re-bootstrap.

Mirror of ``packages/ts/src/zyins/isaNamespaces.ts::LicensesFacade``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from ..core.idempotency import generate_idempotency_key
from ..core.license_hmac import LicenseClock, build_license_hmac_headers, system_license_clock
from ..core.transport import HttpTransport, Transport, raise_for_status

if TYPE_CHECKING:
    from .credential_state import IsaCredentialState


_ACTIVATE_PATH = "/v1/licenses/activate"
_CHECK_PATH = "/v1/licenses/check"
_DEACTIVATE_PATH = "/v1/licenses/deactivate"
_DEACTIVATED_STATUS = "deactivated"


@dataclass(frozen=True, slots=True)
class LicensesActivateResult:
    status: str = ""
    license_key: str = ""
    remaining_activations: int = 0


@dataclass(frozen=True, slots=True)
class LicensesCheckResult:
    status: str = ""


@dataclass(frozen=True, slots=True)
class LicensesDeactivateResult:
    status: str = ""


class LicensesFacade:
    """Credential-aware licenses facade.

    Constructor takes the shared :class:`IsaCredentialState` plus the
    transport seam; every method fills missing args from the state's
    snapshot.
    """

    __slots__ = ("_base_url", "_clock", "_state", "_transport")

    def __init__(
        self,
        *,
        state: IsaCredentialState,
        base_url: str,
        transport: Transport | None = None,
        clock: LicenseClock | None = None,
    ) -> None:
        self._state = state
        self._base_url = base_url.rstrip("/")
        self._transport = transport or HttpTransport()
        self._clock = clock or system_license_clock

    def activate(
        self,
        *,
        email: str | None = None,
        keycode: str | None = None,
        device_id: str | None = None,
    ) -> LicensesActivateResult:
        snap = self._state.snapshot()
        body = json.dumps(
            {
                "email": email if email is not None else snap.email,
                "keycode": keycode if keycode is not None else snap.keycode,
                "device_id": device_id if device_id is not None else snap.device_id,
            },
            separators=(",", ":"),
        )
        raw = self._dispatch("POST", _ACTIVATE_PATH, body=body)
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
    ) -> LicensesCheckResult:
        snap = self._state.snapshot()
        payload: dict[str, str] = {
            "email": email if email is not None else snap.email,
            "keycode": keycode if keycode is not None else snap.keycode,
        }
        resolved_device = device_id if device_id is not None else snap.device_id
        if resolved_device:
            payload["device_id"] = resolved_device
        resolved_key = license_key if license_key is not None else snap.license_key
        if resolved_key:
            payload["license_key"] = resolved_key
        body = json.dumps(payload, separators=(",", ":"))
        raw = self._dispatch("POST", _CHECK_PATH, body=body)
        return _parse_check(raw)

    def deactivate(
        self,
        *,
        email: str | None = None,
        keycode: str | None = None,
        device_id: str | None = None,
    ) -> LicensesDeactivateResult:
        snap = self._state.snapshot()
        payload: dict[str, str] = {
            "email": email if email is not None else snap.email,
            "keycode": keycode if keycode is not None else snap.keycode,
        }
        resolved_device = device_id if device_id is not None else snap.device_id
        if resolved_device:
            payload["device_id"] = resolved_device
        body = json.dumps(payload, separators=(",", ":"))
        raw = self._dispatch("POST", _DEACTIVATE_PATH, body=body)
        result = _parse_deactivate(raw)
        self._state.clear_license_key()
        return result

    def _dispatch(self, method: str, path: str, *, body: str) -> str:
        auth = self._state.auth()
        hmac_headers = build_license_hmac_headers(
            license_key=auth.license_key,
            order_id=auth.order_id,
            email=auth.email,
            method=method,
            request_uri=path,
            body=body,
            device_id=auth.device_id,
            clock=self._clock,
        ).as_dict()
        headers: dict[str, str] = {
            **hmac_headers,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Idempotency-Key": generate_idempotency_key(),
        }
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


def _parse_activate(raw: str) -> LicensesActivateResult:
    root = _unwrap(raw, context="licenses.activate")
    auth = root.get("auth")
    license_key = ""
    if isinstance(auth, dict):
        candidate = auth.get("license_key") or auth.get("licenseKey")
        if isinstance(candidate, str):
            license_key = candidate
    if not license_key:
        candidate = root.get("license_key") or root.get("licenseKey")
        if isinstance(candidate, str):
            license_key = candidate
    remaining = root.get("remaining_activations") or root.get("remainingActivations") or 0
    try:
        remaining_int = int(remaining)
    except (TypeError, ValueError):
        remaining_int = 0
    status = root.get("status")
    return LicensesActivateResult(
        status=status if isinstance(status, str) else "",
        license_key=license_key,
        remaining_activations=remaining_int,
    )


def _parse_check(raw: str) -> LicensesCheckResult:
    root = _unwrap(raw, context="licenses.check")
    status = root.get("status")
    return LicensesCheckResult(status=status if isinstance(status, str) else "")


def _parse_deactivate(raw: str) -> LicensesDeactivateResult:
    root = _unwrap(raw, context="licenses.deactivate")
    status = root.get("status")
    if status != _DEACTIVATED_STATUS:
        raise ValueError("licenses.deactivate: response missing deactivated status")
    return LicensesDeactivateResult(status=status if isinstance(status, str) else "")
