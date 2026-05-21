"""``isa.zyins.prequalify.legacy_blob`` tests."""

from __future__ import annotations

import json

import pytest

from sah_sdk import Isa
from sah_sdk.core.errors import ISAError
from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins.prequalify_legacy_blob import encode_legacy_blob


class StubTransport:
    def __init__(self, response: TransportResponse) -> None:
        self.response = response
        self.calls: list[tuple[str, str, dict[str, str], str | None]] = []

    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        body: str | None = None,
    ) -> TransportResponse:
        self.calls.append((method, url, dict(headers), body))
        return self.response


_FAKE_BEARER = "isa_test_" + "fakepersona" + "1234567890"


def test_encode_legacy_blob_serializes_dict_compactly() -> None:
    body = encode_legacy_blob({"a": 1, "b": "x"})
    assert json.loads(body) == {"a": 1, "b": "x"}
    assert " " not in body  # compact separators


def test_encode_legacy_blob_rejects_non_dict() -> None:
    with pytest.raises(TypeError, match="must be a dict"):
        encode_legacy_blob([1, 2, 3])  # type: ignore[arg-type]


def test_legacy_blob_round_trips_opaque_payload() -> None:
    transport = StubTransport(
        TransportResponse(
            status=200,
            body=json.dumps(
                {
                    "plans": [
                        {
                            "brand": "Aetna",
                            "tier": "preferred",
                            "monthly_premium": 42.5,
                            "face_value": 10000,
                            "product_token": "fex-aetna-accendo",
                        }
                    ],
                    "request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS",
                }
            ),
            headers={},
        )
    )
    isa = Isa.with_bearer(_FAKE_BEARER, transport=transport)
    payload = {"prepEncObj": "opaque", "extra_field_we_dont_understand": True}
    envelope = isa.zyins.prequalify.legacy_blob(payload)
    assert len(envelope.data.plans) == 1
    plan = envelope.data.plans[0]
    assert plan.brand == "Aetna"
    assert plan.product_token == "fex-aetna-accendo"
    assert envelope.request_id  # extracted from envelope-helper

    method, url, _, sent_body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v1/prequalify")
    # The body must round-trip the payload verbatim — no SDK rewriting.
    assert json.loads(sent_body or "") == payload


def test_legacy_blob_maps_4xx_to_isa_error() -> None:
    transport = StubTransport(
        TransportResponse(
            status=400,
            body=json.dumps({"code": "validation_error", "title": "bad", "detail": "fields"}),
            headers={"content-type": "application/problem+json"},
        )
    )
    isa = Isa.with_bearer(_FAKE_BEARER, transport=transport)
    with pytest.raises(ISAError):
        isa.zyins.prequalify.legacy_blob({"x": 1})
