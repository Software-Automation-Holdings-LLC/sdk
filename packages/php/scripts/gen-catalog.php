<?php

declare(strict_types=1);

/**
 * Catalog code generator (PHP edition).
 *
 * Reads `v2_products.json` and emits:
 *   - `src/Catalog/data/products.php`  — id-keyed Product data map
 *   - `src/Catalog/data/carriers.php`  — carrier metadata map
 *   - `src/Catalog/Product.php`        — rich value class
 *   - `src/Catalog/Products.php`       — nested family accessors + byId
 *
 * Generator fails loud if any product entry lacks an `id` field.
 *
 * Idempotent: same input bytes produce byte-identical output.
 *
 * Run: `php scripts/gen-catalog.php`
 * Wired into: `composer gen:catalog`
 */

$repoPhp    = dirname(__DIR__);
$repoPlatform = $_SERVER['SDK_PLATFORM_REPO']
    ?? realpath($repoPhp . '/../..')
    ?: dirname($repoPhp, 2);
$insurance = $_SERVER['SDK_INSURANCE_REPO']
    ?? realpath($repoPlatform . '/../insurance')
    ?: $repoPlatform . '/../insurance';

$dataDir = $repoPhp . '/src/Catalog/data';
if (! is_dir($dataDir)) {
    if (! mkdir($dataDir, 0o755, recursive: true) && ! is_dir($dataDir)) {
        throw new RuntimeException("Failed to create catalog data directory: {$dataDir}");
    }
}

$gaps = [];

/** @return mixed */
function readJson(string $path): mixed
{
    if (! is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }
    return json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
}

function slugify(string $s): string
{
    $t = strtolower($s);
    $t = preg_replace('/[^a-z0-9]+/', '-', $t) ?? '';
    return trim($t, '-');
}

function writeData(string $dataDir, string $name, mixed $value): void
{
    $body = "<?php\n\ndeclare(strict_types=1);\n\nreturn " . var_export($value, true) . ";\n";
    $target = $dataDir . '/' . $name;
    if (file_put_contents($target, $body) === false) {
        throw new RuntimeException("Failed to write catalog file: {$target}");
    }
}

/**
 * Derive a stable PHP method name from a product display name.
 *
 * Rules (mirror the TS SDK's camelCase convention):
 *   - Strip carrier prefix from the display name (first word(s) until
 *     the product-specific part begins is already implicit in the
 *     family namespace).
 *   - Convert remaining words to camelCase.
 *   - Disambiguate collisions by appending _2, _3, ...
 *
 * We actually use the full display name → camelCase since the family
 * groups are already scoped. Examples:
 *   "Aetna Accendo"       → "aetnaAccendo"
 *   "Mutual of Omaha Living Promise" → "mutualOfOmahaLivingPromise"
 */
function methodName(string $displayName): string
{
    // Split on non-alphanumeric sequences
    $parts = preg_split('/[^a-zA-Z0-9]+/', $displayName, flags: PREG_SPLIT_NO_EMPTY) ?? [];
    if ($parts === []) {
        return 'unknown';
    }
    $first = strtolower($parts[0]);
    $rest  = array_slice($parts, 1);
    $camel = $first . implode('', array_map('ucfirst', array_map('strtolower', $rest)));
    return $camel;
}

// ─── Products + Carriers ─────────────────────────────────────────────────────

$productsPath = $insurance . '/v2_products.json';
$json = readJson($productsPath);

