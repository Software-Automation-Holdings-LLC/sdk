<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

use InvalidArgumentException;

/**
 * Catalog API for medication uses (indications). Mirrors the TS
 * SDK's `MedicationUses` facade.
 *
 * Catalog size is large (~3000 uses; ~6000 medications). The data file
 * is loaded lazily on first access. Static state caches the require()
 * result so subsequent calls within a process are zero-cost.
 */
final class MedicationUses
{
    /** @return list<string> */
    public static function values(): array
    {
        return array_keys(self::dataMap());
    }

    public static function metadata(string $use): MedicationUseMetadata
    {
        $row = self::dataMap()[$use] ?? null;
        if ($row === null) {
            throw new InvalidArgumentException("MedicationUses::metadata: unknown use '{$use}'");
        }
        return new MedicationUseMetadata(
            displayName: $row['displayName'],
            medications: $row['medications'],
        );
    }

    /**
     * @return array<string,array{displayName:string,medications:list<string>}>
     */
    private static function dataMap(): array
    {
        /** @var array<string,array{displayName:string,medications:list<string>}>|null $cache */
        static $cache = null;
        if ($cache === null) {
            /** @var array<string,array{displayName:string,medications:list<string>}> $loaded */
            $loaded = require __DIR__ . '/data/medication_uses.php';
            $cache = $loaded;
        }
        return $cache;
    }
}
