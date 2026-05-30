# Changelog — sah-sdk

All notable changes to the unified Python SDK. Until v1.0.0 ships to
public PyPI, every release is a pre-release and the API may change in
incompatible ways.

## 1.0.0rc2 — 2026-05-30

Reference-facade consumer-gap fixes so bpp2.0 can drop its bypasses. The
underlying release tag is `sdk/v1.0.0-rc.2`.

### Fixed

- **`products_by_family` skips empty-id rows.** A row whose `id` is an
  empty string is now dropped (was kept), matching the Go/PHP/C# mirrors.
- **`discontinued_products` accepts integer-valued float epochs.** The
  strict `isinstance(value, int)` check is replaced by an integer-epoch
  coercion that keeps integer-valued numbers in any JSON notation
  (`1700000000.0`) and drops genuine fractionals (`1700000000.5`).

## 1.0.0rc1 — 2026-05-29

First release candidate for the public 1.0 SDK. **Internal channel only**
(GitHub Packages / Test PyPI). The committed metadata uses PEP 440
normalized form `1.0.0rc1`; the underlying release tag is
`sdk/v1.0.0-rc.1`.

### Highlights

- **Per-surface `api_version` map (no global default).**
  `Isa.with_keycode(api_version={"prequalify": "2026-05-14", ...})`.
  Surfaces missing from the map fall back to `BUNDLED_API_VERSIONS`.
- **`BUNDLED_API_VERSIONS` exported.** The full per-surface default
  table is a public symbol; downstream tooling and conformance
  scenarios pin against it byte-identically across all 5 languages.
- **Bundleless top-level `isa.zyins.reference.match(text)`.** Fetches
  and caches the v3 datasets index transparently. No prior
  `datasets.get_v3()` required. `refresh_reference_index()`
  invalidates.
- **`cases.save` / `cases.recall` via injectable `CaseStorage`.**
  Default `ZeroKnowledgeCaseStorage` envelopes the payload before
  writing through `/v1/case`. Carrier adapters implement the same
  protocol to redirect persistence.
- **v3 wire-shape end-to-end.** `prequalify` / `quote` accept the
  nested `applicant` + `coverage` + `products` envelope; `pricing[]`
  table iteration on offers; ULID-aware conditions/medications;
  `face_amount_cents` singular.
- **Idempotency: strict UUID v4** on `/v3/*` mutations. SDK auto-mints
  per call; consumer override via `idempotency_key=` validated at
  the transport layer.

### Migration

See [`MIGRATION.md`](./MIGRATION.md) for the 0.x → 1.0 cut and
[../../MIGRATION.md](../../MIGRATION.md) for the cross-language guide.

### Known drift (conformance gate YELLOW — non-blocking)

The Python conformance runner is PENDING; nine known drift items from
the TypeScript canonical runner are tracked in PR #387:

1. Bearer auth doesn't reach product methods on the locked surface;
   `isa.zyins.prequalify` requires `Isa.with_keycode()`.
2. `applicant.height_inches` (number) vs `applicant.height` (Height
   object): v3 serializer crashes on scenarios 01,02,03,04,05,12.
3. Scenario 12 routes through v2, not v3 (no `api_version` map).
4. `reference.concepts.match` returns `is_known=False` when the v3
   datasets bundle hasn't been primed (scenarios 03, 07, 09).
5. `cases.save({applicant, state, note})` rejected; locked
   `ZeroKnowledgeCaseStorage` requires `{product, payload}`.
6. `cases.recall(id)` without `recall_token` throws by design;
   scenario 10 assumes token-optional recall.
7. `prequalify(req, idempotency_key=...)` not supported on locked
   signature (scenario 12).
8. `reference.match` (scenario) vs `reference.concepts.match` (locked).
9. `reference.conditions_for(id=, sort=)` does not exist; traversal
   is on the concept handle.

Each is either an SDK fix, a scenario rewrite, or "by design" — the
gate is YELLOW pending triage.

### Links

- Docs: <https://docs.isaapi.com>
- Guides: [`api/guides/`](../../api/guides/)
- Migration: [`MIGRATION.md`](./MIGRATION.md)
