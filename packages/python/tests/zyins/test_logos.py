"""``isa.zyins.logos`` tests."""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from sah_sdk.core.errors import ISAError
from sah_sdk.zyins.logos import LogosResponse, LogosSubClient


@dataclass
class StubFetch:
    response: LogosResponse
    calls: list[str] = field(default_factory=list)
    closed: bool = False

    def __call__(self, url: str) -> LogosResponse:
        self.calls.append(url)
        return self.response

    def close(self) -> None:
        self.closed = True


def test_get_returns_bytes_by_default() -> None:
    raw = b"\x89PNG\r\n\x1a\nfake"
    fetch = StubFetch(response=LogosResponse(status=200, body=raw, headers={}))
    sub = LogosSubClient("https://zyins.isaapi.com", fetch=fetch)
    out = sub.get("aetna")
    assert out == raw
    assert fetch.calls[0] == "https://zyins.isaapi.com/v1/logo/aetna"


def test_get_with_data_uri_returns_string() -> None:
    uri = "data:image/png;base64,AAAA"
    fetch = StubFetch(
        response=LogosResponse(status=200, body=uri.encode("utf-8"), headers={})
    )
    sub = LogosSubClient("https://zyins.isaapi.com", fetch=fetch)
    out = sub.get("aetna", data_uri=True)
    assert out == uri
    assert fetch.calls[0].endswith("/v1/logo/aetna?ds=true")


def test_get_data_uri_rejects_non_data_body() -> None:
    fetch = StubFetch(
        response=LogosResponse(status=200, body=b"<html>nope</html>", headers={})
    )
    sub = LogosSubClient("https://zyins.isaapi.com", fetch=fetch)
    with pytest.raises(ISAError, match="data:image/"):
        sub.get("aetna", data_uri=True)


def test_get_rejects_empty_carrier() -> None:
    fetch = StubFetch(response=LogosResponse(status=200, body=b"", headers={}))
    sub = LogosSubClient("https://zyins.isaapi.com", fetch=fetch)
    with pytest.raises(ISAError, match="carrier is required"):
        sub.get("")


def test_get_404_raises_isa_error() -> None:
    fetch = StubFetch(
        response=LogosResponse(
            status=404,
            body=b'{"type":"about:blank","code":"not_found","title":"Not Found"}',
            headers={"content-type": "application/problem+json"},
        )
    )
    sub = LogosSubClient("https://zyins.isaapi.com", fetch=fetch)
    with pytest.raises(ISAError):
        sub.get("unknown-carrier")


def test_carrier_path_segment_is_url_encoded() -> None:
    fetch = StubFetch(response=LogosResponse(status=200, body=b"x", headers={}))
    sub = LogosSubClient("https://zyins.isaapi.com", fetch=fetch)
    sub.get("Acme & Co/Ltd")
    assert fetch.calls[0] == "https://zyins.isaapi.com/v1/logo/Acme%20%26%20Co%2FLtd"


def test_close_releases_fetcher() -> None:
    fetch = StubFetch(response=LogosResponse(status=200, body=b"x", headers={}))
    sub = LogosSubClient("https://zyins.isaapi.com", fetch=fetch)

    sub.close()

    assert fetch.closed is True
