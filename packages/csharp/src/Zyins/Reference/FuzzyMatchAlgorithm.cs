// `Isa.Sdk.Zyins.Reference.FuzzyMatchAlgorithm` — typo-tolerant text →
// single Concept resolution. Port of the TS reference
// (`packages/ts/src/zyins/reference/FuzzyMatchAlgorithm.ts`).
//
// An opt-in `IMatchAlgorithm` that recovers misspellings the
// `DefaultMatchAlgorithm` (exact `MakeKey` + word-order-invariant
// `CheckKey`) cannot. The default stays the default; pass this to
// `IsaBuilder.WithMatchAlgorithm(new FuzzyMatchAlgorithm(...))` to opt in.
//
// Pipeline — a tiered cascade, ranked by TIER FIRST, then by candidate
// frequency (Algolia-style successive tie-break, NOT one blended score):
//
//   1. exact      — `MakeKey` id/name equality (identity-preserving)
//   2. prefix     — candidate key starts with the query key (or vice versa)
//   3. damerau    — OSA edit distance within a length-scaled band
//                   (`sertaline` → `sertraline`, `chrons` → `crohns`)
//   4. phonetic   — Double Metaphone primary-code equality
//                   (`tylonol` → `tylenol`, both encode `TLNL`)
//   5. synonym    — alias equality, only if the candidate exposes aliases
//                   (today's `IConcept` does NOT — tier is inert)
//
// The first non-empty tier wins; within it the best candidate is chosen by
// lowest edit distance, then frequency (higher first), then a deterministic
// name/id tie-break so the result is reproducible across the language ports.
//
// Parity-hardening rules (the cross-language determinism contract):
//   1. Both query and every candidate string are NFC-normalized before any
//      comparison that feeds the phonetic / tie-break stages.
//   2. Lowercasing is locale-invariant (`ToLowerInvariant`, never `ToLower`).
//   3. When tier + edit distance + frequency are all equal, ties break by
//      normalized candidate name, then `Id` — stable, reproducible output.
//   4. The Double Metaphone encoder is validated against the shared vector
//      fixture reused by every port.
//
// Synchronous, pure, and safe to share across concurrent calls — the
// instance holds no mutable per-call state. Candidate metaphone codes are
// pre-computed lazily per candidate-pool identity for speed.

using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Text;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Typo-tolerant <see cref="IMatchAlgorithm"/>. Opt-in; pass to
/// <c>IsaBuilder.WithMatchAlgorithm</c> to enable misspelling recovery the
/// default matcher cannot reach.</summary>
/// <example>
/// <code>
/// var matcher = new FuzzyMatchAlgorithm(frequencies);
/// matcher.Match("sertaline", medications).Id; // "SERTRALINE"
/// matcher.Match("tylonol", medications).Id;    // "TYLENOL"
/// </code>
/// </example>
public sealed class FuzzyMatchAlgorithm : IMatchAlgorithm
{
    private static readonly IReadOnlyDictionary<string, int> EmptyFrequencies =
        new Dictionary<string, int>();

    // U+FFFF — sorts after every real id so null-id candidates (never reached
    // for known candidates) order last, keeping the tie-break total.
    private const string NullIdSentinel = "￿";

    private readonly IReadOnlyDictionary<string, int> _frequencies;

    // Per-candidate-pool cache of primary metaphone codes, keyed by the pool
    // reference identity — mirrors the TS `WeakMap<Concept[], ...>`.
    private readonly ConditionalWeakTable<object, IReadOnlyDictionary<IConcept, string>>
        _metaphoneCache = new();

    /// <summary>Construct an opt-in fuzzy matcher.</summary>
    /// <param name="frequencies">Per-id popularity map (concept <c>Id</c> →
    /// aggregate count) driving the intra-tier frequency tie-break. Omit (or
    /// pass <c>null</c>) to disable frequency ranking; ties then fall through
    /// to the deterministic name/id order.</param>
    /// <param name="versionTag">Optional version stamp surfaced via
    /// <see cref="VersionTag"/>.</param>
    public FuzzyMatchAlgorithm(
        IReadOnlyDictionary<string, int>? frequencies = null,
        string? versionTag = null)
    {
        _frequencies = frequencies ?? EmptyFrequencies;
        VersionTag = versionTag;
    }

