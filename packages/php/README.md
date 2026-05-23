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
composer require sah/sdk:^0.3.0
```

(Private Packagist; auto-update is wired to this repository. Tag pattern is
`sdk/vX.Y.Z` — one tag, one publish per language.)

## Quick start — bearer mode

```php
use Sah\Sdk\Isa;
use Sah\Sdk\Zyins\Applicant;
use Sah\Sdk\Zyins\Coverage;
use Sah\Sdk\Zyins\Height;
use Sah\Sdk\Zyins\NicotineUsage;
use Sah\Sdk\Zyins\Prequalify\Input;
use Sah\Sdk\Zyins\Product;
use Sah\Sdk\Zyins\ProductType;
use Sah\Sdk\Zyins\Sex;
use Sah\Sdk\Zyins\Weight;

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
| `Isa::withLicense($keycode = null, $email = null)` | `ISA_LICENSE_KEYCODE`, `ISA_LICENSE_EMAIL` | `Authorization: License <b64>` |
| `Isa::withSession($id = null, $secret = null)` | `ISA_SESSION_ID`, `ISA_SESSION_SECRET` | `Authorization: Session <id>` |

Missing env vars raise `Sah\Sdk\Zyins\Exception\IsaConfigException` with the
exact variable name in the message.

## Product namespaces

```php
$isa->zyins->prequalify->run($input);
$isa->zyins->quote->run($input);
$isa->zyins->datasets->list(...);
$isa->zyins->referenceData->...
$isa->zyins->usage->...

$isa->rapidsign->documents->send($req);
$isa->rapidsign->webhooks->verify(...);

$isa->proxy->call->invoke($integrationUuid, $invokeInput);
$isa->proxy->algosure->sign(...);
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
use Sah\Sdk\Zyins\Licenses\CheckInput;
use Sah\Sdk\Zyins\ZyInsClient;

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
