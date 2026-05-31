<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Pagination;

/**
 * Common options accepted by every `*.list(...)` call.
 *
 * Per SDK_DESIGN.md §9: cursors are opaque, page size defaults to 50
 * (DEFAULT_PAGE_SIZE) and is capped at 100 server-side.
 */
final readonly class ListOptions
{
    /** Default page size when caller does not specify one. Matches §9.4. */
    public const DEFAULT_PAGE_SIZE = 50;

    /**
     * @param string|null $cursor Resume cursor; null fetches the first page.
     * @param int|null    $limit  Per-page rows; null requests the server default.
     */
    public function __construct(
        public ?string $cursor = null,
        public ?int $limit = null,
    ) {
    }
}
