// Pagination — cursor-aware iterator wrapper (SDK_DESIGN.md §9).
//
// Every list endpoint on isa.zyins.*, isa.rapidsign.*, isa.account.*
// returns a CursorAsyncEnumerable<T> that exposes a Cursor property and
// accepts a resume cursor on construction. This is the escape hatch for
// long-running workers that need to checkpoint mid-iteration and resume
// across process restarts.
//
// Today no list endpoints are exposed publicly — the dataset surface uses
// page-by-page methods. This file is the scaffold the first iterating
// list endpoint will hang off (case search, signature event log, webhook
// delivery log).

using System.Runtime.CompilerServices;

namespace Isa.Sdk.Zyins;

/// <summary>One page of a paginated list endpoint as returned over the wire.</summary>
/// <typeparam name="T">Row type.</typeparam>
public sealed record CursorPage<T>(
    IReadOnlyList<T> Data,
    string? NextCursor,
    bool HasMore);

/// <summary>Common options accepted by every <c>*.List(...)</c> call.</summary>
public sealed record ListOptions
{
    /// <summary>Default page size when caller does not specify one. Matches §9.4.</summary>
    public const int DefaultPageSize = 50;

    /// <summary>Resume cursor; null fetches the first page.</summary>
    public string? Cursor { get; init; }

    /// <summary>Per-page rows; null requests the server default (50).</summary>
    public int? Limit { get; init; }
}

/// <summary>Page fetcher contract supplied by each list implementation.</summary>
public delegate Task<CursorPage<T>> PageFetcher<T>(
    string? cursor,
    int? limit,
    CancellationToken cancellationToken);

/// <summary>
/// Async-enumerable wrapper that walks a paginated endpoint one item at a time,
/// fetching pages transparently. Workers can persist <see cref="Cursor"/>
/// mid-iteration and resume across process restarts.
/// </summary>
/// <example>
/// <code>
/// var iter = isa.Zyins.Cases.List(new ListOptions());
/// await foreach (var c in iter)
/// {
///     await Process(c);
///     if (ShouldStop())
///     {
///         await checkpoint.SaveAsync(iter.Cursor);
///         return;
///     }
/// }
///
/// // later, in a new process:
/// var resumed = isa.Zyins.Cases.List(new ListOptions { Cursor = await checkpoint.LoadAsync() });
/// await foreach (var c in resumed) { /* ... */ }
/// </code>
/// </example>
/// <seealso href="https://docs.isaapi.com/zyins/pagination"/>
public sealed class CursorAsyncEnumerable<T> : IAsyncEnumerable<T>
{
    private readonly PageFetcher<T> _fetcher;
    private readonly ListOptions _options;
    private string? _currentCursor;

    public CursorAsyncEnumerable(PageFetcher<T> fetcher, ListOptions? options = null)
    {
        _fetcher = fetcher ?? throw new ArgumentNullException(nameof(fetcher));
        _options = options ?? new ListOptions();
        _currentCursor = _options.Cursor;
    }

    /// <summary>
    /// Opaque cursor at the current iteration position. Persist this for resume.
    /// The cursor returned is the one that fetched the page currently being yielded,
    /// so resuming replays that page (the server dedupes by id).
    /// </summary>
    public string? Cursor => _currentCursor;

    public IAsyncEnumerator<T> GetAsyncEnumerator(CancellationToken cancellationToken = default)
        => IterateAsync(cancellationToken).GetAsyncEnumerator(cancellationToken);

    private async IAsyncEnumerable<T> IterateAsync(
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var nextCursor = _options.Cursor;
        var exhausted = false;
        while (!exhausted)
        {
            var cursorForThisFetch = nextCursor;
            _currentCursor = cursorForThisFetch;
            var page = await _fetcher(cursorForThisFetch, _options.Limit, cancellationToken)
                .ConfigureAwait(false);
            foreach (var item in page.Data)
            {
                yield return item;
            }
            nextCursor = page.NextCursor;
            if (!page.HasMore || page.NextCursor is null)
            {
                exhausted = true;
            }
        }
    }
}

/// <summary>First-page-only fetcher. For UI consumers that render their own paginator.</summary>
public static class Pagination
{
    /// <example>
    /// <code>
    /// var page = await Pagination.FirstPageAsync(fetcher, new ListOptions());
    /// foreach (var row in page.Data) { /* ... */ }
    /// // page.NextCursor is null on the last page.
    /// </code>
    /// </example>
    public static Task<CursorPage<T>> FirstPageAsync<T>(
        PageFetcher<T> fetcher,
        ListOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        options ??= new ListOptions();
        return fetcher(options.Cursor, options.Limit, cancellationToken);
    }
}
