<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Pagination;

/**
 * First-page-only fetcher. For UI consumers that render their own paginator
 * (Next / Previous buttons) instead of streaming.
 *
 * @example
 * $page = FirstPage::fetch($fetcher, new ListOptions());
 * foreach ($page->data as $row) { ... }
 * // $page->nextCursor is null on the last page.
 */
final class FirstPage
{
    /**
     * @template T
     *
     * @param callable(?string, ?int): CursorPage<T> $fetcher
     *
     * @return CursorPage<T>
     */
    public static function fetch(callable $fetcher, ?ListOptions $options = null): CursorPage
    {
        $options ??= new ListOptions();
        return $fetcher($options->cursor, $options->limit);
    }
}
