<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Pagination;

use Generator;
use IteratorAggregate;

/**
 * Cursor-aware iterator returned by every `*.list(...)` method.
 *
 * Workers may persist `cursor()` mid-iteration and resume across process
 * restarts by passing the saved value back as `new ListOptions(cursor: ...)`.
 *
 * @template T
 * @implements IteratorAggregate<int, T>
 *
 * @example
 * $iter = $isa->zyins->cases->list(new ListOptions());
 * foreach ($iter as $case) {
 *     process($case);
 *     if (shouldStop()) {
 *         $checkpoint->save($iter->cursor());
 *         return;
 *     }
 * }
 *
 * // later, in a new process:
 * $resumed = $isa->zyins->cases->list(new ListOptions(cursor: $checkpoint->load()));
 * foreach ($resumed as $case) { ... }
 *
 * @see https://docs.isaapi.com/zyins/pagination
 */
final class CursorIterator implements IteratorAggregate
{
    /** @var callable(?string, ?int): CursorPage<T> */
    private $fetcher;

    private ?string $currentCursor;
    private ?string $nextCursor;
    private ?int $limit;

    /**
     * @param callable(?string, ?int): CursorPage<T> $fetcher Async page fetcher (cursor, limit) → page.
     */
    public function __construct(callable $fetcher, ?ListOptions $options = null)
    {
        $this->fetcher = $fetcher;
        $this->currentCursor = $options?->cursor;
        $this->nextCursor = $options?->cursor;
        $this->limit = $options?->limit;
    }

    /**
     * Opaque cursor at the current iteration position. Persist this for resume.
     *
     * @return string|null The cursor that fetched the current page; null before
     *                     iteration starts.
     */
    public function cursor(): ?string
    {
        return $this->currentCursor;
    }

    /**
     * @return Generator<int, T>
     */
    public function getIterator(): Generator
    {
        $exhausted = false;
        while (!$exhausted) {
            $cursorForThisFetch = $this->nextCursor;
            $this->currentCursor = $cursorForThisFetch;
            /** @var CursorPage<T> $page */
            $page = ($this->fetcher)($cursorForThisFetch, $this->limit);
            foreach ($page->data as $item) {
                yield $item;
            }
            $this->nextCursor = $page->nextCursor;
            if (!$page->hasMore || $page->nextCursor === null) {
                $exhausted = true;
            }
        }
    }
}
