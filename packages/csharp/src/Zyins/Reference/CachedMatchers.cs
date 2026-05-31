// Top-level cache-backed matcher namespaces. Mirror the locked SDK
// syntax `isa.Zyins.Medications.MatchAsync(text)` /
// `isa.Zyins.Conditions.MatchAsync(text)` /
// `isa.Zyins.Concepts.MatchAsync(text)`.
//
// The bundleless surface lazily resolves a DatasetBundleV3 the first
// time MatchAsync is called, then memoizes it on the namespace
// instance. A SemaphoreSlim gates concurrent first-callers so the
// dataset is fetched exactly once even under heavy concurrency.
//
// The existing bundle-required interface (`IMedicationMatcher.Match(text, bundle)`)
// is preserved — these namespace types implement it directly so the
// `client.Medications.Match(text, bundle)` shortcut keeps compiling.
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Resolves a <see cref="DatasetBundleV3"/> on demand. The
/// production resolver fetches `GET /v3/datasets`; tests inject a
/// fake to keep the cache-backed path covered without HTTP.</summary>
internal interface IBundleResolver
{
    /// <summary>Return a fresh bundle. Implementations MAY throw if the
    /// dataset is unavailable; callers surface that to the consumer.</summary>
    Task<DatasetBundleV3> GetAsync(CancellationToken ct);
}

/// <summary>Default <see cref="IBundleResolver"/> backed by
/// <see cref="DatasetsV3SubClient"/>. The resolver does NOT cache —
/// the namespace class owns the cache so invalidation is uniform.</summary>
internal sealed class DatasetsV3BundleResolver : IBundleResolver
{
    private readonly DatasetsV3SubClient _datasets;

    public DatasetsV3BundleResolver(DatasetsV3SubClient datasets)
    {
        _datasets = datasets ?? throw new ArgumentNullException(nameof(datasets));
    }

    public async Task<DatasetBundleV3> GetAsync(CancellationToken ct)
    {
        var response = await _datasets.GetAsync(options: null, ct).ConfigureAwait(false);
        if (response.Bundle is null)
        {
            // 304 with no prior bundle cached on this namespace — the
            // server promised the dataset hadn't changed, but we have
            // nothing to compare against. Treat as a transport bug.
            throw new InvalidOperationException(
                "ZyIns Reference cache: DatasetsV3 returned 304 with no prior bundle on first fetch — server contract violation");
        }
        return response.Bundle;
    }
}

/// <summary>Shared implementation of the lazy cache. Generic over the
/// concept-specific output so each top-level namespace can expose its
/// own typed <c>MatchAsync</c> shape.</summary>
internal sealed class BundleCache
{
    private readonly IBundleResolver _resolver;
    private readonly SemaphoreSlim _gate = new(initialCount: 1, maxCount: 1);
    private DatasetBundleV3? _cached;

    public BundleCache(IBundleResolver resolver)
    {
        _resolver = resolver ?? throw new ArgumentNullException(nameof(resolver));
    }

    /// <summary>Return the cached bundle if present; otherwise fetch
    /// under the gate so concurrent first-callers share one round-trip.</summary>
    public async Task<DatasetBundleV3> GetAsync(CancellationToken ct)
    {
        // Fast path: already cached.
        var snapshot = Volatile.Read(ref _cached);
        if (snapshot is not null) return snapshot;

        await _gate.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            // Re-check inside the gate; another caller may have won.
            snapshot = Volatile.Read(ref _cached);
            if (snapshot is not null) return snapshot;
            var fresh = await _resolver.GetAsync(ct).ConfigureAwait(false);
            Volatile.Write(ref _cached, fresh);
            return fresh;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>Discard the cached bundle. The next
    /// <see cref="GetAsync(CancellationToken)"/> re-fetches.</summary>
    public void Invalidate() => Volatile.Write(ref _cached, null);
}

/// <summary>Top-level medications namespace exposed on
/// <c>ZyInsClient.Medications</c>. The bundleless
/// <see cref="MatchAsync(string, CancellationToken)"/> entry point is
/// the locked Tier-1 surface; the bundle-required
/// <see cref="Match(string, DatasetBundleV3)"/> and
/// <see cref="List(DatasetBundleV3)"/> entry points are retained for
/// the Tier-3 sugar.</summary>
public sealed class MedicationsNamespace : IMedicationMatcher
{
    private readonly BundleCache _cache;
    private readonly IMedicationMatcher _inner;

