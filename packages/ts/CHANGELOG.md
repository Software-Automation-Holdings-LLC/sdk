# Changelog — @software-automation-holdings-llc/sdk

All notable changes to the unified TypeScript SDK. Until v1.0.0 ships
to the public npm registry, every release is a pre-release and the
API may change in incompatible ways.

## v1.0.0-rc.2 — 2026-05-30

Reference-facade consumer-gap fixes so bpp2.0 can drop its bypasses.

### Fixed

- **`products_by_family` skips empty-id rows.** A row whose `id` is an
  empty string is now dropped (was kept), matching the Go/PHP/C# mirrors.
- **`discontinued_products` requires integer-valued epochs.** The parser
  now uses `Number.isInteger` (was `Number.isFinite`), so a fractional
  epoch is skipped while an integer-valued float (`1700000000.0`) is kept.

## v1.0.0-rc.1 — 2026-05-29

First release candidate for the public 1.0 SDK. **Internal channel only**
(GitHub Packages, `--tag next` — `latest` dist-tag is NOT moved).
Consumers install via `npm install @software-automation-holdings-llc/sdk@next`
once authenticated to GitHub Packages.

### Highlights

- **Per-surface `apiVersion` map (no global default).** `Isa.withKeycode({
  apiVersion: { prequalify: '2026-05-14', quote: '2026-05-14', ... } })`.
  Surfaces missing from the map fall back to `BundledApiVersions`.
- **`BundledApiVersions` exported.** The full per-surface default
  table is a public symbol; downstream tooling and conformance
  scenarios pin against it byte-identically across all 5 languages.
- **Bundleless top-level `isa.zyins.reference.match(text)`.** Fetches
  and caches the v3 datasets index transparently. No prior
  `datasets.getV3()` required. `RefreshReferenceIndex` invalidates.
- **`cases.save` / `cases.recall` via injectable `CaseStorage`.**
  Default `ZeroKnowledgeCaseStorage` AES-GCM-envelopes the payload
  before writing through `/v1/case`. Carrier adapters implement the
  same interface to redirect persistence.
- **v3 wire-shape end-to-end.** `prequalify` / `quote` accept the
  nested `applicant` + `coverage` + `products` envelope; pricing[]
  table iteration on offers; ULID-aware conditions/medications;
  `face_amount_cents` singular.
- **Idempotency: strict UUID v4** on `/v3/*` mutations. SDK auto-mints
  per call; consumer override via the `idempotencyKey` option
  validated at the transport layer.

### Migration

See [`MIGRATION.md`](./MIGRATION.md) for the 0.x → 1.0 cut and
[../../MIGRATION.md](../../MIGRATION.md) for the cross-language guide.

### Known drift (conformance gate YELLOW — non-blocking)

The TypeScript conformance runner is canonical at rc.1. Nine known
drift items surfaced on first end-to-end execution (sourced verbatim
from PR #387):

1. Bearer auth doesn't reach product methods on the locked surface;
   `isa.zyins.prequalify` requires `Isa.withKeycode()`.
2. `applicant.height_inches` (number) vs `applicant.height` (Height
   object): v3 serializer crashes on scenarios 01,02,03,04,05,12.
3. Scenario 12 routes through v2, not v3 (no `apiVersion` map).
4. `reference.concepts.match` returns `isKnown:false` when the v3
   datasets bundle hasn't been primed (scenarios 03, 07, 09).
5. `cases.save({applicant, state, note})` rejected; locked
   `ZeroKnowledgeCaseStorage` requires `{product, payload}`.
6. `cases.recall(id)` without `recallToken` throws by design;
   scenario 10 assumes token-optional recall.
7. `prequalify(req, {idempotencyKey})` not supported on locked
   signature (scenario 12).
8. `reference.match` (scenario) vs `reference.concepts.match` (locked).
9. `reference.conditionsFor({id, sort})` does not exist; traversal is
   on the concept handle.

Each is either an SDK fix, a scenario rewrite, or "by design" — the
gate is YELLOW pending triage.

### Links

- Docs: <https://docs.isaapi.com>
- Guides: [`api/guides/`](../../api/guides/)
- Migration: [`MIGRATION.md`](./MIGRATION.md)
