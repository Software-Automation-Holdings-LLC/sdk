# Migration — 0.x → 1.0.0-rc.1 (TypeScript)

The cross-language guide at [`../../MIGRATION.md`](../../MIGRATION.md)
covers the full cut (constructor rename, per-surface `apiVersion`,
v3 wire-shape, CaseStorage adapter, bundleless `reference.match`).
TS-specific notes:

- **Install (rc.1, internal channel):**

  ```bash
  # ~/.npmrc must auth GitHub Packages:
  # //npm.pkg.github.com/:_authToken=<GH_PAT_with_read:packages>
  # @software-automation-holdings-llc:registry=https://npm.pkg.github.com

  npm install @software-automation-holdings-llc/sdk@next
  ```

  Published with `--tag next`; `latest` dist-tag is NOT moved.

- **Constructor:** `Isa.create(...)` → `Isa.withKeycode(...)`. The
  `deviceId` option is removed (internal SDK detail).
- **apiVersion:** string → `Record<Surface, string>`. Use
  `BundledApiVersions` for defaults.
- **Cases:** `Isa.case.save(...)` → `isa.zyins.cases.save({ product,
  payload })`. Default storage is `ZeroKnowledgeCaseStorage`
  (AES-GCM envelope).
- **Reference:** `datasets.getV3().match(...)` →
  `isa.zyins.reference.match(text)`. Cache primes on first call;
  `isa.zyins.reference.refresh()` invalidates.
- **TypeScript strict mode:** `tsc --noEmit` against the SDK now
  enforces the locked surface contract (see CI workflow
  `sdk-public-api.yml`).

---

# Historical: per-product SDK packages (v0.0.0 → v0.3.0)

Per SDK_DESIGN §0 (2026-05-18), the TypeScript SDK now ships as one unified
package: `@software-automation-holdings-llc/sdk`.

## Package mapping

| Old (retired)        | New                                     |
| -------------------- | --------------------------------------- |
| `@isa-sdk/core`      | `@software-automation-holdings-llc/sdk` |
| `@isa-sdk/zyins`     | `@software-automation-holdings-llc/sdk` |
| `@isa-sdk/rapidsign` | `@software-automation-holdings-llc/sdk` |
| `@isa-sdk/proxy`     | `@software-automation-holdings-llc/sdk` |

## Codemod

A jscodeshift codemod scaffold lives at `codemod/rename-isa-sdk-imports.ts`
(work in progress). Until it ships, the rewrite is mechanical:

```diff
-import { Isa, Money, Product, ErrorCode } from '@isa-sdk/zyins';
+import { Isa, Product } from '@software-automation-holdings-llc/sdk';

-import { RapidSignClient } from '@isa-sdk/rapidsign';
+import { Isa } from '@software-automation-holdings-llc/sdk';
+// then use isa.rapidsign.* on a constructed Isa instance.
```

## Public API surface

The unified barrel exports:

- `Isa`, `ZyInsNamespace`, `RapidSignNamespace`, `ProxyNamespace`, `IsaOptions`
- `IsaIdentity`, `BearerIdentity`, `LicenseIdentity`, `SessionIdentity`,
  `resolveBearerIdentity`, `resolveLicenseIdentity`, `resolveSessionIdentity`,
  `ENV_VAR_NAMES`
- `IsaError`, `IsaApiError`, `IsaConfigError`, `IsaIdempotencyConflictError`
- `Envelope`, `RawResponse`, `RawResponseResult`
- `Sex`, `NicotineUsage`, `Height`, `Weight`, `sexWireCode`, `Applicant`,
  `Medication`, `Condition`
- `Coverage`, `FaceValueCoverage`, `MonthlyBudgetCoverage`
- `ProductCatalog`, `ProductSelection`, `ProductType`, `Product`
- `DebugLogger`, `EnvReader`, `LogSink`, `debugLoggerFromEnv`, `makeLogger`,
  `redactHeaders`, `redactBody`, `redactBodyString`, `processEnv`, `stderrSink`

Sub-namespace types (RapidSign envelopes / signatures, proxy transport
internals) are accessible via the `Isa` instance and not re-exported from the
top-level barrel.
