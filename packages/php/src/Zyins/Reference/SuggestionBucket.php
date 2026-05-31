<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Stable string discriminator for {@see Suggestion::$bucket}.
 *
 * Priority order (highest → lowest):
 *  1. {@see self::STARTS_WITH}
 *  2. {@see self::SAME_WORDS}
 *  3. {@see self::INDEPENDENT_WORD_INTERSECTION}
 *  4. {@see self::WORD_COUNT_NO_TOLERANCE}
 *  5. {@see self::SAME_NUM_WITH_TOLERANCE}
 *  6. {@see self::WORD_COUNT_WITH_TOLERANCE}
 *
 * Mirrors the bucket labels in the bpp2.0 reference algorithm and the
 * sibling SDKs (TS / Python / Go / C#). The closed list is stable; new
 * buckets ship as new constants.
 */
final class SuggestionBucket
{
    public const STARTS_WITH = 'starts_with';
    public const SAME_WORDS = 'same_words';
    public const INDEPENDENT_WORD_INTERSECTION = 'independent_word_intersection';
    public const WORD_COUNT_NO_TOLERANCE = 'word_count_no_tolerance';
    public const SAME_NUM_WITH_TOLERANCE = 'same_num_with_tolerance';
    public const WORD_COUNT_WITH_TOLERANCE = 'word_count_with_tolerance';

    private function __construct()
    {
    }
}
