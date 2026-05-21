"""Test helpers for the account namespace."""

from __future__ import annotations

from dataclasses import dataclass, field

from sah_sdk.account import AccountNamespace, AuthContext
from sah_sdk.core.transport import TransportResponse


@dataclass
class RecordingTransport:
    """Replay-able transport stub that captures every outbound call."""

    response_status: int = 200
    response_body: str = "{}"
    response_headers: dict[str, str] = field(default_factory=dict)
    calls: list[tuple[str, str, dict[str, str], str | None]] = field(default_factory=list)

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        self.calls.append((method, url, dict(headers), body))
        return TransportResponse(
            status=self.response_status,
            body=self.response_body,
            headers=self.response_headers,
        )


FIXED_CLOCK_MS = 1700000000000


def fixed_clock() -> int:
    return FIXED_CLOCK_MS


def make_namespace(
    *,
    transport: RecordingTransport,
    license_key: str = "lk-1234",
    keycode: str = "ABC-123-XYZ",
    email: str = "john.doe@acme-agency.com",
    device_id: str = "device-1",
    base_url: str = "https://account.isaapi.com",
) -> AccountNamespace:
    auth = AuthContext(
        license_key=license_key,
        order_id=keycode,
        email=email,
        device_id=device_id,
    )
    return AccountNamespace(
        auth=auth,
        base_url=base_url,
        transport=transport,
        clock=fixed_clock,
    )
