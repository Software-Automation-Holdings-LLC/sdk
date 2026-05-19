# sah-sdk

Python SDK for the [ZyINS API](https://docs.isaapi.com). Mirrors the
canonical TypeScript SDK at `packages/zyins/js/` with Python-idiomatic
naming (`snake_case`) and pydantic v2 models.

## Install

```bash
pip install sah-sdk
```

## Quick start

```python
from sah_sdk.zyins import ZyInsClient, Applicant, Coverage, PrequalifyInput, Sex

client = ZyInsClient("isa_live_<your-token>")

result = client.prequalify.run(PrequalifyInput(
    applicant=Applicant(
        dob="1962-04-18",
        sex=Sex.MALE,
        height_inches=70,
        weight_pounds=195,
        state="NC",
        nicotine_use="none",
    ),
    coverage=Coverage.face_value(100_000),
    products="colonial-penn.final-expense",
))

for plan in result.plans:
    print(plan.brand, plan.tier, plan.monthly_premium)
```

The token alone is enough — `Authorization: Bearer <token>`,
`Idempotency-Key`, and the date-pinned `Version` header are set
automatically.

## Auth deviation from the TS SDK

The TypeScript SDK in this monorepo still carries the pre-#286 HMAC device
signing surface (`AuthContext` with `licenseKey + orderId + email + deviceId`).
The Python SDK is built against the post-#286 wire contract: a single
bearer token (`isa_live_*` / `isa_test_*`) is the entire auth surface.
This is the intentional simplification called out in the platform's
`platform_v1_architecture` notes.

## Surface

| TypeScript                                | Python                              |
| ----------------------------------------- | ----------------------------------- |
| `client.prequalify(req)`                  | `client.prequalify.run(input)`      |
| `client.license.activate/deactivate/check`| `client.license.*` (mirrored)       |
| `client.case.email(req)`                  | `client.case.email(input)`          |
| (new)                                     | `client.quote.run(input)`           |
| (new)                                     | `client.datasets.list/get`          |
| (new)                                     | `client.reference_data.get(kind)`   |
| (new)                                     | `client.usage.summary(period)`      |

Errors mirror the TS hierarchy: `ISAError` (alias `ZyInsError`, also
exported as `IsaApiError`) → `LicenseError`, `PrequalifyError`,
`ValidationError`, `RateLimitError`, `AuthError`,
`IsaIdempotencyConflictError`.

## `Isa` factory client

Per [SDK_DESIGN.md §3](https://github.com/Software-Automation-Holdings-LLC/isa-platform/blob/main/docs/SDK_DESIGN.md),
the recommended entry point is the `Isa` class with three named factories:

```python
from sah_sdk.zyins import Isa

# Reads ISA_TOKEN from the environment.
isa = Isa.with_bearer()
env = isa.zyins.prequalify(req)
print(env.data, env.request_id, env.idempotency_key, env.retry_attempts)

# Or pass the token explicitly.
isa = Isa.with_bearer("isa_live_…")

# License factory — reads ISA_LICENSE_KEYCODE / ISA_LICENSE_EMAIL.
isa = Isa.with_license()

# Session factory — reads ISA_SESSION_ID / ISA_SESSION_SECRET.
isa = Isa.with_session()
```

Each factory raises `IsaConfigError` with a clear, actionable message if
the required env vars are unset and no explicit arguments are supplied.

### Raw HTTP access

Every method has a `.with_raw_response()` variant returning both the
parsed envelope and the underlying HTTP metadata:

```python
env, raw = isa.zyins.prequalify.with_raw_response(req)
raw.status     # int
raw.url        # str
raw.headers    # read-only mapping
```

### Debug logging

Set `ISA_LOG=debug` to dump every request and response to **stderr** —
never stdout, so parent processes piping the consumer's JSON output stay
clean. Credential headers (`Authorization`, `X-Device-Signature`,
`X-Session-Signature`) and PII body fields (`email`, `dob`, `ssn`,
`phone`) are redacted automatically.

### Idempotency conflicts

When the same `Idempotency-Key` is replayed with a different body the
server returns 409 `idempotency_conflict`. The SDK raises
`IsaIdempotencyConflictError` with `.key` and `.first_seen_at` so the
caller can audit the queued-write bug class:

```python
from sah_sdk.zyins import IsaIdempotencyConflictError

try:
    isa.zyins.prequalify(req, idempotency_key="case-42")
except IsaIdempotencyConflictError as e:
    log.error("key %s first seen at %s", e.key, e.first_seen_at)
```

## Concurrency

The `Isa` client is safe for use with `asyncio.gather` and
`concurrent.futures` — every request mints a fresh request-id and
idempotency key, and shared client state (auth, base URL, debug logger)
is read-only after construction. Reuse a single `Isa` instance across
all concurrent requests; the underlying HTTP transport pools connections
for you.

```python
import asyncio
from sah_sdk.zyins import Isa

isa = Isa.with_bearer()

async def one(req):
    return isa.zyins.prequalify(req)

results = await asyncio.gather(*(one(r) for r in batch))
# Each result.request_id is distinct.
```

## Development

```bash
hatch run test         # pytest
hatch run lint         # ruff + mypy --strict
hatch build            # wheel + sdist
```

Live-integration tests run only when `ZYINS_TEST_TOKEN` is set:

```bash
ZYINS_TEST_TOKEN=isa_test_... hatch run test -- -m integration
```
