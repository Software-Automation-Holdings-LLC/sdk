<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Documents;

/** One PDF source the server fetches and merges into the packet. */
final readonly class PdfSource
{
    public function __construct(
        public string $url,
        public ?string $expectedHash = null,
    ) {
    }
}
