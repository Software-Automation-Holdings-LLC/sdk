"""``isa.account.branding`` — ``GET /v1/branding``.

Whitelabel configuration for the calling license: agency name, logo URL,
theme colors. Identity comes from License-HMAC auth headers; the request
carries no body credentials. The server returns a zero-value document
when no branding row exists (it does NOT 404), so the SDK never
synthesizes a "no branding" error — callers receive an empty
:class:`BrandingDetail`.

Mirror of ``packages/ts/src/account/branding.ts``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from urllib.parse import quote as urlquote

from ._op import dispatch, parse_json_object

if TYPE_CHECKING:
    from . import _OperationContext


_PATH = "/v1/branding"


@dataclass(frozen=True, slots=True)
class BrandingDetail:
    """Whitelabel detail returned by ``account.branding.lookup``."""

    imo_name: str = ""
    imo_logo: str = ""
    primary_color: str = ""
    nav_color: str = ""
    bg_color: str = ""
    button_color: str = ""
    active_button_color: str = ""
    header_text_color: str = ""
    hide_affiliate_leads: bool = False
    prevent_product_selection: bool = False
    default_settings: str = ""


@dataclass(frozen=True, slots=True)
class BrandingLookupRequest:
    """Optional inputs for ``account.branding.lookup``."""

    #: Per-vendor branding source override (server-side allowlist).
    source: str = ""


class AccountBranding:
    """``isa.account.branding`` facade."""

    __slots__ = ("_ctx",)

    def __init__(self, ctx: _OperationContext) -> None:
        self._ctx = ctx

    def lookup(self, request: BrandingLookupRequest | None = None) -> BrandingDetail:
        req = request or BrandingLookupRequest()
        query = f"?source={urlquote(req.source, safe='')}" if req.source else ""
        path = f"{_PATH}{query}"
        body = dispatch(self._ctx, method="GET", path=path)
        return _parse_branding(body)


def _parse_branding(body: str) -> BrandingDetail:
    root = parse_json_object(body, context="account.branding")
    if not root:
        return BrandingDetail()
    return BrandingDetail(
        imo_name=_str(root, "imo_name"),
        imo_logo=_str(root, "imo_logo"),
        primary_color=_first_str(root, ("primary_color", "main_color")),
        nav_color=_str(root, "nav_color"),
        bg_color=_str(root, "bg_color"),
        button_color=_str(root, "button_color"),
        active_button_color=_str(root, "active_button_color"),
        header_text_color=_str(root, "header_text_color"),
        hide_affiliate_leads=_bool(root, "hide_affiliate_leads"),
        prevent_product_selection=_bool(root, "prevent_product_selection"),
        default_settings=_str(root, "default_settings"),
    )


def _str(r: dict[str, Any], key: str) -> str:
    v = r.get(key)
    return v if isinstance(v, str) else ""


def _first_str(r: dict[str, Any], keys: tuple[str, ...]) -> str:
    for k in keys:
        v = r.get(k)
        if isinstance(v, str) and v:
            return v
    return ""


def _bool(r: dict[str, Any], key: str) -> bool:
    v = r.get(key)
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v in ("true", "1")
    return False
