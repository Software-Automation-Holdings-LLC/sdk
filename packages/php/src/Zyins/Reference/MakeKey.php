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
    /**
     * Normalize free text into the canonical catalog key.
     *
     * @internal
     */
    public static function normalize(string $text): string
    {
        $upper = strtoupper($text);
        $out = '';
        $len = strlen($upper);
        for ($i = 0; $i < $len; $i++) {
            $ch = $upper[$i];
            $code = ord($ch);
            $isDigit = $code >= 0x30 && $code <= 0x39;
            $isUpper = $code >= 0x41 && $code <= 0x5A;
            if ($isDigit || $isUpper) {
                $out .= $ch;
            }
        }
        return $out;
    }

    private function __construct()
    {
    }
}
