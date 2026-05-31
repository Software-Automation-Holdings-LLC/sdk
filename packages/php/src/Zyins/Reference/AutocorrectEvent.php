<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Payload delivered to {@see DefaultAutocorrector}'s `onApplied`
 * callback when a correction is applied. Lets consumers log, count, or
 * surface "we autocorrected for you" UI without inferring from the
 * before/after string diff.
 */
final readonly class AutocorrectEvent
{
    /**
     * @param string $from Uppercase n-gram that triggered the correction.
     * @param string $to   Uppercase correction substituted in place of `from`.
     * @param AutocorrectorInterface::MODE_* $mode
     */
    public function __construct(
        public string $from,
        public string $to,
        public string $mode,
    ) {
    }
}