    /// <inheritdoc/>
    public string? VersionTag { get; }

    /// <summary>Return a clone with selected fields overridden.</summary>
    public FuzzyMatchAlgorithm Clone(
        IReadOnlyDictionary<string, int>? frequencies = null,
        string? versionTag = null) =>
        new(frequencies ?? _frequencies, versionTag ?? VersionTag);

    /// <inheritdoc/>
    public IConcept Match(string query, IReadOnlyCollection<IConcept> candidates)
    {
        if (query is null) throw new ArgumentNullException(nameof(query));
        if (candidates is null) throw new ArgumentNullException(nameof(candidates));

        var queryKey = MakeKey.Normalize(query);
        if (queryKey.Length == 0) return Concept.Unknown(query);

        var tier = FirstNonEmptyTier(query, queryKey, candidates);
        if (tier is null) return Concept.Unknown(query);
        return BestInTier(tier) ?? Concept.Unknown(query);
    }

    // Evaluate tiers in order; return the candidates of the first tier with
    // any hit, or null if every tier is empty.
    private List<ScoredCandidate>? FirstNonEmptyTier(
        string query,
        string queryKey,
        IReadOnlyCollection<IConcept> candidates)
    {
        var exact = CollectExact(queryKey, candidates);
        if (exact.Count > 0) return exact;

        var prefix = CollectPrefix(queryKey, candidates);
        if (prefix.Count > 0) return prefix;

        var damerau = CollectDamerau(queryKey, candidates);
        if (damerau.Count > 0) return damerau;

        var phonetic = CollectPhonetic(query, candidates);
        if (phonetic.Count > 0) return phonetic;

        var synonym = CollectSynonym(query, candidates);
        if (synonym.Count > 0) return synonym;

        return null;
    }

    // Pick the single winner within a tier: lowest edit distance, then
    // highest frequency, then the deterministic name/id tie-break.
    private IConcept? BestInTier(List<ScoredCandidate> tier)
    {
        ScoredCandidate? best = null;
        foreach (var candidate in tier)
        {
            if (best is null || Outranks(candidate, best.Value)) best = candidate;
        }
        return best?.Concept;
    }

    private bool Outranks(ScoredCandidate a, ScoredCandidate b)
    {
        if (a.Distance != b.Distance) return a.Distance < b.Distance;
        var aFreq = FrequencyOf(a.Concept);
        var bFreq = FrequencyOf(b.Concept);
        if (aFreq != bFreq) return aFreq > bFreq;
        return CompareForTieBreak(a.Concept, b.Concept) < 0;
    }

    private int FrequencyOf(IConcept concept)
    {
        if (concept.Id is not { } id) return 0;
        return _frequencies.TryGetValue(id, out var freq) ? freq : 0;
    }

    private static List<ScoredCandidate> CollectExact(
        string queryKey,
        IReadOnlyCollection<IConcept> candidates)
    {
        var hits = new List<ScoredCandidate>();
        foreach (var candidate in candidates)
        {
            if (MakeKey.Normalize(candidate.Name) == queryKey)
            {
                hits.Add(new ScoredCandidate(candidate, 0));
                continue;
            }
            if (candidate.Id is { } id && MakeKey.Normalize(id) == queryKey)
            {
                hits.Add(new ScoredCandidate(candidate, 0));
            }
        }
        return hits;
    }

    private static List<ScoredCandidate> CollectPrefix(
        string queryKey,
        IReadOnlyCollection<IConcept> candidates)
    {
        var hits = new List<ScoredCandidate>();
        foreach (var candidate in candidates)
        {
            var nameKey = MakeKey.Normalize(candidate.Name);
            if (nameKey == queryKey) continue; // exact, not prefix
            if (nameKey.StartsWith(queryKey, StringComparison.Ordinal) ||
                queryKey.StartsWith(nameKey, StringComparison.Ordinal))
            {
                hits.Add(new ScoredCandidate(candidate, Math.Abs(nameKey.Length - queryKey.Length)));
            }
        }
        return hits;
    }

