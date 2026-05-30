"""``CaseStorage`` adapter Protocol — pluggable backend for ``isa.zyins.cases``.

The Python SDK ships :class:`~.zero_knowledge.ZeroKnowledgeCaseStorage`
as the default — client-side AES-256-GCM, server stores opaque
ciphertext, the per-record key is returned to the caller as a
``recall_token`` and never crosses the wire. Consumers who need an
alternative backend (in-memory stub for tests, BYO server-side store,
etc.) implement this Protocol and wire it through
:meth:`Isa.with_keycode` ``case_storage=`` argument.

The single code path is ``isa.zyins.cases.save(record)`` →
``storage.put(record)`` — no branching on which backend is in use; the
adapter is the polymorphism boundary.

The Protocol is SYNCHRONOUS in Python — matches the wire dispatcher
(:meth:`ZyInsClient._dispatch`) and the cross-language CaseStorage
contracts (Go, PHP, C#, TS). Adapters that wrap async resources should
expose a sync facade and run the awaitable internally; the SDK is
intentionally sync-first per SDK_DESIGN.md §4.

Cross-reference: see TS ``packages/ts/src/zyins/cases.ts`` for the
wire-equivalent ``share`` operation and the zero-knowledge wire format
locked in #347.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass(frozen=True, slots=True)
class CaseRecord:
    """A case payload destined for storage.

    The ``payload`` is the caller-supplied JSON-serializable case
    contents; ``product`` is the routing tag bound to the encryption
    envelope as AEAD additional-data (so the platform can route by
    product without ever decrypting the payload). ``id`` is set only on
    records read back from storage — ``put`` ignores it on input.
    """

    payload: Any = None
    product: str = "zyins"
    id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class PutResult:
    """The server-assigned case id and the per-record recall token.

    The ``recall_token`` is the only handle that can decrypt the
    record. The server never sees it. Surface it to the end user as
    the fragment of a share link, the body of a one-time recall email,
    or the value of a recipient-side secret — never log it, never
    persist it to telemetry, never attach it to a thrown error.

    Adapters that mint no client-side key material (e.g. carrier
    storage backends) MAY return ``recall_token=None``.
    """

    id: str
    recall_token: str | None = None


@runtime_checkable
class CaseStorage(Protocol):
    """Pluggable persistence adapter for ``isa.zyins.cases``.

    Implementations:

    * :class:`~.zero_knowledge.ZeroKnowledgeCaseStorage` — default;
      encrypts client-side with AES-256-GCM and posts opaque
      ciphertext.
    * Test stubs — typically an in-memory dict keyed by id.
    * Server-side custom storage — for consumers who run their own
      backend.

    Implementations MUST be safe to call concurrently and MUST NOT
    mutate the input :class:`CaseRecord`. Failure modes raise — adapters
    never return a partial record.
    """

    def put(self, record: CaseRecord) -> PutResult:
        """Store ``record`` and return the assigned id + recall token."""
        ...

    def get(
        self, id: str, recall_token: str | None = None
    ) -> CaseRecord | None:
        """Fetch the record at ``id``, decrypting with ``recall_token``.

        ``recall_token`` is required iff :meth:`put` returned one.
        Returns ``None`` when the record is absent or expired (the two
        cases are indistinguishable by design — the platform cannot
        leak existence of an expired record). Raises an
        implementation-defined error on a tampered envelope or a wrong
        recall token.
        """
        ...


__all__ = ["CaseRecord", "CaseStorage", "PutResult"]
