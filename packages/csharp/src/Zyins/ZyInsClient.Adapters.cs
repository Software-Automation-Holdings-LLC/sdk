// Reference-adapter wiring on <see cref="ZyInsClient"/>. Locked-spec
// surface: <c>isa.Zyins.Autocorrector</c>, <c>isa.Zyins.Matcher</c>,
// <c>isa.Zyins.AutocompleteAlgorithm</c>.
//
// Each property exposes the active adapter — by default the
// corresponding <c>Default*</c> implementation, lazily-bound to the
// zyins v3 dataset. Custom adapters injected via
// <see cref="IsaBuilder"/> replace the defaults wholesale.
//
// The autocorrector resolves the typoMap from the
// <c>spelling_corrections</c> dataset on first <c>Correct</c> call;
// concurrent first-callers share a single fetch via the existing
// <see cref="BundleCache"/>. Subsequent <c>InvalidateAdapters</c>
// discards the bound typoMap so the next call re-projects from a
// fresh bundle.
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Zyins.Reference;

namespace Isa.Sdk.Zyins;

public sealed partial class ZyInsClient
{
    private IAutocorrector? _customAutocorrector;
    private IMatchAlgorithm? _customMatchAlgorithm;
    private IAutocompleteAlgorithm? _customAutocompleteAlgorithm;
    private LazyTypoMapAutocorrector? _defaultAutocorrector;
    private DefaultMatchAlgorithm? _defaultMatchAlgorithm;
    private DefaultAutocompleteAlgorithm? _defaultAutocompleteAlgorithm;

    /// <summary>Active <see cref="IAutocorrector"/>. Defaults to a
    /// <see cref="DefaultAutocorrector"/> bound to the zyins
    /// <c>spelling_corrections</c> dataset (lazily loaded). Override via
    /// <see cref="IsaBuilder.WithAutocorrector(IAutocorrector)"/>.</summary>
    public IAutocorrector Autocorrector =>
        _customAutocorrector ?? (_defaultAutocorrector ??=
            new LazyTypoMapAutocorrector(GetOrCreateBundleCache()));

    /// <summary>Active <see cref="IMatchAlgorithm"/>. Defaults to
    /// <see cref="DefaultMatchAlgorithm"/>; override via
    /// <see cref="IsaBuilder.WithMatchAlgorithm(IMatchAlgorithm)"/>.</summary>
    public IMatchAlgorithm Matcher =>
        _customMatchAlgorithm ?? (_defaultMatchAlgorithm ??= new DefaultMatchAlgorithm());

    /// <summary>Active <see cref="IAutocompleteAlgorithm"/>. Defaults
    /// to <see cref="DefaultAutocompleteAlgorithm"/>; override via
    /// <see cref="IsaBuilder.WithAutocompleteAlgorithm(IAutocompleteAlgorithm)"/>.</summary>
    public IAutocompleteAlgorithm AutocompleteAlgorithm =>
        _customAutocompleteAlgorithm ?? (_defaultAutocompleteAlgorithm ??= new DefaultAutocompleteAlgorithm());

    internal void AttachAdapters(
        IAutocorrector? autocorrector,
        IMatchAlgorithm? matchAlgorithm,
        IAutocompleteAlgorithm? autocompleteAlgorithm)
    {
        _customAutocorrector = autocorrector;
        _customMatchAlgorithm = matchAlgorithm;
        _customAutocompleteAlgorithm = autocompleteAlgorithm;
    }

    private BundleCache? _sharedBundleCache;

    internal BundleCache GetOrCreateBundleCache()
    {
        // The cache-backed namespace types each already own a BundleCache;
        // expose the same instance via the underlying resolver so the
        // autocorrector shares the fetch.
        return _sharedBundleCache ??= new BundleCache(new DatasetsV3BundleResolver(DatasetsV3));
    }
}

/// <summary>Default-impl autocorrector that lazily projects the
/// <c>spelling_corrections</c> dataset into its typoMap on first
/// <see cref="Correct"/> call. Thread-safe; concurrent first-callers
/// share a single fetch.</summary>
internal sealed class LazyTypoMapAutocorrector : IAutocorrector
{
    private readonly BundleCache _cache;
    private readonly SemaphoreSlim _gate = new(initialCount: 1, maxCount: 1);
    private DefaultAutocorrector? _bound;

    public LazyTypoMapAutocorrector(BundleCache cache)
    {
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    }

    public string? VersionTag => _bound?.VersionTag;

    public string Correct(string text, AutocorrectOptions? options = null)
    {
        if (string.IsNullOrEmpty(text)) return text ?? string.Empty;
        var bound = Volatile.Read(ref _bound);
        if (bound is null)
        {
            bound = Resolve().GetAwaiter().GetResult();
        }
        return bound.Correct(text, options);
    }

    /// <summary>Async-safe resolution. Production callers can drive the
    /// projection up front via this method to avoid the sync-over-async
    /// path in <see cref="Correct"/>.</summary>
    public async Task<DefaultAutocorrector> Resolve(CancellationToken ct = default)
    {
        var snapshot = Volatile.Read(ref _bound);
        if (snapshot is not null) return snapshot;
        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            snapshot = Volatile.Read(ref _bound);
            if (snapshot is not null) return snapshot;
            var bundle = await _cache.GetAsync(ct).ConfigureAwait(false);
            var map = ProjectTypoMap(bundle);
            var fresh = new DefaultAutocorrector(map, versionTag: bundle.CatalogVersion);
            Volatile.Write(ref _bound, fresh);
            return fresh;
        }
        finally
        {
            _gate.Release();
        }
    }

    private static IReadOnlyDictionary<string, string> ProjectTypoMap(DatasetBundleV3 bundle)
    {
        var rows = bundle.SpellingCorrections.Items;
        var map = new Dictionary<string, string>(rows.Count, StringComparer.Ordinal);
        foreach (var row in rows)
        {
            map[row.From.ToUpperInvariant()] = row.To.ToUpperInvariant();
        }
        return map;
    }
}
