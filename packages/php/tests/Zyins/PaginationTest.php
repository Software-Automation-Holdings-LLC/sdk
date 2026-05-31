<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Zyins\Pagination\CursorIterator;
use Isa\Sdk\Zyins\Pagination\CursorPage;
use Isa\Sdk\Zyins\Pagination\FirstPage;
use Isa\Sdk\Zyins\Pagination\ListOptions;

#[CoversClass(CursorIterator::class)]
#[CoversClass(CursorPage::class)]
#[CoversClass(FirstPage::class)]
#[CoversClass(ListOptions::class)]
final class PaginationTest extends TestCase
{
    /**
     * @param array<int, CursorPage<array{id: string}>> $pages
     * @return callable(?string, ?int): CursorPage<array{id: string}>
     */
    private function fakeFetcher(array $pages, ?array &$calls = null): callable
    {
        $calls = [];
        return function (?string $cursor, ?int $limit) use ($pages, &$calls): CursorPage {
            $calls[] = [$cursor, $limit];
            if ($cursor === null) {
                return $pages[0];
            }
            foreach ($pages as $i => $page) {
                if ($page->nextCursor === $cursor) {
                    return $pages[$i + 1];
                }
            }
            throw new \RuntimeException("unknown cursor: {$cursor}");
        };
    }

    public function test_iterates_every_item_across_pages(): void
    {
        $pages = [
            new CursorPage([['id' => '1'], ['id' => '2']], 'cur_a', true),
            new CursorPage([['id' => '3'], ['id' => '4']], 'cur_b', true),
            new CursorPage([['id' => '5']], null, false),
        ];
        $iter = new CursorIterator($this->fakeFetcher($pages));
        $ids = [];
        foreach ($iter as $row) {
            $ids[] = $row['id'];
        }
        self::assertSame(['1', '2', '3', '4', '5'], $ids);
    }

    public function test_cursor_mid_iteration_supports_checkpoint(): void
    {
        $pages = [
            new CursorPage([['id' => '1'], ['id' => '2']], 'cur_a', true),
            new CursorPage([['id' => '3'], ['id' => '4']], 'cur_b', true),
            new CursorPage([['id' => '5']], null, false),
        ];
        $iter = new CursorIterator($this->fakeFetcher($pages));
        $seen = [];
        $mid = null;
        foreach ($iter as $row) {
            $seen[] = $row['id'];
            if (count($seen) === 3) {
                $mid = $iter->cursor();
                break;
            }
        }
        // The cursor that fetched the current page (cur_a).
        self::assertSame('cur_a', $mid);
    }

    public function test_resumes_from_saved_cursor(): void
    {
        $pages = [
            new CursorPage([['id' => '1'], ['id' => '2']], 'cur_a', true),
            new CursorPage([['id' => '3'], ['id' => '4']], 'cur_b', true),
            new CursorPage([['id' => '5']], null, false),
        ];
        $resumed = new CursorIterator(
            $this->fakeFetcher($pages),
            new ListOptions(cursor: 'cur_a'),
        );
        $ids = [];
        foreach ($resumed as $row) {
            $ids[] = $row['id'];
        }
        self::assertSame(['3', '4', '5'], $ids);
    }

    public function test_limit_is_passed_through_to_fetcher(): void
    {
        $pages = [new CursorPage([['id' => '1']], null, false)];
        $calls = null;
        $iter = new CursorIterator(
            $this->fakeFetcher($pages, $calls),
            new ListOptions(limit: 25),
        );
        foreach ($iter as $_) {
            // drain
        }
        self::assertSame(25, $calls[0][1]);
    }

    public function test_first_page_returns_single_page(): void
    {
        $pages = [new CursorPage([['id' => '1'], ['id' => '2']], 'cur_a', true)];
        $page = FirstPage::fetch($this->fakeFetcher($pages));
        self::assertSame('cur_a', $page->nextCursor);
        self::assertTrue($page->hasMore);
        self::assertCount(2, $page->data);
    }
}
