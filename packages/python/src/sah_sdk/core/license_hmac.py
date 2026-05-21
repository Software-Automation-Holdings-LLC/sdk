"""License-HMAC request signing.

Python mirror of ``packages/ts/src/core/license/deviceAuth.ts``. Produces the
six headers the BPP/account-API license verifier requires::

    Authorization:        License base64(<licenseKey>:<orderId>:<email>)
    X-Device-ID:          <deviceId>
    X-Device-Signature:   hex(HMAC-SHA256(deviceId, canonical))
    X-License-Method:     <METHOD>
    X-License-URI:        <path[?query]>
    X-License-Timestamp:  <epoch_ms>

The canonical signing string is byte-identical to the TS helper::

    <METHOD>\\n<requestURI>\\n<timestamp>\\n<body>

No trailing newline. Body is the verbatim request body string ("" for GET).
``timestamp`` is the ms-epoch integer rendered as a base-10 string — the
wire form the Go verifier accepts.

The clock is injectable via the :data:`LicenseClock` seam so tests pin
time without monkey-patching ``time.time``.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
from collections.abc import Callable
from dataclasses import dataclass

#: Returns the current time as an integer milliseconds-since-epoch.
LicenseClock = Callable[[], int]


def system_license_clock() -> int:
    """Default :data:`LicenseClock` — UTC wall clock in ms."""
    return int(time.time() * 1000)


def strip_quotes(value: str) -> str:
    """Strip surrounding double-quote characters.

    AsyncStorage values may retain JSON serialization quotes depending on
    the read/write path; auth values are sanitized before use.
    """
    if len(value) >= 2 and value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    return value


def _b64_utf8(value: str) -> str:
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def build_license_header(license_key: str, order_id: str, email: str) -> str:
    """Return the ``Authorization: License <base64>`` header value.

    Mirrors the TS ``buildLicenseHeader``. Retained for callers that need
    the identity header without the per-request HMAC signature; new code
    SHOULD use :func:`build_license_hmac_headers`.
    """
    payload = f"{strip_quotes(license_key)}:{strip_quotes(order_id)}:{strip_quotes(email)}"
    return f"License {_b64_utf8(payload)}"


def compute_device_signature(body: str, device_id: str) -> str:
    """Return ``hex(HMAC-SHA256(deviceId, body))``.

    ``deviceId`` is the HMAC key; ``body`` is the canonical signing string.
    Both are encoded as UTF-8 before signing — matching the TS
    ``computeDeviceSignature`` byte-for-byte.
    """
    clean = strip_quotes(device_id)
    return hmac.new(clean.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


@dataclass(frozen=True, slots=True)
class LicenseHMACHeaders:
    """The six headers produced by :func:`build_license_hmac_headers`."""

    authorization: str
    x_device_id: str
    x_device_signature: str
    x_license_method: str
    x_license_uri: str
    x_license_timestamp: str

    def as_dict(self) -> dict[str, str]:
        return {
            "Authorization": self.authorization,
            "X-Device-ID": self.x_device_id,
            "X-Device-Signature": self.x_device_signature,
            "X-License-Method": self.x_license_method,
            "X-License-URI": self.x_license_uri,
            "X-License-Timestamp": self.x_license_timestamp,
        }


def build_license_hmac_headers(
    *,
    license_key: str,
    order_id: str,
    email: str,
    method: str,
    request_uri: str,
    body: str,
    device_id: str,
    clock: LicenseClock | None = None,
) -> LicenseHMACHeaders:
    """Compute the HMAC-signed License authentication headers.

    Binds the license credentials to a specific request (method, URI, body)
    via HMAC-SHA256. The license identity travels in ``Authorization``;
    the per-request signature lives in ``X-Device-Signature`` over the
    canonical string ``<method>\\n<requestURI>\\n<timestamp>\\n<body>``.

    :raises ValueError: if ``device_id`` is empty.
    """
    if not device_id:
        raise ValueError("license_hmac: device_id must be non-empty")
    timestamp = str((clock or system_license_clock)())
    canonical = f"{method}\n{request_uri}\n{timestamp}\n{body}"
    signature = compute_device_signature(canonical, device_id)
    return LicenseHMACHeaders(
        authorization=build_license_header(license_key, order_id, email),
        x_device_id=strip_quotes(device_id),
        x_device_signature=signature,
        x_license_method=method,
        x_license_uri=request_uri,
        x_license_timestamp=timestamp,
    )
