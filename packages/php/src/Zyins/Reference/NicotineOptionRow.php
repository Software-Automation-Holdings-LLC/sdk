<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * One inline-row nicotine option from `GET /v3/datasets`.
 *
 * `type` is the wire string discriminator (`smoked`, `smokeless`, etc.);
 * the SDK does not enumerate it — new types ship as new string values.
 */
final readonly class NicotineOptionRow
{
    public function __construct(
        public string $id,
        public string $name,
        public string $type,
    ) {
    }
}
