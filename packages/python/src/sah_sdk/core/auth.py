"""Bearer-token auth for the Python SDK.

The TypeScript SDK still carries the legacy HMAC ``AuthContext``
(licenseKey + orderId + email + deviceId). The Python SDK is built
against the post-#286 wire contract: a single bearer token is the
entire auth surface. This module is the injection seam — the client
calls :meth:`BearerAuth.headers` to get the ``Authorization`` header.

If the platform later re-introduces additional identity material, a
new ``AuthContext`` subclass can be added here without changing the
client surface.
"""

from __future__ import annotations

from dataclasses import dataclass

_BEARER_PREFIX_LIVE = "isa_live_"
_BEARER_PREFIX_TEST = "isa_test_"


@dataclass(frozen=True, slots=True)
class BearerAuth:
    """Wraps a single ``isa_live_*`` / ``isa_test_*`` API token."""

    token: str

    def __post_init__(self) -> None:
        if not self.token:
            raise ValueError("BearerAuth: token must be a non-empty string")
        # Tokens are opaque base62-ish strings; reject any character that
        # cannot survive an HTTP ``Authorization`` header. Whitespace and
        # control characters silently break the header or leak credentials
        # into log scrapes — fail fast at construction time instead.
        for ch in self.token:
            if ch.isspace() or ord(ch) < 0x20 or ord(ch) == 0x7F:
                raise ValueError(
                    "BearerAuth: token must not contain whitespace or "
                    "control characters"
                )
        if not (
            self.token.startswith(_BEARER_PREFIX_LIVE)
            or self.token.startswith(_BEARER_PREFIX_TEST)
        ):
            # Soft-warn via exception rather than silent acceptance —
            # the platform rejects non-prefixed tokens anyway.
            raise ValueError(
                "BearerAuth: token must start with 'isa_live_' or 'isa_test_'; "
                "got a token with an unrecognized prefix"
            )

    @property
    def is_test(self) -> bool:
        return self.token.startswith(_BEARER_PREFIX_TEST)

    def headers(self) -> dict[str, str]:
        """Return the auth header(s) to attach to a request."""
        return {"Authorization": f"Bearer {self.token}"}


@dataclass(frozen=True, slots=True)
class LicenseAuth:
    """License-credential auth strategy (agent tools).

    Carries the keycode + email pair. The runtime signing pipeline (HMAC
    body + device binding) is wired by the transport layer in a follow-up
    phase; this class is the injection seam consumers reference today.
    """

    keycode: str
    email: str

    def __post_init__(self) -> None:
        if not self.keycode:
            raise ValueError("LicenseAuth: keycode must be a non-empty string")
        if not self.email:
            raise ValueError("LicenseAuth: email must be a non-empty string")


@dataclass(frozen=True, slots=True)
class SessionAuth:
    """Session-credential auth strategy (embedded forms).

    Carries the session id + signing secret. The runtime signing
    pipeline is wired by the transport layer in a follow-up phase.
    """

    session_id: str
    session_secret: str

    def __post_init__(self) -> None:
        if not self.session_id:
            raise ValueError("SessionAuth: session_id must be a non-empty string")
        if not self.session_secret:
            raise ValueError("SessionAuth: session_secret must be a non-empty string")
