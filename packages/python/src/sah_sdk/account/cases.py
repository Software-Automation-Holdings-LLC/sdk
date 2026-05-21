"""``isa.account.cases`` — case CRUD + share over ``/v1/case``.

``create`` → ``POST   /v1/case``
``get``    → ``GET    /v1/case/{id}``
``list``   → ``GET    /v1/case``
``email``  → ``POST   /v1/case/{id}/email``

Cases are content-addressed shareable artifacts created from a quote input
+ results + selected products. The server hashes the tuple — identical
inputs dedupe to the same ``hash`` regardless of which license created
the case.

Mirror of ``packages/ts/src/account/cases.ts``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from urllib.parse import quote as urlquote

from ._op import dispatch, parse_json_object, unwrap_envelope

if TYPE_CHECKING:
    from . import _OperationContext

_PATH = "/v1/case"


@dataclass(frozen=True, slots=True)
class CaseCreateRequest:
    """Inputs for ``account.cases.create``."""

    #: Quote input — object converted to XML server-side, or raw XML string.
    input: dict[str, Any] | str
    #: Optional quote results payload.
    results: Any = None
    #: Optional product selection.
    products: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class CaseCreateResult:
    hash: str = ""
    url: str = ""
    readonly: bool = False
    created_at: str = ""


@dataclass(frozen=True, slots=True)
class CaseSummary:
    """A case as returned by ``get`` / ``list``."""

    hash: str = ""
    url: str = ""
    readonly: bool = False
    created_at: str = ""
    input: Any = None
    results: Any = None
    products: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class CaseEmailRequest:
    """Inputs for ``account.cases.email``."""

    case_id: str
    to: str


@dataclass(frozen=True, slots=True)
class CaseEmailResult:
    queued: bool = True


class AccountCases:
    """``isa.account.cases`` facade."""

    __slots__ = ("_ctx",)

    def __init__(self, ctx: _OperationContext) -> None:
        self._ctx = ctx

    def create(self, request: CaseCreateRequest) -> CaseCreateResult:
        if request.input is None:
            raise ValueError("account: cases.create requires input")
        wire: dict[str, Any] = {"input": request.input}
        if request.results is not None:
            wire["results"] = request.results
        if request.products:
            wire["products"] = list(request.products)
        body = json.dumps(wire, separators=(",", ":"))
        raw = dispatch(self._ctx, method="POST", path=_PATH, body=body)
        return _parse_create(raw)

    def get(self, case_id: str) -> CaseSummary:
        if not case_id:
            raise ValueError("account: cases.get requires a non-empty case id")
        path = f"{_PATH}/{urlquote(case_id, safe='')}"
        raw = dispatch(self._ctx, method="GET", path=path)
        return _parse_summary_body(raw)

    def list(self) -> tuple[CaseSummary, ...]:
        raw = dispatch(self._ctx, method="GET", path=_PATH)
        return _parse_summary_list(raw)

    def email(self, request: CaseEmailRequest) -> CaseEmailResult:
        if not request.case_id:
            raise ValueError("account: cases.email requires a non-empty case_id")
        if not request.to:
            raise ValueError("account: cases.email requires a non-empty to address")
        path = f"{_PATH}/{urlquote(request.case_id, safe='')}/email"
        body = json.dumps({"to": request.to}, separators=(",", ":"))
        dispatch(self._ctx, method="POST", path=path, body=body)
        return CaseEmailResult(queued=True)


def _parse_create(body: str) -> CaseCreateResult:
    if not body:
        raise ValueError("account: cases.create response body was empty")
    root = parse_json_object(body, context="account.cases.create")
    return CaseCreateResult(
        hash=_str(root, "hash"),
        url=_str(root, "url"),
        readonly=root.get("readonly") is True,
        created_at=_str(root, "created_at"),
    )


def _parse_summary_body(body: str) -> CaseSummary:
    if not body:
        raise ValueError("account: cases.get response body was empty")
    root = parse_json_object(body, context="account.cases.get")
    return _summary_from_record(root)


def _parse_summary_list(body: str) -> tuple[CaseSummary, ...]:
    if not body:
        return ()
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(f"account.cases.list: response was not valid JSON: {exc}") from exc
    root = unwrap_envelope(parsed)
    if isinstance(root, list):
        return tuple(_summary_from_record(e) for e in root if isinstance(e, dict))
    if isinstance(root, dict) and isinstance(root.get("cases"), list):
        return tuple(
            _summary_from_record(e) for e in root["cases"] if isinstance(e, dict)
        )
    return ()


def _summary_from_record(r: dict[str, Any]) -> CaseSummary:
    products_raw = r.get("products")
    products: tuple[str, ...] = (
        tuple(str(p) for p in products_raw) if isinstance(products_raw, list) else ()
    )
    return CaseSummary(
        hash=_str(r, "hash"),
        url=_str(r, "url"),
        readonly=r.get("readonly") is True,
        created_at=_str(r, "created_at"),
        input=r.get("input"),
        results=r.get("results"),
        products=products,
    )


def _str(r: dict[str, Any], key: str) -> str:
    v = r.get(key)
    return v if isinstance(v, str) else ""