if (! is_array($json)) {
    // v2_products.json is absent — CI runners check out only the platform repo,
    // not the sibling engine repo that holds it. The committed catalog
    // (src/Catalog/Products.php + data/products.php) carries the real prod_<uuid>
    // ids and IS the published artifact, so preserve it untouched. Overwriting it
    // with an empty catalog is the isa-sdk@1.0.1 launch-blocker. With nothing
    // committed to preserve, fail loud rather than ship an empty product catalog.
    $committed = [
        $repoPhp . '/src/Catalog/Products.php',
        $repoPhp . '/src/Catalog/Product.php',
        $dataDir . '/products.php',
        $dataDir . '/carriers.php',
    ];
    $missing = array_filter($committed, static fn (string $p): bool => ! is_file($p));
    if ($missing !== []) {
        fwrite(STDERR, sprintf(
            "gen-catalog: FATAL: Products: %s not found AND no committed catalog to preserve (%s). "
            . "Refusing to emit an empty product catalog. Run where the data file exists, "
            . "or commit a populated catalog first.\n",
            $productsPath,
            implode(', ', $missing),
        ));
        exit(1);
    }
    $gaps[] = "Products: {$productsPath} not found — preserving committed catalog.";
    fwrite(STDERR, "gen-catalog: preserved committed catalog (Products.php + data)\n");
} else {
    /** @var array<string, array{id:string, slug:string, displayName:string, carrier:string, class:string}> $products keyed by prod_<uuid> */
    $products = [];
    /** @var array<string, array{slug:string, displayName:string, products:list<string>}> $carriers keyed by carrier slug */
    $carriers = [];
    /** @var array<string, list<array{id:string, slug:string, displayName:string, carrier:string, class:string}>> $byFamily */
    $byFamily = [];

    foreach ($json as $productClass => $rows) {
        if (! is_array($rows)) {
            continue;
        }
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $rawId = $row['id'] ?? null;
            if (! is_string($rawId) || trim($rawId) === '') {
                throw new RuntimeException(
                    "gen-catalog: product in class '{$productClass}' is missing required 'id' field. " .
                    "Entry: " . json_encode($row)
                );
            }
            $prodId      = 'prod_' . trim($rawId);
            $carrierName = (string) ($row['carrier'] ?? '');
            $displayName = (string) ($row['name'] ?? '');
            $carrierSlug = slugify($carrierName);

            if ($carrierSlug === '') {
                throw new RuntimeException(
                    "gen-catalog: product id={$prodId} has empty carrier name."
                );
            }

            $entry = [
                'id'          => $prodId,
                'slug'        => (string) ($row['identifier'] ?? ''),
                'displayName' => $displayName,
                'carrier'     => $carrierName,
                'class'       => (string) $productClass,
            ];

            $products[$prodId] = $entry;
            $byFamily[(string) $productClass][] = $entry;

            if (! isset($carriers[$carrierSlug])) {
                $carriers[$carrierSlug] = [
                    'slug'        => $carrierSlug,
                    'displayName' => $carrierName,
                    'products'    => [],
                ];
            }
            $carriers[$carrierSlug]['products'][] = $prodId;
        }
    }

    ksort($products);
    ksort($carriers);
    foreach ($byFamily as &$fam) {
        usort($fam, static fn (array $a, array $b): int => strcmp($a['displayName'], $b['displayName']));
    }
    unset($fam);

    writeData($dataDir, 'products.php', $products);
    writeData($dataDir, 'carriers.php', $carriers);

    // ── Emit src/Catalog/Product.php ─────────────────────────────────────────

    $productClassFile = $repoPhp . '/src/Catalog/Product.php';
    $productCode = <<<'PHP'
<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

use InvalidArgumentException;

/**
 * Generated catalog — do not hand-edit; rerun `php scripts/gen-catalog.php`.
 *
 * A single product in the ISA catalog.
 *
 * `id` is the opaque `prod_<uuid>` identifier — the ONLY value the v3
 * prequalify `products[]` filter accepts. `name`, `carrier`, and `class`
 * are display affordances only; they are mutable (carriers rename products)
 * and must never be used as identity or sent on the wire.
 *
 * Obtain instances via {@see Products}:
 *
 *     Products::fex()->aetnaAccendo()
 *     Products::byId('prod_d7b57156-3e83-506b-8936-0692c1193dc7')
 */
