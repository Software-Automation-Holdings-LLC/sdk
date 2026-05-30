"""Cases sub-client — ``POST /v1/case`` (and shared email helper).

Cases are content-addressed shareable artifacts created from a quote
input + results + selected products. The server hashes the (xml,
results, products) tuple; identical inputs dedupe to the same hash
regardless of which license created the case.

The ``email`` operation on this sub-client targets ``POST /v1/email/enqueue``
(same wire endpoint as :class:`EmailSubClient`) — both expose the
case-share email so callers can pick the namespace that matches their
mental model.

Future ``list`` / ``get`` / ``delete`` operations require net-new
server work tracked in the design doc.
"""

from __future__ import annotations

import base64
import json
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CaseCreateInput(BaseModel):
    """Input for :meth:`CasesSubClient.create`.

    ``input`` is polymorphic at the wire: a dict is converted to XML
    server-side; a string is treated as raw XML.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    input: dict[str, Any] | str
    results: Any = None
    products: list[str] = Field(default_factory=list)

    @field_validator("input")
    @classmethod
    def _v_input(cls, value: Any) -> Any:
        if value is None or value == "":
            raise ValueError("cases.create: input must be non-empty")
        return value

    def to_wire_body(self) -> str:
        payload: dict[str, Any] = {"input": self.input}
        if self.results is not None:
            payload["results"] = self.results
        if self.products:
            payload["products"] = self.products
        return json.dumps(payload, separators=(",", ":"))


class CaseCreateResult(BaseModel):
    """Result of :meth:`CasesSubClient.create`."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    object: str = "case"
    hash: str = ""
    url: str = ""
    readonly: bool = False
    created_at: str = ""


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


def parse_create_response(raw: str) -> CaseCreateResult:
    root = _unwrap_envelope(raw, context="cases.create")
    return CaseCreateResult(
        object=str(root.get("object") or "case"),
        hash=str(root.get("hash") or ""),
        url=str(root.get("url") or ""),
        readonly=bool(root.get("readonly") is True),
        created_at=str(root.get("created_at") or ""),
    )


class EmailEnqueueInput(BaseModel):
    """Input for :meth:`CasesSubClient.email` / :meth:`EmailSubClient.enqueue`."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    to: str
    subject: str
    body_html: str
    attachment_filename: str = ""
    attachment_content: str = ""

    @field_validator("to")
    @classmethod
    def _v_to(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("email.enqueue: to must be non-empty")
        return value

    def to_wire_body(self) -> str:
        payload: dict[str, Any] = {
            "to": self.to,
            "subject": self.subject,
            "body_html": self.body_html,
        }
        if self.attachment_filename or self.attachment_content:
            payload["attachment"] = {
                "filename": self.attachment_filename,
                "content_base64": base64.b64encode(
                    self.attachment_content.encode("utf-8")
                ).decode("ascii"),
            }
        return json.dumps(payload, separators=(",", ":"))


class EmailEnqueueResult(BaseModel):
    """Result of :meth:`EmailSubClient.enqueue`."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    enqueue_id: str = ""


def parse_email_response(raw: str) -> EmailEnqueueResult:
    if not raw:
        return EmailEnqueueResult()
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        return EmailEnqueueResult()
    data = parsed.get("data")
    if isinstance(data, dict):
        parsed = data
    return EmailEnqueueResult(enqueue_id=str(parsed.get("enqueue_id") or ""))


# Re-exports for the storage-adapter surface introduced alongside the
# zero-knowledge case store. The legacy ``CaseCreateInput`` /
# ``CaseCreateResult`` / ``EmailEnqueueInput`` types above remain the
# wire shape for ``isa.zyins.cases.create`` and ``isa.zyins.cases.email``;
# the ``CaseStorage`` Protocol and :class:`ZeroKnowledgeCaseStorage`
# are the adapter surface used by ``isa.zyins.cases.save`` / ``.get`` /
# ``.delete``.
from .storage import CaseRecord, CaseStorage, PutResult  # noqa: E402
from .zero_knowledge import CaseDecryptError, ZeroKnowledgeCaseStorage  # noqa: E402

