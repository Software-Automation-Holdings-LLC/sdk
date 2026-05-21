"""``isa.account.email`` tests."""

from __future__ import annotations

import json

import pytest

from sah_sdk.account import EmailAttachment, EmailEnqueueRequest

from .helpers import RecordingTransport, make_namespace


def test_email_enqueue_single_recipient() -> None:
    transport = RecordingTransport(response_body=json.dumps({"status": "queued"}))
    ns = make_namespace(transport=transport)
    result = ns.email.enqueue(
        EmailEnqueueRequest(to="agent@example.com", subject="hi", body="hello")
    )
    assert result.status == "queued"
    method, url, _, body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v1/email/enqueue")
    payload = json.loads(body or "")
    assert payload["to"] == "agent@example.com"


def test_email_enqueue_multi_recipient_keeps_list() -> None:
    transport = RecordingTransport(response_body=json.dumps({"status": "1"}))
    ns = make_namespace(transport=transport)
    result = ns.email.enqueue(
        EmailEnqueueRequest(
            to=("a@x.io", "b@x.io"),
            subject="hi",
            body="hello",
        )
    )
    # Server may return '1' but the SDK normalizes to 'queued'.
    assert result.status == "queued"
    _, _, _, body = transport.calls[0]
    payload = json.loads(body or "")
    assert payload["to"] == ["a@x.io", "b@x.io"]


def test_email_enqueue_with_attachments_passes_through_base64() -> None:
    transport = RecordingTransport(response_body=json.dumps({"status": "queued"}))
    ns = make_namespace(transport=transport)
    ns.email.enqueue(
        EmailEnqueueRequest(
            to="agent@example.com",
            subject="case",
            body="see attached",
            attachments=(
                EmailAttachment(filename="case.pdf", content="aGVsbG8="),
            ),
        )
    )
    _, _, _, body = transport.calls[0]
    payload = json.loads(body or "")
    assert payload["attachments"] == [{"filename": "case.pdf", "content": "aGVsbG8="}]


def test_email_enqueue_rejects_empty_recipients() -> None:
    transport = RecordingTransport()
    ns = make_namespace(transport=transport)
    with pytest.raises(ValueError, match="at least one recipient"):
        ns.email.enqueue(EmailEnqueueRequest(to="", subject="s", body="b"))
