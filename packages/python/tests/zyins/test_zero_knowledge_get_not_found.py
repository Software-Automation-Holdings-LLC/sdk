"""Regression: ZeroKnowledgeCaseStorage.get maps a 404 to None and lets
every other error surface.

``ZyInsClient._dispatch`` raises a typed ``ISAError`` on any non-2xx
(it calls ``raise_for_status``), so a missing/expired case arrives as an
exception, never as a response object with ``status == 404``. The old
``if status == 404: return None`` guard was therefore unreachable —
``get`` raised on a missing record instead of returning ``None`` (its
documented contract). A non-404 error must still propagate so a real
failure is never swallowed as an absent record.
"""

from __future__ import annotations

import base64
from typing import Any

import pytest

from sah_sdk.core.errors import ISAError
from sah_sdk.zyins.cases.zero_knowledge import ZeroKnowledgeCaseStorage


def _valid_recall_token() -> str:
    """A url-safe-base64 token that decodes to a 32-byte AES-256 key, so
    the recall token validates before the dispatch is reached."""
    return base64.urlsafe_b64encode(bytes(32)).rstrip(b"=").decode("ascii")


class _RaisingDispatcher:
    """Dispatcher whose GET raises the configured ISAError, mirroring the
    real ``_dispatch`` raise-for-status behavior."""

    def __init__(self, error: ISAError) -> None:
        self._error = error

    def _dispatch(self, *, method: str, path: str, body: str, idempotency_key: str | None = None) -> Any:
        raise self._error


def test_get_returns_none_on_404() -> None:
    storage = ZeroKnowledgeCaseStorage(
        _RaisingDispatcher(ISAError("not found", code="not_found", http_status=404))
    )
    assert storage.get("missing-case", _valid_recall_token()) is None


def test_get_propagates_non_404_error() -> None:
    storage = ZeroKnowledgeCaseStorage(
        _RaisingDispatcher(ISAError("boom", code="internal_error", http_status=500))
    )
    with pytest.raises(ISAError) as excinfo:
        storage.get("case-500", _valid_recall_token())
    assert excinfo.value.http_status == 500
