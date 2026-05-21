"""``isa.account.reference_data`` — engine reference-data lookups.

Three wire paths, one typed surface::

    scope == 'dataset'           → GET   /dataset/{dataset}
    scope == 'compiled_data_v2'  → POST  /v1/reference-data
    scope == 'compiled_data_v3'  → POST  /v2/reference-data
    (other scope values)         → POST  /v1/reference-data

The scope value is forwarded to the server in the request body for the
POST paths so the server can dispatch to the right compiled-data version.
For the GET path the ``dataset`` field selects the dataset by name; no
body is sent.

Return shape is the server's verbatim JSON, unwrapped from the standard
``{"data": ...}`` envelope when present. The common case is
``{"datasets": {...}}``; some endpoints return a flat record. The SDK does
not interpret the payload — callers pick the fields they need.

Mirror of ``packages/ts/src/account/referenceData.ts``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from urllib.parse import quote as urlquote

from ._op import dispatch, unwrap_envelope

if TYPE_CHECKING:
    from . import _OperationContext


_REFERENCE_V1_PATH = "/v1/reference-data"
_REFERENCE_V2_PATH = "/v2/reference-data"
_DATASET_PREFIX = "/dataset/"


@dataclass(frozen=True, slots=True)
class ReferenceDataRequest:
    """Inputs for ``account.reference_data.get``."""

    #: Server-side dispatcher key. ``'dataset'`` routes to ``GET /dataset/{name}``;
    #: ``'compiled_data_v2'`` routes to ``POST /v1/reference-data``;
    #: ``'compiled_data_v3'`` routes to ``POST /v2/reference-data``;
    #: other values default to ``/v1/reference-data`` for forward compatibility.
    scope: str
    #: Required when ``scope == 'dataset'``. Names the dataset to fetch.
    dataset: str = ""
    #: Optional caller-supplied filters / parameters; forwarded as the POST body.
    payload: dict[str, Any] | None = None


#: Response shape — opaque to the SDK.
ReferenceDataResult = dict[str, Any]


class AccountReferenceData:
    """``isa.account.reference_data`` facade."""

    __slots__ = ("_ctx",)

    def __init__(self, ctx: _OperationContext) -> None:
        self._ctx = ctx

    def get(
        self,
        scope: str,
        *,
        dataset: str = "",
        payload: dict[str, Any] | None = None,
    ) -> ReferenceDataResult:
        if not scope:
            raise ValueError("account: reference_data.get requires a non-empty scope")
        if scope == "dataset":
            return self._fetch_dataset(dataset)
        return self._post_reference(scope, payload or {})

    def _fetch_dataset(self, dataset: str) -> ReferenceDataResult:
        if not dataset:
            raise ValueError(
                "account: reference_data.get(scope='dataset') requires a dataset name"
            )
        path = f"{_DATASET_PREFIX}{urlquote(dataset, safe='')}"
        body = dispatch(self._ctx, method="GET", path=path)
        return _parse(body)

    def _post_reference(self, scope: str, payload: dict[str, Any]) -> ReferenceDataResult:
        path = _REFERENCE_V2_PATH if scope == "compiled_data_v3" else _REFERENCE_V1_PATH
        wire: dict[str, Any] = {"scope": scope}
        wire.update(payload)
        body = json.dumps(wire, separators=(",", ":"))
        raw = dispatch(self._ctx, method="POST", path=path, body=body)
        return _parse(raw)


def _parse(body: str) -> ReferenceDataResult:
    if not body:
        return {}
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"account: reference-data response was not valid JSON: {exc}"
        ) from exc
    root = unwrap_envelope(parsed)
    if isinstance(root, dict):
        return dict(root)
    return {"data": root}
