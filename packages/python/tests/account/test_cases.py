"""``isa.account.cases`` tests."""

from __future__ import annotations

import json

import pytest

import sah_sdk.account as account_module
from sah_sdk.account import (
    AccountNamespace,
    AuthContext,
    CaseCreateRequest,
    CaseEmailRequest,
)
from sah_sdk.account._op import dispatch

from .helpers import RecordingTransport, make_namespace


def test_cases_create_posts_input_results_products() -> None:
    transport = RecordingTransport(
        response_body=json.dumps(
            {
                "data": {
                    "hash": "abc123",
                    "url": "https://acme.io/case/abc123",
                    "readonly": False,
                    "created_at": "2026-05-14T14:32:01Z",
                }
            }
        )
    )
    ns = make_namespace(transport=transport)
    result = ns.cases.create(
        CaseCreateRequest(
            input={"age": 64},
            results={"plans": []},
            products=("fex-aetna-accendo",),
        )
    )
    assert result.hash == "abc123"
    assert result.url == "https://acme.io/case/abc123"
    assert result.readonly is False
    method, url, headers, body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v1/case")
    payload = json.loads(body or "")
    assert payload["input"] == {"age": 64}
    assert payload["results"] == {"plans": []}
    assert payload["products"] == ["fex-aetna-accendo"]
    assert "Idempotency-Key" in headers


def test_account_namespace_closes_owned_transport(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created: list[ClosingTransport] = []

    class ClosingTransport(RecordingTransport):
        closed = False

        def __init__(self) -> None:
            super().__init__()
            created.append(self)

        def close(self) -> None:
            self.closed = True

    monkeypatch.setattr(account_module, "HttpTransport", ClosingTransport)
    ns = AccountNamespace(
        auth=AuthContext(
            license_key="lk-123",
            order_id="order-123",
            email="agent@example.com",
            device_id="device-123",
        ),
        base_url="https://account.isaapi.com",
    )

    ns.close()

    assert created
    assert created[0].closed is True


def test_cases_get_signs_path_with_id() -> None:
    transport = RecordingTransport(
        response_body=json.dumps(
            {
                "hash": "abc123",
                "url": "https://acme.io/case/abc123",
                "readonly": True,
                "created_at": "2026-05-14T14:32:01Z",
                "products": ["fex-aetna-accendo"],
            }
        )
    )
    ns = make_namespace(transport=transport)
    summary = ns.cases.get("abc123")
    assert summary.hash == "abc123"
    assert summary.readonly is True
    assert summary.products == ("fex-aetna-accendo",)
    method, url, headers, _ = transport.calls[0]
    assert method == "GET"
    assert url.endswith("/v1/case/abc123")
    assert headers["X-License-URI"] == "/v1/case/abc123"


def test_dispatch_signs_normalized_method() -> None:
    transport = RecordingTransport()
    ns = make_namespace(transport=transport)

    dispatch(ns._ctx, method="get", path="/v1/case/abc123")

    method, _, headers, _ = transport.calls[0]
    assert method == "GET"
    assert headers["X-License-Method"] == "GET"


def test_cases_get_rejects_empty_id() -> None:
    transport = RecordingTransport()
    ns = make_namespace(transport=transport)
    with pytest.raises(ValueError, match="non-empty case id"):
        ns.cases.get("")


def test_cases_list_unwraps_envelope_and_array() -> None:
    transport = RecordingTransport(
        response_body=json.dumps(
            {
                "data": [
                    {"hash": "a", "url": "ua", "readonly": False, "created_at": "t"},
                    {"hash": "b", "url": "ub", "readonly": True, "created_at": "t"},
                ]
            }
        )
    )
    ns = make_namespace(transport=transport)
    items = ns.cases.list()
    assert len(items) == 2
    assert items[0].hash == "a"
    assert items[1].readonly is True


def test_cases_list_rejects_malformed_json() -> None:
    transport = RecordingTransport(response_body="{")
    ns = make_namespace(transport=transport)
    with pytest.raises(ValueError, match=r"account\.cases\.list"):
        ns.cases.list()


def test_cases_email_posts_to_subpath() -> None:
    transport = RecordingTransport(response_body=json.dumps({"queued": True}))
    ns = make_namespace(transport=transport)
    result = ns.cases.email(CaseEmailRequest(case_id="abc", to="agent@example.com"))
    assert result.queued is True
    method, url, _, body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v1/case/abc/email")
    assert json.loads(body or "") == {"to": "agent@example.com"}


def test_cases_email_rejects_empty_fields() -> None:
    transport = RecordingTransport()
    ns = make_namespace(transport=transport)
    with pytest.raises(ValueError, match="case_id"):
        ns.cases.email(CaseEmailRequest(case_id="", to="x@y.z"))
    with pytest.raises(ValueError, match="to address"):
        ns.cases.email(CaseEmailRequest(case_id="abc", to=""))
