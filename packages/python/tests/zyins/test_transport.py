"""HTTP transport error wrapping tests."""

from __future__ import annotations

from unittest.mock import MagicMock

import httpx
import pytest

from sah_sdk.core.errors import IsaTransportError
from sah_sdk.core.transport import HttpTransport


def test_request_wraps_httpx_request_error() -> None:
    client = MagicMock()
    # Pass an explicit httpx.Request rather than relying on ConnectError's
    # message-only constructor: httpx.RequestError.request is a property
    # that raises RuntimeError if accessed while unset, so a real caller
    # attempting to log/inspect the failed request wouldn't hit a message-
    # only exception in practice. Supplying it here keeps the fixture
    # representative of what httpx itself raises.
    failed_request = httpx.Request("GET", "https://example.test")
    client.request.side_effect = httpx.ConnectError(
        "connection refused", request=failed_request
    )
    transport = HttpTransport(client=client)

    with pytest.raises(IsaTransportError, match="connection refused"):
        transport.request("GET", "https://example.test", headers={})
