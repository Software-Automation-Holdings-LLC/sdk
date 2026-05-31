# Changelog — Sah.Sdk

All notable changes to the unified C# SDK. Until v1.0.0 ships to
public NuGet, every release is a pre-release and the API may change
in incompatible ways.

## 1.0.0-rc.2 — 2026-05-30

Reference-facade consumer-gap fixes so bpp2.0 can drop its bypasses.

### Fixed

- **`discontinued_products` accepts integer-valued float epochs.**
  `TryGetInt64` alone rejects any number carrying a `.` or exponent, so an
  integer-valued epoch float (`1700000000.0`) was dropped. Added
  `TryIntegerEpoch` (TryGetInt64 + a TryGetDouble integer-check fallback)
  so C# keeps integer-valued numbers in any notation and drops genuine
  fractionals — identical to the Go/TS/Python/PHP mirrors.

## 1.0.0-rc.1 — 2026-05-29

First release candidate for the public 1.0 SDK. **Internal channel only**
(GitHub Packages NuGet feed). Consumers install via
`dotnet add package Sah.Sdk --version 1.0.0-rc.1 --source github` once
the GitHub Packages source is registered.

### Highlights

- **Per-surface `ApiVersion` resolution (no global default).** The
  single pinned `ApiVersion` is replaced with `BundledApiVersions`
  plus `ResolveApiVersion(surface)` on each client. Consumers can
  override per-surface via the options bag.
- **`BundledApiVersions` exported.** The full per-surface default
  table is a public symbol; downstream tooling and conformance
  scenarios pin against it byte-identically across all 5 languages.
- **`Reference` namespace on `ZyInsClient`.** `Match`, concept
  handles, cached `ReferenceIndex`, symmetric traversal. Bundleless
  top-level `MatchAsync` fetches and caches the v3 datasets index
  transparently.
- **`Cases.SaveAsync` / `Cases.RecallAsync` via optional
  `CaseStorage`.** Default `ZeroKnowledgeCaseStorage` with AES-GCM
  on `net8+`; the same interface lets carrier adapters redirect
  persistence.
- **v3 wire-shape end-to-end.** `PrequalifyAsync` / `QuoteAsync`
  accept the nested `applicant` + `coverage` + `products` envelope;
  pricing[] table iteration on offers; ULID-aware conditions/
  medications; `face_amount_cents` singular.
- **Idempotency: strict UUID v4** on `/v3/*` mutations. SDK auto-mints
  per call; consumer override via `IdempotencyKey` validated at the
  transport layer.

### Migration

See [`MIGRATION.md`](./MIGRATION.md) for the 0.x → 1.0 cut and
[../../MIGRATION.md](../../MIGRATION.md) for the cross-language guide.

### Known drift (conformance gate YELLOW — non-blocking)

The C# conformance runner is PENDING; nine known drift items from the
TypeScript canonical runner are tracked in PR #387:

1. Bearer auth doesn't reach product methods on the locked surface;
   `isa.ZyIns.PrequalifyAsync` requires `Isa.WithKeycode()`.
2. `applicant.height_inches` (number) vs `applicant.height` (Height
   object): v3 serializer crashes on scenarios 01,02,03,04,05,12.
3. Scenario 12 routes through v2, not v3 (no `ApiVersion` map).
4. `Reference.Concepts.Match` returns `IsKnown=false` when the v3
   datasets bundle hasn't been primed (scenarios 03, 07, 09).
5. `Cases.SaveAsync` with `{applicant, state, note}` rejected;
   locked `ZeroKnowledgeCaseStorage` requires `{product, payload}`.
6. `Cases.RecallAsync(id)` without `recallToken` throws by design;
   scenario 10 assumes token-optional recall.
7. `PrequalifyAsync(req, idempotencyKey: ...)` not supported on
   locked signature (scenario 12).
8. `Reference.Match` (scenario) vs `Reference.Concepts.Match`
   (locked).
9. `Reference.ConditionsFor(id:, sort:)` does not exist; traversal
   is on the concept handle.

Each is either an SDK fix, a scenario rewrite, or "by design" — the
gate is YELLOW pending triage.

### Links

- Docs: <https://docs.isaapi.com>
- Guides: [`api/guides/`](../../api/guides/)
- Migration: [`MIGRATION.md`](./MIGRATION.md)
