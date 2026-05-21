"""Canonical session-signing helper.

Produces the four headers the ISA Platform session verifier requires::

    Authorization:     Bearer <session_secret>
    X-Isa-Session-Id:  <session_id>
    X-Isa-Timestamp:   <iso8601_z>
    X-Isa-Signature:   hex(HMAC-SHA256(session_secret, canonical))

The canonical string is byte-identical to ``session.CanonicalString`` in
``shared/go/auth/session/canonical.go``::

    <METHOD>\\n<path>\\n<hex(sha256(body))>\\n<timestamp>\\n<session_id>

No trailing newline. The Go ground truth pins the bytes both sides hash.
"""

from __future__ import annotations

import hashlib
import hmac
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

_EMPTY_SHA256 = (
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
)

#: Clock seam — returns the current UTC instant. Default is the system
#: wall clock; tests pin time by passing a callable that returns a fixed
#: ``datetime``.
SignClock = Callable[[], datetime]


def _system_clock() -> datetime:
    return datetime.now(tz=timezone.utc)


def format_timestamp(now: datetime) -> str:
    """Format ``now`` as RFC 3339 UTC with a ``Z`` suffix and no fractional seconds.

    Naive datetimes are assumed to already be in UTC; aware datetimes are
    converted to UTC before formatting. Microseconds are dropped to match
    Go's ``time.RFC3339`` rendering for whole-second instants.
    """
    if now.tzinfo is not None:
        now = now.astimezone(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%SZ")


def canonical_string(
    method: str,
    path: str,
    body: bytes | str,
    timestamp: str,
    session_id: str,
) -> str:
    """Build the canonical signing string. Pure function; safe to call directly."""
    body_bytes = body.encode("utf-8") if isinstance(body, str) else bytes(body)
    body_hash_hex = (
        _EMPTY_SHA256
        if not body_bytes
        else hashlib.sha256(body_bytes).hexdigest()
    )
    return "\n".join(
        [
            method.upper(),
            path,
            body_hash_hex,
            timestamp,
            session_id,
        ]
    )


@dataclass(frozen=True, slots=True)
class SignedHeaders:
    """The four headers produced by :func:`sign_request`."""

    authorization: str
    isa_session_id: str
    isa_timestamp: str
    isa_signature: str

    def as_dict(self) -> dict[str, str]:
        """Return a header dict suitable for ``requests`` / ``httpx``."""
        return {
            "Authorization": self.authorization,
            "X-Isa-Session-Id": self.isa_session_id,
            "X-Isa-Timestamp": self.isa_timestamp,
            "X-Isa-Signature": self.isa_signature,
        }


def sign_request(
    *,
    method: str,
    path: str,
    body: bytes | str,
    session_id: str,
    session_secret: str,
    clock: SignClock | None = None,
) -> SignedHeaders:
    """Compute the canonical session-auth headers for a single request.

    The body is sha256'd, never sent in the header. The session secret
    travels in ``Authorization: Bearer …``; the per-request signature
    travels in ``X-Isa-Signature``. The four headers together are the
    wire contract the Go verifier admits.

    :raises ValueError: if ``session_id`` or ``session_secret`` is empty.
    """
    if not session_id:
        raise ValueError("sign_request: session_id must be a non-empty string")
    if not session_secret:
        raise ValueError(
            "sign_request: session_secret must be a non-empty string"
        )
    clock_fn = clock or _system_clock
    timestamp = format_timestamp(clock_fn())
    canonical = canonical_string(method, path, body, timestamp, session_id)
    signature = hmac.new(
        session_secret.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return SignedHeaders(
        authorization=f"Bearer {session_secret}",
        isa_session_id=session_id,
        isa_timestamp=timestamp,
        isa_signature=signature,
    )
