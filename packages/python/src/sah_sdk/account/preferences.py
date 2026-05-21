"""``isa.account.preferences`` — ``GET`` / ``POST /v1/preferences``.

Per-license opaque settings document, partitioned by caller-supplied
``scope``. bpp2.0 passes ``scope="bpp"``; future surfaces (eApp, agent
dashboard) pass their own value so writes do not stomp each other.

The SDK does not interpret the document — callers serialize their own
settings shape and pass through.

Mirror of ``packages/ts/src/account/preferences.ts``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any
from urllib.parse import quote as urlquote

from ._op import dispatch, unwrap_envelope

if TYPE_CHECKING:
    from . import _OperationContext


_PATH = "/v1/preferences"


#: Opaque preferences document — keys and values are caller-defined.
PreferencesDocument = dict[str, Any]


@dataclass(frozen=True, slots=True)
class PreferencesLookupRequest:
    """Input for ``account.preferences.lookup``."""

    #: Required partition key. Different surfaces pass different scopes.
    scope: str


@dataclass(frozen=True, slots=True)
class PreferencesLookupResult:
    prefs: PreferencesDocument = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class PreferencesSetRequest:
    """Input for ``account.preferences.set``."""

    #: Required partition key matching the corresponding ``lookup``.
    scope: str
    #: Document to upsert.
    prefs: PreferencesDocument


@dataclass(frozen=True, slots=True)
class PreferencesSetResult:
    ok: bool = True


class AccountPreferences:
    """``isa.account.preferences`` facade."""

    __slots__ = ("_ctx",)

    def __init__(self, ctx: _OperationContext) -> None:
        self._ctx = ctx

    def lookup(self, scope: str) -> PreferencesLookupResult:
        if not scope:
            raise ValueError("account: preferences.lookup requires a non-empty scope")
        path = f"{_PATH}?scope={urlquote(scope, safe='')}"
        body = dispatch(self._ctx, method="GET", path=path)
        return PreferencesLookupResult(prefs=_parse_prefs(body))

    def set(self, scope: str, prefs: PreferencesDocument) -> PreferencesSetResult:
        if not scope:
            raise ValueError("account: preferences.set requires a non-empty scope")
        if not isinstance(prefs, dict):
            raise ValueError("account: preferences.set requires a prefs dict")
        body = json.dumps({"scope": scope, "prefs": prefs}, separators=(",", ":"))
        dispatch(self._ctx, method="POST", path=_PATH, body=body)
        return PreferencesSetResult(ok=True)


def _parse_prefs(body: str) -> PreferencesDocument:
    if not body:
        return {}
    try:
        parsed: Any = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"account: preferences response was not valid JSON: {exc}"
        ) from exc
    root = unwrap_envelope(parsed)
    if isinstance(root, dict) and "prefs" in root:
        prefs = root.get("prefs")
        if isinstance(prefs, dict):
            return dict(prefs)
    if isinstance(root, dict):
        return dict(root)
    return {}
