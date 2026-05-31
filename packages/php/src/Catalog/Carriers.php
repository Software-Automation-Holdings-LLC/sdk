<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

use InvalidArgumentException;

/**
 * Catalog API for carriers. Carrier slugs are stable; display names
 * follow the engine's product catalog.
 *
 * Mirrors the TS SDK's `ProductCarriers` facade. `states` is not
 * surfaced today — per-carrier licensure is not currently exposed in
 * the public reference data.
 */
final class Carriers
{
    /** @return list<string> */
    public static function values(): array
    {
        return array_keys(self::dataMap());
    }

    public static function metadata(string $slug): CarrierMetadata
    {
        $row = self::dataMap()[$slug] ?? null;
        if ($row === null) {
            throw new InvalidArgumentException("Carriers::metadata: unknown carrier '{$slug}'");
        }
        return new CarrierMetadata(
            slug: $row['slug'],
            displayName: $row['displayName'],
            products: $row['products'],
        );
    }

    /**
     * @return array<string,array{slug:string,displayName:string,products:list<string>}>
     */
    private static function dataMap(): array
    {
        /** @var array<string,array{slug:string,displayName:string,products:list<string>}>|null $cache */
        static $cache = null;
        if ($cache === null) {
            /** @var array<string,array{slug:string,displayName:string,products:list<string>}> $loaded */
            $loaded = require __DIR__ . '/data/carriers.php';
            $cache = $loaded;
        }
        return $cache;
    }
}
