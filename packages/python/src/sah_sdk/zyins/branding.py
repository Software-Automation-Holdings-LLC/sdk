"""Branding sub-client — ``GET /v1/branding``.

Branding is per-license-order whitelabel configuration: agency name,
logo URL, colors, and product restrictions. Identity is derived from
the configured auth context — no body fields required.

The server deliberately does NOT 404 when a row is missing; it returns
a zero-value :class:`BrandingDetail`. See
``docs/design/cases-email-branding-surface.md`` for the #149 auth
elevation context — when session-credentials replace License-HMAC,
this SDK surface is unaffected.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict


class BrandingDetail(BaseModel):
    """Whitelabel detail returned by :meth:`BrandingSubClient.lookup`."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    imo_name: str = ""
    imo_logo: str = ""
    nav_color: str = ""
    main_color: str = ""
    button_color: str = ""
    active_button_color: str = ""
    bg_color: str = ""
    header_text_color: str = ""
    hide_affiliate_leads: bool = False
    prevent_product_selection: bool = False
    default_settings: str = ""


def _unwrap_envelope(raw: str, *, context: str) -> dict[str, Any]:
    if not raw:
        raise ValueError(f"{context}: response body was empty")
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError(f"{context}: response body was not a JSON object")
    data = parsed.get("data")
    if isinstance(data, dict):
        return data
    return parsed


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value in ("true", "1")
    return False


def parse_lookup_response(raw: str) -> BrandingDetail:
    """Parse a branding response, tolerating both bare and ADR-012 envelopes."""
    root = _unwrap_envelope(raw, context="branding.lookup")
    return BrandingDetail(
        imo_name=str(root.get("imo_name") or ""),
        imo_logo=str(root.get("imo_logo") or ""),
        nav_color=str(root.get("nav_color") or ""),
        main_color=str(root.get("main_color") or ""),
        button_color=str(root.get("button_color") or ""),
        active_button_color=str(root.get("active_button_color") or ""),
        bg_color=str(root.get("bg_color") or ""),
        header_text_color=str(root.get("header_text_color") or ""),
        hide_affiliate_leads=_coerce_bool(root.get("hide_affiliate_leads")),
        prevent_product_selection=_coerce_bool(root.get("prevent_product_selection")),
        default_settings=str(root.get("default_settings") or ""),
    )
