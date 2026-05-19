# Migration — per-product packages → `sah/sdk` v0.3.0

The PHP SDK ships as **one Composer package per process**, not four. This
document explains how to migrate.

## Why

Per-product splits cost us:

- Four publish targets per language × five languages = twenty release legs.
- Composer dependency-resolution coordination on every release (a `quote()`
  bump in `sah/sdk-zyins` did not automatically pick up a `Transport` change
  in `isa-sdk/core-transport`).
- Mental tax on consumers: "are these versions compatible?"

The bundle-size argument never held — Composer downloads everything you
require; you cannot tree-shake PHP. Licensing separation is a contract-layer
concern, not a package-layer concern.

## Composer changes

| Before | After |
|---|---|
| `composer require sah/sdk-zyins` | `composer require sah/sdk:^0.3.0` |
| `composer require sah/sdk-rapidsign` | (covered by `sah/sdk:^0.3.0`) |
| `composer require sah/sdk-proxy` | (covered by `sah/sdk:^0.3.0`) |
| `composer require isa-sdk/core-transport` | (covered by `sah/sdk:^0.3.0`) |

```bash
composer remove sah/sdk-zyins sah/sdk-rapidsign sah/sdk-proxy isa-sdk/core-transport
composer require sah/sdk:^0.3.0
```

## Namespace changes

| Before | After |
|---|---|
| `Sah\IsaSdk\ZyINS\…` | `Sah\Sdk\Zyins\…` |
| `Sah\IsaSdk\RapidSign\…` | `Sah\Sdk\RapidSign\…` |
| `Sah\IsaSdk\Proxy\…` | `Sah\Sdk\Proxy\…` |
| `Sah\Sdk\Core\Transport\…` | `Sah\Sdk\Core\…` |
| `Sah\IsaSdk\ZyINS\Tests\…` | `Sah\Sdk\Tests\Zyins\…` |
| `Sah\IsaSdk\Proxy\Tests\…` | `Sah\Sdk\Tests\Proxy\…` |
| `Sah\IsaSdk\RapidSign\Tests\…` | `Sah\Sdk\Tests\RapidSign\…` |
| `Sah\Sdk\Core\Transport\Tests\…` | `Sah\Sdk\Tests\Core\…` |

## Entry-point change

The new unified entry point is `Sah\Sdk\Isa`. Per-product clients
(`ZyInsClient`, `RapidSignClient`, `ProxyClient`) remain available for
advanced callers — `Isa` composes them.

```php
// Before
use Sah\IsaSdk\ZyINS\ZyInsClient;
use Sah\IsaSdk\RapidSign\RapidSignClient;

$zyins = ZyInsClient::withBearer();
$rapidsign = new RapidSignClient($token);

// After
use Sah\Sdk\Isa;

$isa = Isa::withBearer();
$zyins = $isa->zyins;          // Sah\Sdk\Zyins\ZyInsClient
$rapidsign = $isa->rapidsign;   // Sah\Sdk\RapidSign\RapidSignClient
$proxy = $isa->proxy;           // Sah\Sdk\Proxy\ProxyClient
```

## Automated migration with Rector

A scaffold Rector configuration is included as `rector.php`. Run it from
your project root:

```bash
composer require --dev rector/rector:^1.2
vendor/bin/rector process --config vendor/sah/sdk/rector.php path/to/your/code
```

The supplied rule set covers the namespace renames listed above and the
`ZyInsClient::with*` → `Isa::with*` factory swap. Review each diff before
committing — Rector's renames are textual and a stray comment containing the
old namespace will also be rewritten.

## What did not change

- Method shapes (`prequalify->run`, `documents->send`, `call->invoke`).
- Idempotency-key behavior (`Idempotency-Key` header, conflict surface via
  `IsaIdempotencyConflictException`).
- Envelope fields (`requestId`, `idempotencyKey`, `retryAttempts`).
- The `withRawResponse()` variants and the cursor escape hatch on list
  iterators.
- Stderr debug logging at `ISA_LOG=debug`.
- The PSR-18 transport contract.
