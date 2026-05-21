"""``isa.account.preferences`` tests."""

from __future__ import annotations

import json

import pytest

from .helpers import RecordingTransport, make_namespace


def test_preferences_lookup_uses_scope_query_param() -> None:
    transport = RecordingTransport(
        response_body=json.dumps({"data": {"prefs": {"theme": "dark"}}})
    )
    ns = make_namespace(transport=transport)
    result = ns.preferences.lookup("bpp")
    assert result.prefs == {"theme": "dark"}
    method, url, _, body = transport.calls[0]
    assert method == "GET"
    assert url.endswith("/v1/preferences?scope=bpp")
    assert body is None


def test_preferences_lookup_rejects_empty_scope() -> None:
    transport = RecordingTransport()
    ns = make_namespace(transport=transport)
    with pytest.raises(ValueError, match="non-empty scope"):
        ns.preferences.lookup("")


def test_preferences_set_posts_scope_and_prefs() -> None:
    transport = RecordingTransport(response_body=json.dumps({"ok": True}))
    ns = make_namespace(transport=transport)
    result = ns.preferences.set("bpp", {"theme": "dark"})
    assert result.ok is True
    method, url, headers, body = transport.calls[0]
    assert method == "POST"
    assert url.endswith("/v1/preferences")
    assert json.loads(body or "") == {"scope": "bpp", "prefs": {"theme": "dark"}}
    assert "Idempotency-Key" in headers


def test_preferences_set_rejects_non_dict_prefs() -> None:
    transport = RecordingTransport()
    ns = make_namespace(transport=transport)
    with pytest.raises(ValueError, match="prefs dict"):
        ns.preferences.set("bpp", "not a dict")  # type: ignore[arg-type]
