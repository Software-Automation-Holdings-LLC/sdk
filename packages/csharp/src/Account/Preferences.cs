// `isa.Account.Preferences` — GET / POST /v1/preferences.
//
// Per-license opaque settings document, partitioned by caller-supplied
// `scope`. bpp2.0 passes scope="bpp"; future surfaces (eApp, agent
// dashboard) will pass their own value so writes do not stomp each other.
//
// The SDK does not interpret the document; callers serialize their own
// settings shape and pass through.
using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Zyins;

namespace Isa.Sdk.Account;

/// <summary>Opaque preferences document — keys and values are caller-defined.</summary>
public sealed record PreferencesDocument
{
    /// <summary>Document body.</summary>
    [JsonPropertyName("prefs")]
    public IReadOnlyDictionary<string, object?> Prefs { get; init; }
        = new Dictionary<string, object?>();
}

/// <summary>Result of <see cref="AccountPreferences.LookupAsync"/>.</summary>
public sealed record PreferencesLookupResult
{
    /// <summary>Document body.</summary>
    [JsonPropertyName("prefs")]
    public IReadOnlyDictionary<string, object?> Prefs { get; init; }
        = new Dictionary<string, object?>();
}

/// <summary>Input for <see cref="AccountPreferences.SetAsync"/>.</summary>
public sealed record PreferencesSetRequest
{
    /// <summary>Partition key matching the corresponding lookup. Required.</summary>
    [JsonPropertyName("scope")] public string Scope { get; init; } = string.Empty;

    /// <summary>Document to upsert.</summary>
    [JsonPropertyName("prefs")]
    public IReadOnlyDictionary<string, object?> Prefs { get; init; }
        = new Dictionary<string, object?>();
}

/// <summary>Result of <see cref="AccountPreferences.SetAsync"/>.</summary>
public sealed record PreferencesSetResult
{
    /// <summary>True on successful upsert.</summary>
    [JsonPropertyName("ok")] public bool Ok { get; init; } = true;
}

/// <summary>`isa.Account.Preferences` facade.</summary>
public sealed class AccountPreferences
{
    private const string Path = "/v1/preferences";
    private readonly AccountContext _ctx;

    internal AccountPreferences(AccountContext ctx) => _ctx = ctx;

    /// <summary>Fetch the preferences document for the supplied scope.</summary>
    public Task<PreferencesLookupResult> LookupAsync(string scope, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(scope))
            throw new ArgumentException("account: preferences.lookup requires a non-empty scope", nameof(scope));
        var op = _ctx.RequireOp();
        var query = new Dictionary<string, string?> { ["scope"] = scope };
        return HttpDispatcher.GetAsync<PreferencesLookupResult>(op, Path, query, ct);
    }

    /// <summary>Upsert the preferences document for the supplied scope.</summary>
    public Task<PreferencesSetResult> SetAsync(PreferencesSetRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.Scope))
            throw new ArgumentException("account: preferences.set requires a non-empty scope", nameof(request));
        if (request.Prefs is null)
            throw new ArgumentException("account: preferences.set requires a prefs object", nameof(request));
        var op = _ctx.RequireOp();
        return HttpDispatcher.PostJsonEnvelopeAsync<PreferencesSetRequest, PreferencesSetResult>(
            op, Path, request, "preferences.set", ct);
    }
}
