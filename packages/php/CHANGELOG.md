# Changelog — sah/sdk

All notable changes to the unified PHP SDK. Until v1.0.0 ships to
public Packagist, every release is a pre-release and the API may
change in incompatible ways.

## 1.0.0-rc.2 — 2026-05-30

Reference-facade consumer-gap fixes so bpp2.0 can drop its bypasses.

### Fixed

- **`discontinued_products` accepts integer-valued float epochs.** The
  strict `is_int()` check is replaced by an integer-epoch coercion that
  keeps integer-valued numbers in any JSON notation (`1700000000.0`) and
  drops genuine fractionals (`1700000000.5`), matching the other mirrors.
- **Autocomplete carries the frequency score in alphabetical mode.**
  `Sort::ALPHABETICAL` suggestions now carry `score = frequency + 1`
  (was `0`), matching the TypeScript/Python mirrors; ordering is
  unchanged.

## 1.0.0-rc.1 — 2026-05-29

First release candidate for the public 1.0 SDK. **Internal channel only**
(GitHub Packages for Composer). Consumers install via
`composer require sah/sdk:1.0.0-rc.1` once their `composer.json` has
the GitHub Packages repository configured. `minimum-stability` must
include `rc` (set at the consumer's project level).

### Highlights

- **Per-surface `apiVersion` map (no global default).**
  `Isa::withKeycode(['apiVersion' => ['prequalify' => '2026-05-14', ...]])`.
  Surfaces missing from the map fall back to `BundledApiVersions`.
- **`BundledApiVersions` exported.** The full per-surface default
  table is a public symbol; downstream tooling and conformance
  scenarios pin against it byte-identically across all 5 languages.
- **Bundleless top-level `$isa->zyins->reference->match($text)`.**
  Fetches and caches the v3 datasets index transparently via
  `ReferenceBundleCache`. No prior `datasetsV3->get()` required.
- **`cases->save` / `cases->recall` via injectable `CaseStorage`.**
  Default `ZeroKnowledgeCaseStorage` writes through `/v1/case`. E2EE
  crypto envelope is noted as a follow-up parity item to the TS
  default.
- **v3 wire-shape end-to-end.** `prequalify` / `quote` accept the
  nested `applicant` + `coverage` + `products` envelope; `pricing[]`
  table iteration on offers; ULID-aware conditions/medications;
  `face_amount_cents` singular.
- **Idempotency: strict UUID v4** on `/v3/*` mutations. SDK auto-mints
  per call; consumer override validated at the transport layer.

### Migration

See [`MIGRATION.md`](./MIGRATION.md) for the 0.x → 1.0 cut and
[../../MIGRATION.md](../../MIGRATION.md) for the cross-language guide.

### Known drift (conformance gate YELLOW — non-blocking)

The PHP conformance runner is PENDING; nine known drift items from the
TypeScript canonical runner are tracked in PR #387:

1. Bearer auth doesn't reach product methods on the locked surface;
   `$isa->zyins->prequalify` requires `Isa::withKeycode()`.
2. `applicant.height_inches` (number) vs `applicant.height` (Height
   object): v3 serializer crashes on scenarios 01,02,03,04,05,12.
3. Scenario 12 routes through v2, not v3 (no `apiVersion` map).
4. `reference.concepts.match` returns `isKnown=false` when the v3
   datasets bundle hasn't been primed (scenarios 03, 07, 09).
5. `cases->save(['applicant' => ..., 'state' => ..., 'note' => ...])`
   rejected; locked `ZeroKnowledgeCaseStorage` requires
   `['product' => ..., 'payload' => ...]`.
6. `cases->recall($id)` without `recallToken` throws by design;
   scenario 10 assumes token-optional recall.
7. `prequalify($req, ['idempotencyKey' => ...])` not supported on
   locked signature (scenario 12).
8. `reference->match` (scenario) vs `reference->concepts->match`
   (locked).
9. `reference->conditionsFor(['id' => ..., 'sort' => ...])` does not
   exist; traversal is on the concept handle.

Each is either an SDK fix, a scenario rewrite, or "by design" — the
gate is YELLOW pending triage.

### Links

- Docs: <https://docs.isaapi.com>
- Guides: [`api/guides/`](../../api/guides/)
- Migration: [`MIGRATION.md`](./MIGRATION.md)
