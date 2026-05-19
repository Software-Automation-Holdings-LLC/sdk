// Cursor-aware pagination contract (SDK_DESIGN.md §9).
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class PaginationTests
{
    private static PageFetcher<string> FakeFetcher(IReadOnlyList<CursorPage<string>> pages, List<(string?, int?)> calls)
    {
        return (cursor, limit, _) =>
        {
            calls.Add((cursor, limit));
            if (cursor is null) return Task.FromResult(pages[0]);
            for (var i = 0; i < pages.Count; i++)
            {
                if (pages[i].NextCursor == cursor) return Task.FromResult(pages[i + 1]);
            }
            throw new InvalidOperationException($"unknown cursor: {cursor}");
        };
    }

    [Fact]
    public async Task IteratesEveryItemAcrossPages()
    {
        var pages = new[]
        {
            new CursorPage<string>(new[] { "1", "2" }, "cur_a", true),
            new CursorPage<string>(new[] { "3", "4" }, "cur_b", true),
            new CursorPage<string>(new[] { "5" },     null,    false),
        };
        var calls = new List<(string?, int?)>();
        var iter = new CursorAsyncEnumerable<string>(FakeFetcher(pages, calls));
        var got = new List<string>();
        await foreach (var s in iter) got.Add(s);
        Assert.Equal(new[] { "1", "2", "3", "4", "5" }, got);
    }

    [Fact]
    public async Task CursorMidIterationSupportsCheckpoint()
    {
        var pages = new[]
        {
            new CursorPage<string>(new[] { "1", "2" }, "cur_a", true),
            new CursorPage<string>(new[] { "3", "4" }, "cur_b", true),
            new CursorPage<string>(new[] { "5" },     null,    false),
        };
        var calls = new List<(string?, int?)>();
        var iter = new CursorAsyncEnumerable<string>(FakeFetcher(pages, calls));
        var seen = new List<string>();
        string? mid = null;
        await foreach (var s in iter)
        {
            seen.Add(s);
            if (seen.Count == 3)
            {
                mid = iter.Cursor;
                break;
            }
        }
        Assert.Equal("cur_a", mid);
    }

    [Fact]
    public async Task ResumesFromSavedCursor()
    {
        var pages = new[]
        {
            new CursorPage<string>(new[] { "1", "2" }, "cur_a", true),
            new CursorPage<string>(new[] { "3", "4" }, "cur_b", true),
            new CursorPage<string>(new[] { "5" },     null,    false),
        };
        var calls = new List<(string?, int?)>();
        var resumed = new CursorAsyncEnumerable<string>(
            FakeFetcher(pages, calls),
            new ListOptions { Cursor = "cur_a" });
        var got = new List<string>();
        await foreach (var s in resumed) got.Add(s);
        Assert.Equal(new[] { "3", "4", "5" }, got);
    }

    [Fact]
    public async Task LimitIsPassedThroughToFetcher()
    {
        var pages = new[]
        {
            new CursorPage<string>(new[] { "x" }, null, false),
        };
        var calls = new List<(string?, int?)>();
        var iter = new CursorAsyncEnumerable<string>(
            FakeFetcher(pages, calls),
            new ListOptions { Limit = 25 });
        await foreach (var _ in iter) { /* drain */ }
        Assert.Equal(25, calls[0].Item2);
    }

    [Fact]
    public async Task FirstPageReturnsSinglePage()
    {
        var pages = new[]
        {
            new CursorPage<string>(new[] { "1", "2" }, "cur_a", true),
        };
        var calls = new List<(string?, int?)>();
        var page = await Pagination.FirstPageAsync(FakeFetcher(pages, calls));
        Assert.Equal("cur_a", page.NextCursor);
        Assert.True(page.HasMore);
        Assert.Equal(2, page.Data.Count);
    }
}
