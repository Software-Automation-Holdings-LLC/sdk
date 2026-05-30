"""Typed error funnel for the ZyINS Python SDK.

Mirrors ``packages/zyins/js/src/errors.ts``. Every error the SDK raises
is a subclass of :class:`ISAError` (the platform-wide base name in the
post-#286 contract) and carries the same fields as the TS errors: a
stable string ``code``, the HTTP status, the optional request id, an
advice code, a doc url, and a param pointer for validation errors.

Resolution order in :func:`from_http_response` matches the TS funnel:

1. RFC 7807 ``application/problem+json`` body — map by ``code``.
2. Legacy ``ERR_*`` plain-text body — map via :data:`LEGACY_ERR_MAP`.
3. Fallback — generic :class:`ISAError` with ``code='unknown'``.

Callers switch on ``error.code`` — never on HTTP status or message text.
"""

from __future__ import annotations

import json
from typing import Any, Final

LicenseErrorCode = str
PrequalifyErrorCode = str

# NOTE: ``"unknown"`` is deliberately excluded from both sets so that a
# ProblemDetails response with ``code: "unknown"`` (or a missing ``code``
# field, which defaults to ``"unknown"`` in ``from_problem_details``) falls
# through to the generic :class:`ISAError`. This matches the TypeScript
# SDK and prevents cross-domain misclassification (e.g. a datasets or
# usage error being routed into :class:`PrequalifyError`).
LICENSE_ERROR_CODES: Final[frozenset[str]] = frozenset(
    {
        "max_activations",
        "inactive",
        "active_elsewhere",
        "locked",
        "invalid_credentials",
        "no_email",
    }
)

PREQUALIFY_ERROR_CODES: Final[frozenset[str]] = frozenset({"engine_error"})


class ISAError(Exception):
    """Base class for every error the SDK emits."""

    code: str

    def __init__(
        self,
        message: str,
        *,
        code: str,
        http_status: int | None = None,
        request_id: str | None = None,
        advice_code: str | None = None,
        doc_url: str | None = None,
        param: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.http_status = http_status
        self.request_id = request_id
        self.advice_code = advice_code
        self.doc_url = doc_url
        self.param = param

    def __repr__(self) -> str:  # pragma: no cover - cosmetic
        return f"{type(self).__name__}(code={self.code!r}, http_status={self.http_status!r})"


# ``IsaApiError`` is the SDK_DESIGN.md §6 name for the HTTP-response-bearing
# branch of the hierarchy. The existing :class:`ISAError` already plays that
# role for the Python SDK; we expose ``IsaApiError`` as an alias so consumers
# matching the documented surface (``isinstance(e, IsaApiError)``) get the
# same behavior. New error subclasses (e.g. :class:`IsaIdempotencyConflictError`)
# should subclass ``IsaApiError`` directly for forward compatibility.
IsaApiError = ISAError


class IsaIdempotencyConflictError(IsaApiError):
    """409 ``idempotency_conflict`` — same key, different body.

    Per SDK_DESIGN.md §10.3. Exposes :attr:`key` (the conflicting
    ``Idempotency-Key``) and :attr:`first_seen_at` (when the server first
    recorded the original request) so the caller can audit the queued-write
    bug class where a stale key is reused with mutated parameters.
    """

    def __init__(
        self,
        message: str,
        *,
        key: str,
        first_seen_at: str | None = None,
        http_status: int = 409,
        request_id: str | None = None,
        doc_url: str | None = None,
    ) -> None:
        super().__init__(
            message,
            code="idempotency_conflict",
            http_status=http_status,
            request_id=request_id,
            doc_url=doc_url,
        )
        self.key = key
        self.first_seen_at = first_seen_at


class LicenseError(ISAError):
    """License activation / deactivation / check errors."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        http_status: int | None = None,
        request_id: str | None = None,
    ) -> None:
        super().__init__(
            message, code=code, http_status=http_status, request_id=request_id
        )


class PrequalifyError(ISAError):
    """Prequalify validation / engine errors."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        http_status: int | None = None,
        param: str | None = None,
        request_id: str | None = None,
    ) -> None:
        super().__init__(
            message,
            code=code,
            http_status=http_status,
            param=param,
            request_id=request_id,
        )


class ValidationError(ISAError):
    """4xx body-validation failure on any operation."""

    def __init__(
        self,
        message: str,
        *,
        http_status: int = 400,
        param: str | None = None,
        request_id: str | None = None,
    ) -> None:
        super().__init__(
            message,
            code="validation_error",
            http_status=http_status,
            param=param,
            request_id=request_id,
        )


class AuthError(ISAError):
    """401/403 — bearer token rejected or insufficient scope."""

    def __init__(
        self,
        message: str,
        *,
        http_status: int = 401,
        request_id: str | None = None,
    ) -> None:
        super().__init__(
            message, code="auth_error", http_status=http_status, request_id=request_id
        )


class RateLimitError(ISAError):
    """429 with optional ``Retry-After`` hint."""

    def __init__(
        self,
        message: str,
        *,
        code: str = "rate_limit_exceeded",
        http_status: int = 429,
        retry_after_seconds: float | None = None,
        request_id: str | None = None,
    ) -> None:
        super().__init__(
            message, code=code, http_status=http_status, request_id=request_id
        )
        self.retry_after_seconds = retry_after_seconds


