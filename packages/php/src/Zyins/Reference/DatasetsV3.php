<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use Isa\Sdk\Zyins\Exception\IsaException;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;

/**
 * `GET /v3/datasets` — typed, self-contained reference catalog.
 *
 * The v3 datasets endpoint ships every row as a complete record. A
 * condition row carries its treating medications inline
 * (`treated_with[]`); a medication row carries the conditions it's used
 * for inline (`used_for[]`); every relation carries its own
 * `prescription_count`. No response-root joins, no client-side
 * derivation — the row IS the contract.
 *
 * Honors `If-None-Match` for cheap conditional revalidation. A `304`
 * surfaces as {@see DatasetsV3NotModified}; consumers discriminate with
 * `DatasetsV3NotModified::is($result)`.
 *
 * @example
 *  $bundle = $isa->zyins->datasetsV3->get();
 *  foreach ($bundle->conditions as $row) {
 *      foreach ($row->treatedWith as $rel) {
 *          printf("%s is treated with %s (%d prescriptions)\n",
 *              $row->name, $rel->name, $rel->prescriptionCount);
 *      }
 *  }
 */
final readonly class DatasetsV3
{
    private const PATH = '/v3/datasets';

    /**
     * 2^63 — the smallest float strictly greater than PHP_INT_MAX (which is
     * not representable as a float and rounds up to this value). Used as a
     * strict upper bound when coercing an integer-valued float epoch to int,
     * so a value at-or-above it is rejected rather than wrapping on the cast.
     */
    private const INT64_CEILING_AS_FLOAT = 9223372036854775808.0;

    public function __construct(
        private Transport $transport,
        private ?ReferenceBundleCache $cache = null,
    ) {
    }

    /**
     * Fetch the v3 reference catalog. Returns either a {@see DatasetBundleV3}
     * on a fresh response (`200`) or {@see DatasetsV3NotModified} when the
     * server confirms the caller's cached etag still matches (`304`).
     *
     * @throws IsaException on non-`200`/`304` responses.
     */
    public function get(
        ?DatasetsV3GetOptions $options = null,
        ?RequestOptions $requestOptions = null,
    ): DatasetBundleV3|DatasetsV3NotModified {
        $opts = $options ?? DatasetsV3GetOptions::default();
        $extra = [];
        if ($opts->ifNoneMatch !== null && $opts->ifNoneMatch !== '') {
            $extra['If-None-Match'] = $opts->ifNoneMatch;
        }
        $reqOpts = ($requestOptions ?? RequestOptions::default())->withExtraHeaders($extra);

        $path = self::PATH . self::buildQuery($opts);
        $raw = $this->transport->sendRaw('GET', $path, null, $reqOpts);

        if ($raw->status === 304) {
            return new DatasetsV3NotModified(etag: $raw->header('ETag'));
        }
        if ($raw->status < 200 || $raw->status >= 300) {
            throw Transport::exceptionFromRaw($raw);
        }
        $bundle = self::parseEnvelope($raw->body, $raw->header('ETag'));
        $this->cache?->setBundle($bundle);
        return $bundle;
    }

    private static function buildQuery(DatasetsV3GetOptions $opts): string
    {
        $parts = [];
        if ($opts->include !== null) {
            $parts[] = 'include=' . implode(',', array_map(
                static fn (DatasetCategory $c): string => $c->value,
                $opts->include,
            ));
        }
        if ($opts->fields !== null) {
            $parts[] = 'fields=' . $opts->fields;
        }
        return $parts === [] ? '' : '?' . implode('&', $parts);
    }

    private static function parseEnvelope(string $body, ?string $etag): DatasetBundleV3
    {
        if ($body === '') {
            return self::emptyBundle($etag);
        }
        try {
            $decoded = json_decode($body, associative: true, flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new IsaException(
                message: 'datasetsV3: response body is not valid JSON: ' . $e->getMessage(),
                errorCode: 'invalid_response',
                previous: $e,
            );
        }
        if (! is_array($decoded)) {
            throw new IsaException(
                message: 'datasetsV3: response body is not a JSON object',
                errorCode: 'invalid_response',
            );
        }
        $data = is_array($decoded['data'] ?? null) ? $decoded['data'] : [];
        /** @var array<string,mixed> $data */
        return self::parseData($data, $etag);
    }

    /**
     * @param array<string,mixed> $data
     */
    private static function parseData(array $data, ?string $etag): DatasetBundleV3
    {
        $datasetsField = is_array($data['datasets'] ?? null) ? $data['datasets'] : [];
        /** @var array<string,mixed> $datasetsField */

        $datasets = [];
        $conditions = [];
        $medications = [];
        $products = [];
        $nicotineOptions = [];
        $spellingCorrections = [];

        foreach (DatasetCategory::cases() as $category) {
            $rawEntry = is_array($datasetsField[$category->value] ?? null)
                ? $datasetsField[$category->value]
                : null;
            /** @var array<string,mixed>|null $rawEntry */
            $entryItems = self::parseItemsForCategory($category, $rawEntry);
            $version = is_string($rawEntry['version'] ?? null) ? (string) $rawEntry['version'] : '';
            $itemCount = is_int($rawEntry['item_count'] ?? null)
                ? (int) $rawEntry['item_count']
                : count($entryItems);
            $datasets[$category->value] = new DatasetEntry(
                version: $version,
                itemCount: $itemCount,
                items: $entryItems,
            );
            switch ($category) {
                case DatasetCategory::Conditions:
                    /** @var list<ConditionRow> $entryItems */
                    $conditions = $entryItems;
                    break;
                case DatasetCategory::Medications:
                    /** @var list<MedicationRow> $entryItems */
                    $medications = $entryItems;
                    break;
                case DatasetCategory::Products:
                    /** @var list<ReferenceEntity> $entryItems */
                    $products = $entryItems;
                    break;
                case DatasetCategory::NicotineOptions:
                    /** @var list<NicotineOptionRow> $entryItems */
                    $nicotineOptions = $entryItems;
                    break;
                case DatasetCategory::SpellingCorrections:
                    /** @var list<SpellingCorrectionRow> $entryItems */
                    $spellingCorrections = $entryItems;
                    break;
            }
        }

        $catalogVersion = is_string($data['catalog_version'] ?? null)
            ? (string) $data['catalog_version']
            : (is_string($data['version'] ?? null) ? (string) $data['version'] : '');

        return new DatasetBundleV3(
            version: $catalogVersion,
            medications: $medications,
            conditions: $conditions,
            products: $products,
            nicotineOptions: $nicotineOptions,
            spellingCorrections: $spellingCorrections,
            datasets: $datasets,
            etag: $etag,
            productsByFamily: self::parseProductsByFamily($data['products_by_family'] ?? null),
            discontinuedProducts: self::parseDiscontinuedProducts($data['discontinued_products'] ?? null),
            stateDerivatives: self::parseStateDerivatives($data['state_derivatives'] ?? null),
        );
    }

    /**
     * @return array<string,list<ReferenceEntity>>
     */
    private static function parseProductsByFamily(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $family => $value) {
            // The family value must be a JSON array. json_decode(assoc:true)
            // turns BOTH a JSON array and a JSON object into a PHP array, so
            // is_array alone would accept a JSON object like {"id":"x"} and
            // emit a phantom empty-list key for it — the Go/TS/Python/C#
            // parsers skip a non-array family entirely. array_is_list() keeps
            // only sequential (JSON-array) values, so a JSON-object family is
            // skipped here too.
            if (! is_string($family) || ! is_array($value) || ! array_is_list($value)) {
                continue;
            }
            $entities = [];
            foreach ($value as $it) {
                if (! is_array($it)) {
                    continue;
                }
                $id = $it['id'] ?? null;
                // A row is valid iff it carries a non-empty `id` — the opaque
                // contract key. `name` is display enrichment the server may
                // legitimately leave blank or absent, so a missing/non-string
                // name defaults to '' and keeps the row. Matches the
                // Go/TypeScript/Python/C# mirrors; only a row with no id is
                // dropped. (The row parser at parseRow() defaults name the same
                // way — this keeps the two PHP paths consistent.)
                if (is_string($id) && $id !== '') {
                    $name = is_string($it['name'] ?? null) ? (string) $it['name'] : '';
                    $entities[] = new ReferenceEntity(id: $id, name: $name);
                }
            }
            $out[$family] = $entities;
        }
        return $out;
    }

    /**
     * @return array<string,int>
     */
    private static function parseDiscontinuedProducts(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $slug => $value) {
            if (! is_string($slug)) {
                continue;
            }
            $epoch = self::integerEpoch($value);
            if ($epoch !== null) {
                $out[$slug] = $epoch;
            }
        }
        return $out;
    }

    /**
     * Coerce a discontinued-product value to an integer unix-epoch second.
     *
     * Accepts integer-valued numbers in any JSON notation (1700000000,
     * 1700000000.0, 1.7e9) and rejects genuine fractionals (1700000000.5),
     * booleans, strings, and null. Returns the epoch as an int, or null when
     * the value is not a valid integer epoch. Mirrors the Go/C#/TS/Python
     * epoch parsers, which all keep integer-valued floats and drop fractionals.
     *
     * Out-of-range guard: the epoch is an int64 on the wire. An integer-valued
     * float outside the int64 window is rejected — casting it with `(int)`
     * would yield a platform-undefined wrapped value, whereas the
     * int64-typed Go/C# parsers reject it. Rejecting here keeps all five SDKs
     * dropping the same out-of-range epoch. `is_int` values are already within
     * PHP's native int width (int64 on every supported 64-bit platform).
     */
    private static function integerEpoch(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }
        // Upper bound is a strict `<`: (float) PHP_INT_MAX rounds up to 2^63, so
        // a value at-or-above that threshold would wrap on the (int) cast.
        // self::INT64_CEILING_AS_FLOAT == 2^63 is the smallest float strictly
        // greater than PHP_INT_MAX. Mirrors Go's float64Int64Ceiling.
        if (is_float($value) && is_finite($value) && floor($value) === $value
            && $value >= (float) PHP_INT_MIN && $value < self::INT64_CEILING_AS_FLOAT) {
            return (int) $value;
        }
        return null;
    }

    /**
     * @return list<string>
     */
    private static function parseStateDerivatives(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $it) {
            if (is_string($it)) {
                $out[] = $it;
            }
        }
        return $out;
    }

    /**
     * @param array<string,mixed>|null $rawEntry
     * @return list<ConditionRow|MedicationRow|NicotineOptionRow|SpellingCorrectionRow|ReferenceEntity>
     */
    private static function parseItemsForCategory(DatasetCategory $category, ?array $rawEntry): array
    {
        if ($rawEntry === null) {
            return [];
        }
        $itemsRaw = is_array($rawEntry['items'] ?? null) ? $rawEntry['items'] : [];
        $out = [];
        foreach ($itemsRaw as $it) {
            if (! is_array($it)) {
                continue;
            }
            /** @var array<string,mixed> $it */
            $row = self::parseRow($category, $it);
            if ($row !== null) {
                $out[] = $row;
            }
        }
        return $out;
    }

    /**
     * @param array<string,mixed> $it
     */
    private static function parseRow(
        DatasetCategory $category,
        array $it,
    ): ConditionRow|MedicationRow|NicotineOptionRow|SpellingCorrectionRow|ReferenceEntity|null {
        $id = $it['id'] ?? null;
        if (! is_string($id) || $id === '') {
            return null;
        }
        $name = is_string($it['name'] ?? null) ? (string) $it['name'] : '';
        switch ($category) {
            case DatasetCategory::Conditions:
                return new ConditionRow(
                    id: $id,
                    name: $name,
                    treatedWith: self::parseRelations($it['treated_with'] ?? null),
                );
            case DatasetCategory::Medications:
                return new MedicationRow(
                    id: $id,
                    name: $name,
                    usedFor: self::parseRelations($it['used_for'] ?? null),
                );
            case DatasetCategory::NicotineOptions:
                $type = is_string($it['type'] ?? null) ? (string) $it['type'] : '';
                return new NicotineOptionRow(id: $id, name: $name, type: $type);
            case DatasetCategory::SpellingCorrections:
                $from = is_string($it['from'] ?? null) ? (string) $it['from'] : '';
                $to = is_string($it['to'] ?? null) ? (string) $it['to'] : '';
                if ($from === '' || $to === '') {
                    return null;
                }
                return new SpellingCorrectionRow(id: $id, from: $from, to: $to);
            case DatasetCategory::Products:
                return new ReferenceEntity(id: $id, name: $name);
        }
    }

    /**
     * @return list<Relation>
     */
    private static function parseRelations(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $row) {
            if (! is_array($row)) {
                continue;
            }
            /** @var array<string,mixed> $row */
            $id = $row['id'] ?? null;
            $name = $row['name'] ?? null;
            $count = $row['prescription_count'] ?? 0;
            if (! is_string($id) || ! is_string($name)) {
                continue;
            }
            $countInt = is_int($count) ? $count : (is_numeric($count) ? (int) $count : 0);
            $out[] = new Relation(id: $id, name: $name, prescriptionCount: $countInt);
        }
        return $out;
    }

    private static function emptyBundle(?string $etag): DatasetBundleV3
    {
        return new DatasetBundleV3(
            version: '',
            medications: [],
            conditions: [],
            products: [],
            nicotineOptions: [],
            spellingCorrections: [],
            datasets: [],
            etag: $etag,
        );
    }
}
