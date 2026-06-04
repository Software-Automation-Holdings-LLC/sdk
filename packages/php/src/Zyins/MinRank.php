<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

/**
 * Minimum guaranteed-issue rank accepted by the server's `min_rank` filter on
 * prequalify and quote.
 *
 * The canonical values are {@see MinRank::IMMEDIATE}, {@see MinRank::GRADED},
 * {@see MinRank::ROP}, and {@see MinRank::GUARANTEED}; `RETURN_OF_PREMIUM`,
 * `GUARANTEED_ISSUE`, and `GI` are synonyms sharing the canonical lowercase wire
 * token.
 *
 * This is a `final class` of `public const`, not a backed enum: PHP
 * backed enums forbid duplicate backing values, and the synonyms (`rop`,
 * `guaranteed`) repeat their canonical token — a backed enum would be a fatal
 * error. The server compares case-insensitively and also tolerates numeric
 * strings, so option fields stay `?string`; these constants are for ergonomics,
 * not a hard gate.
 */
final class MinRank
{
    /** Immediate (full) benefit rank. */
    public const IMMEDIATE = 'immediate';

    /** Graded-benefit rank. */
    public const GRADED = 'graded';

    /** Return-of-premium rank. Canonical; see {@see MinRank::RETURN_OF_PREMIUM}. */
    public const ROP = 'rop';

    /** Synonym for {@see MinRank::ROP}. */
    public const RETURN_OF_PREMIUM = 'rop';

    /** Guaranteed-issue rank. Canonical; see {@see MinRank::GUARANTEED_ISSUE} and {@see MinRank::GI}. */
    public const GUARANTEED = 'guaranteed';

    /** Synonym for {@see MinRank::GUARANTEED}. */
    public const GUARANTEED_ISSUE = 'guaranteed';

    /** Synonym for {@see MinRank::GUARANTEED}. */
    public const GI = 'guaranteed';

    private function __construct()
    {
    }
}
