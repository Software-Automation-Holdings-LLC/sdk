"""100 parallel asyncio.gather calls produce 100 distinct request_ids.

The Isa client must be safe for use with ``asyncio.gather`` and
``concurrent.futures`` per SDK_DESIGN.md §12.1 and the README. This test
proves that:

* The same :class:`Isa` instance can serve concurrent requests.
* Each request gets a fresh idempotency key (no cross-request leakage).
* The envelope's ``request_id`` and ``idempotency_key`` are distinct
  across all 100 parallel invocations.
"""

from __future__ import annotations

import asyncio
import json
import threading
import uuid

import pytest

from sah_sdk.core.transport import TransportResponse
from sah_sdk.zyins import (
    Applicant,
    Coverage,
    Isa,
    NicotineUsage,
    PrequalifyInput,
    Sex,
)


class CountingTransport:
    """Thread-safe transport that mints a unique request_id per call.

    Mirrors what a real server does: each request gets its own server-
    side correlation id. We use that id to verify the SDK round-trips
    distinct values to its caller.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._count = 0

    def request(
        self, method: str, url: str, *, headers: dict[str, str], body: str | None = None
    ) -> TransportResponse:
        with self._lock:
            self._count += 1
            n = self._count
        request_id = f"req_concurrent_{n:04d}"
        # Echo the idempotency key the SDK sent so we can verify
        # distinctness on both ends of the contract.
        idem = headers.get("Idempotency-Key", "")
        envelope = json.dumps(
            {
                "plans": [],
                "request_id": request_id,
                "idempotency_key": idem,
                "livemode": False,
                "retry_attempts": 0,
            }
        )
        return TransportResponse(
            status=200,
            body=envelope,
            headers={"x-isa-request-id": request_id},
        )


_FAKE_TOKEN = "isa_" + "test_" + "concurrency" + "00000000"
_PARALLEL = 100


def _input() -> PrequalifyInput:
    return PrequalifyInput(
        applicant=Applicant(
            dob="1962-04-18",
            sex=Sex.MALE,
            height_inches=70,
            weight_pounds=195,
            state="NC",
            nicotine_use=NicotineUsage.NONE,
        ),
        coverage=Coverage.face_value(100_000),
        products="colonial-penn.final-expense",
    )


@pytest.mark.asyncio
async def test_100_parallel_asyncio_gather_distinct_request_ids() -> None:
    transport = CountingTransport()
    isa = Isa.with_bearer(_FAKE_TOKEN, transport=transport)
    req = _input()

    async def one() -> tuple[str, str]:
        # The SDK call itself is sync; offload to a thread so asyncio
        # can actually interleave 100 of them.
        env = await asyncio.to_thread(isa.zyins.prequalify, req)
        return env.request_id, env.idempotency_key

    results = await asyncio.gather(*(one() for _ in range(_PARALLEL)))

    assert len(results) == _PARALLEL
    request_ids = {r[0] for r in results}
    idem_keys = {r[1] for r in results}
    # Every request_id distinct (server-side correlation works).
    assert len(request_ids) == _PARALLEL
    # Every idempotency_key distinct (SDK auto-mints per call).
    assert len(idem_keys) == _PARALLEL
    # Sanity: keys are valid UUIDs.
    for k in idem_keys:
        uuid.UUID(k)
