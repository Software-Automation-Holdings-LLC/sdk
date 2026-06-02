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
from .case_crypto import CaseEnvelope, decrypt_case, encrypt_case
from .case_link import assemble_link, parse_link

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


@dataclass(frozen=True, slots=True)
class CaseShareRequest:
    """Inputs for ``account.cases.share`` — the zero-knowledge share path."""

    #: Routing tag stored cleartext and bound as AEAD data during encryption.
    product: str
    #: Arbitrary JSON payload, encrypted client-side before it leaves the SDK.
    payload: Any


@dataclass(frozen=True, slots=True)
class CaseShareResult:
    """Result of ``account.cases.share``: case id + assembled share link."""

    #: Server-assigned case id.
    id: str
    #: Full share link ``{viewer}/<id>#k=<base64url(key)>``.
    link: str


@dataclass(frozen=True, slots=True)
class CaseOpenResult:
    """A decrypted case returned by ``account.cases.open``."""

    #: Routing tag the case was created under.
    product: str
    #: The decrypted payload.
    payload: Any


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

    def share(self, request: CaseShareRequest) -> CaseShareResult:
        """Encrypt a payload client-side, store the opaque envelope via
        ``POST /v1/case``, and return the fragment-keyed share link. The
        decryption key never reaches the server. The link is returned as a
        value and nothing else — never logged, never on a thrown error."""
        if not request.product:
            raise ValueError("account: cases.share requires a product")
        if request.payload is None:
            raise ValueError("account: cases.share requires a payload")
        encrypted = encrypt_case(
            request.product, request.payload, self._ctx.random_bytes
        )
        wire = {
            "product": request.product,
            "ciphertext": encrypted.envelope.ciphertext,
            "iv": encrypted.envelope.iv,
            "tag": encrypted.envelope.tag,
        }
        body = json.dumps(wire, separators=(",", ":"))
        raw = dispatch(self._ctx, method="POST", path=_PATH, body=body)
        case_id = _str(
            parse_json_object(raw, context="account.cases.share"), "id"
        )
        if not case_id:
            raise ValueError("account: cases.share response missing 'id'")
        link = assemble_link(
            self._ctx.case_viewer_base_url, case_id, encrypted.key_fragment
        )
        return CaseShareResult(id=case_id, link=link)

    def open(self, link: str) -> CaseOpenResult:
        """Resolve a share link: parse the code + fragment key, fetch the
        opaque envelope via ``GET /v1/case/{code}``, and decrypt locally. The
        key comes only from the link the caller already holds."""
        parsed = parse_link(link)
        path = f"{_PATH}/{urlquote(parsed.code, safe='')}"
        raw = dispatch(self._ctx, method="GET", path=path)
        root = parse_json_object(raw, context="account.cases.open")
        product = _str(root, "product")
        if not product:
            raise ValueError("account: cases.open response missing 'product'")
        envelope = CaseEnvelope(
            ciphertext=_str(root, "ciphertext"),
            iv=_str(root, "iv"),
            tag=_str(root, "tag"),
        )
        payload = decrypt_case(product, envelope, parsed.key_fragment)
        return CaseOpenResult(product=product, payload=payload)


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
