# sah/sdk (PHP)

Unified PHP SDK for the [Best Plan Pro API](https://docs.isaapi.com) — powered by the ZyINS engine. One Composer package, three product
namespaces: `zyins` (underwriting), `rapidsign` (envelope and document
workflows), `proxy` (`/v1/call` Algosure-HMAC bridge).

The canonical surface across SDK languages is the unified JS package at
`packages/ts/src/` ([entry](../ts/src/index.ts)). This PHP package mirrors
that surface in idiomatic PHP 8.2 — `readonly` classes, constructor
promotion, named-args, PSR-18 transport.

## Install

```bash
composer require sah/sdk:^0.5.0
```

(Private Packagist; auto-update is wired to this repository. Tag pattern is
`sdk/vX.Y.Z` on isa-platform — one tag, one publish per language. The flat
`sdk-php` mirror is tagged `vX.Y.Z` for Packagist webhook discovery.)

## Quick start — bearer mode

```php
use Isa\Sdk\Isa;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Prequalify\Input;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\ProductType;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;

$isa = Isa::withBearer();   // reads ISA_TOKEN from env

$input = new Input(
    applicant: new Applicant(
        dob: '1962-04-18',
        sex: Sex::Male,
        height: Height::fromFeetInches(5, 10),
        weight: Weight::fromPounds(195),
        state: 'NC',
        nicotineUse: NicotineUsage::None,
    ),
    coverage: Coverage::faceValue(25_000),
    products: [
        new Product('colonial-penn', ProductType::FinalExpense, 'colonial-penn.final-expense', 'Colonial Penn FE'),
    ],
);
$result = $isa->zyins->prequalify->run($input);
```

## Factories

| Factory | Env vars consulted when unset | Wire shape |
|---|---|---|
| `Isa::withBearer($token = null)` | `ISA_TOKEN` | `Authorization: Bearer isa_*` |
| `Isa::withKeycode($keycode = null, $email = null)` | `ISA_LICENSE_KEYCODE`, `ISA_LICENSE_EMAIL` | `Authorization: License <b64>` |
| `Isa::withLicense($keycode = null, $email = null)` | `ISA_LICENSE_KEYCODE`, `ISA_LICENSE_EMAIL` | `Authorization: License <b64>` — deprecated alias for `withKeycode` |
| `Isa::withSession($id = null, $secret = null)` | `ISA_SESSION_ID`, `ISA_SESSION_SECRET` | `Authorization: Session <id>` |

`withKeycode` is the canonical factory for agent-tool (BPP) integrations. `withLicense` is a deprecated alias that will be removed in a future major version. Use `withKeycode` in new code.

Missing env vars raise `Isa\Sdk\Zyins\Exception\IsaConfigException` with the
exact variable name in the message.

## First call in <15 lines

```php
use Isa\Sdk\Isa;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Prequalify\Input;
use Isa\Sdk\Zyins\Sex;

$isa = Isa::withKeycode(
    keycode: 'SDV-HWH-WDD',
    email:   'john.doe@acme-agency.com',
);
$result = $isa->zyins->prequalify->run(new Input(
    applicant: new Applicant(dob: '1962-04-18', sex: Sex::Male, state: 'NC'),
    coverage:  Coverage::faceValue(25_000),
));
echo $result->data->plans[0]->monthlyPremium;
```

## Per-surface API versions

The ISA API is a federation of independently versioned surfaces. Every SDK
release exports a frozen `BundledApiVersions::MAP` recording which `/vN`
each surface targets:

```php
use Isa\Sdk\Zyins\Options\BundledApiVersions;

print_r(BundledApiVersions::MAP);
// [
//   'prequalify' => 'v2',
//   'quote'      => 'v2',
//   'datasets'   => 'v2',
//   'reference'  => 'v2',
//   'sessions'   => 'v1',
//   'branding'   => 'v1',
//   'cases'      => 'v1',
// ]
```

Pin individual surfaces with a per-surface `apiVersion` map. There is **no**
`default` key and **no** string shorthand — resolution is
`$apiVersion[$surface] ?? BundledApiVersions::MAP[$surface]`:

```php
$isa = Isa::withKeycode(
    keycode:    'SDV-HWH-WDD',
    email:      'john.doe@acme-agency.com',
    apiVersion: ['quote' => 'v2'],   // pin only quote; everything else bundled
);
```

The release that retargets `prequalify` / `quote` / `datasets` / `reference`
to `v3` will bump those entries. See [SDK syntax proposal §2.7][syntax-27].

[syntax-27]: ../../docs/sdk-syntax-proposal.md#27-versioning--per-surface-not-global

## Reference data — `->match()`

The unversioned `$isa->zyins->reference` namespace canonicalizes free-text
medication and condition input. Unknown text never rejects — it returns a
structured concept with `isKnown === false`, so the final canonicalization
fires server-side at `/vN/prequalify`:

```php
$ds = $isa->zyins->datasets->get(include: ['conditions', 'medications']);

$insulin = $isa->zyins->medications->match('insulin');
echo $insulin->id, ' ', $insulin->name, ' ', var_export($insulin->isKnown, true);
// med_01KSR2WVAGC05ZGR6FA4QYEB12 INSULIN true

// Symmetric traversal — which conditions is insulin used for?
$usedFor = $insulin->conditions($isa->zyins->reference->sort::MostCommonFirst);
// frequency-ordered array; cond_01KSR2WVAGC05ZGR6FA4QYEA8X first

$novel = $isa->zyins->medications->match('NewExperimental XR 2026');
// $novel->isKnown === false; $novel->inputText === 'NewExperimental XR 2026'
```

`Sort::MostCommonFirst` and `Sort::Alphabetical` are the two supported
orderings.

## Case storage — bring your own

`$isa->zyins->cases->*` routes through a `CaseStorage` adapter. The
default is the zero-knowledge store — ISA's servers only hold ciphertext
and an opaque ID. To plug a carrier-controlled store, pass your adapter at
construction:

```php
$isa = Isa::withKeycode(
    keycode: $keycode, email: $email,
    caseStorage: new CarrierCaseStorage(),  // optional; default = ZeroKnowledgeCaseStorage
);
```

See [cases guide](https://docs.isaapi.com/docs/cases) for the full
bring-your-own pattern.

## Product namespaces

```php
<?php

use Isa\Sdk\Isa;

function callEverySurface(Isa $isa, $input, $req, $invokeInput, $integrationUuid): void
{
    $isa->zyins->prequalify->run($input);
    $isa->zyins->quote->run($input);
    $isa->zyins->datasets->list();
    // $isa->zyins->referenceData->...   // see ReferenceData service
    // $isa->zyins->usage->...           // see Usage service

    $isa->rapidsign->documents->send($req);
    // $isa->rapidsign->webhooks->verify(...);

    $isa->proxy->call->invoke($integrationUuid, $invokeInput);
    // $isa->proxy->algosure->sign(...);
}
```

Each sub-namespace's services preserve the same request envelope and error
funnel:

- `IsaIdempotencyConflictException` with `getKey()`, `getFirstSeenAt()` —
  retryable conflict on `Idempotency-Key`.
- `Envelope` (readonly): `requestId`, `idempotencyKey`, `retryAttempts`.
- `withRawResponse()` variants — return `[$data, $rawResponse]` for callers
  that need the underlying PSR-7 response.
- Cursor escape hatch on list iterators — the iterator wrapper exposes
  `cursor()` so callers can resume pagination across processes.
- Stderr-only debug logging via `fwrite(STDERR, ...)` when `ISA_LOG=debug`,
  guarded by a PSR-3 logger so callers can route elsewhere.

See [MIGRATION.md](./MIGRATION.md) for the move from the per-product
packages (`sah/sdk-zyins`, `sah/sdk-rapidsign`, `sah/sdk-proxy`,
`isa-sdk/core-transport`).

## Development

```bash
composer install
vendor/bin/phpunit
vendor/bin/phpstan analyse --level max src tests
vendor/bin/php-cs-fixer fix --dry-run --diff
```

## Licenses and Ready

The PHP SDK exposes the public BPP license-lifecycle surface and the
platform readiness probe on every `ZyInsClient`:

```php
use Isa\Sdk\Zyins\Licenses\CheckInput;
use Isa\Sdk\Zyins\ZyInsClient;

$client = ZyInsClient::withBearer();

$result = $client->licenses->check(new CheckInput(
    email: 'john.doe@acme-agency.com',
    keycode: 'ABC-123-XYZ',
));
// $result->status: 'valid' | 'invalid' | 'inactive'

$ready = $client->health->getReadiness();
// $ready->ready: true on every required probe = 'serving'
```

`/v1/licenses/check` and `/v1/licenses/deactivate` are public; `/ready`
is the unauthenticated load-balancer probe.
