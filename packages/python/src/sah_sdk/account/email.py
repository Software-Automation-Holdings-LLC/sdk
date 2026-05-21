"""``isa.account.email`` — ``POST /v1/email/enqueue``.

Transactional email enqueue. ``to`` accepts either a single address or a
list (server treats a list as multi-recipient send). ``attachments`` is
optional; each entry carries the filename and base64-encoded content
verbatim — encoding is the caller's responsibility so binary payloads
(PDFs) do not pay the cost of a UTF-8 round-trip through the SDK.

The server response shape is ``{"status": "queued" | "1"}`` per the
legacy BPP enqueue surface; both values are accepted and normalized to
``"queued"``.

Mirror of ``packages/ts/src/account/email.ts``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

from ._op import dispatch

if TYPE_CHECKING:
    from . import _OperationContext

_PATH = "/v1/email/enqueue"


@dataclass(frozen=True, slots=True)
class EmailAttachment:
    """One attachment in an email-enqueue request."""

    filename: str
    #: Base64-encoded content. Caller encodes; SDK passes through.
    content: str


@dataclass(frozen=True, slots=True)
class EmailEnqueueRequest:
    """Inputs for ``account.email.enqueue``."""

    #: Recipient address(es). Single string or tuple of strings.
    to: str | tuple[str, ...]
    subject: str
    body: str
    attachments: tuple[EmailAttachment, ...] = ()


@dataclass(frozen=True, slots=True)
class EmailEnqueueResult:
    #: Normalized to ``"queued"`` regardless of which legacy literal the server returns.
    status: Literal["queued"] = "queued"


class AccountEmail:
    """``isa.account.email`` facade."""

    __slots__ = ("_ctx",)

    def __init__(self, ctx: _OperationContext) -> None:
        self._ctx = ctx

    def enqueue(self, request: EmailEnqueueRequest) -> EmailEnqueueResult:
        recipients = _normalize_recipients(request.to)
        if not recipients:
            raise ValueError("account: email.enqueue requires at least one recipient")
        if not isinstance(request.subject, str):
            raise ValueError("account: email.enqueue requires a subject")
        if not isinstance(request.body, str):
            raise ValueError("account: email.enqueue requires a body")
        wire: dict[str, object] = {
            "to": recipients if isinstance(request.to, tuple) else recipients[0],
            "subject": request.subject,
            "body": request.body,
        }
        if request.attachments:
            wire["attachments"] = [
                {"filename": a.filename, "content": a.content}
                for a in request.attachments
            ]
        body = json.dumps(wire, separators=(",", ":"))
        dispatch(self._ctx, method="POST", path=_PATH, body=body)
        return EmailEnqueueResult(status="queued")


def _normalize_recipients(to: str | tuple[str, ...]) -> list[str]:
    if isinstance(to, tuple):
        return [t for t in to if isinstance(t, str) and t]
    if isinstance(to, str) and to:
        return [to]
    return []
