"""Tests for the v3 datasets parser + transport entry point."""

from __future__ import annotations

import json
from dataclasses import dataclass, field

import pytest

from sah_sdk.core.errors import ISAError
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins.datasets_v3 import (
    DatasetCategory,
    DatasetsV3GetOptions,
    DatasetsV3NotModified,
    ReferenceEntity,
    get_datasets_v3,
    is_not_modified,
    parse_datasets_v3_envelope,
)


@dataclass
class _RecordingTransport:
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


_SAMPLE_BODY = json.dumps(
    {
        "object": "datasets",
        "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
        "idempotency_key": None,
        "livemode": True,
        "data": {
            "version": "3.0",
            "datasets": {
                "conditions": {
                    "version": "3.0",
                    "item_count": 1,
                    "items": [{"id": "HIGHBLOODPRESSURE", "name": "High Blood Pressure"}],
                },
                "medications": {
                    "version": "3.0",
                    "item_count": 2,
                    "items": [
                        {"id": "LISINOPRIL", "name": "Lisinopril"},
                        {"id": "LOSARTAN", "name": "Losartan"},
                    ],
                },
            },
            "medications_by_condition": {
                "HIGHBLOODPRESSURE": ["LISINOPRIL", "LOSARTAN"]
            },
            "frequency_graphs": {
                "use_map": {"HIGHBLOODPRESSURE": {"LISINOPRIL": 100, "LOSARTAN": 50}}
            },
        },
    }
)


def test_parser_typed_entities_and_id_keyed_maps() -> None:
    bundle = parse_datasets_v3_envelope(_SAMPLE_BODY, etag='W/"abc"')
    assert bundle.version == "3.0"
    assert bundle.etag == 'W/"abc"'
    assert bundle.conditions == (
        ReferenceEntity(id="HIGHBLOODPRESSURE", name="High Blood Pressure"),
    )
    assert bundle.medications == (
        ReferenceEntity(id="LISINOPRIL", name="Lisinopril"),
        ReferenceEntity(id="LOSARTAN", name="Losartan"),
    )
    assert bundle.medications_by_condition["HIGHBLOODPRESSURE"] == (
        "LISINOPRIL",
        "LOSARTAN",
    )
    assert bundle.frequency_graphs.use_map["HIGHBLOODPRESSURE"]["LISINOPRIL"] == 100


def test_parser_treats_empty_relation_fields_as_inline_rows() -> None:
    body = json.dumps(
        {
            "data": {
                "version": "3.0",
                "datasets": {
                    "conditions": {
                        "items": [
                            {
                                "id": "NEWCONDITION",
                                "name": "New Condition",
                                "treated_with": [],
                            }
                        ]
                    },
                    "medications": {
                        "items": [
                            {
                                "id": "NEWMEDICATION",
                                "name": "New Medication",
                                "used_for": [],
                            }
                        ]
                    },
                },
            }
        }
    )

    bundle = parse_datasets_v3_envelope(body)

    assert bundle.medications_by_condition == {"NEWCONDITION": ()}
    assert bundle.frequency_graphs.use_map == {"NEWCONDITION": {}}


def test_parser_derives_legacy_maps_from_medication_side_relations() -> None:
    # Asymmetric payload: the condition row carries no treated_with, but the
    # medication row carries used_for. The derived legacy maps must still
    # surface the cross-link from the medication side rather than dropping it.
    body = json.dumps(
        {
            "data": {
                "version": "3.0",
                "datasets": {
                    "conditions": {
                        "items": [{"id": "HBP", "name": "High Blood Pressure"}]
                    },
                    "medications": {
                        "items": [
                            {
                                "id": "LISINOPRIL",
                                "name": "Lisinopril",
                                "used_for": [
                                    {
                                        "id": "HBP",
                                        "name": "High Blood Pressure",
                                        "prescription_count": 100,
                                    }
                                ],
                            }
                        ]
                    },
                },
            }
        }
    )

    bundle = parse_datasets_v3_envelope(body)

    assert bundle.medications_by_condition["HBP"] == ("LISINOPRIL",)
    assert bundle.frequency_graphs.use_map["HBP"]["LISINOPRIL"] == 100


def test_parser_rejects_invalid_json() -> None:
    with pytest.raises(ValueError, match="Invalid JSON"):
        parse_datasets_v3_envelope("{not json")


def test_parser_tolerates_missing_fields() -> None:
    bundle = parse_datasets_v3_envelope("{}")
    assert bundle.version == ""
    assert bundle.medications == ()
    assert bundle.conditions == ()
    assert bundle.medications_by_condition == {}
    assert bundle.frequency_graphs.use_map == {}
    # A3: slices default to empty, never None.
    assert bundle.products_by_family == {}
    assert bundle.discontinued_products == {}
    assert bundle.state_derivatives == ()


