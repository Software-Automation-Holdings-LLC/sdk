<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Internal sorted check-key normalizer for the v3 reference namespace.
 *
 * @internal Consumers never call this directly. The reference matchers
 * are the only callers. The shared `reference_vectors.json` conformance
 * corpus pins the algorithm across TS / Go / Python / C# / PHP.
 *
 * Mirrors the engine's `CondNameMakeCheckKey`
 * (`go/zyins/utils/strings/normalize.go`, Perl
 * `cond_name_make_check_key_xs`): uppercase, strip every character that
 * is not ASCII alphanumeric, then SORT the surviving bytes ascending.
 * Digits (0x30-0x39) sort before letters (0x41-0x5A), byte-identical to
 * the engine.
 *
 * Sorting collapses word order so prefix / suffix / no-space severity
 * variants of one concept resolve identically, while severity qualifiers
 * stay distinct (MILD vs SEVERE differ in letter multiset):
 *   "SEVERE COPD"   → "CDEEEOPRSV"
 *   "COPD (SEVERE)" → "CDEEEOPRSV"
 *   "COPD (MILD)"   → "CDDILMOP"
 *
 * Used ONLY for word-order-invariant NAME matching. Opaque catalog ids
 * (e.g. HIGHBLOODPRESSURE, cond_<ULID>) are never keyed this way —
 * sorting an id would let unrelated ids collide. Id and exact-name
 * lookups stay on {@see MakeKey}.
 */
final class CheckKey
{
    /**
     * Normalize free text into the engine's sorted condition check-key.
     *
     * A key holds at most 36 distinct bytes, so tallying them and
     * replaying the tally in byte order sorts it in constant extra
     * memory, where sorting the bytes themselves needs a slot per byte.
     *
     * @internal
     */
    public static function normalize(string $text): string
    {
        /** @var array<int,int> $tally byte → occurrences, ascending by byte */
        $tally = count_chars(MakeKey::normalize($text), 1);
        $sorted = '';
        foreach ($tally as $byte => $count) {
            $sorted .= str_repeat(chr($byte), $count);
        }
        return $sorted;
    }

    private function __construct()
    {
    }
}
