// Tier 3 logos operations — GET /v1/logo/{carrier} (synonym /v1/logos/{carrier}).
//
// Static carrier-brand assets. Per api-standards.md (GET allowlist), the
// endpoint is non-credentialed: the SDK does NOT attach auth headers. Two
// response shapes are negotiated via the ?ds= query parameter:
//
//   - ?ds=true → server returns a `data:image/...;base64,...` text body.
//   - default  → server returns the raw image bytes (typically PNG/JPEG).
//
// The C# surface offers a single `GetAsync(carrier, opts, ct)` entry point
// whose return type is `LogoResult` carrying both representations. Callers
// pull either `.Bytes` (default) or `.DataUri` (when opts.DataUri=true).
// Mirrors `isa.zyins.logos.get(carrier, { dataUri? })` in the TS SDK.
using System;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Core;

namespace Isa.Sdk.Zyins;

/// <summary>Options accepted by <see cref="LogosSubClient.GetAsync"/>.</summary>
public sealed record LogosOptions
{
    /// <summary>When true, returns the asset as a <c>data:image/...</c> URI string
    /// via <see cref="LogoResult.DataUri"/>. When false (default), returns the raw
    /// bytes via <see cref="LogoResult.Bytes"/>.</summary>
    public bool DataUri { get; init; }
}

/// <summary>Result of <see cref="LogosSubClient.GetAsync"/>. Exactly one of
/// <see cref="Bytes"/> or <see cref="DataUri"/> is populated, mirroring the
/// <c>dataUri</c> flag in the request options.</summary>
public sealed record LogoResult
{
    /// <summary>Raw image bytes when the request did not opt in to the data URI shape.</summary>
    public byte[]? Bytes { get; init; }

    /// <summary>Base64 data URI string when the request opted in via
    /// <see cref="LogosOptions.DataUri"/>.</summary>
    public string? DataUri { get; init; }
}

/// <summary>Sub-client for the public carrier-logo endpoint. Non-credentialed —
/// requests are issued without auth headers, matching the GET allowlist.</summary>
public sealed class LogosSubClient
{
    // Canonical path per api-standards.md. The server also serves the
    // legacy `/v1/logos/{carrier}` synonym; both resolve to the same asset.
    private const string LogoPath = "/v1/logo/";
    private const string DataUriPrefix = "data:image/";

    private readonly OperationContext _ctx;

    internal LogosSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Fetch the carrier-logo asset.</summary>
    /// <exception cref="ArgumentException">when <paramref name="carrier"/> is empty.</exception>
    /// <exception cref="global::Isa.Sdk.Core.IsaException">when the server returns a non-2xx response.</exception>
    public async Task<LogoResult> GetAsync(
        string carrier,
        LogosOptions? options = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(carrier))
            throw new ArgumentException("zyins.logos.get: carrier is required", nameof(carrier));

        var dataUri = options?.DataUri == true;
        var path = LogoPath + Uri.EscapeDataString(carrier) + (dataUri ? "?ds=true" : string.Empty);
        var url = new Uri(_ctx.BaseUrl, path);
        // Non-credentialed GET — skip signer entirely.
        var request = new TransportRequest(
            HttpVerb.Get,
            url,
            new System.Collections.Generic.Dictionary<string, string>
            {
                ["Accept"] = dataUri ? "text/plain" : "image/*",
            },
            Body: null);
        _ctx.Logger.LogRequest(request, attempt: 0);
        var response = await _ctx.Transport.SendAsync(request, ct).ConfigureAwait(false);
        _ctx.Logger.LogResponse(request.Url, response);
        if (response.Status is < 200 or >= 300)
        {
            throw ProblemDetailsParser.ToException(response);
        }
        if (dataUri)
        {
            var body = response.Body ?? string.Empty;
            if (!body.StartsWith(DataUriPrefix, StringComparison.Ordinal))
            {
                throw new IsaException(
                    code: "unknown",
                    message: $"zyins.logos.get: expected a {DataUriPrefix}... URI but got: {Snip(body)}");
            }
            return new LogoResult { DataUri = body };
        }
        if (response.BodyBytes is null)
            throw new IsaException(
                code: "unknown",
                message: "zyins.logos.get: transport did not return raw bytes.");
        return new LogoResult { Bytes = response.BodyBytes };
    }

    private static string Snip(string s) =>
        s.Length <= 32 ? s : s.Substring(0, 32);
}