final readonly class Product
{
    public function __construct(
        /** Opaque product id (`prod_<uuid>`). The only stable identity and wire value. */
        public string $id,
        /** Display name (e.g. `"Aetna Accendo"`). Mutable — never store as identity. */
        public string $name,
        /** Product class (`"fex"`, `"term"`, `"medsup"`, `"preneed"`, …). */
        public string $class,
        /** Carrier display name (e.g. `"Aetna"`). */
        public string $carrier,
    ) {
        if ($this->id === '') {
            throw new InvalidArgumentException('Product requires a non-empty id');
        }
    }
}
PHP;
    if (file_put_contents($productClassFile, $productCode . "\n") === false) {
        throw new RuntimeException("Failed to write: {$productClassFile}");
    }

    // ── Emit src/Catalog/Products.php ────────────────────────────────────────

    // Build family inner classes
    $knownFamilies = ['fex', 'term', 'medsup', 'preneed'];
    $allFamilies = array_unique([...$knownFamilies, ...array_keys($byFamily)]);

    $familyClassCode = '';
    $familyFactoryCode = '';

    foreach ($allFamilies as $family) {
        $entries = $byFamily[$family] ?? [];
        if ($entries === []) {
            continue;
        }

        $className = ucfirst((string) $family) . 'Products';
        $factoryMethod = lcfirst(ucfirst((string) $family));

        // Build methods for each product in the family
        $usedNames = [];
        $methodCodes = '';
        foreach ($entries as $entry) {
            $method = methodName($entry['displayName']);
            // Disambiguate
            $base = $method;
            $suffix = 2;
            while (isset($usedNames[$method])) {
                $method = $base . $suffix;
                $suffix++;
            }
            $usedNames[$method] = true;

            $id          = addslashes($entry['id']);
            $displayName = addslashes($entry['displayName']);
            $carrierName = addslashes($entry['carrier']);
            $classStr    = addslashes($entry['class']);

            $methodCodes .= "    public function {$method}(): Product\n";
            $methodCodes .= "    {\n";
            $methodCodes .= "        return new Product(id: '{$id}', name: '{$displayName}', class: '{$classStr}', carrier: '{$carrierName}');\n";
            $methodCodes .= "    }\n\n";
        }

        $familyClassCode .= "/**\n";
        $familyClassCode .= " * Typed accessor for the `{$family}` product family.\n";
        $familyClassCode .= " * Obtain via {@see Products::{$factoryMethod}()}.\n";
        $familyClassCode .= " */\n";
        $familyClassCode .= "final class {$className}\n{\n";
        $familyClassCode .= rtrim($methodCodes) . "\n";
        $familyClassCode .= "    private function __construct() {}\n\n";
        $familyClassCode .= "    /** @internal */\n";
        $familyClassCode .= "    public static function instance(): self { return new self(); }\n";
        $familyClassCode .= "}\n\n";

        $familyFactoryCode .= "    /**\n";
        $familyFactoryCode .= "     * Returns the `{$family}` family accessor.\n";
        $familyFactoryCode .= "     * Usage: Products::{$factoryMethod}()->aetnaAccendo()\n";
        $familyFactoryCode .= "     */\n";
        $familyFactoryCode .= "    public static function {$factoryMethod}(): {$className}\n";
        $familyFactoryCode .= "    {\n";
        $familyFactoryCode .= "        return {$className}::instance();\n";
        $familyFactoryCode .= "    }\n\n";
    }

    // Build the Products class with byId
    $productsCode = <<<'PHP'
<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

/**
 * Generated catalog — do not hand-edit; rerun `php scripts/gen-catalog.php`.
 *
 * Rich, nested, id-carrying product catalog.
 *
 * Usage:
 *
 *     $product = Products::fex()->aetnaAccendo();
 *     $same    = Products::byId($product->id); // identical object
 *
 * `byId` is the only reverse-lookup entry point. There is no `bySlug` on
 * this public surface — slugs are mutable display metadata; ids are stable.
 */

