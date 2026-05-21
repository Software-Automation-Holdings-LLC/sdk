"""Internal per-operation dispatch helper.

Centralizes the License-HMAC header assembly + transport dispatch + error
funneling so each operation module (branding, preferences, cases, email,
reference_data) is concerned only with request body construction and
response parsing.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from ..core.idempotency import generate_idempotency_key
from ..core.license_hmac import build_license_hmac_headers
from ..core.transport import raise_for_status

if TYPE_CHECKING:
    from . import _OperationContext


def dispatch(
    ctx: _OperationContext,
    *,
    method: str,
    path: str,
    body: str = "",
    accept: str = "application/json",
    idempotency_key: str | None = None,
    extra_headers: dict[str, str] | None = None,
) -> str:
    """Sign + send a single request, raising on non-2xx. Returns response body."""
    method_upper = method.upper()
    auth = ctx.auth()
    hmac_headers = build_license_hmac_headers(
        license_key=auth.license_key,
        order_id=auth.order_id,
        email=auth.email,
        method=method_upper,
        request_uri=path,
        body=body,
        device_id=auth.device_id,
        clock=ctx.clock,
    ).as_dict()
    headers: dict[str, str] = {**hmac_headers, "Accept": accept}
    if body:
        headers["Content-Type"] = "application/json"
    if method_upper in {"POST", "PUT", "PATCH", "DELETE"}:
        headers["Idempotency-Key"] = idempotency_key or generate_idempotency_key()
    if extra_headers:
        headers.update(extra_headers)
    response = ctx.transport.request(
        method_upper,
        f"{ctx.base_url}{path}",
        headers=headers,
        body=body if body else None,
    )
    raise_for_status(response)
    return response.body


def unwrap_envelope(parsed: Any) -> Any:
    """If ``parsed`` is the ADR-012 ``{data: ...}`` envelope, return the inner data."""
    if isinstance(parsed, dict) and "data" in parsed:
        data = parsed.get("data")
        if data is not None:
            return data
    return parsed


def parse_json_object(body: str, *, context: str) -> dict[str, Any]:
    """Parse a JSON object body, unwrap the envelope, return the inner dict.

    Returns an empty dict for an empty body. Raises :class:`ValueError`
    when the body is non-empty but malformed.
    """
    if not body:
        return {}
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{context}: response was not valid JSON: {exc}") from exc
    root = unwrap_envelope(parsed)
    if isinstance(root, dict):
        return root
    return {}
