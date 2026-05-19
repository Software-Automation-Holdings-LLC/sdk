<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Documents;

/** One PDF source the server fetches and merges into the packet. */
final readonly class PdfSource
{
    public function __construct(
        public string $url,
        public ?string $expectedHash = null,
    ) {
    }
}
