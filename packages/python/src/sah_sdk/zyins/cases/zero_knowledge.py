"""Default ``CaseStorage`` implementation: zero-knowledge AES-256-GCM.

The platform stores opaque ciphertext and never holds a key. On
:meth:`put` the SDK mints a fresh 256-bit data key, encrypts the
payload, posts the base64 wire envelope (``ciphertext`` / ``iv`` /
``tag``), and returns the data key as the ``recall_token``. On
:meth:`get` the caller passes that token back; the SDK fetches the
opaque envelope and decrypts locally. The server cannot read any
record.

Wire contract is shared with the TypeScript SDK (#347) — see
``packages/ts/src/account/caseCrypto.ts``. ``product`` is bound as
AEAD additional-data so a record routed under one product cannot be
decrypted while masquerading as another.

HARD RULE — never log the recall token. Never embed it in a thrown
error, telemetry payload, or returned debug record. The token is the
capability; leakage defeats the zero-knowledge guarantee.
"""

from __future__ import annotations

import base64
import json
import os
import secrets
from typing import TYPE_CHECKING, Any, Protocol
from urllib.parse import quote as urlquote

from ...core.errors import ISAError
from .storage import CaseRecord, CaseStorage, PutResult

if TYPE_CHECKING:
    pass


# AES-256 data-key length in bytes. Matches TS ``KEY_BYTES``.
_KEY_BYTES = 32
# AES-GCM nonce length in bytes (96-bit, the GCM-recommended size).
_IV_BYTES = 12
# AES-GCM authentication-tag length in bits → bytes.
_TAG_BITS = 128
_TAG_BYTES = _TAG_BITS // 8

_CASE_PATH = "/v1/case"

# HTTP status mapped to a None record on get (absent / expired).
_HTTP_NOT_FOUND = 404


class _Dispatcher(Protocol):
    """The slice of :class:`ZyInsClient` we depend on.

    Narrowed to the dispatch surface so the storage is constructable
    against any compatible facade in tests without hauling in the full
    HTTP client. The real :class:`ZyInsClient._dispatch` returns a
    response object with at least ``.body`` and ``.status``; the
    Protocol matches structurally.
    """

    def _dispatch(
        self,
        *,
        method: str,
        path: str,
        body: str,
        idempotency_key: str | None = None,
    ) -> Any: ...


class CaseDecryptError(ValueError):
    """Raised when a case envelope fails AES-GCM authentication.

    Indicates one of: wrong recall token, tampered ciphertext, or a
    routing-product mismatch (the ``product`` field bound as AEAD does
    not match the stored envelope). The plaintext cannot be recovered.
    """


class ZeroKnowledgeCaseStorage(CaseStorage):
    """Default :class:`CaseStorage` — client-side AES-256-GCM.

    Constructed implicitly by :meth:`Isa.with_keycode` when no other
    ``case_storage`` is supplied. Tests typically substitute an
    in-memory stub.
    """

    __slots__ = ("_client",)

    def __init__(self, client: _Dispatcher) -> None:
        self._client = client

    def put(self, record: CaseRecord) -> PutResult:
        if record.payload is None:
            raise ValueError("ZeroKnowledgeCaseStorage.put: record.payload is required")
        if not record.product:
            raise ValueError("ZeroKnowledgeCaseStorage.put: record.product is required")
        envelope, key = _encrypt(record.product, record.payload)
        body = json.dumps(
            {"product": record.product, **envelope}, separators=(",", ":")
        )
        response = self._client._dispatch(
            method="POST", path=_CASE_PATH, body=body, idempotency_key=None
        )
        case_id = _parse_created_id(_response_body(response))
        return PutResult(id=case_id, recall_token=_bytes_to_urlsafe_b64(key))

    def get(
        self, id: str, recall_token: str | None = None
    ) -> CaseRecord | None:
        if not id:
            raise ValueError("ZeroKnowledgeCaseStorage.get: id is required")
        if recall_token is None or not recall_token:
            raise ValueError(
                "ZeroKnowledgeCaseStorage.get: recall_token is required to decrypt"
            )
        path = f"{_CASE_PATH}/{urlquote(id, safe='')}"
        # _dispatch raises a typed ISAError on any non-2xx (it calls
        # raise_for_status), so a 404 surfaces as an exception — it never
        # returns a response object with status 404. Catch the not-found
        # case here and map it to None (absent/expired, by design no
        # distinction); any other status (e.g. a 500) propagates so a real
        # error is never swallowed as a missing record.
        try:
            response = self._client._dispatch(
                method="GET", path=path, body="", idempotency_key=None
            )
        except ISAError as err:
            if err.http_status == _HTTP_NOT_FOUND:
                return None
            raise
        envelope, product = _parse_envelope(_response_body(response))
        key = _urlsafe_b64_to_bytes(recall_token)
        payload = _decrypt(product, envelope, key)
        return CaseRecord(payload=payload, product=product, id=id)

    def delete(self, id: str) -> None:
        if not id:
            raise ValueError("ZeroKnowledgeCaseStorage.delete: id is required")
        path = f"{_CASE_PATH}/{urlquote(id, safe='')}"
        self._client._dispatch(
            method="DELETE", path=path, body="", idempotency_key=None
        )


