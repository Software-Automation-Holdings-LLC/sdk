<?php

declare(strict_types=1);

namespace Sah\Sdk\Catalog;

use InvalidArgumentException;

/**
 * Catalog API for {@see Product}. Provides `values()`, `metadata()`,
 * `byCarrier()`, and `search()` lookups in parity with the TS SDK's
 * `Products` facade.
 *
 * Data is loaded once per process from the generator-emitted
 * `data/products.php` file. Unused slugs are not retained by the
 * autoloader — the data file is read on first access.
 */
final class Products
{
    /** @return list<string> */
    public static function values(): array
    {
        return array_keys(self::dataMap());
    }

    public static function metadata(string $slug): ProductMetadata
    {
        $row = self::dataMap()[$slug] ?? null;
        if ($row === null) {
            throw new InvalidArgumentException("Products::metadata: unknown product '{$slug}'");
        }
        return self::rowToMetadata($row);
    }

    /**
     * Products filed by a given carrier slug. Case-insensitive match
     * against the carrier slug; pass either the slug (`mutual-of-omaha`)
     * or the display name (`Mutual of Omaha`) — both resolve.
     *
     * @return list<string>
     */
    public static function byCarrier(string $carrier): array
    {
        $target = strtolower(trim($carrier));
        $target = (string) preg_replace('/[^a-z0-9]+/', '-', $target);
        $target = trim($target, '-');
        $out = [];
        foreach (self::dataMap() as $slug => $row) {
            if ($row['carrier'] === $target) {
                $out[] = $slug;
            }
        }
        return $out;
    }

    /**
     * Substring search across slug + display name. Returns matches
     * sorted by relevance (prefix matches first, then substring).
     *
     * @return list<string>
     */
    public static function search(string $query): array
    {
        $q = strtolower(trim($query));
        if ($q === '') {
            return [];
        }
        $prefix = [];
        $substring = [];
        foreach (self::dataMap() as $slug => $row) {
            $hay = $slug . ' ' . strtolower($row['displayName']);
            if (str_starts_with($hay, $q) || str_starts_with(strtolower($row['displayName']), $q)) {
                $prefix[] = $slug;
            } elseif (str_contains($hay, $q)) {
                $substring[] = $slug;
            }
        }
        return [...$prefix, ...$substring];
    }

    /**
     * @return array<string,array{slug:string,displayName:string,carrier:string,productClass:string,stateVariations:list<string>}>
     */
    private static function dataMap(): array
    {
        /** @var array<string,array{slug:string,displayName:string,carrier:string,productClass:string,stateVariations:list<string>}>|null $cache */
        static $cache = null;
        if ($cache === null) {
            /** @var array<string,array{slug:string,displayName:string,carrier:string,productClass:string,stateVariations:list<string>}> $loaded */
            $loaded = require __DIR__ . '/data/products.php';
            $cache = $loaded;
        }
        return $cache;
    }

    /**
     * @param array{slug:string,displayName:string,carrier:string,productClass:string,stateVariations:list<string>} $row
     */
    private static function rowToMetadata(array $row): ProductMetadata
    {
        return new ProductMetadata(
            slug: $row['slug'],
            displayName: $row['displayName'],
            carrier: $row['carrier'],
            productClass: $row['productClass'],
            stateVariations: $row['stateVariations'],
        );
    }
}
