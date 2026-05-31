// v3 quote — `POST /v3/quote`. C# parity to the TS surface in
// `packages/ts/src/zyins/quote-v3.ts`.
//
// Shares the uniform `pricing[]` table shape and request body wire format
// with v3 prequalify; the difference is the response envelope (groups by
// requested amount instead of a flat plan list).

using System;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Core;

namespace Isa.Sdk.Zyins;

/// <summary>Sub-client for the v3 quote endpoint.</summary>
public sealed class QuoteV3SubClient : IQuoteV3Service
{
    private const string Path = "/v3/quote";

    private readonly OperationContext _ctx;
    private readonly Func<string>? _idempotencyKeyFactory;

    internal QuoteV3SubClient(OperationContext ctx, Func<string>? idempotencyKeyFactory = null)
    {
        _ctx = ctx;
        _idempotencyKeyFactory = idempotencyKeyFactory;
    }

    /// <inheritdoc/>
    public Task<QuoteV3Result> RunAsync(QuoteV3Request input, CancellationToken ct = default) =>
        RunAsync(input, idempotencyKey: null, ct);

    /// <summary>Run a v3 quote call with an explicit idempotency key (UUID v4 expected).</summary>
    public async Task<QuoteV3Result> RunAsync(QuoteV3Request input, string? idempotencyKey, CancellationToken ct = default)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        var key = ResolveIdempotencyKey(idempotencyKey);
        var body = V3WireBuilder.SerializeRequest(input.Applicant, input.Coverage, input.Products, V3WireBuilder.OptionsToCommon(input.Options));
        var response = await V3Dispatcher.PostAsync(_ctx, Path, body, key, ct).ConfigureAwait(false);
        return V3ResponseParser.ParseQuote(response.Body, key, V3WireBuilder.RetryAttemptsFromHeaders(response.Headers));
    }

    private string ResolveIdempotencyKey(string? explicitKey)
    {
        if (!string.IsNullOrWhiteSpace(explicitKey)) return explicitKey!;
        return _idempotencyKeyFactory?.Invoke() ?? V3WireBuilder.MintUuidV4();
    }
}
