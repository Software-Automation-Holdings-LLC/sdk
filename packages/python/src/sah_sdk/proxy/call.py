"""``isa.proxy.call`` — structured invocation against ``/v1/call``.

The SDK↔proxy hop is signed with canonical session-credential HMAC. The
envelope shape is opaque pass-through::

    {integration_id | integration_uuid, method, params}

Auth headers are emitted by :func:`sah_sdk.core.sign_request.sign`
(``Authorization``, ``X-Isa-Session-Id``, ``X-Isa-Timestamp``,
``X-Isa-Signature``); :func:`call` adds ``Idempotency-Key`` (auto-minted
UUID v4 by default) and ``Content-Type: application/json``.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from ..core.env import IsaConfigError
from ..core.errors import (
    AuthError,
    ISAError,
    IsaIdempotencyConflictError,
    ValidationError,
)
from ..core.sign_request import SignClock, sign_request

DEFAULT_PROXY_ORIGIN = "https://proxy.isaapi.com"
DEFAULT_PROXY_TIMEOUT_SECONDS = 30.0
_PROXY_CALL_PATH = "/v1/call"


@dataclass(frozen=True)
class SessionBinding:
    """Session credentials carried by the parent :class:`Isa`.

    Held immutably so concurrent ``proxy.call`` invocations on one client
    cannot race the credential rotation a future refresh adds.
    """

    session_id: str
    session_secret: str
    proxy_origin: str = DEFAULT_PROXY_ORIGIN


#: HTTP transport seam. The default uses :mod:`urllib`; tests inject a stub
#: returning ``(status, body, headers)`` so they exercise mapping without
#: opening sockets.
Transport = Callable[[str, str, Mapping[str, str], bytes], tuple[int, bytes, dict[str, str]]]


def _default_transport(
    method: str,
    url: str,
    headers: Mapping[str, str],
    body: bytes,
    timeout: float = DEFAULT_PROXY_TIMEOUT_SECONDS,
) -> tuple[int, bytes, dict[str, str]]:
    req = urllib.request.Request(url, data=body, headers=dict(headers), method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            return resp.status, data, dict(resp.headers.items())
    except urllib.error.HTTPError as e:
        # HTTPError carries the response payload — read it so error mapping
        # can see the server's ProblemDetails body.
        data = e.read() if hasattr(e, "read") else b""
        return e.code, data, dict(e.headers.items()) if e.headers else {}


def call(
    binding: SessionBinding,
    *,
    integration_uuid: str | None = None,
    integration_id: int | None = None,
    params: Any = None,
    method: str = "POST",
    idempotency_key: str | None = None,
    clock: SignClock | None = None,
    uuid_factory: Callable[[], str] | None = None,
    transport: Transport | None = None,
    timeout: float = DEFAULT_PROXY_TIMEOUT_SECONDS,
) -> Any:
    """Execute one call against ``/v1/call``.

    :param binding: session credentials + proxy origin.
    :param integration_uuid: preferred opaque identifier.
    :param integration_id: legacy BIGSERIAL identifier (mutually exclusive
        with ``integration_uuid``).
    :param params: opaque JSON-serializable payload forwarded to the
        downstream integration.
    :param method: HTTP method the proxy uses against the integration.
        Defaults to ``POST``.
    :param idempotency_key: optional caller-supplied key; auto-minted as a
        UUID v4 when omitted.
    :returns: parsed JSON response body (envelope shape is whatever the
        server returns).
    :raises ValidationError: when neither/both of the identifiers are set.
    :raises AuthError: on 401 / 403 from the proxy.
    :raises IsaIdempotencyConflictError: on 409 ``idempotency_conflict``.
    :raises ISAError: on any other non-2xx response.
    """
    _validate_identifier(integration_uuid, integration_id)
    body = _build_envelope(
        integration_uuid=integration_uuid,
        integration_id=integration_id,
        method=method,
        params=params,
    )
    sign_kwargs: dict[str, Any] = {
        "method": "POST",
        "path": _PROXY_CALL_PATH,
        "body": body,
        "session_id": binding.session_id,
        "session_secret": binding.session_secret,
    }
    if clock is not None:
        sign_kwargs["clock"] = clock
    signed = sign_request(**sign_kwargs)
    key = idempotency_key or (uuid_factory() if uuid_factory else str(uuid.uuid4()))
    headers_dict = dict(signed.as_dict())
    headers_dict["Content-Type"] = "application/json"
    headers_dict["Idempotency-Key"] = key
    url = binding.proxy_origin.rstrip("/") + _PROXY_CALL_PATH
    if transport is None:
        status, raw, _resp_headers = _default_transport(
            "POST",
            url,
            headers_dict,
            body,
            timeout=timeout,
        )
    else:
        status, raw, _resp_headers = transport("POST", url, headers_dict, body)
    return _handle_response(status, raw)


def _validate_identifier(
    integration_uuid: str | None,
    integration_id: int | None,
) -> None:
    has_uuid = _has_integration_uuid(integration_uuid)
    has_id = _has_integration_id(integration_id)
    if integration_id is not None and not has_id:
        raise ValidationError(
            "proxy.call: integration_id must be a positive integer",
            param="integration_id",
        )
    if has_uuid and has_id:
        raise ValidationError(
            "proxy.call: supply exactly one of integration_uuid or integration_id",
            param="integration_uuid",
        )
    if not has_uuid and not has_id:
        raise ValidationError(
            "proxy.call: supply exactly one of integration_uuid or integration_id",
            param="integration_uuid",
        )


def _build_envelope(
    *,
    integration_uuid: str | None,
    integration_id: int | None,
    method: str,
    params: Any,
) -> bytes:
    """Serialize the envelope deterministically (signed bytes == wire bytes)."""
    envelope: dict[str, Any] = {}
    if _has_integration_uuid(integration_uuid):
        envelope["integration_uuid"] = integration_uuid
    else:
        envelope["integration_id"] = integration_id
    envelope["method"] = method
    envelope["params"] = params
    return json.dumps(envelope, separators=(",", ":")).encode("utf-8")


def _has_integration_uuid(value: str | None) -> bool:
    return isinstance(value, str) and value != ""


def _has_integration_id(value: int | None) -> bool:
    return type(value) is int and value > 0


def _handle_response(status: int, raw: bytes) -> Any:
    parsed = _try_parse_json(raw)
    if 200 <= status < 300:
        return parsed
    code = _extract_code(parsed)
    detail = _extract_detail(parsed, raw)
    request_id = _extract_request_id(parsed)
    if status == 401:
        raise AuthError(detail, http_status=401, request_id=request_id)
    if status == 400:
        raise ValidationError(
            detail,
            http_status=400,
            param=_extract_param(parsed),
            request_id=request_id,
        )
    if status == 409 and code == "idempotency_conflict":
        raise IsaIdempotencyConflictError(
            detail,
            key=_extract_key(parsed),
            first_seen_at=_extract_first_seen_at(parsed),
            http_status=409,
            request_id=request_id,
        )
    raise ISAError(
        detail,
        code=code or "api_error",
        http_status=status,
        request_id=request_id,
    )


def _try_parse_json(raw: bytes) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None


def _extract_code(parsed: Any) -> str | None:
    if isinstance(parsed, dict):
        v = parsed.get("code")
        return v if isinstance(v, str) else None
    return None


def _extract_detail(parsed: Any, raw: bytes) -> str:
    if isinstance(parsed, dict):
        for k in ("detail", "message"):
            v = parsed.get(k)
            if isinstance(v, str):
                return v
    try:
        return raw.decode("utf-8") or "proxy.call failed"
    except UnicodeDecodeError:
        return "proxy.call failed"


def _extract_request_id(parsed: Any) -> str | None:
    if isinstance(parsed, dict):
        v = parsed.get("request_id")
        return v if isinstance(v, str) else None
    return None


def _extract_param(parsed: Any) -> str | None:
    if isinstance(parsed, dict):
        v = parsed.get("param")
        return v if isinstance(v, str) else None
    return None


def _extract_key(parsed: Any) -> str:
    if isinstance(parsed, dict):
        v = parsed.get("key") or parsed.get("idempotency_key")
        if isinstance(v, str):
            return v
    return ""


def _extract_first_seen_at(parsed: Any) -> str | None:
    if isinstance(parsed, dict):
        v = parsed.get("first_seen_at") or parsed.get("firstSeenAt")
        return v if isinstance(v, str) else None
    return None


def require_session_binding(
    session_id: str | None,
    session_secret: str | None,
    *,
    proxy_origin: str = DEFAULT_PROXY_ORIGIN,
) -> SessionBinding:
    """Return a :class:`SessionBinding` or raise :class:`IsaConfigError`.

    Called from :class:`ProxyNamespace.call` to enforce the session-identity
    boundary before any signing or network work.
    """
    if not session_id or not session_secret:
        raise IsaConfigError(
            "proxy.call requires a Session identity; "
            "exchange your bearer/license credentials via "
            "account.sessions.create first"
        )
    return SessionBinding(
        session_id=session_id,
        session_secret=session_secret,
        proxy_origin=proxy_origin,
    )
