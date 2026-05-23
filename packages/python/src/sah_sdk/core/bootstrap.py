"""Embedded HMAC bootstrap signature for POST /v1/sessions.

This module pins the byte-exact wire format documented at
``api/guides/authentication-advanced.md#test-vector`` and reproduced in
``tests/conformance/fixtures/auth-vector.json``. The reference TypeScript
implementation lives at ``packages/ts/src/core/internal/auth/bootstrap.ts``;
this file MUST reproduce the identical hex against the same inputs.

Two-stage flow:

1. Serialize the request body as JSON, keys in source order
   (``keycode``, ``email``, ``deviceId``), no whitespace, no trailing
   newline.
2. Build the canonical signing string and HMAC-SHA256 it with the
   ``license_key`` as the key.

Why a dedicated module: the bootstrap signature predates any session (no
``session_secret`` exists yet), uses the ``license_key`` as the HMAC key,
and is the only call where ``device_id`` appears in the body. The
steady-state session-signing helper (``sign_request``) handles every
other call.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass


@dataclass(frozen=True)
class BootstrapInput:
    """Inputs to the bootstrap signature.

    Mirrors the ``auth-vector`` fixture one-for-one. Field declaration
    order matches the canonical serialized-body order
    (``keycode, email, deviceId``); the body is hand-serialized so the
    Python source order pins the wire bytes.
    """

    keycode: str
    """Per-seat keycode (e.g. ``SDV-HWH-WDD``)."""

    email: str
    """License-owner email (lowercased lookup key server-side)."""

    license_key: str
    """Long-lived license key. HMAC key only — never on the wire."""

    device_id: str
    """Stable per-install device id. Appears in body + ``X-Device-ID``."""

    method: str
    """Uppercase HTTP method, typically ``POST``."""

    path: str
    """Request path with leading ``/v1/``, no query string."""

    timestamp: int
    """Unix seconds. Server tolerates 5 minutes of skew."""


@dataclass(frozen=True)
class BootstrapSignature:
    """Output bundle.

    Returns every intermediate so that conformance tests can assert each
    stage independently — if a future regression flips the
    serialized body, the failure points at exactly that stage instead of
    just "hex differs".
    """

    serialized_body: str
    """JSON body exactly as sent on the wire. Bytes signed verbatim."""

    canonical: str
    """``<ts>.<METHOD> <path>.<body>`` — the HMAC input."""

    hex: str
    """Lowercase hex HMAC-SHA256 over canonical, keyed by license_key."""

    header: str
    """``ISA-Signature: t=<ts>,v1=<hex>`` — ready-to-set header value."""


def build_bootstrap_signature(inp: BootstrapInput) -> BootstrapSignature:
    """Build the byte-exact bootstrap signature.

    Raises:
        ValueError: when any required field is blank or the timestamp is
            non-positive. The locked contract requires every field present.
    """
    if not inp.keycode or inp.keycode != inp.keycode.strip():
        raise ValueError("bootstrap signature: keycode is required")
    if not inp.email or inp.email != inp.email.strip():
        raise ValueError("bootstrap signature: email is required")
    if not inp.license_key or inp.license_key != inp.license_key.strip():
        raise ValueError("bootstrap signature: license_key is required")
    if not inp.device_id or inp.device_id != inp.device_id.strip():
        raise ValueError("bootstrap signature: device_id is required")
    if not inp.method or inp.method != inp.method.strip():
        raise ValueError("bootstrap signature: method is required")
    if not inp.path or inp.path != inp.path.strip():
        raise ValueError("bootstrap signature: path is required")
    if inp.timestamp <= 0:
        raise ValueError("bootstrap signature: timestamp is required")

    serialized_body = _serialize_body(inp.keycode, inp.email, inp.device_id)
    canonical = f"{inp.timestamp}.{inp.method.upper()} {inp.path}.{serialized_body}"
    digest = hmac.new(
        inp.license_key.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return BootstrapSignature(
        serialized_body=serialized_body,
        canonical=canonical,
        hex=digest,
        header=f"ISA-Signature: t={inp.timestamp},v1={digest}",
    )


def _serialize_body(keycode: str, email: str, device_id: str) -> str:
    """Serialize the bootstrap body with pinned key order, no whitespace.

    ``json.dumps`` on a dict preserves insertion order (Python 3.7+); we
    rely on that AND pass ``separators=(',', ':')`` so the JSON is
    minified to match the TypeScript ``JSON.stringify`` output.
    """
    return json.dumps(
        {"keycode": keycode, "email": email, "deviceId": device_id},
        separators=(",", ":"),
        ensure_ascii=False,
    )
