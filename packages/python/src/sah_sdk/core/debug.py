"""Debug logger that streams redacted requests/responses to stderr.

Enabled when ``ISA_LOG=debug`` (case-insensitive) is set in the
environment. Output goes to :data:`sys.stderr` exclusively — never
stdout — so parent processes piping the SDK consumer's JSON output do
not see log noise interleaved with data.

Redaction rules (matches the TS SDK):

* Header values for ``Authorization``, ``X-Device-Signature``, and
  ``X-Session-Signature`` are replaced with ``"<redacted>"``.
* JSON body fields named ``email``, ``dob``, ``ssn``, ``phone``
  (at any nesting level, case-insensitive) are replaced with
  ``"<redacted>"``.

The logger is a facade — tests inject a fake :class:`EnvReader` and
fake ``stream`` to capture output deterministically without touching
the real process env or stderr.
"""

from __future__ import annotations

import json
import sys
from collections.abc import Mapping
from typing import IO, Any, Final

from .env import EnvReader, default_env

_REDACTED: Final[str] = "<redacted>"

# Header names compared case-insensitively. Stored lower-case here so
# the comparator can normalize once.
_REDACT_HEADERS: Final[frozenset[str]] = frozenset(
    {"authorization", "x-device-signature", "x-session-signature"}
)

# Body fields redacted recursively. Compared case-insensitively.
_REDACT_BODY_FIELDS: Final[frozenset[str]] = frozenset({"email", "dob", "ssn", "phone"})


class DebugLogger:
    """Stderr-bound debug logger with PII/credential redaction.

    Construction is cheap when disabled: :attr:`enabled` is read once
    from the env at construction time and every log method short-circuits
    on the cached flag.
    """

    def __init__(
        self,
        *,
        env: EnvReader | None = None,
        stream: IO[str] | None = None,
    ) -> None:
        self._env = env or default_env()
        # CRITICAL: default to sys.stderr, never sys.stdout. Anthropic's
        # SDK has a known bug shipping debug logs to stdout, breaking
        # parent/child JSON pipelines. We do not reproduce that bug.
        self._stream = stream or sys.stderr
        value = self._env.get("ISA_LOG")
        self.enabled = value is not None and value.lower() == "debug"

    def log_request(
        self,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: str | None,
        *,
        attempt: int = 0,
    ) -> None:
        if not self.enabled:
            return
        payload = {
            "direction": "request",
            "method": method,
            "url": url,
            "attempt": attempt,
            "headers": redact_headers(headers),
            "body": redact_body_string(body),
        }
        self._emit(payload)

    def log_response(
        self,
        method: str,
        url: str,
        status: int,
        headers: Mapping[str, str],
        body: str | None,
        *,
        attempt: int = 0,
    ) -> None:
        if not self.enabled:
            return
        payload = {
            "direction": "response",
            "method": method,
            "url": url,
            "attempt": attempt,
            "status": status,
            "headers": redact_headers(headers),
            "body": redact_body_string(body),
        }
        self._emit(payload)

    def _emit(self, payload: dict[str, Any]) -> None:
        line = json.dumps(payload, separators=(",", ":"), default=str)
        # write+flush rather than print() — print() would honor any
        # caller-installed sys.stdout redirection. We bind explicitly
        # to the stream captured at construction.
        self._stream.write(f"isa-sdk debug {line}\n")
        self._stream.flush()


def redact_headers(headers: Mapping[str, str]) -> dict[str, str]:
    """Return a copy of ``headers`` with credential headers masked."""
    out: dict[str, str] = {}
    for name, value in headers.items():
        if name.lower() in _REDACT_HEADERS:
            out[name] = _REDACTED
        else:
            out[name] = value
    return out


def redact_body_string(body: str | None) -> str | None:
    """Redact PII fields in a JSON body string.

    Non-JSON or empty bodies are returned unchanged. Truncated/malformed
    JSON is reported as-is rather than masked silently — the operator
    sees what actually went on the wire.
    """
    if body is None or body == "":
        return body
    try:
        parsed = json.loads(body)
    except (ValueError, json.JSONDecodeError):
        return body
    redacted = _redact_value(parsed)
    return json.dumps(redacted, separators=(",", ":"))


def _redact_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            k: (
                _REDACTED
                if isinstance(k, str) and k.lower() in _REDACT_BODY_FIELDS
                else _redact_value(v)
            )
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_redact_value(v) for v in value]
    return value
