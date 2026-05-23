# Changelog — github.com/Software-Automation-Holdings-LLC/sdk

All notable changes to the unified Go SDK. The module has not yet been
tagged for general release; until v1.0.0 ships, every release is
implicitly a pre-release and the API may change in incompatible ways.

## v0.5.0 — 2026-05-21

### Added

- **`core/session` package** — atomic session store with single-flight
  `Bootstrap` driver. `Store.CurrentSecret()` is the read path; the
  steady-state interceptor calls `Bootstrap` on miss/expiry and
  `Invalidate` on 401 `session_expired`. `OnActivity(ctx)` is the
  consumer-facing proactive-refresh hook (re-mints when within 5
  minutes of expiry).
- **`core/transport.SessionInterceptor`** — transparent HTTPDoer wrapper
  that signs every request with the cached session, retries once on
  401 `session_expired`, and shares one bootstrap across concurrent
  callers via `golang.org/x/sync/singleflight`. Wiring at the
  transport layer means every existing product method (zyins,
  account, rapidsign, proxy) inherits auto-refresh without per-method
  changes.

### Tests

- `TestSessionInterceptor_ConcurrentProductCalls_TriggerExactlyOneBootstrap`
  fires 10 concurrent product calls from a cold-start interceptor and
  asserts exactly one POST `/v1/sessions` round-trip — the
  single-flight invariant.
- `TestSessionInterceptor_RetryOn401SessionExpired` covers the
  invalidate + re-bootstrap + replay path.

## v0.4.0-rc.1 — 2026-05-21

### Added

- **`account/` namespace** — License-HMAC-authenticated `isa.account.*`
  surface for branding, preferences, cases, email, and reference-data
  lookups (mirrors TS SDK PR #196).
  - `account.NewClient(auth, opts...)` constructs the namespace from
    explicit credentials; consumer-defined `HTTPDoer` and
    `license.Clock` facades support test injection.
  - `client.Branding.Lookup(ctx, *BrandingLookupOptions)` →
    `(*BrandingDetail, error)`. Tolerates the standard envelope and
    accepts both `primary_color` and the legacy `main_color`.
  - `client.Preferences.Lookup(ctx, scope) / Set(ctx, scope, doc)` —
    opaque scope-partitioned settings document.
  - `client.Cases.{Create, Get, List, Email}` — content-addressed case
    CRUD + share.
  - `client.Email.Enqueue` — transactional email; recipients accept
    `[]string`; the wire shape collapses a single recipient to a bare
    string to match the legacy server.
  - `client.ReferenceData.Get(ctx, scope, ...ReferenceDataOption)` —
    dispatches across `GET /dataset/{name}`, `POST /v1/reference-data`,
    and `POST /v2/reference-data` based on scope.
- **`core/license` package** — `license.Build(input)` produces the
  six-header License-HMAC bundle (Authorization, X-Device-ID,
  X-Device-Signature, X-License-Method, X-License-URI,
  X-License-Timestamp). Byte-identical to the TS
  `buildLicenseHMACHeaders` helper.
- **`zyins.LogosService`** — `client.Logos.Get(ctx, carrier, ...)`
  returns either raw image bytes or a `data:image/...;base64,...`
  string depending on `WithDataURI(true)`. Non-credentialed per
  api-standards GET allowlist (mirrors TS SDK PR #195). Hits
  `/v1/logo/{carrier}` for parity with the PHP server today; can
  switch to `/v1/logos/` after zyins #303 lands without API churn.
- **Licenses ergonomics** (mirrors TS SDK PR #194):
  - `client.Licenses.Activate(ctx, *LicenseActivateInput)` — minted
    license key auto-stashes into the attached `CredentialState`.
  - `client.Licenses.Check(ctx, nil)` and `.Deactivate(ctx, nil)`
    now fill from `CredentialState` when the input is nil.
  - `client.Licenses.WithState(state)` attaches a shared credential
    state for zero-arg variants.
  - `zyins.CredentialState`, `MemoryCredentialStore`,
    `LicensesFromEnv()` (reads `ISA_LICENSE_KEYCODE` +
    `ISA_LICENSE_EMAIL`), and `OnLicenseRefreshed(listener)` hook.
- **`zyins.Prequalify.LegacyBlob`** — accepts an opaque
  `map[string]any` already encoded by a legacy caller and posts it
  verbatim to `/v1/prequalify`; reuses the full transport stack (auth,
  idempotency, error funnel). Mirrors TS SDK PR #193.
- **`catalog/` package** — generated catalogs of `Product`, `State`,
  `Carrier`, `MedicationUse`, `Scope`, `SignEvent`, `ErrorCode`. API:
  `catalog.Products.Values()`, `catalog.Products.ByCarrier(slug)`,
  `catalog.Products.Metadata(p)`, `catalog.States.ByAbbreviation("NC")`,
  etc. Regenerate via `go generate ./catalog/...` (delegates to
  `packages/go/scripts/gen-catalog`). Mirrors TS SDK PR #197.

### Data-source gaps (mirrored from TS catalog)

- `ProductMetadata.AgeMin/Max`, `.States`, `.FaceAmountMin/Max` are
  advisory zeros today — the upstream catalog does not expose
  per-product underwriting bounds in a stable, public-facing form.
- `CarrierMetadata.States` is empty — per-carrier licensure is not
  surfaced in the public reference data.
- `ConditionCategories` is intentionally absent (the engine does not
  expose a stable taxonomy yet).

## Earlier versions

See `zyins/CHANGELOG.md` for the per-package history of the bearer-only
v0.1.0 / v0.2.0 / v0.3.0 lines.
