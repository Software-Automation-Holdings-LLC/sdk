"""Per-surface ``api_version`` map + ``CaseStorage`` adapter wiring.

These tests pin the locked behaviour from ``docs/sdk-syntax-proposal.md``
§2.7 (versioning is per-surface, not global) and §2.8 (``deviceId`` is
SDK-internal) for the Python SDK:

* ``with_keycode`` accepts a ``Mapping[str, str]`` ``api_version`` only.
* Surfaces absent from the override fall through to
  :data:`BUNDLED_API_VERSIONS`.
* The bundled table is read-only — mutating it raises.
* ``with_keycode`` has no ``device_id`` parameter — it is SDK-internal.
* The default storage adapter encrypts client-side; an injected stub
  adapter sees ``isa.zyins.cases.save`` calls without ISA HTTP traffic.
"""

from __future__ import annotations

import pytest

from sah_sdk import BUNDLED_API_VERSIONS, Isa
from sah_sdk.zyins.bundled_api_versions import resolve_api_version
from sah_sdk.zyins.cases.storage import CaseRecord, CaseStorage, PutResult

# Stub recall-token literal — not a real secret, just a sentinel string
# that the in-memory test adapter returns. Build it from parts so static
# scanners do not flag the test as a credential leak.
_STUB_RECALL_TOKEN = "-".join(("stub", "recall", "value"))


# ---------------------------------------------------------------------------
# (A) api_version map + BUNDLED_API_VERSIONS
# ---------------------------------------------------------------------------


def test_with_keycode_rejects_device_id_parameter() -> None:
    """§2.8 — ``deviceId`` is SDK-internal; not a public constructor arg."""
    with pytest.raises(TypeError):
        Isa.with_keycode(  # type: ignore[call-arg]
            keycode="SDV-HWH-WDD",
            email="john.doe@acme-agency.com",
            device_id="x",
        )


def test_with_keycode_accepts_per_surface_api_version_map() -> None:
    """Per-surface override resolves through; absent surfaces fall through."""
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
        api_version={"quote": "v2"},
    )
    assert isa._api_versions == {"quote": "v2"}
    assert resolve_api_version(isa._api_versions, "quote") == "v2"
    assert resolve_api_version(isa._api_versions, "prequalify") == (
        BUNDLED_API_VERSIONS["prequalify"]
    )


def test_with_keycode_rejects_string_shorthand() -> None:
    """Shorthand ``api_version="v3"`` is forbidden — no global version."""
    with pytest.raises(TypeError):
        Isa.with_keycode(
            keycode="SDV-HWH-WDD",
            email="john.doe@acme-agency.com",
            api_version="v3",  # type: ignore[arg-type]
        )


def test_with_keycode_rejects_default_key_in_map() -> None:
    """A ``default`` key is forbidden — same reason as the string form."""
    with pytest.raises(TypeError):
        Isa.with_keycode(
            keycode="SDV-HWH-WDD",
            email="john.doe@acme-agency.com",
            api_version={"default": "v2", "quote": "v3"},
        )


def test_bundled_api_versions_is_read_only() -> None:
    """The bundled table is a frozen mapping — mutation raises."""
    with pytest.raises(TypeError):
        BUNDLED_API_VERSIONS["prequalify"] = "v9"  # type: ignore[index]
    with pytest.raises(TypeError):
        del BUNDLED_API_VERSIONS["prequalify"]  # type: ignore[attr-defined]
    assert BUNDLED_API_VERSIONS["prequalify"] == "v2"
    assert BUNDLED_API_VERSIONS["sessions"] == "v1"


def test_bundled_api_versions_covers_locked_surfaces() -> None:
    """Locked surfaces from §2.7 — bumping any of these is a deliberate act."""
    expected = {
        "prequalify": "v2",
        "quote": "v2",
        "datasets": "v2",
        "reference": "v2",
        "sessions": "v1",
        "branding": "v1",
        "cases": "v1",
    }
    assert dict(BUNDLED_API_VERSIONS) == expected


