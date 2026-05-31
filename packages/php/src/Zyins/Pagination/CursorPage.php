<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Pagination;

/**
 * One page of a paginated list endpoint as returned over the wire.
 *
 * Servers return `{"data": [...], "next_cursor": string|null, "has_more": bool}`
 * per SDK_DESIGN.md §9.4.
 *
 * @template T
 */
final readonly class CursorPage
{
    /**
     * @param array<int, T> $data       Items on this page.
     * @param string|null   $nextCursor Opaque cursor for the next page, or null on the last page.
     * @param bool          $hasMore    Whether more pages remain. False when nextCursor is null.
     */
    public function __construct(
        public array $data,
        public ?string $nextCursor,
        public bool $hasMore,
    ) {
    }
}