    private static List<ScoredCandidate> CollectDamerau(
        string queryKey,
        IReadOnlyCollection<IConcept> candidates)
    {
        var threshold = DamerauOsa.ThresholdForLength(queryKey.Length);
        var hits = new List<ScoredCandidate>();
        foreach (var candidate in candidates)
        {
            var nameKey = MakeKey.Normalize(candidate.Name);
            if (nameKey.Length == 0 || nameKey == queryKey) continue;
            var distance = DamerauOsa.Distance(queryKey, nameKey, threshold);
            if (distance <= threshold) hits.Add(new ScoredCandidate(candidate, distance));
        }
        return hits;
    }

    private List<ScoredCandidate> CollectPhonetic(
        string query,
        IReadOnlyCollection<IConcept> candidates)
    {
        var hits = new List<ScoredCandidate>();
        var queryCode = DoubleMetaphone.Encode(NormalizeForCompare(query)).Primary;
        if (queryCode.Length == 0) return hits;
        var codes = CandidateCodes(candidates);
        foreach (var candidate in candidates)
        {
            if (codes.TryGetValue(candidate, out var code) &&
                string.Equals(code, queryCode, StringComparison.Ordinal))
            {
                hits.Add(new ScoredCandidate(candidate, 0));
            }
        }
        return hits;
    }

    // Alias tier. Inert: today's `IConcept` surface deliberately omits
    // aliases (resolved server-side), so the tier never fires. Present to
    // hold the cross-language pipeline shape; lights up without a signature
    // change when a candidate type surfaces aliases.
    private static List<ScoredCandidate> CollectSynonym(
        string query,
        IReadOnlyCollection<IConcept> candidates)
    {
        _ = query;
        _ = candidates;
        return new List<ScoredCandidate>();
    }

    // Lazily pre-compute (and cache) each candidate's primary metaphone code,
    // keyed by the candidate-pool reference identity.
    private IReadOnlyDictionary<IConcept, string> CandidateCodes(
        IReadOnlyCollection<IConcept> candidates)
    {
        // ConditionalWeakTable keys on reference identity; a re-passed pool
        // returns the cached map, a fresh pool recomputes. GetValue is the
        // netstandard2.0-compatible get-or-add (no AddOrUpdate there).
        return _metaphoneCache.GetValue(candidates, ComputeCandidateCodes);
    }

    private static IReadOnlyDictionary<IConcept, string> ComputeCandidateCodes(object pool)
    {
        var candidates = (IReadOnlyCollection<IConcept>)pool;
        var codes = new Dictionary<IConcept, string>(ConceptReferenceComparer.Instance);
        foreach (var candidate in candidates)
        {
            codes[candidate] = DoubleMetaphone.Encode(NormalizeForCompare(candidate.Name)).Primary;
        }
        return codes;
    }

    // Rule 1 + Rule 2: NFC-normalize, then locale-invariant lowercase, so
    // precomposed and decomposed forms collapse before any comparison.
    private static string NormalizeForCompare(string text) =>
        text.Normalize(NormalizationForm.FormC).ToLowerInvariant();

    // Rule 3: deterministic final tie-break by normalized name, then `Id`.
    // Ordinal (code-unit) comparison — NOT culture-aware — so the order is
    // locale-invariant and identical across the language ports.
    private static int CompareForTieBreak(IConcept a, IConcept b)
    {
        var byName = string.CompareOrdinal(NormalizeForCompare(a.Name), NormalizeForCompare(b.Name));
        if (byName != 0) return byName;
        return string.CompareOrdinal(a.Id ?? NullIdSentinel, b.Id ?? NullIdSentinel);
    }

    // Reference-identity comparer for the metaphone cache. IConcept's own
    // Equals compares on Id+Kind; the cache must key on object identity (the
    // TS WeakMap semantics) so distinct candidates sharing an Id stay
    // distinct entries. netstandard2.0 lacks the BCL ReferenceEqualityComparer.
    private sealed class ConceptReferenceComparer : IEqualityComparer<IConcept>
    {
        public static readonly ConceptReferenceComparer Instance = new();

        public bool Equals(IConcept? x, IConcept? y) => ReferenceEquals(x, y);

        public int GetHashCode(IConcept obj) => RuntimeHelpers.GetHashCode(obj);
    }

    // A candidate with its match tier (implicit via collecting stage) and
    // edit distance, pre-tie-break.
    private readonly struct ScoredCandidate
    {
        public ScoredCandidate(IConcept concept, int distance)
        {
            Concept = concept;
            Distance = distance;
        }

        public IConcept Concept { get; }
        public int Distance { get; }
    }
}
