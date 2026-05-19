"""Tests for the ``client.datasets`` sub-client and parsers."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

import pytest

from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import Dataset, ZyInsClient
from sah_sdk.zyins.datasets import parse_dataset, parse_dataset_list

_TOKEN = os.environ.get(
    "ZYINS_FAKE_TEST_TOKEN", "isa_test_" + "fakepersona" + "1234567890"
)


@dataclass
class RecordingTransport:
    """In-memory transport that records every request."""

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


# ---------------------------------------------------------------------------
# parse_dataset_list — must tolerate every reasonable wire shape.
# ---------------------------------------------------------------------------


def test_parse_dataset_list_from_bare_array() -> None:
    body = json.dumps(
        [{"id": "conditions", "name": "Conditions", "version": "2026-05"}]
    )
    result = parse_dataset_list(body)
    assert len(result) == 1
    assert result[0].id == "conditions"


def test_parse_dataset_list_from_data_envelope() -> None:
    body = json.dumps(
        {"data": [{"id": "drugs", "name": "Drugs"}], "request_id": "req_x"}
    )
    result = parse_dataset_list(body)
    assert len(result) == 1
    assert result[0].name == "Drugs"


def test_parse_dataset_list_from_legacy_datasets_envelope() -> None:
    body = json.dumps({"datasets": [{"id": "states"}]})
    result = parse_dataset_list(body)
    assert result[0].id == "states"


def test_parse_dataset_list_empty_body_returns_empty_tuple() -> None:
    assert parse_dataset_list("") == ()


def test_parse_dataset_list_unexpected_root_returns_empty() -> None:
    # The previous implementation crashed with ``AttributeError`` on a
    # scalar root; the parser must funnel through to an empty result.
    assert parse_dataset_list(json.dumps(42)) == ()


# ---------------------------------------------------------------------------
# parse_dataset — single resource.
# ---------------------------------------------------------------------------


def test_parse_dataset_from_data_wrapper() -> None:
    body = json.dumps({"data": {"id": "conditions", "version": "2026-05"}})
    result = parse_dataset(body)
    assert result.id == "conditions"
    assert result.version == "2026-05"


def test_parse_dataset_from_bare_object() -> None:
    body = json.dumps({"id": "drugs", "name": "Drugs"})
    result = parse_dataset(body)
    assert result.id == "drugs"


# ---------------------------------------------------------------------------
# DatasetsSubClient — wire-level expectations.
# ---------------------------------------------------------------------------


def test_datasets_list_issues_get_to_canonical_path() -> None:
    transport = RecordingTransport(response_body=json.dumps({"data": []}))
    client = ZyInsClient(_TOKEN, transport=transport)
    client.datasets.list()
    method, url, headers, body = transport.calls[0]
    assert method == "GET"
    assert url.endswith("/v1/datasets")
    assert body is None
    assert "Idempotency-Key" not in headers


def test_datasets_get_url_encodes_id() -> None:
    transport = RecordingTransport(
        response_body=json.dumps({"id": "weird id", "name": "x"})
    )
    client = ZyInsClient(_TOKEN, transport=transport)
    client.datasets.get("weird id")
    _, url, _, _ = transport.calls[0]
    # Space must be percent-encoded; raw spaces in a path are malformed.
    assert " " not in url
    assert "weird%20id" in url


def test_datasets_get_rejects_empty_id() -> None:
    client = ZyInsClient(_TOKEN, transport=RecordingTransport())
    with pytest.raises(ValueError):
        client.datasets.get("")


def test_dataset_record_count_defaults_to_zero() -> None:
    body = json.dumps({"id": "conditions"})
    assert parse_dataset(body).record_count == 0


def test_dataset_model_is_exported() -> None:
    # Smoke: the public surface re-exports the type for type hints.
    assert Dataset.__name__ == "Dataset"