    internal MedicationsNamespace(BundleCache cache, IMedicationMatcher inner)
    {
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _inner = inner ?? throw new ArgumentNullException(nameof(inner));
    }

    /// <summary>Free-text → medication concept. Lazily resolves the
    /// catalog on first call and caches it on this namespace
    /// instance.</summary>
    public async Task<IConcept> MatchAsync(string text, CancellationToken ct = default)
    {
        if (text is null) throw new ArgumentNullException(nameof(text));
        var bundle = await _cache.GetAsync(ct).ConfigureAwait(false);
        return _inner.Match(text, bundle);
    }

    /// <summary>Discard the cached bundle. The next
    /// <see cref="MatchAsync(string, CancellationToken)"/> re-fetches
    /// <c>GET /v3/datasets</c>.</summary>
    public void InvalidateCache() => _cache.Invalidate();

    /// <inheritdoc />
    public IConcept Match(string text, DatasetBundleV3 bundle) => _inner.Match(text, bundle);

    /// <inheritdoc />
    public IReadOnlyList<IMedicationConcept> List(DatasetBundleV3 bundle) => _inner.List(bundle);
}

/// <summary>Top-level conditions namespace exposed on
/// <c>ZyInsClient.Conditions</c>. Symmetric to
/// <see cref="MedicationsNamespace"/>.</summary>
public sealed class ConditionsNamespace : IConditionMatcher
{
    private readonly BundleCache _cache;
    private readonly IConditionMatcher _inner;

    internal ConditionsNamespace(BundleCache cache, IConditionMatcher inner)
    {
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _inner = inner ?? throw new ArgumentNullException(nameof(inner));
    }

    /// <summary>Free-text → condition concept. Cache-backed; safe to
    /// call concurrently from multiple threads.</summary>
    public async Task<IConcept> MatchAsync(string text, CancellationToken ct = default)
    {
        if (text is null) throw new ArgumentNullException(nameof(text));
        var bundle = await _cache.GetAsync(ct).ConfigureAwait(false);
        return _inner.Match(text, bundle);
    }

    /// <summary>Discard the cached bundle.</summary>
    public void InvalidateCache() => _cache.Invalidate();

    /// <inheritdoc />
    public IConcept Match(string text, DatasetBundleV3 bundle) => _inner.Match(text, bundle);

    /// <inheritdoc />
    public IReadOnlyList<IConditionConcept> List(DatasetBundleV3 bundle) => _inner.List(bundle);
}

/// <summary>Top-level concepts namespace exposed on
/// <c>ZyInsClient.Concepts</c> — tries conditions first, then
/// medications. Symmetric to
/// <see cref="MedicationsNamespace"/>.</summary>
public sealed class ConceptsNamespace : IAnyConceptMatcher
{
    private readonly BundleCache _cache;
    private readonly IAnyConceptMatcher _inner;

    internal ConceptsNamespace(BundleCache cache, IAnyConceptMatcher inner)
    {
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _inner = inner ?? throw new ArgumentNullException(nameof(inner));
    }

    /// <summary>Free-text → concept across both axes. Cache-backed.</summary>
    public async Task<IConcept> MatchAsync(string text, CancellationToken ct = default)
    {
        if (text is null) throw new ArgumentNullException(nameof(text));
        var bundle = await _cache.GetAsync(ct).ConfigureAwait(false);
        return _inner.Match(text, bundle);
    }

    /// <summary>Discard the cached bundle.</summary>
    public void InvalidateCache() => _cache.Invalidate();

    /// <inheritdoc />
    public IConcept Match(string text, DatasetBundleV3 bundle) => _inner.Match(text, bundle);

    /// <inheritdoc />
    public IReadOnlyList<IConcept> MatchMany(IEnumerable<string> texts, DatasetBundleV3 bundle)
        => _inner.MatchMany(texts, bundle);
}
