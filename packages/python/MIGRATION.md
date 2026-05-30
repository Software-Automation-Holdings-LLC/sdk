# Migration — 0.x → 1.0.0rc1 (Python)

The cross-language guide at [`../../MIGRATION.md`](../../MIGRATION.md)
covers the full cut (constructor rename, per-surface `api_version`,
v3 wire-shape, CaseStorage adapter, bundleless `reference.match`).
Python-specific notes:

- **Install (rc.1, internal channel):**

  ```bash
  # Test PyPI:
  pip install --index-url https://test.pypi.org/simple/ \
      --extra-index-url https://pypi.org/simple/ \
      sah-sdk==1.0.0rc1

  # OR GitHub Packages for Python (when configured):
  pip install --index-url https://<token>@pypi.pkg.github.com/Software-Automation-Holdings-LLC/ \
      sah-sdk==1.0.0rc1
  ```

  PEP 440 normalization: the release tag is `sdk/v1.0.0-rc.1`; the
  installable package version is `1.0.0rc1`.

- **Constructor:** `Isa.create(...)` → `Isa.with_keycode(...)`. The
  `device_id` parameter is removed (internal SDK detail).
- **api_version:** `str` → `dict[str, str]` (per-surface map). Use
  `BUNDLED_API_VERSIONS` for defaults.
- **Cases:** `isa.case.save(...)` → `isa.zyins.cases.save(product=...,
  payload=...)`. Default storage is `ZeroKnowledgeCaseStorage`.
- **Reference:** `datasets.get_v3().match(...)` →
  `isa.zyins.reference.match(text)`. Cache primes on first call;
  `isa.zyins.reference.refresh()` invalidates.
- **Type checking:** mypy strict against the SDK now enforces the
  locked surface contract.

---

# Historical: `isa-sdk-zyins` 0.2.x → `sah-sdk` 0.3.0

## What changed

The Python SDK has consolidated from a per-product package into a single
unified package. Per `SDK_DESIGN.md` §0 (2026-05-18), there is now **one
package per language**, with each product mounted under a sub-namespace:

| Before (0.2.x)                | After (0.3.0)                          |
|-------------------------------|----------------------------------------|
| `isa-sdk-zyins` (PyPI name)   | `sah-sdk`                              |
| `isa_sdk.zyins` (import root) | `sah_sdk.zyins`                        |
| `isa_sdk.zyins.transport`     | `sah_sdk.core.transport`               |
| `isa_sdk.zyins.errors`        | `sah_sdk.core.errors`                  |
| `isa_sdk.zyins.envelope`      | `sah_sdk.core.envelope`                |
| `isa_sdk.zyins.debug`         | `sah_sdk.core.debug`                   |
| `isa_sdk.zyins.auth`          | `sah_sdk.core.auth`                    |
| (n/a — was zyins-only)        | `sah_sdk.rapidsign` (scaffold)         |
| (n/a — was zyins-only)        | `sah_sdk.proxy` (scaffold)             |

All public re-exports remain available at the namespace root —
`from sah_sdk.zyins import Isa, QuoteInput, PrequalifyResult` still
works, and `Isa` is additionally exported from the top-level
(`from sah_sdk import Isa`). Domain types (`Applicant`, `Coverage`,
`Product`, `Medication`, `Condition`, …) are unchanged.

## Why

- Per-product splits added 20 publish targets (4 products × 5 languages)
  without realized benefit — bundle size, licensing separation, and
  release cadence are all addressable at other layers.
- One mental model: consumers learn `Isa.with_bearer()` once and use the
  same client for `isa.zyins.*`, `isa.rapidsign.*`, `isa.proxy.*`.
- Cross-product primitives (auth strategies, error hierarchy, envelope,
  transport) live in one place and stay in sync.

## Mechanical migration

For most projects, the migration is two find-and-replace operations:

```bash
# In your project root:
grep -rl 'from isa_sdk.zyins' src/ | xargs sed -i '' \
    's/from isa_sdk\.zyins/from sah_sdk.zyins/g'

grep -rl 'isa_sdk\.zyins\.\(transport\|errors\|envelope\|debug\|auth\)' src/ | xargs sed -i '' \
    -e 's/isa_sdk\.zyins\.transport/sah_sdk.core.transport/g' \
    -e 's/isa_sdk\.zyins\.errors/sah_sdk.core.errors/g' \
    -e 's/isa_sdk\.zyins\.envelope/sah_sdk.core.envelope/g' \
    -e 's/isa_sdk\.zyins\.debug/sah_sdk.core.debug/g' \
    -e 's/isa_sdk\.zyins\.auth/sah_sdk.core.auth/g'
```

For projects with non-trivial imports (e.g. that re-export SDK symbols
from internal facades, or that use the SDK across many packages), use
the bundled `libcst`-based codemod:

```bash
pip install 'sah-sdk[dev]'
python -m sah_sdk._codemod path/to/your/src
```

The codemod is idempotent — running it twice on already-migrated code
is a no-op. It only rewrites known import patterns; ambiguous cases are
left alone with a diagnostic for human review.

## Public surface (0.3.0)

```python
from sah_sdk import (
    Isa,
    # Auth strategies (carry credentials; transport wires them later)
    BearerAuth, LicenseAuth, SessionAuth,
    # Errors
    IsaApiError, IsaIdempotencyConflictError, IsaPermissionError,
    IsaTransportError, IsaConfigError,
    # Envelope and value types
    Envelope, RawResponse, Money, Email, Url,
    # Constants
    Product, ProductLabels, UsState, ErrorCode,
)
```

## Pinning during transition

If you must support both during transition, pin to the legacy package
in one place and the new package in another, then migrate file by file:

```toml
# pyproject.toml
dependencies = [
    "isa-sdk-zyins==0.2.*; python_version < '3.10'",  # legacy callers
    "sah-sdk>=0.3.0",                                   # everything else
]
```

The legacy package will receive security backports for six months past
the 0.3.0 GA date, then be archived.

## Questions / issues

File an issue at <https://github.com/Software-Automation-Holdings-LLC/isa-platform/issues>
with the `sdk-python` label.