class IsaPermissionError(ISAError):
    """403 — caller authenticated but lacks scope for the requested action."""

    def __init__(
        self,
        message: str,
        *,
        http_status: int = 403,
        request_id: str | None = None,
    ) -> None:
        super().__init__(
            message,
            code="permission_denied",
            http_status=http_status,
            request_id=request_id,
        )


class IsaTransportError(ISAError):
    """Network/transport failure — DNS, TLS, connect, read timeout, broken pipe.

    Distinguished from :class:`IsaApiError` because no HTTP response was
    ever received. ``http_status`` is therefore always ``None``.
    """

    def __init__(self, message: str, *, request_id: str | None = None) -> None:
        super().__init__(
            message,
            code="transport_error",
            http_status=None,
            request_id=request_id,
        )


def _coerce_http_status(value: object, fallback: int | None) -> int | None:
    if value is None:
        return fallback
    if isinstance(value, bool):
        return fallback
    if isinstance(value, int):
        return value if value > 0 else fallback
    if isinstance(value, str):
        try:
            parsed = int(value)
        except ValueError:
            return fallback
        return parsed if parsed > 0 else fallback
    return fallback


LEGACY_ERR_MAP: Final[dict[str, str]] = {
    "ERR_MAX_ACTIVATIONS": "max_activations",
    "ERR_INACTIVE": "inactive",
    "ERR_ACTIVE_ELSEWHERE": "active_elsewhere",
    "ERR_LOCKED": "locked",
    "ERR_INVALID_CREDENTIALS": "invalid_credentials",
    "NO_EMAIL": "no_email",
}


def from_http_response(
    status: int,
    body: str,
    *,
    request_id: str | None = None,
    retry_after_seconds: float | None = None,
) -> ISAError:
    """Parse a raw HTTP response into a typed :class:`ISAError`."""
    trimmed = body.strip()
    if status == 429:
        return RateLimitError(
            trimmed or "rate limited",
            http_status=status,
            retry_after_seconds=retry_after_seconds,
            request_id=request_id,
        )
    if status in (401, 403):
        return AuthError(
            trimmed or f"HTTP {status}", http_status=status, request_id=request_id
        )

    problem = _try_parse_problem_details(trimmed)
    if problem is not None:
        return from_problem_details(problem, http_status=status, request_id=request_id)

    legacy = _try_parse_legacy_err(status, trimmed, request_id=request_id)
    if legacy is not None:
        return legacy

    return ISAError(
        trimmed or f"HTTP {status}",
        code="unknown",
        http_status=status,
        request_id=request_id,
    )


def from_problem_details(
    problem: dict[str, Any],
    *,
    http_status: int | None = None,
    request_id: str | None = None,
) -> ISAError:
    """Map a parsed ProblemDetails dict to the right subclass."""
    code = str(problem.get("code", "unknown"))
    message = str(problem.get("detail") or problem.get("title") or "")
    status = _coerce_http_status(problem.get("status"), http_status)
    param = problem.get("param")
    doc_url = problem.get("doc_url")

    if code == "idempotency_conflict":
        key = str(problem.get("idempotency_key") or problem.get("key") or "")
        first_seen = problem.get("first_seen_at") or problem.get("firstSeenAt")
        body_request_id = problem.get("request_id")
        resolved_request_id = (
            request_id
            if request_id is not None
            else (str(body_request_id) if body_request_id is not None else None)
        )
        return IsaIdempotencyConflictError(
            message or "idempotency_conflict",
            key=key,
            first_seen_at=str(first_seen) if first_seen is not None else None,
            http_status=status or 409,
            request_id=resolved_request_id,
            doc_url=str(doc_url) if doc_url is not None else None,
        )
    if code == "license_locked":
        return LicenseError(
            "locked", message, http_status=status, request_id=request_id
        )
    if code == "validation_error":
        return ValidationError(
            message,
            http_status=status or 400,
            param=str(param) if param is not None else None,
            request_id=request_id,
        )
    if code in ("rate_limit_exceeded", "rate_limited"):
        return RateLimitError(
            message, code=code, http_status=status or 429, request_id=request_id
        )
    if code in PREQUALIFY_ERROR_CODES:
        return PrequalifyError(
            code,
            message,
            http_status=status,
            param=str(param) if param is not None else None,
            request_id=request_id,
        )
    if code in LICENSE_ERROR_CODES:
        return LicenseError(code, message, http_status=status, request_id=request_id)

    return ISAError(
        message,
        code=code,
        http_status=status,
        param=str(param) if param is not None else None,
        doc_url=str(doc_url) if doc_url is not None else None,
        request_id=request_id,
    )


def _try_parse_problem_details(body: str) -> dict[str, Any] | None:
    if not body.startswith("{"):
        return None
    try:
        parsed = json.loads(body)
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(parsed, dict):
        return None
    if "code" in parsed or "title" in parsed or "detail" in parsed:
        return parsed
    return None


def _try_parse_legacy_err(
    status: int, body: str, *, request_id: str | None
) -> LicenseError | None:
    mapped = LEGACY_ERR_MAP.get(body)
    if mapped:
        return LicenseError(mapped, body, http_status=status, request_id=request_id)
    if body.startswith("ERR_"):
        return LicenseError("unknown", body, http_status=status, request_id=request_id)
    return None