# ---------------------------------------------------------------------------
# CasesFacade — locked top-level surface for ``isa.zyins.cases``.
#
# Two locked verbs:
#   * ``save(record)``   — persist via the resolved ``CaseStorage`` adapter.
#   * ``recall(id, ...)`` — resolve via the same adapter.
#
# Legacy verbs (``create`` / ``share`` / ``email``) continue to proxy
# through the underlying ``ZyInsClient.cases`` sub-client so existing
# callers do not need to migrate.
#
# The adapter is resolved at :class:`Isa` construction; the facade only
# holds a lazy thunk so non-cases code paths don't pay the cost of
# instantiating the default ``ZeroKnowledgeCaseStorage`` (which pulls
# in ``cryptography``).
# ---------------------------------------------------------------------------


class CasesFacade:
    """``isa.zyins.cases`` — locked top-level case surface.

    Implements the locked verbs ``save`` and ``recall`` per
    ``docs/sdk-syntax-proposal.md``. Both delegate to the configured
    :class:`~sah_sdk.zyins.cases.storage.CaseStorage` adapter:

        result = isa.zyins.cases.save(record)
        record = isa.zyins.cases.recall(result.id, result.recall_token)

    The default adapter (:class:`ZeroKnowledgeCaseStorage`) encrypts
    payloads client-side with AES-256-GCM and returns the per-record
    key as ``recall_token``; carrier adapters substitute their own
    storage and may omit the token.

    Legacy ``share`` / ``email`` are forwarded to the underlying
    :class:`~sah_sdk.zyins.client.ZyInsClient.cases` sub-client so
    existing call sites continue to work unchanged.
    """

    __slots__ = ("_legacy_provider", "_storage_provider")

    def __init__(
        self,
        *,
        storage_provider: Callable[[], CaseStorage],
        legacy_provider: Callable[[], Any],
    ) -> None:
        self._storage_provider = storage_provider
        self._legacy_provider = legacy_provider

    # ------------------------------------------------------------------
    # Locked verbs.
    # ------------------------------------------------------------------

    def save(self, record: CaseRecord) -> PutResult:
        """Persist a record through the resolved ``CaseStorage`` adapter.

        Returns a :class:`~sah_sdk.zyins.cases.storage.PutResult` with
        the adapter-assigned ``id`` plus an opaque ``recall_token``
        (``None`` when the adapter mints no client-side key material).
        """
        return self._storage_provider().put(record)

    def recall(
        self, id: str, recall_token: str | None = None
    ) -> CaseRecord | None:
        """Resolve a previously-saved record.

        ``recall_token`` is required iff :meth:`save` returned one.
        Returns ``None`` when the record is absent — adapters do not
        distinguish "expired" from "never existed" by design.
        """
        return self._storage_provider().get(id, recall_token)

    # ------------------------------------------------------------------
    # Legacy forwards. Kept so the canonical ``isa.zyins.cases.share(...)``
    # / ``.email(...)`` paths from the pre-locked surface remain reachable
    # through the unified ``Isa`` entry.
    # ------------------------------------------------------------------

    def __getattr__(self, name: str) -> Any:
        # Anything not save/recall falls through to the legacy
        # ZyInsClient.cases sub-client (share, email, create, …).
        legacy = self._legacy_provider()
        return getattr(legacy, name)


__all__ = [
    "CaseCreateInput",
    "CaseCreateResult",
    "CaseDecryptError",
    "CaseRecord",
    "CaseStorage",
    "CasesFacade",
    "EmailEnqueueInput",
    "EmailEnqueueResult",
    "PutResult",
    "ZeroKnowledgeCaseStorage",
    "parse_create_response",
    "parse_email_response",
]
