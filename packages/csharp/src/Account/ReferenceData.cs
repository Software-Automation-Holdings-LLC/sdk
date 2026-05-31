// `isa.Account.ReferenceData` — engine reference-data lookups.
//
// Three wire paths, one typed surface:
//   scope == "dataset"            → GET   /dataset/{dataset}
//   scope == "compiled_data_v2"   → POST  /v1/reference-data
//   scope == "compiled_data_v3"   → POST  /v2/reference-data
//   (other scope values)          → POST  /v1/reference-data
//
// The scope value is forwarded in the request body for the POST paths so
// the server can dispatch to the right compiled-data version. The GET
// path takes the dataset name in the URL.
//
// Return shape is the server's verbatim JSON, unwrapped from the
// ADR-012 envelope when present. Callers downcast to the fields they need.
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Zyins;

namespace Isa.Sdk.Account;

/// <summary>Inputs for <see cref="AccountReferenceData.GetAsync(ReferenceDataRequest, CancellationToken)"/>.</summary>
public sealed record ReferenceDataRequest
{
    /// <summary>Server-side dispatcher key.</summary>
    public string Scope { get; init; } = string.Empty;
    /// <summary>Required when <c>Scope == "dataset"</c>. Names the dataset to fetch.</summary>
    public string? Dataset { get; init; }
    /// <summary>Optional caller-supplied filters / parameters; forwarded as the POST body.</summary>
    public IReadOnlyDictionary<string, object?>? Payload { get; init; }
}

/// <summary>Response shape — opaque to the SDK. Common case is a
/// <c>{ datasets: { ... } }</c> envelope; some scopes return a flat record.</summary>
public sealed record ReferenceDataResult
{
    /// <summary>The verbatim response body keyed by field name.</summary>
    public IReadOnlyDictionary<string, JsonElement> Data { get; init; }
        = new Dictionary<string, JsonElement>();
}

/// <summary>Optional shape (mirrors the TS `opts`). Reserved for future
/// per-call knobs (cache TTL, partial fetch); currently unused.</summary>
public sealed record ReferenceDataOptions
{
}

/// <summary>`isa.Account.ReferenceData` facade.</summary>
public sealed class AccountReferenceData
{
    private const string V1Path = "/v1/reference-data";
    private const string V2Path = "/v2/reference-data";
    private const string DatasetPrefix = "/dataset/";

    private readonly AccountContext _ctx;

    internal AccountReferenceData(AccountContext ctx) => _ctx = ctx;

    /// <summary>Fetch reference data per the supplied scope.</summary>
    public Task<ReferenceDataResult> GetAsync(ReferenceDataRequest request, CancellationToken ct = default)
        => GetAsync(request, options: null, ct);

    /// <summary>Fetch with optional per-call options (reserved).</summary>
    public Task<ReferenceDataResult> GetAsync(
        ReferenceDataRequest request,
        ReferenceDataOptions? options,
        CancellationToken ct = default)
    {
        _ = options; // reserved
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.Scope))
            throw new ArgumentException("account: referenceData.get requires a non-empty scope", nameof(request));
        var op = _ctx.RequireOp();
        if (request.Scope == "dataset")
        {
            if (string.IsNullOrWhiteSpace(request.Dataset))
                throw new ArgumentException("account: referenceData.get(scope=dataset) requires a dataset name", nameof(request));
            var path = $"{DatasetPrefix}{Uri.EscapeDataString(request.Dataset)}";
            return HttpDispatcher.GetAsync<ReferenceDataResult>(op, path, ct: ct);
        }
        var wire = new Dictionary<string, object?>();
        if (request.Payload is not null)
        {
            foreach (var kv in request.Payload) wire[kv.Key] = kv.Value;
        }
        wire["scope"] = request.Scope;
        var dispatchPath = request.Scope == "compiled_data_v3" ? V2Path : V1Path;
        return HttpDispatcher.PostJsonAsync<IReadOnlyDictionary<string, object?>, ReferenceDataResult>(
            op, dispatchPath, wire, ct);
    }
}
