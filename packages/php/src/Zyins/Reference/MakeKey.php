<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Internal `make_key` normalizer for the v3 reference namespace.
 *
 * @internal Consumers never call this directly. The reference matchers
 * are the only callers; the SDK never asks consumers to normalize text
 * themselves. The shared `reference_vectors.json` conformance corpus
 * pins the algorithm across TS / Go / Python / C# / PHP.
 *
 * Algorithm: uppercase the input, then strip every character that is
 * not ASCII alphanumeric. "High Blood Pressure" → "HIGHBLOODPRESSURE".
 */
final class MakeKey
{
    private const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    /**
     * Normalize free text into the canonical catalog key.
     *
     * @internal
     */
    public static function normalize(string $text): string
    {
        return self::collect($text, strlen($text));
    }

    /**
     * The key of `$text`, or null when it is longer than `$maxLength`.
     *
     * Allocates at most `$maxLength + 1` bytes however long `$text` is,
     * so a matcher bounded by its longest catalog key spends no more on
     * text that cannot match than on text that can.
     *
     * @internal
     */
    public static function within(string $text, int $maxLength): ?string
    {
        $key = self::collect($text, $maxLength + 1);
        return strlen($key) > $maxLength ? null : $key;
    }

    /** The first `$limit` alphanumerics of `$text`, uppercased. */
    private static function collect(string $text, int $limit): string
    {
        $key = '';
        $length = strlen($text);
        $offset = strcspn($text, self::ALPHANUMERIC);
        while ($offset < $length && strlen($key) < $limit) {
            $run = strspn($text, self::ALPHANUMERIC, $offset, $limit - strlen($key));
            $key .= substr($text, $offset, $run);
            $offset += $run;
            $offset += strcspn($text, self::ALPHANUMERIC, $offset);
        }
        return strtoupper($key);
    }

    private function __construct()
    {
    }
}
