"""``isa.account.branding`` tests."""

from __future__ import annotations

import json

from sah_sdk.account import BrandingDetail

from .helpers import RecordingTransport, make_namespace


def test_branding_lookup_parses_envelope() -> None:
    transport = RecordingTransport(
        response_body=json.dumps(
            {
                "data": {
                    "imo_name": "Acme Agency",
                    "imo_logo": "https://example.com/logo.png",
                    "primary_color": "#ff0000",
                    "hide_affiliate_leads": True,
                }
            }
        )
    )
    ns = make_namespace(transport=transport)
    detail = ns.branding.lookup()
    assert detail.imo_name == "Acme Agency"
    assert detail.imo_logo == "https://example.com/logo.png"
    assert detail.primary_color == "#ff0000"
    assert detail.hide_affiliate_leads is True


def test_branding_lookup_signs_get_with_hmac_headers() -> None:
    transport = RecordingTransport()
    ns = make_namespace(transport=transport)
    ns.branding.lookup()
    method, url, headers, body = transport.calls[0]
    assert method == "GET"
    assert url.endswith("/v1/branding")
    assert body is None
    assert headers["Authorization"].startswith("License ")
    assert headers["X-Device-ID"] == "device-1"
    assert headers["X-License-Method"] == "GET"
    assert headers["X-License-URI"] == "/v1/branding"
    assert "X-Device-Signature" in headers


def test_branding_lookup_with_source_adds_query_param() -> None:
    transport = RecordingTransport()
    ns = make_namespace(transport=transport)
    from sah_sdk.account.branding import BrandingLookupRequest

    ns.branding.lookup(BrandingLookupRequest(source="mountain-life"))
    _, url, headers, _ = transport.calls[0]
    assert url.endswith("/v1/branding?source=mountain-life")
    # The HMAC signs the path WITH the query string so the server's
    # signature validator computes the same canonical bytes.
    assert headers["X-License-URI"] == "/v1/branding?source=mountain-life"


def test_branding_lookup_returns_zero_branding_on_empty_body() -> None:
    transport = RecordingTransport(response_body="")
    ns = make_namespace(transport=transport)
    detail = ns.branding.lookup()
    assert detail == BrandingDetail()
