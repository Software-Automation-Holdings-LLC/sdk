# @software-automation-holdings-llc/sdk

Unified TypeScript SDK for the ISA platform APIs.

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

```ts
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

```ts
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
