// v3 datasets — <c>GET /v3/datasets</c>. C# parity to the TS surface
// in <c>packages/ts/src/zyins/datasets-v3.ts</c>.
//
// Wire shape: inline rows (every relation lives inside the row). The
// SDK does NOT rebuild any maps client-side; the row IS the source of
// truth. See <c>DatasetsV3.Records.cs</c> for the data model.
//
// Conditional revalidation works the same as every other v3 endpoint:
// pass <c>IfNoneMatch</c>; on 304 the bundle is absent and the prior
// ETag is echoed back so callers can keep the prior bundle live.
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Core;

namespace Isa.Sdk.Zyins;

/// <summary>
/// Options for <see cref="DatasetsV3SubClient.GetAsync"/>.
///
/// <list type="bullet">
/// <item><c>Include</c>: narrow the response to specific dataset names
/// (<c>conditions</c>, <c>medications</c>, <c>nicotine_options</c>,
/// <c>spelling_corrections</c>); <c>null</c> = all.</item>
/// <item><c>Fields</c>: <c>"meta"</c> skips row payloads; <c>"full"</c>
/// (default) returns everything.</item>
/// <item><c>IfNoneMatch</c>: conditional revalidation; passes through as
/// the <c>If-None-Match</c> request header.</item>
/// </list>
/// </summary>
public sealed record DatasetsV3GetOptions(
    IReadOnlyList<string>? Include = null,
    string? Fields = null,
    string? IfNoneMatch = null
);

/// <summary>Result returned when the server answered the conditional GET with 304.</summary>
public sealed record DatasetsV3NotModified(string? Etag);

/// <summary>Surface for <c>GET /v3/datasets</c>.</summary>
public interface IDatasetsV3Service
{
    /// <summary>Fetch the v3 reference bundle.</summary>
    Task<DatasetsV3Response> GetAsync(DatasetsV3GetOptions? options = null, CancellationToken ct = default);
}

/// <summary>
/// Discriminated wrapper for the v3 datasets GET result. Either the server
/// returned a fresh bundle or 304 with a (possibly absent) ETag.
/// </summary>
public sealed class DatasetsV3Response
{
    private DatasetsV3Response(DatasetBundleV3? bundle, DatasetsV3NotModified? notModified)
    {
        Bundle = bundle;
        NotModified = notModified;
    }

    /// <summary>Fresh bundle when the server returned 200. <c>null</c> on 304.</summary>
    public DatasetBundleV3? Bundle { get; }

    /// <summary>Populated when the server returned 304. <c>null</c> on a fresh response.</summary>
    public DatasetsV3NotModified? NotModified { get; }

    /// <summary>True iff the server answered with 304.</summary>
    public bool IsNotModified => NotModified is not null;

    internal static DatasetsV3Response FromBundle(DatasetBundleV3 bundle) => new(bundle, null);
    internal static DatasetsV3Response FromNotModified(string? etag) => new(null, new DatasetsV3NotModified(etag));
}

/// <summary>Sub-client for the v3 datasets endpoint.</summary>
/// <example>
/// <code>
/// var response = await isa.Zyins.DatasetsV3.GetAsync();
/// var bundle = response.Bundle!;
/// var hbp = bundle.Conditions.Items.First(c =&gt; c.Name == "High Blood Pressure");
/// foreach (var med in hbp.TreatedWith) System.Console.WriteLine(med.Name);
/// </code>
/// </example>
public sealed class DatasetsV3SubClient : IDatasetsV3Service
{
    private const string Path = "/v3/datasets";
    private const string IfNoneMatchHeader = "If-None-Match";
    private const string EtagHeader = "ETag";
    private const string AcceptHeader = "Accept";
    private const string JsonMediaType = "application/json";

    private readonly OperationContext _ctx;

    internal DatasetsV3SubClient(OperationContext ctx) => _ctx = ctx;

    /// <inheritdoc/>
    public async Task<DatasetsV3Response> GetAsync(DatasetsV3GetOptions? options = null, CancellationToken ct = default)
    {
        var query = BuildQuery(options);
        var url = BuildUrl(_ctx.BaseUrl, Path, query);
        var headers = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [AcceptHeader] = JsonMediaType,
        };
        if (options?.IfNoneMatch is { } inm && !string.IsNullOrWhiteSpace(inm))
        {
            headers[IfNoneMatchHeader] = inm;
        }
        var request = new TransportRequest(HttpVerb.Get, url, headers, Body: null);
        var signed = _ctx.Signer.Sign(request);
        _ctx.Logger.LogRequest(signed, attempt: 0);
        var response = await _ctx.Transport.SendAsync(signed, ct).ConfigureAwait(false);
        _ctx.Logger.LogResponse(signed.Url, response);

        if (response.Status == 304)
        {
            return DatasetsV3Response.FromNotModified(ReadHeader(response.Headers, EtagHeader));
        }
        if (response.Status is < 200 or >= 300)
        {
            throw ProblemDetailsParser.ToException(response);
        }
        var bundle = DatasetsV3Parser.ParseEnvelope(response.Body, ReadHeader(response.Headers, EtagHeader));
        return DatasetsV3Response.FromBundle(bundle);
    }

    private static IReadOnlyList<KeyValuePair<string, string>> BuildQuery(DatasetsV3GetOptions? options)
    {
        if (options is null) return Array.Empty<KeyValuePair<string, string>>();
        var parts = new List<KeyValuePair<string, string>>(2);
        if (options.Include is not null)
        {
            parts.Add(new KeyValuePair<string, string>("include", string.Join(",", options.Include)));
        }
        if (!string.IsNullOrWhiteSpace(options.Fields))
        {
            parts.Add(new KeyValuePair<string, string>("fields", options.Fields!));
        }
        return parts;
    }

    private static Uri BuildUrl(Uri baseUrl, string path, IReadOnlyList<KeyValuePair<string, string>> query)
    {
        var b = new UriBuilder(new Uri(baseUrl, path));
        if (query.Count == 0) return b.Uri;
        var encoded = new List<string>(query.Count);
        foreach (var kv in query)
        {
            encoded.Add(Uri.EscapeDataString(kv.Key) + "=" + Uri.EscapeDataString(kv.Value));
        }
        b.Query = string.Join("&", encoded);
        return b.Uri;
    }

    private static string? ReadHeader(IReadOnlyDictionary<string, string> headers, string name)
    {
        foreach (var kv in headers)
        {
            if (string.Equals(kv.Key, name, StringComparison.OrdinalIgnoreCase)) return kv.Value;
        }
        return null;
    }
}
