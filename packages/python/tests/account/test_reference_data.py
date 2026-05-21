"""``isa.account.reference_data`` tests."""

from __future__ import annotations

import json

import pytest

from .helpers import RecordingTransport, make_namespace


def test_reference_data_dataset_uses_get_path() -> None:
    transport = RecordingTransport(
        response_body=json.dumps({"datasets": {"states": ["NC", "TX"]}})
    )
    ns = make_namespace(transport=transport)
    result = ns.reference_data.get("dataset", dataset="states")
    assert result == {"datasets": {"states": ["NC", "TX"]}}
    method, url, _, body = transport.calls[0]
    assert method == "GET"
    assert url.endswith("/dataset/states")
    assert body is None


def test_reference_data_dataset_requires_name() -> None:
    transport = RecordingTransport()
    ns = make_namespace(transport=transport)
    with pytest.raises(ValueError, match="requires a dataset name"):
        ns.reference_data.get("dataset")


def test_reference_data_compiled_v3_targets_v2_path() -> None:
    transport = RecordingTransport(response_body=json.dumps({"data": {"x": 1}}))
    ns = make_namespace(transport=transport)
    result = ns.reference_data.get("compiled_data_v3", payload={"k": "v"})
    assert result == {"x": 1}
    method, url, _, body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v2/reference-data")
    payload = json.loads(body or "")
    assert payload["scope"] == "compiled_data_v3"
    assert payload["k"] == "v"


def test_reference_data_default_targets_v1_path() -> None:
    transport = RecordingTransport(response_body=json.dumps({"data": {}}))
    ns = make_namespace(transport=transport)
    ns.reference_data.get("compiled_data_v2")
    _, url, _, _ = transport.calls[0]
    assert url.endswith("/v1/reference-data")


def test_reference_data_rejects_empty_scope() -> None:
    transport = RecordingTransport()
    ns = make_namespace(transport=transport)
    with pytest.raises(ValueError, match="non-empty scope"):
        ns.reference_data.get("")
