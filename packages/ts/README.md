# @software-automation-holdings-llc/sdk

Unified TypeScript SDK for the [Best Plan Pro API](https://docs.isaapi.com) — powered by the ZyINS engine.

## Install

```sh
npm install @software-automation-holdings-llc/sdk
```

The package is published to GitHub Packages (org-private). Configure your `.npmrc`:

```
@software-automation-holdings-llc:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## Hello world

```ts @no-compile
import { Isa } from '@software-automation-holdings-llc/sdk';

const isa = Isa.withBearer();                   // reads ISA_TOKEN
const { data } = await isa.zyins.prequalify(req);
```

Three bootstrap factories cover all auth contexts:

| Factory | Audience | Env defaults |
|---|---|---|
| `Isa.withBearer()` | Server-to-server | `ISA_TOKEN` |
| `Isa.withLicense({ deviceId, orderId })` | BPP agent tools | `ISA_LICENSE_KEYCODE`, `ISA_LICENSE_EMAIL` |
| `Isa.withSession()` | Embedded forms | `ISA_SESSION_ID`, `ISA_SESSION_SECRET` |

## First call in <15 lines

```ts
import {
  Isa,
  Sex,
  State,
  Height,
  Weight,
  NicotineUsage,
  Coverage,
  ProductSelection,
  ProductClass,
} from '@software-automation-holdings-llc/sdk';

const isa = await Isa.withKeycode({
  keycode: 'SDV-HWH-WDD',
  email:   'john.doe@acme-agency.com',
});

const { data } = await isa.zyins.prequalifyV2({
  applicant: {
    dob:         '1962-04-18',
    sex:         Sex.Male,
    state:       State.NorthCarolina,
    height:      Height.fromFeetInches(5, 10),
    weight:      Weight.fromPounds(195),
    nicotineUse: NicotineUsage.None,
  },
  coverage: Coverage.faceValue(25_000),
  products: ProductSelection.byTypes([ProductClass.Term]),
});
console.log(data.plans[0].premium?.display);
```

## Per-surface API versions

The ISA API is a federation of independently versioned surfaces. There is no
single "current" version; the SDK exposes no global shorthand. Every release
ships a frozen `BundledApiVersions` table recording which `/vN` each surface
targets:

```ts @no-compile
import { BundledApiVersions } from '@software-automation-holdings-llc/sdk';

console.log(BundledApiVersions);
// {
//   prequalify: 'v2',
//   quote:      'v2',
//   datasets:   'v2',
//   reference:  'v2',
//   sessions:   'v1',
//   branding:   'v1',
//   cases:      'v1',
// }
```

To pin a single surface without disturbing the rest, pass a per-surface
`apiVersion` override map. There is **no** `default` key and **no** string
shorthand — resolution is `apiVersion[surface] ?? BundledApiVersions[surface]`:

```ts
import { Isa } from '@software-automation-holdings-llc/sdk';

const isa = await Isa.withKeycode(
  {
    keycode: 'SDV-HWH-WDD',
    email:   'john.doe@acme-agency.com',
  },
  undefined,                       // env reader — defaults to process.env
  { apiVersion: { quote: 'v2' } }, // pin only quote; everything else bundled
);
```

The release that retargets `prequalify` / `quote` / `datasets` / `reference`
to `v3` will bump those entries. See [SDK syntax proposal §2.7][syntax-27].

[syntax-27]: ../../docs/sdk-syntax-proposal.md#27-versioning--per-surface-not-global

## Reference adapters

Three SDK adapters consume the `/v3/datasets` catalog: **Autocorrect**
(typo correction), **Match** (text → single canonical concept), and
**Autocomplete** (text → ranked suggestions). Each one ships a default
implementation and accepts a wholesale replacement at SDK construction.
Each one has a canonical guide on
[docs.isaapi.com](https://docs.isaapi.com); the README only shows the
30-second tour.

| Adapter | Default impl | Guide |
|---|---|---|
| `Autocorrector` | `DefaultAutocorrector` (typo-map driven) | [Autocorrect](https://docs.isaapi.com/docs/autocorrect) |
| `MatchAlgorithm` | `DefaultMatchAlgorithm` (`_makeKey` + exact lookup) | [Match](https://docs.isaapi.com/docs/match) |
| `AutocompleteAlgorithm` | `DefaultAutocompleteAlgorithm` (6-bucket priority) | [Autocomplete](https://docs.isaapi.com/docs/autocomplete) |

Wire-shape reference for the catalog the adapters consume:
[Reference catalog shape](https://docs.isaapi.com/docs/reference-catalog).
Standalone-licensable terms: [Licensing the datasets](https://docs.isaapi.com/docs/licensing-the-datasets).

### Autocorrect

`isa.zyins.autocorrector` is pre-wired against the ZyINS spelling
corrections. The `mode` option chooses between mid-typing guards
(`keyup`) and anti-duplication guards (`submit`).

```ts @no-compile
import { Isa } from '@software-automation-holdings-llc/sdk';

const isa = await Isa.withKeycode({
  keycode: 'SDV-HWH-WDD',
  email:   'john.doe@acme-agency.com',
});

const corrected = isa.zyins.autocorrector.correct('hyprtension and losartn', {
  mode: 'submit',
});
// → 'HYPERTENSION and LOSARTAN'
```

For a custom typo corpus, use the generic kernel:

```ts @no-compile
const myCorrector = isa.autocorrector.create({
  typoMap: new Map([['ASMA', 'ASTHMA'], ['DIABEETUS', 'DIABETES']]),
});
myCorrector.correct('asma flare', { mode: 'submit' });
// → 'ASTHMA flare'
```

### Match

`isa.zyins.{conditions,medications,concepts}.match()` resolves free
text to a single canonical `Concept`. Unknown text never rejects — it
returns an `UnknownConcept` with `inputText` preserved, safe to send
straight to `/v3/prequalify`.

```ts @no-compile
const hbp = isa.zyins.conditions.match('High Blood Pressure');
console.log(hbp.id, hbp.name, hbp.isKnown);
// cond_01KSR2XVXS8F3PQRJGFG91W51G  High Blood Pressure  true

const novel = isa.zyins.medications.match('NewExperimental XR 2026');
console.log(novel.isKnown, novel.inputText);
// false  'NewExperimental XR 2026'
```

### Autocomplete

`isa.zyins.{conditions,medications,concepts}.autocomplete(text, opts)`
returns ranked `Suggestion[]` using the 6-bucket priority algorithm
with within-bucket frequency boost. `frequencies` and `kinds` come
from the cached datasets bundle automatically.

```ts @no-compile
const suggestions = await isa.zyins.conditions.autocomplete('high b', {
  limit: 5,
});
suggestions.forEach(s => console.log(s.bucket, s.concept.name, s.score));
// 1  High Blood Pressure  12480
// 1  High Blood Sugar      3200
```

### Extending the default

Each `Default*` implementation is immutable and exposes a `clone(overrides)`
method plus a `versionTag` getter. Use `clone()` to swap one field
without restating the others:

```ts @no-compile
import { DefaultAutocorrector } from '@software-automation-holdings-llc/sdk';

// Start from the SDK-bundled corrector, override the typo map, keep
// the rest of the wiring (mode, onApplied sink, etc.) intact:
const tenant = isa.zyins.autocorrector.clone({
  typoMap:    new Map([['HBP', 'HIGH BLOOD PRESSURE']]),
  versionTag: '2026.05.29-acme',
  onApplied:  (event) => analytics.track('autocorrect', event),
});

tenant.versionTag;  // '2026.05.29-acme'  — surfaces stale-corpus detection
```

`DefaultAutocorrector.onApplied` fires once per correction with the input
text, the corrected text, and the `mode`. Use it to surface telemetry
without subclassing.

`DefaultMatchAlgorithm` and `DefaultAutocompleteAlgorithm` follow the
same `clone(overrides)` + `versionTag` pattern.

### Wholesale replacement

When the bundled algorithm is the wrong shape (e.g. fuzzy edit-distance,
hosted-LLM lookup), implement the interface directly and pass it on the
constructor. The minimal `MatchAlgorithm` is two lines:

```ts @no-compile
import type { MatchAlgorithm, Concept } from '@software-automation-holdings-llc/sdk';

// Exact-string match against `concept.name`, no key normalization.
class ExactNameMatch implements MatchAlgorithm {
  match(text: string, candidates: readonly Concept[]): Concept | null {
    return candidates.find((c) => c.name === text) ?? null;
  }
}

const isa = await Isa.withKeycode({
  keycode: 'SDV-HWH-WDD',
  email:   'john.doe@acme-agency.com',
  autocorrector:         new MyAutocorrector(),         // Autocorrector
  matchAlgorithm:        new ExactNameMatch(),          // MatchAlgorithm
  autocompleteAlgorithm: new MyAutocompleteAlgorithm(), // AutocompleteAlgorithm
});
```

The injected implementation replaces the default everywhere — pre-wired
facades (`isa.zyins.conditions.match`, `isa.zyins.medications.autocomplete`)
route through it. Same wholesale + decorator + composition pattern as
[`CaseStorage`](https://docs.isaapi.com/docs/cases).

### `BundledApiVersions` and the adapter wire

The default adapters consume the v3 reference catalog. The `/datasets`
surface is pinned in [`BundledApiVersions`](https://docs.isaapi.com/docs/api-version-pinning):

```ts @no-compile
import { BundledApiVersions } from '@software-automation-holdings-llc/sdk';

BundledApiVersions.datasets;    // 'v3'
BundledApiVersions.prequalify;  // 'v2' as of this SDK release
```

Override per-surface via the `apiVersion` map on `Isa.withKeycode`. The
adapters always read whichever `/vN/datasets` you pinned — no separate
adapter version. See [api-version-pinning](https://docs.isaapi.com/docs/api-version-pinning).

## Case storage — bring your own

`isa.zyins.cases.*` routes through a `CaseStorage` adapter. The default is
the zero-knowledge store — ISA's servers only hold ciphertext and an opaque
ID. To plug a carrier-controlled store, pass your adapter at construction:

```ts @no-compile
// `CarrierCaseStorage` is a placeholder for a consumer-supplied
// implementation of the `CaseStorage` interface — see the cases guide.
import { Isa, LicenseAuth, type CaseStorage } from '@software-automation-holdings-llc/sdk';
declare const CarrierCaseStorage: new () => CaseStorage;

const isa = await Isa.create({
  auth: LicenseAuth.fromEnv(),
  caseStorage: new CarrierCaseStorage(),  // optional; default = ZeroKnowledgeCaseStorage
});
```

See [cases guide](https://docs.isaapi.com/docs/cases) for the full
bring-your-own pattern.

## Sub-namespaces

| Namespace | Access | Status |
|---|---|---|
| `isa.zyins.*` | `isa.zyins.prequalify(req)` | Live (license mode) |
| `isa.rapidsign.*` | `isa.rapidsign.webhooks.verify(...)` | Verifier stub (issue #38) |
| `isa.proxy.*` | internal | Phase 3 |
| `isa.webhooks.*` | top-level alias | Verifier stub |

## Raw response variant

Every product method has a `.withRawResponse` sibling returning
`{ data, response }` with status, headers, and url:

```ts @no-compile
// Continued from "First call in <15 lines" — `isa` and `req` are
// the ones defined there.
const { data, response } = await isa.zyins.prequalifyRaw(req);
console.log(response.headers['x-isa-request-id']);
```

## Debug logging

Set `ISA_LOG=debug` to stream request/response pairs to stderr. Sensitive
headers (`Authorization`, `X-Device-Signature`, `X-Session-Signature`) and
body fields (`license`, `licenseKey`, `keycode`, `password`, `secret`,
`token`) are redacted.

## Concurrency safety

A single `Isa` instance carries no shared mutable state. Multiple
concurrent in-flight calls on one instance are safe — there's no need
to construct one client per request.

## Tree-shaking

The package is annotated `sideEffects: false`. Modern bundlers
(esbuild, Rollup, Webpack) will drop unused product namespaces from
your bundle when you import only the names you use.

## Migration from per-product packages

`@isa-sdk/core`, `@isa-sdk/zyins`, `@isa-sdk/rapidsign`, and
`@isa-sdk/proxy` (all `0.0.0`) are retired in favor of this unified
package. See [MIGRATION.md](./MIGRATION.md) for the codemod and a
mapping table.

## License lifecycle

License activation, check, and deactivation hang off `isa.zyins.license`
(singular — a device carries exactly one license). The facade fills
`keycode`/`email`/`deviceId` from the credential state used to
construct `isa`, so the common call is argument-free:

```ts
import { Isa } from '@software-automation-holdings-llc/sdk';

const isa = await Isa.withKeycode({
  keycode: 'SDV-HWH-WDD',
  email:   'john.doe@acme-agency.com',
});

const status = await isa.zyins.license.check();
// status.status: 'valid' | 'invalid' | 'inactive'
```
