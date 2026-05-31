<?php

declare(strict_types=1);

/**
 * Catalog code generator (PHP edition).
 *
 * Reads source data files from the zyins engine (`v2_products.json`)
 * and the platform schemas, emits PHP catalog data files under
 * `src/Catalog/data/`. Pairs with the per-resource catalog classes in
 * `src/Catalog/` which load the emitted data lazily.
 *
 * Idempotent: same input bytes produce byte-identical output.
 *
 * Run via `php scripts/gen-catalog.php` (executed automatically before
 * `composer build`, when wired into the project Makefile).
 *
 * Sources are discovered relative to the monorepo layout; missing
 * sources cause the matching catalog data file to be emitted as
 * empty arrays and the gap is reported on stderr.
 */

$repoPhp = dirname(__DIR__);
$repoPlatform = $_SERVER['SDK_PLATFORM_REPO']
    ?? realpath($repoPhp . '/../..')
    ?: dirname($repoPhp, 2);
$insurance = $_SERVER['SDK_INSURANCE_REPO']
    ?? realpath($repoPlatform . '/../insurance')
    ?: $repoPlatform . '/../insurance';

$dataDir = $repoPhp . '/src/Catalog/data';
if (! is_dir($dataDir)) {
    if (! mkdir($dataDir, 0o755, recursive: true) && ! is_dir($dataDir)) {
        throw new RuntimeException("Failed to create catalog data directory: $dataDir");
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

function slug(string $s): string
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
        throw new RuntimeException("Failed to write catalog file: $target");
    }
}

// Products + Carriers
$productsPath = $insurance . '/v2_products.json';
$json = readJson($productsPath);
if (! is_array($json)) {
    $gaps[] = "Products: $productsPath not found — emitting empty catalog.";
    writeData($dataDir, 'products.php', []);
    writeData($dataDir, 'carriers.php', []);
} else {
    $products = [];
    $carriers = [];
    foreach ($json as $productClass => $rows) {
        if (! is_array($rows)) {
            continue;
        }
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $id = (string) ($row['identifier'] ?? '');
            $carrierName = (string) ($row['carrier'] ?? '');
            $displayName = (string) ($row['name'] ?? '');
            if ($id === '') {
                continue;
            }
            $carrierSlug = slug($carrierName);
            if ($carrierSlug === '') {
                $gaps[] = "Products: identifier $id has empty carrier; skipping row.";
                continue;
            }
            /** @var list<string> $stateVariations */
            $stateVariations = [];
            if (isset($row['state_variations']) && is_array($row['state_variations'])) {
                foreach ($row['state_variations'] as $sv) {
                    if (is_string($sv)) {
                        $stateVariations[] = $sv;
                    }
                }
            }
            $products[$id] = [
                'slug' => $id,
                'displayName' => $displayName,
                'carrier' => $carrierSlug,
                'productClass' => (string) $productClass,
                'stateVariations' => $stateVariations,
            ];
            if (! isset($carriers[$carrierSlug])) {
                $carriers[$carrierSlug] = [
                    'slug' => $carrierSlug,
                    'displayName' => $carrierName,
                    'products' => [],
                ];
            }
            $carriers[$carrierSlug]['products'][] = $id;
        }
    }
    ksort($products);
    ksort($carriers);
    writeData($dataDir, 'products.php', $products);
    writeData($dataDir, 'carriers.php', $carriers);

    // Emit src/Catalog/Product.php with stable constants
    $constants = [];
    foreach (array_keys($products) as $slug) {
        // identifier = SLUG_UPPER (replace non-alnum with _)
        // Pattern: `fex-aetna-accendo` -> `AETNA_ACCENDO_FEX`
        // strip class prefix (fex-, term-, medsup-, preneed-) and append as suffix.
        $klass = $products[$slug]['productClass'];
        $bare = str_starts_with($slug, $klass . '-') ? substr($slug, strlen($klass) + 1) : $slug;
        $ident = strtoupper((string) preg_replace('/[^A-Za-z0-9]+/', '_', $bare))
            . '_' . strtoupper((string) preg_replace('/[^A-Za-z0-9]+/', '_', $klass));
        $ident = trim($ident, '_');
        // disambiguate collisions
        $base = $ident;
        $i = 1;
        while (isset($constants[$ident])) {
            $i++;
            $ident = $base . '_' . $i;
        }
        $constants[$ident] = $slug;
    }
    $constantsCode = "<?php\n\ndeclare(strict_types=1);\n\nnamespace Isa\\Sdk\\Catalog;\n\n";
    $constantsCode .= "/**\n * Generated catalog — DO NOT hand-edit. Stable wire-form product slugs.\n *\n";
    $constantsCode .= " * Look up metadata via {@see Products::metadata()}; iterate every slug\n";
    $constantsCode .= " * via {@see Products::values()}.\n */\n";
    $constantsCode .= "final class Product\n{\n";
    foreach ($constants as $name => $slug) {
        $constantsCode .= "    public const " . $name . " = '" . addslashes($slug) . "';\n";
    }
    $constantsCode .= "\n    private function __construct() {}\n}\n";
    $productClassFile = $repoPhp . '/src/Catalog/Product.php';
    if (file_put_contents($productClassFile, $constantsCode) === false) {
        throw new RuntimeException("Failed to write catalog class: $productClassFile");
    }
}

// Conditions / Medication uses — read v2_conditions.json + v2_medications.json
$conditionsPath = $insurance . '/v2_conditions.json';
$medicationsPath = $insurance . '/v2_medications.json';
$condJson = readJson($conditionsPath);
$medJson = readJson($medicationsPath);

if (! is_array($condJson)) {
    $gaps[] = "Conditions: $conditionsPath not found — emitting empty catalog.";
    writeData($dataDir, 'conditions.php', []);
} else {
    // The source structure is engine-specific; emit empty until the
    // upstream publishes a stable category taxonomy. Shape kept fixed
    // so consumers can code against it today.
    writeData($dataDir, 'conditions.php', []);
}

if (! is_array($medJson)) {
    $gaps[] = "MedicationUses: $medicationsPath not found — emitting empty catalog.";
    writeData($dataDir, 'medication_uses.php', []);
} else {
    // Derive { use -> [medications...] }. Shape is forward-compatible
    // with the TS catalog's MedicationUses output.
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

if ($gaps !== []) {
    foreach ($gaps as $g) {
        fwrite(STDERR, "gen-catalog: $g\n");
    }
}

fwrite(STDOUT, "gen-catalog: wrote " . count(glob($dataDir . '/*.php') ?: []) . " data files\n");
