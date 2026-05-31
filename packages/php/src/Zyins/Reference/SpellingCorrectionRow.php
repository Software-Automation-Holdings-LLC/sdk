<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * One inline-row spelling correction from `GET /v3/datasets`.
 *
 * `from` is the typo (uppercase); `to` is the correction (uppercase) —
 * matches the {@see DefaultAutocorrector} typo map shape exactly. Build
 * the autocorrector's typo map with {@see DatasetBundleV3::typoMap()}.
 */
final readonly class SpellingCorrectionRow
{
    public function __construct(
        public string $id,
        public string $from,
        public string $to,
    ) {
    }
}