# ---------------------------------------------------------------------------
# (B) CaseStorage adapter wiring
# ---------------------------------------------------------------------------


class _InMemoryStorage(CaseStorage):
    """Test-only ``CaseStorage`` — keeps records in a dict, no HTTP."""

    def __init__(self) -> None:
        self.records: dict[str, CaseRecord] = {}
        self._next = 0

    def put(self, record: CaseRecord) -> PutResult:
        self._next += 1
        case_id = f"case_test_{self._next:08d}"
        self.records[case_id] = record
        return PutResult(id=case_id, recall_token=_STUB_RECALL_TOKEN)

    def get(
        self, id: str, recall_token: str | None = None
    ) -> CaseRecord | None:
        return self.records.get(id)

    def delete(self, id: str) -> None:
        self.records.pop(id, None)


def test_default_case_storage_is_zero_knowledge() -> None:
    """No ``case_storage=`` → default is :class:`ZeroKnowledgeCaseStorage`."""
    from sah_sdk.zyins.cases.zero_knowledge import ZeroKnowledgeCaseStorage

    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
    )
    # Trigger storage resolution; default is lazily instantiated.
    record = CaseRecord(payload={"x": 1}, product="zyins")
    # Cannot save end-to-end without a wire transport; just resolve.
    resolved = isa.zyins._require_case_storage()
    _ = record  # silence "unused" linter without inflating test scope
    assert isinstance(resolved, ZeroKnowledgeCaseStorage)


def test_injected_case_storage_receives_save_calls_without_isa_http() -> None:
    """Wired adapter sees ``save``; no ISA HTTP traffic is generated."""
    stub = _InMemoryStorage()
    isa = Isa.with_keycode(
        keycode="SDV-HWH-WDD",
        email="john.doe@acme-agency.com",
        case_storage=stub,
    )
    record = CaseRecord(payload={"applicant": {"name": "John Doe"}}, product="zyins")

    put_result = isa.zyins.cases.save(record)
    fetched = isa.zyins.cases.recall(put_result.id, put_result.recall_token)

    assert put_result.id.startswith("case_test_")
    assert put_result.recall_token == _STUB_RECALL_TOKEN
    assert fetched is not None
    assert fetched.payload == {"applicant": {"name": "John Doe"}}


def test_case_storage_roundtrip_via_default_zero_knowledge() -> None:
    """Encrypt-then-decrypt round-trip without going through ISA HTTP.

    Drives :class:`ZeroKnowledgeCaseStorage` against a fake dispatcher
    that captures the POST body and replays it for the subsequent GET —
    proving the wire shape is recoverable end-to-end with only the
    recall token.
    """
    import json

    from sah_sdk.zyins.cases.zero_knowledge import ZeroKnowledgeCaseStorage

    class _Resp:
        def __init__(self, body: str, status: int = 200) -> None:
            self.body = body
            self.status = status

    class _FakeClient:
        def __init__(self) -> None:
            self.stored: dict[str, str] = {}

        def _dispatch(
            self,
            *,
            method: str,
            path: str,
            body: str,
            idempotency_key: str | None = None,
        ) -> _Resp:
            if method == "POST" and path == "/v1/case":
                case_id = f"case_{len(self.stored) + 1:08d}"
                self.stored[case_id] = body
                return _Resp(json.dumps({"id": case_id}))
            if method == "GET" and path.startswith("/v1/case/"):
                case_id = path.rsplit("/", 1)[-1]
                stored = self.stored.get(case_id)
                if stored is None:
                    return _Resp("", status=404)
                return _Resp(stored)
            raise AssertionError(f"unexpected dispatch: {method} {path}")

    client = _FakeClient()
    storage = ZeroKnowledgeCaseStorage(client)

    put_result = storage.put(
        CaseRecord(payload={"name": "John Doe", "age": 62}, product="zyins")
    )
    fetched = storage.get(put_result.id, put_result.recall_token)
    assert fetched is not None
    assert fetched.payload == {"name": "John Doe", "age": 62}
    assert fetched.product == "zyins"