def test_parser_surfaces_product_slices() -> None:
    # A3: products_by_family / discontinued_products / state_derivatives
    # pass through as typed fields; malformed rows are skipped, not fatal.
    body = json.dumps(
        {
            "data": {
                "products_by_family": {
                    "final_expense": [
                        {"id": "prod_001", "name": "Mountain Life MYGA"},
                        {"id": "", "name": "Empty Id"},  # empty id: dropped
                        {"id": 42},  # malformed: dropped
                        "nope",  # malformed: dropped
                    ]
                },
                "discontinued_products": {
                    "mountain-life-myga": 1746979200,
                    "float-epoch-ok": 1746979200.0,  # integer-valued: kept
                    "fractional-dropped": 1746979200.5,  # fractional: dropped
                    "bad": "not-a-number",  # dropped
                },
                "state_derivatives": ["ND", "SD", 7],  # 7 dropped
            }
        }
    )
    bundle = parse_datasets_v3_envelope(body)
    assert bundle.products_by_family["final_expense"] == (
        ReferenceEntity(id="prod_001", name="Mountain Life MYGA"),
    )
    assert bundle.discontinued_products == {
        "mountain-life-myga": 1746979200,
        "float-epoch-ok": 1746979200,
    }
    assert bundle.state_derivatives == ("ND", "SD")


def test_parser_keeps_id_only_row_and_drops_id_less_row() -> None:
    # Cross-language keep/drop parity guard. The canonical predicate: a product
    # row is valid iff it has a non-empty ``id`` (the opaque contract key); a
    # missing/blank ``name`` defaults to "" and the row is KEPT. A row with no
    # id is DROPPED. Go/TypeScript/PHP/C# all behave identically.
    body = json.dumps(
        {
            "data": {
                "products_by_family": {
                    "final_expense": [
                        {"id": "prod_id_present"},  # name absent -> kept, name=""
                        {"name": "orphan"},  # id absent -> dropped
                    ]
                }
            }
        }
    )
    bundle = parse_datasets_v3_envelope(body)
    assert bundle.products_by_family["final_expense"] == (
        ReferenceEntity(id="prod_id_present", name=""),
    )


def test_parser_drops_out_of_range_epoch() -> None:
    # Cross-language int64 epoch-bound parity guard. An epoch outside the int64
    # window is dropped (never kept as a wrapped/imprecise value); the in-range
    # entry survives. Go/C#/PHP (int64-typed) and Python/TS (range-gated) agree.
    body = json.dumps(
        {
            "data": {
                "discontinued_products": {
                    "in-range": 1746979200,
                    "overflow-int-skipped": 9300000000000000000,  # > 2**63
                    "overflow-float-skipped": 9.3e18,  # > 2**63
                }
            }
        }
    )
    bundle = parse_datasets_v3_envelope(body)
    assert bundle.discontinued_products == {"in-range": 1746979200}


def test_parser_rejects_non_integer_frequencies() -> None:
    body = json.dumps(
        {
            "data": {
                "frequency_graphs": {
                    "use_map": {
                        "HBP": {
                            "LISINOPRIL": 42,
                            "BOGUS": True,  # boolean rejected
                            "ALSO_BOGUS": "100",  # string rejected
                            "TRUNCATED": 12.7,  # non-integral float rejected
                            "WHOLE_FLOAT": 88.0,  # whole-valued float accepted
                        }
                    }
                }
            }
        }
    )
    bundle = parse_datasets_v3_envelope(body)
    row = bundle.frequency_graphs.use_map["HBP"]
    assert row == {"LISINOPRIL": 42, "WHOLE_FLOAT": 88}


def test_get_returns_bundle_on_200() -> None:
    transport = _RecordingTransport(
        response_status=200,
        response_body=_SAMPLE_BODY,
        response_headers={"etag": 'W/"v3-etag"'},
    )
    result = get_datasets_v3(
        None,
        transport=transport,
        base_url="https://api.example.com",
        headers={"Authorization": "Bearer test"},
    )
    assert is_not_modified(result) is False
    assert not isinstance(result, DatasetsV3NotModified)
    assert result.etag == 'W/"v3-etag"'
    assert result.version == "3.0"
    method, url, headers, body = transport.calls[0]
    assert method == "GET"
    assert url == "https://api.example.com/v3/datasets"
    assert headers["Authorization"] == "Bearer test"
    assert body is None


def test_get_returns_not_modified_on_304() -> None:
    transport = _RecordingTransport(
        response_status=304, response_body="", response_headers={"etag": 'W/"unchanged"'}
    )
    result = get_datasets_v3(
        DatasetsV3GetOptions(if_none_match='W/"unchanged"'),
        transport=transport,
        base_url="https://api.example.com",
        headers={},
    )
    assert is_not_modified(result) is True
    assert isinstance(result, DatasetsV3NotModified)
    assert result.etag == 'W/"unchanged"'
    sent_headers = transport.calls[0][2]
    assert sent_headers["If-None-Match"] == 'W/"unchanged"'


def test_get_query_string_includes_and_fields() -> None:
    transport = _RecordingTransport(response_status=200, response_body=_SAMPLE_BODY)
    get_datasets_v3(
        DatasetsV3GetOptions(
            include=(DatasetCategory.CONDITIONS, DatasetCategory.MEDICATIONS),
            fields="meta",
        ),
        transport=transport,
        base_url="https://api.example.com",
        headers={},
    )
    _, url, _, _ = transport.calls[0]
    assert (
        url
        == "https://api.example.com/v3/datasets?include=conditions,medications&fields=meta"
    )


def test_get_raises_typed_error_on_non_2xx() -> None:
    transport = _RecordingTransport(
        response_status=500, response_body="boom", response_headers={}
    )
    with pytest.raises(ISAError):
        get_datasets_v3(
            None,
            transport=transport,
            base_url="https://api.example.com",
            headers={},
        )
