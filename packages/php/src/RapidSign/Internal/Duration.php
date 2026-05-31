<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Internal;

use Isa\Sdk\RapidSign\Exception\ValidationException;

/**
 * Duration parsing. Three accepted input shapes (mirrors the JS SDK):
 *
 *   1. int — milliseconds, taken as-is.
 *   2. ISO-8601 duration — `P30D`, `PT24H`, `PT5M`, `PT15S`, `P1DT12H`.
 *   3. Shorthand — `500ms`, `30s`, `5m`, `2h`, `7d`.
 *
 * Returns milliseconds. Throws {@see ValidationException} on malformed
 * input so callers handle SDK validation failures consistently with
 * server-side validation errors.
 */
final class Duration
{
    public const SECOND_MS = 1_000;
    public const MINUTE_MS = 60 * self::SECOND_MS;
    public const HOUR_MS = 60 * self::MINUTE_MS;
    public const DAY_MS = 24 * self::HOUR_MS;
    public const MAX_MS = 7 * self::DAY_MS;

    private const SHORTHAND_RE = '/^(\d+)(ms|s|m|h|d)$/i';
    private const ISO8601_RE = '/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/';

    public static function parse(string|int $spec): int
    {
        if (is_int($spec)) {
            if ($spec < 0) {
                throw self::invalid('parseDuration: invalid millisecond value: ' . $spec);
            }
            return $spec;
        }
        $trimmed = trim($spec);
        if ($trimmed === '') {
            throw self::invalid('parseDuration: empty duration string');
        }
        if (preg_match(self::SHORTHAND_RE, $trimmed, $m) === 1) {
            return (int) $m[1] * self::unitMs(strtolower($m[2]));
        }
        if (stripos($trimmed, 'P') === 0) {
            $normalized = strtoupper($trimmed);
            if (preg_match(self::ISO8601_RE, $normalized, $iso) === 1 && self::isValidIsoMatch($normalized, $iso)) {
                return self::isoTotalMs($iso);
            }
        }
        throw self::invalid('parseDuration: unrecognized duration: ' . $spec);
    }

    public static function isIso8601(string $spec): bool
    {
        $normalized = strtoupper(trim($spec));
        return preg_match(self::ISO8601_RE, $normalized, $m) === 1
            && self::isValidIsoMatch($normalized, $m);
    }

    private static function unitMs(string $unit): int
    {
        return match ($unit) {
            'ms' => 1,
            's' => self::SECOND_MS,
            'm' => self::MINUTE_MS,
            'h' => self::HOUR_MS,
            'd' => self::DAY_MS,
            default => throw self::invalid('parseDuration: unknown unit: ' . $unit),
        };
    }

    /**
     * @param array<int,string> $m
     */
    private static function isoTotalMs(array $m): int
    {
        $d = (int) ($m[1] ?? '0');
        $h = (int) ($m[2] ?? '0');
        $mi = (int) ($m[3] ?? '0');
        $s = (int) ($m[4] ?? '0');
        return $d * self::DAY_MS + $h * self::HOUR_MS + $mi * self::MINUTE_MS + $s * self::SECOND_MS;
    }

    /**
     * @param array<int,string> $m
     */
    private static function isValidIsoMatch(string $normalized, array $m): bool
    {
        $hasTime = self::capturePresent($m, 2) || self::capturePresent($m, 3) || self::capturePresent($m, 4);
        if (str_contains($normalized, 'T') && ! $hasTime) {
            return false;
        }
        $total = self::isoTotalMs($m);
        return $total > 0 || $normalized === 'PT0S' || $normalized === 'P0D';
    }

    /**
     * @param array<int,string> $m
     */
    private static function capturePresent(array $m, int $index): bool
    {
        return array_key_exists($index, $m) && $m[$index] !== '';
    }

    private static function invalid(string $message): ValidationException
    {
        return new ValidationException(message: $message);
    }
}
