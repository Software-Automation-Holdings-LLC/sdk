"""Tests for the branding / preferences / cases / email sub-clients."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import pytest

from sah_sdk.core.errors import ISAError
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import (
    CaseCreateInput,
    EmailEnqueueInput,
    PreferencesSetInput,
    ZyInsClient,
)

_TOKEN = os.environ.get(
    "ZYINS_FAKE_TEST_TOKEN", "isa_test_" + "fakepersona" + "1234567890"
)


@dataclass
class RecordingTransport:
    response_status: int = 200
    response_body: str = "{}"
    response_headers: dict[str, str] = field(default_factory=dict)
    calls: list[tuple[str, str, dict[str, str], str | None]] = field(
        default_factory=list
    )

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        self.calls.append((method, url, headers, body))
        return TransportResponse(
            status=self.response_status,
            body=self.response_body,
            headers=self.response_headers,
        )


def _client(transport: RecordingTransport) -> ZyInsClient:
    return ZyInsClient(_TOKEN, transport=transport, base_url="https://test.example")


# ---------------------- branding -----------------------------------


def test_branding_lookup_parses_snake_case() -> None:
    body = json.dumps(
        {
            "imo_name": "Acme Agency",
            "imo_logo": "https://cdn.example/logo.png",
            "nav_color": "#111",
            "hide_affiliate_leads": "true",
            "prevent_product_selection": False,
        }
    )
    transport = RecordingTransport(response_body=body)
    result = _client(transport).branding.lookup()
    assert result.imo_name == "Acme Agency"
    assert result.imo_logo == "https://cdn.example/logo.png"
    assert result.hide_affiliate_leads is True
    assert result.prevent_product_selection is False
    method, url, _headers, _body = transport.calls[0]
    assert method == "GET"
    assert url.endswith("/v1/branding")


def test_branding_lookup_accepts_envelope() -> None:
    body = json.dumps({"data": {"imo_name": "Wrapped Co"}})
    transport = RecordingTransport(response_body=body)
    result = _client(transport).branding.lookup()
    assert result.imo_name == "Wrapped Co"
    assert result.imo_logo == ""


def test_branding_lookup_500_raises() -> None:
    body = json.dumps(
        {"type": "about:blank", "title": "server", "status": 500, "code": "server_error"}
    )
    transport = RecordingTransport(response_status=500, response_body=body)
    with pytest.raises(ISAError):
        _client(transport).branding.lookup()


# ---------------------- preferences -------------------------------


def test_preferences_lookup_returns_prefs() -> None:
    body = json.dumps({"prefs": {"theme": "dark"}})
    transport = RecordingTransport(response_body=body)
    result = _client(transport).preferences.lookup()
    assert result.prefs == {"theme": "dark"}


def test_preferences_set_serializes_body_and_uses_idempotency_key() -> None:
    body = json.dumps({"prefs": {"theme": "dark"}})
    transport = RecordingTransport(response_body=body)
    result = _client(transport).preferences.set(
        PreferencesSetInput(prefs={"theme": "dark"})
    )
    assert result.prefs == {"theme": "dark"}
    method, url, headers, sent_body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v1/preferences")
    assert headers.get("Idempotency-Key")
    assert json.loads(sent_body) == {"prefs": {"theme": "dark"}}


def test_preferences_set_empty_body_falls_back_to_request() -> None:
    transport = RecordingTransport(response_body="")
    result = _client(transport).preferences.set(
        PreferencesSetInput(prefs={"density": "compact"})
    )
    assert result.prefs == {"density": "compact"}


def test_preferences_set_401_raises() -> None:
    body = json.dumps(
        {"type": "about:blank", "title": "unauthorized", "status": 401, "code": "unauthorized"}
    )
    transport = RecordingTransport(response_status=401, response_body=body)
    with pytest.raises(ISAError):
        _client(transport).preferences.set(PreferencesSetInput(prefs={"a": 1}))


# ---------------------- cases -------------------------------------


def test_cases_create_serializes_and_parses_hash() -> None:
    body = json.dumps(
        {
            "object": "case",
            "hash": "abc123",
            "url": "https://share.example/case/abc123",
            "readonly": True,
            "created_at": "2026-05-20T14:32:01Z",
        }
    )
    transport = RecordingTransport(response_body=body)
    result = _client(transport).cases.create(
        CaseCreateInput(
            input={"applicant": {"name": "John Doe"}},
            results={"decided": True},
            products=["senior-life"],
        ),
    )
    assert result.hash == "abc123"
    assert result.readonly is True
    method, url, headers, sent_body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v1/case")
    assert headers.get("Idempotency-Key")
    assert json.loads(sent_body) == {
        "input": {"applicant": {"name": "John Doe"}},
        "results": {"decided": True},
        "products": ["senior-life"],
    }


def test_cases_create_accepts_xml_input_string() -> None:
    body = json.dumps(
        {"object": "case", "hash": "x", "url": "", "readonly": False, "created_at": ""}
    )
    transport = RecordingTransport(response_body=body)
    _client(transport).cases.create(CaseCreateInput(input="<applicant/>"))
    sent = json.loads(transport.calls[0][3])
    assert sent["input"] == "<applicant/>"


def test_cases_create_rejects_empty_input() -> None:
    from pydantic import ValidationError as PydanticValidationError

    with pytest.raises(PydanticValidationError):
        CaseCreateInput(input="")


def test_cases_create_500_raises() -> None:
    body = json.dumps(
        {"type": "about:blank", "title": "server", "status": 500, "code": "server_error"}
    )
    transport = RecordingTransport(response_status=500, response_body=body)
    with pytest.raises(ISAError):
        _client(transport).cases.create(CaseCreateInput(input={"a": 1}))


# ---------------------- email -------------------------------------


def test_email_enqueue_serializes_attachment_as_base64() -> None:
    body = json.dumps({"enqueue_id": "eq_1"})
    transport = RecordingTransport(response_body=body)
    result = _client(transport).email.enqueue(
        EmailEnqueueInput(
            to="jane@smith.com",
            subject="Your case",
            body_html="<p>Hi</p>",
            attachment_filename="case-1.pdf",
            attachment_content="PDF-bytes",
        ),
    )
    assert result.enqueue_id == "eq_1"
    method, url, headers, sent_body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v1/email/enqueue")
    assert headers.get("Idempotency-Key")
    sent = json.loads(sent_body)
    assert sent["to"] == "jane@smith.com"
    # attachment content gets base64-encoded
    import base64

    assert sent["attachment"]["content_base64"] == base64.b64encode(
        b"PDF-bytes"
    ).decode("ascii")


def test_email_enqueue_sends_attachment_content_without_filename() -> None:
    import base64

    payload = EmailEnqueueInput(
        to="jane@smith.com",
        subject="Your case",
        body_html="<p>Hi</p>",
        attachment_content="PDF-bytes",
    ).to_wire_body()
    sent = json.loads(payload)
    assert sent["attachment"]["filename"] == ""
    assert sent["attachment"]["content_base64"] == base64.b64encode(
        b"PDF-bytes"
    ).decode("ascii")


def test_email_enqueue_rejects_missing_to() -> None:
    from pydantic import ValidationError as PydanticValidationError

    with pytest.raises(PydanticValidationError):
        EmailEnqueueInput(to="", subject="s", body_html="b")


def test_cases_email_targets_enqueue_endpoint() -> None:
    body = json.dumps({"enqueue_id": "eq_2"})
    transport = RecordingTransport(response_body=body)
    _client(transport).cases.email(
        EmailEnqueueInput(to="jane@smith.com", subject="s", body_html="b"),
    )
    assert transport.calls[0][1].endswith("/v1/email/enqueue")