# ---------------------------------------------------------------------------
# Crypto envelope (mirrors TS caseCrypto.ts)
# ---------------------------------------------------------------------------


def _encrypt(product: str, payload: Any) -> tuple[dict[str, str], bytes]:
    """Return ``({ciphertext, iv, tag}, raw_key)`` for ``payload``.

    The auth tag is split off from the AES-GCM output to match the TS
    wire contract (``ciphertext`` and ``tag`` carried separately).
    """
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    raw_key = secrets.token_bytes(_KEY_BYTES)
    iv = os.urandom(_IV_BYTES)
    aesgcm = AESGCM(raw_key)
    serialized = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    sealed = aesgcm.encrypt(iv, serialized, product.encode("utf-8"))
    # AESGCM.encrypt appends the auth tag to the ciphertext; split it
    # back out to match the wire contract.
    split_at = len(sealed) - _TAG_BYTES
    return (
        {
            "ciphertext": _bytes_to_b64(sealed[:split_at]),
            "iv": _bytes_to_b64(iv),
            "tag": _bytes_to_b64(sealed[split_at:]),
        },
        raw_key,
    )


def _decrypt(product: str, envelope: dict[str, str], raw_key: bytes) -> Any:
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    iv = _b64_to_bytes(envelope["iv"])
    ciphertext = _b64_to_bytes(envelope["ciphertext"])
    tag = _b64_to_bytes(envelope["tag"])
    sealed = ciphertext + tag
    aesgcm = AESGCM(raw_key)
    try:
        plaintext = aesgcm.decrypt(iv, sealed, product.encode("utf-8"))
    except InvalidTag as exc:
        # Do not include the recall token, key, or any plaintext slice
        # in the error message — leakage primitive.
        raise CaseDecryptError(
            f"case envelope failed authentication for product {product}: "
            "wrong recall token, tampered ciphertext, or product mismatch"
        ) from exc
    return json.loads(plaintext.decode("utf-8"))


# ---------------------------------------------------------------------------
# Wire helpers
# ---------------------------------------------------------------------------


def _parse_created_id(body: str) -> str:
    if not body:
        raise ValueError("ZeroKnowledgeCaseStorage.put: response body was empty")
    root = json.loads(body)
    if isinstance(root, dict) and isinstance(root.get("data"), dict):
        root = root["data"]
    if not isinstance(root, dict):
        raise ValueError(
            "ZeroKnowledgeCaseStorage.put: response was not a JSON object"
        )
    case_id = root.get("id")
    if not isinstance(case_id, str) or not case_id:
        raise ValueError("ZeroKnowledgeCaseStorage.put: response missing 'id'")
    return case_id


def _parse_envelope(body: str) -> tuple[dict[str, str], str]:
    if not body:
        raise ValueError("ZeroKnowledgeCaseStorage.get: response body was empty")
    root = json.loads(body)
    if isinstance(root, dict) and isinstance(root.get("data"), dict):
        root = root["data"]
    if not isinstance(root, dict):
        raise ValueError(
            "ZeroKnowledgeCaseStorage.get: response was not a JSON object"
        )
    fields = ("ciphertext", "iv", "tag", "product")
    missing = [f for f in fields if not isinstance(root.get(f), str)]
    if missing:
        raise ValueError(
            f"ZeroKnowledgeCaseStorage.get: response missing required field(s): "
            f"{', '.join(missing)}"
        )
    return (
        {
            "ciphertext": root["ciphertext"],
            "iv": root["iv"],
            "tag": root["tag"],
        },
        root["product"],
    )


def _response_body(response: Any) -> str:
    body = getattr(response, "body", "")
    return body if isinstance(body, str) else ""


def _bytes_to_b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _b64_to_bytes(s: str) -> bytes:
    return base64.b64decode(s)


def _bytes_to_urlsafe_b64(b: bytes) -> str:
    # No padding — mirrors TS ``bytesToBase64Url`` which trims ``=``.
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _urlsafe_b64_to_bytes(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


__all__ = ["CaseDecryptError", "ZeroKnowledgeCaseStorage"]
