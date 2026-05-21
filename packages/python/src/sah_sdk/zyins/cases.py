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