PHP;
    // Append family inner class definitions
    $productsCode .= $familyClassCode;

    $productsCode .= "final class Products\n{\n";
    $productsCode .= $familyFactoryCode;
    $productsCode .= <<<'PHP'
    /**
     * Look up a product by its opaque id (`prod_<uuid>`).
     *
     * Returns `null` for unknown ids (including stale names — only ids work).
     *
     * Conformance: `Products::byId(Products::fex()->aetnaAccendo()->id)`
     * must return a Product equal to the constant.
     */
    public static function byId(string $id): ?Product
    {
        return self::idMap()[$id] ?? null;
    }

    /** @return array<string, Product> */
    private static function idMap(): array
    {
        /** @var array<string, Product>|null $cache */
        static $cache = null;
        if ($cache === null) {
            /** @var array<string, array{id:string, slug:string, displayName:string, carrier:string, class:string}> $data */
            $data  = require __DIR__ . '/data/products.php';
            $cache = [];
            foreach ($data as $id => $row) {
                $cache[$id] = new Product(
                    id:      $row['id'],
                    name:    $row['displayName'],
                    class:   $row['class'],
                    carrier: $row['carrier'],
                );
            }
        }
        return $cache;
    }

    private function __construct() {}
}
PHP;

    $productsClassFile = $repoPhp . '/src/Catalog/Products.php';
    if (file_put_contents($productsClassFile, $productsCode . "\n") === false) {
        throw new RuntimeException("Failed to write: {$productsClassFile}");
    }
}

// ─── Conditions / Medication uses ────────────────────────────────────────────

$conditionsPath  = $insurance . '/v2_conditions.json';
$medicationsPath = $insurance . '/v2_medications.json';
$condJson = readJson($conditionsPath);
$medJson  = readJson($medicationsPath);

if (! is_array($condJson)) {
    $gaps[] = "Conditions: {$conditionsPath} not found — emitting empty catalog.";
    writeData($dataDir, 'conditions.php', []);
} else {
    writeData($dataDir, 'conditions.php', []);
}

if (! is_array($medJson)) {
    // Same contract as Products: the committed data/medication_uses.php is the
    // published source of truth (~1865 uses) and CI does not check out the
    // engine repo, so preserve it instead of clobbering it with an empty
    // catalog. Fail loud only when there is nothing committed to preserve.
    $committedMeds = $dataDir . '/medication_uses.php';
    if (! is_file($committedMeds)) {
        fwrite(STDERR, sprintf(
            "gen-catalog: FATAL: MedicationUses: %s not found AND no committed catalog to "
            . "preserve (%s). Refusing to emit an empty catalog. Run where the data file "
            . "exists, or commit a populated catalog first.\n",
            $medicationsPath,
            $committedMeds,
        ));
        exit(1);
    }
    $gaps[] = "MedicationUses: {$medicationsPath} not found — preserving committed catalog.";
    fwrite(STDERR, "gen-catalog: preserved committed {$committedMeds}\n");
} else {
    $uses = [];
    foreach ($medJson as $entry) {
        if (! is_array($entry)) {
            continue;
        }
        $name = $entry['name'] ?? null;
        if (! is_string($name) || $name === '') {
            continue;
        }
        $entryUses = $entry['uses'] ?? [];
        if (! is_array($entryUses)) {
            continue;
        }
        foreach ($entryUses as $u) {
            $cond = null;
            if (is_string($u)) {
                $cond = $u;
            } elseif (is_array($u) && isset($u['condition']) && is_string($u['condition'])) {
                $cond = $u['condition'];
            }
            if ($cond === null || $cond === '') {
                continue;
            }
            if (! isset($uses[$cond])) {
                $uses[$cond] = ['displayName' => $cond, 'medications' => []];
            }
            $uses[$cond]['medications'][] = $name;
        }
    }
    foreach ($uses as $k => $row) {
        $meds = array_values(array_unique($row['medications']));
        sort($meds);
        $uses[$k]['medications'] = $meds;
    }
    ksort($uses);
    writeData($dataDir, 'medication_uses.php', $uses);
}

// ─── Report ──────────────────────────────────────────────────────────────────

if ($gaps !== []) {
    foreach ($gaps as $g) {
        fwrite(STDERR, "gen-catalog: {$g}\n");
    }
}

$count = count(glob($dataDir . '/*.php') ?: []);
fwrite(STDOUT, "gen-catalog: wrote {$count} data files\n");
