<?php

declare(strict_types=1);

namespace Sah\Sdk\Catalog;

use InvalidArgumentException;

/**
 * Catalog API for condition categories. Mirrors the TS SDK's
 * `ConditionCategories` facade.
 *
 * Categories partition the canonical condition list into clinically
 * related groups. The engine's reference data does not currently
 * expose a stable category taxonomy; this catalog is intentionally
 * empty until the upstream publishes one. The shape is fixed so
 * consumers can code against it today.
 */
final class Conditions
{
    /** @return list<string> */
    public static function values(): array
    {
        return array_keys(self::dataMap());
    }

    /**
     * @return array{displayName:string,conditions:list<string>}
     */
    public static function metadata(string $category): array
    {
        $row = self::dataMap()[$category] ?? null;
        if ($row === null) {
            throw new InvalidArgumentException("Conditions::metadata: unknown category '{$category}'");
        }
        return $row;
    }

    /**
     * @return array<string,array{displayName:string,conditions:list<string>}>
     */
    private static function dataMap(): array
    {
        /** @var array<string,array{displayName:string,conditions:list<string>}>|null $cache */
        static $cache = null;
        if ($cache === null) {
            /** @var array<string,array{displayName:string,conditions:list<string>}> $loaded */
            $loaded = require __DIR__ . '/data/conditions.php';
            $cache = $loaded;
        }
        return $cache;
    }
}
