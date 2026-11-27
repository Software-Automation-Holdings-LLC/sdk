using System.Diagnostics;
using Isa.Sdk.Zyins.Reference;
using Xunit;

namespace Isa.Sdk.Tests;

/// <summary>
/// Spec for the query-length-unbounded fuzzy fallback.
/// <see cref="DefaultAutocompleteAlgorithm.Rank"/> tokenizes caller-supplied
/// typeahead text with no length cap. When the literal filter misses, the
/// default fuzzy fallback compares every query word with every token of
/// every candidate and recomputes Double Metaphone on the candidate token
/// for each pair. <c>Limit</c> only trims the list returned after that
/// scan, and the <see cref="CancellationToken"/> is not consulted.
/// </summary>
public sealed class AutocompleteQueryBoundTests
{
    private const int CatalogSize = 800;
    private const int BaselineWords = 4;
    private const int AttackWords = 1200;
    private const int Scale = 5;
    private static readonly TimeSpan Floor = TimeSpan.FromMilliseconds(25);
    private static readonly TimeSpan CancelAfter = TimeSpan.FromMilliseconds(40);
    private static readonly TimeSpan CancelCeiling = TimeSpan.FromMilliseconds(200);

    [Fact]
    public async Task Rank_LongUnmatchedQuery_StaysWithinBaseline()
    {
        var algo = new DefaultAutocompleteAlgorithm();
        var candidates = Catalog(CatalogSize);
        var options = new AutocompleteOptions(Limit: 1);

        var baseline = await Elapsed(algo, Query(BaselineWords), candidates, options, CancellationToken.None);
        var attack = await Elapsed(algo, Query(AttackWords), candidates, options, CancellationToken.None);

        Assert.Empty(baseline.Suggestions);
        Assert.Empty(attack.Suggestions);
        AssertBounded(baseline.Elapsed, attack.Elapsed);
    }

    [Fact]
    public async Task Rank_AlphabeticalLongUnmatchedQuery_StaysWithinBaseline()
    {
        var algo = new DefaultAutocompleteAlgorithm();
        var candidates = Catalog(CatalogSize);
        var options = new AutocompleteOptions(Limit: 1, Sort: Sort.Alphabetical);

        var baseline = await Elapsed(algo, Query(BaselineWords), candidates, options, CancellationToken.None);
        var attack = await Elapsed(algo, Query(AttackWords), candidates, options, CancellationToken.None);

        Assert.Empty(attack.Suggestions);
        AssertBounded(baseline.Elapsed, attack.Elapsed);
    }

    [Fact]
    public async Task Rank_CancelledToken_DoesNotScanFuzzyFallback()
    {
        var algo = new DefaultAutocompleteAlgorithm();
        var candidates = Catalog(CatalogSize);
        var options = new AutocompleteOptions(Limit: 1);
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        var baseline = await Elapsed(algo, Query(BaselineWords), candidates, options, CancellationToken.None);
        var attack = await Elapsed(algo, Query(AttackWords), candidates, options, cts.Token);

        Assert.Empty(attack.Suggestions);
        AssertBounded(baseline.Elapsed, attack.Elapsed);
    }

    [Fact]
    public async Task Rank_DeadlineDuringScan_StopsFuzzyFallback()
    {
        var algo = new DefaultAutocompleteAlgorithm();
        var candidates = Catalog(CatalogSize);
        var options = new AutocompleteOptions(Limit: 1);
        using var cts = new CancellationTokenSource(CancelAfter);

        var started = Stopwatch.StartNew();
        var suggestions = await algo.Rank(Query(AttackWords), candidates, options, cts.Token);
        started.Stop();

        Assert.Empty(suggestions);
        Assert.True(
            started.Elapsed <= CancelCeiling,
            $"Rank ignored a {CancelAfter.TotalMilliseconds:0}ms deadline and ran for {started.Elapsed.TotalMilliseconds:0}ms");
    }

    private static void AssertBounded(TimeSpan baseline, TimeSpan observed)
    {
        var limit = baseline * Scale;
        if (limit < Floor)
        {
            limit = Floor;
        }

        Assert.True(
            observed <= limit,
            $"autocomplete rank took {observed.TotalMilliseconds:0}ms; limit {limit.TotalMilliseconds:0}ms (baseline {baseline.TotalMilliseconds:0}ms)");
    }

    private static async Task<(TimeSpan Elapsed, IReadOnlyList<Suggestion> Suggestions)> Elapsed(
        DefaultAutocompleteAlgorithm algo,
        string query,
        IReadOnlyList<IConcept> candidates,
        AutocompleteOptions options,
        CancellationToken cancellationToken)
    {
        var started = Stopwatch.StartNew();
        var suggestions = await algo.Rank(query, candidates, options, cancellationToken);
        started.Stop();
        return (started.Elapsed, suggestions);
    }

    private static List<IConcept> Catalog(int count)
    {
        var concepts = new List<IConcept>(count);
        for (var i = 0; i < count; i++)
        {
            concepts.Add(new ProbeConcept($"C{i}", $"Condition Alpha {i}"));
        }

        return concepts;
    }

    private static string Query(int words) => string.Join(' ', Enumerable.Repeat("qx", words));

    private sealed class ProbeConcept : IConcept
    {
        public ProbeConcept(string id, string name)
        {
            Id = id;
            Name = name;
            InputText = name;
        }

        public string? Id { get; }

        public string Name { get; }

        public ConceptKind Kind => ConceptKind.Condition;

        public bool IsKnown => true;

        public string InputText { get; }

        public IReadOnlyList<IConditionConcept> Conditions(Sort sort = Sort.MostCommonFirst) =>
            Array.Empty<IConditionConcept>();

        public IReadOnlyList<IMedicationConcept> Medications(Sort sort = Sort.MostCommonFirst) =>
            Array.Empty<IMedicationConcept>();

        public bool Equals(IConcept? other) => other is not null && other.Id == Id;
    }
}
