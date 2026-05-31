// v3 prequalify — `POST /v3/prequalify`. C# parity to the TS surface in
// `packages/ts/src/zyins/prequalify-v3.ts`.
//
// The v3 contract collapses v2's `premium` + `other_offers` split into one
// uniform `pricing[]` table per product. Money is integer cents paired with a
// server-formatted `display` string; array order is authoritative; there is
// no `result_index`.
//
// Idempotency: every v3 mutating call requires a UUID v4 in `Idempotency-Key`.
// The SDK auto-mints one when the caller does not supply it, and the same key
// is echoed back in the response envelope.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Core;

namespace Isa.Sdk.Zyins;

// ── Public V3 value objects ───────────────────────────────────────────────────

/// <summary>Underwriting rank bucket. NOT the carrier rate-class label.</summary>
public enum V3EligibilityCategory
{
    /// <summary>Immediate-issue rank.</summary>
    Immediate,
    /// <summary>Graded benefit.</summary>
    Graded,
    /// <summary>Return-of-premium tier.</summary>
    Rop,
    /// <summary>Any other rank the server reports outside the closed set.</summary>
    Other,
}

/// <summary>Eligibility for one row of the pricing table.</summary>
public sealed record V3Eligibility(
    V3EligibilityCategory? Category,
    bool Eligible,
    IReadOnlyList<string> Reasons
);

/// <summary>
/// A monetary amount in integer minor units (US cents) paired with the
/// server-formatted display string — the OpenAPI <c>AmountResponse</c>.
/// <c>Cents</c> is canonical for arithmetic; <c>Display</c> renders verbatim.
/// </summary>
public sealed record V3Amount(long Cents, string Display);

/// <summary>
/// Recurrence period for a <see cref="V3Money"/>. <c>null</c> is a one-time /
/// lump-sum amount (a death benefit); the cases are premium billing cycles.
/// </summary>
public enum V3Period
{
    Monthly,
    Quarterly,
    Semiannual,
    Annual,
}

/// <summary>
/// A monetary value with a recurrence period — the OpenAPI <c>Money</c>. Used
/// for <c>DeathBenefit</c> (<c>Period</c> null, a one-time lump sum) and
/// <c>Budget</c> (<c>Period</c> Monthly, the requested monthly budget).
/// <c>Amount</c> is the canonical <see cref="V3Amount"/>; <c>Period</c>
/// disambiguates one-time vs recurring.
/// </summary>
public sealed record V3Money(V3Amount Amount, V3Period? Period);

/// <summary>
/// Premium for one row of the pricing table. <c>Amount</c> is the headline
/// value clients compare across carriers; it is byte-identical to
/// <c>Modes[DefaultMode]</c>. <c>DefaultMode</c> names which <c>Modes</c> entry
/// <c>Amount</c> was drawn from — the carrier mode token
/// (<c>MONTHLY-EFT</c>, <c>ANNUAL</c>, …), which itself encodes the recurrence,
/// so premium carries no period field. <c>Modes</c> is the full carrier grid.
/// </summary>
public sealed record V3Premium(
    V3Amount Amount,
    string DefaultMode,
    IReadOnlyDictionary<string, V3Amount> Modes
);

/// <summary>
/// One row of the uniform pricing table — a single rate class for one product.
/// Array order in <see cref="V3Offer.Pricing"/> is authoritative for display.
/// </summary>
public sealed record V3PricingRow(
    string RateClass,
    bool Primary,
    V3Eligibility Eligibility,
    int? Rank,
    V3Premium? Premium = null
);

/// <summary>The carrier underwriting a v3 offer.</summary>
public sealed record V3OfferCarrier(string Id, string Name, string LogoUrl);

/// <summary>The carrier product a v3 offer represents.</summary>
public sealed record V3OfferProduct(
    string Id,
    string Slug,
    string Name,
    string DisplayName,
    string Type,
    string WireToken
);

/// <summary>
/// One product's v3 offer, returned identically by <c>POST /v3/prequalify</c>
/// and <c>POST /v3/quote</c>. <c>DeathBenefit</c> is non-null for life products
/// (fex/term/preneed) as a one-time lump sum (<c>Period</c> null); it is
/// <c>null</c> for premium-only products (medsup), whose coverage value lives
/// entirely in <c>Pricing[].Premium</c>. <c>Budget</c> is present only on
/// monthly-budget quotes (<c>Period</c> Monthly, the requested budget — the
/// stable grouping key for budget responses). Array order in <c>Pricing</c> is
/// authoritative for display.
/// </summary>
public sealed record V3Offer(
    string Object,
    string Id,
    bool Eligible,
    V3OfferCarrier Carrier,
    V3OfferProduct Product,
    IReadOnlyList<PlanInfoItem> PlanInfo,
    V3Money? DeathBenefit,
    IReadOnlyList<V3PricingRow> Pricing,
    IReadOnlyDictionary<string, object?> Metadata,
    V3Money? Budget = null
);

/// <summary>
/// Payload of the <c>data</c> field on the v3 prequalify envelope.
///
/// Always a flat <see cref="Plans"/> list — single amount and multi-amount
/// alike. Group client-side by the requested dimension with
/// <see cref="V3Grouping.ByAmount"/> (DeathBenefit for face-amount requests,
/// Budget for monthly-budget requests); the shape never changes with the
/// amount count.
/// </summary>
public sealed record PrequalifyV3Result(
    IReadOnlyList<V3Offer> Plans,
    string RequestId,
    string IdempotencyKey,
    bool Livemode,
    int RetryAttempts
);

/// <summary>
/// Payload of the <c>data</c> field on the v3 quote envelope — the identical
/// flat <see cref="Plans"/> shape as <see cref="PrequalifyV3Result"/>.
/// </summary>
public sealed record QuoteV3Result(
    IReadOnlyList<V3Offer> Plans,
    string RequestId,
    string IdempotencyKey,
    bool Livemode,
    int RetryAttempts
);

/// <summary>Client-side grouping helpers for a flat v3 <c>plans[]</c> list.</summary>
public static class V3Grouping
{
    /// <summary>
    /// Group a flat plans list by the requested coverage dimension. When any
    /// offer carries a <c>Budget</c> (a monthly-budget response) the offers key
    /// off <c>Budget.Amount.Cents</c>; otherwise off
    /// <c>DeathBenefit.Amount.Cents</c> (a face-amount response). Grouping
    /// preserves items within each bucket; callers must not rely on key
    /// enumeration order (Dictionary does not guarantee it).
    ///
    /// In budget mode, an offer missing <c>Budget</c> is skipped (contract
    /// violation) rather than falling back to DeathBenefit, which would
    /// mis-bucket mixed offers. In face-amount mode, an offer with a
    /// <c>null</c> DeathBenefit (a medsup product, which has no face amount) is
    /// likewise skipped — it has no face-amount dimension to group on.
    /// </summary>
    public static IReadOnlyDictionary<long, IReadOnlyList<V3Offer>> ByAmount(
        IReadOnlyList<V3Offer> plans)
    {
        var isBudget = plans.Any(static p => p.Budget is not null);
        var grouped = new Dictionary<long, List<V3Offer>>();
        var order = new List<long>();
        foreach (var offer in plans)
        {
            var dimension = isBudget ? offer.Budget : offer.DeathBenefit;
            // Budget mode: missing budget is a contract violation. Face-amount
            // mode: a null DeathBenefit is a medsup product with no face-amount
            // dimension. Either way there is nothing to group on, so skip.
            if (dimension is null)
            {
                continue;
            }
            var key = dimension.Amount.Cents;
            if (!grouped.TryGetValue(key, out var bucket))
            {
                bucket = new List<V3Offer>();
                grouped[key] = bucket;
                order.Add(key);
            }
            bucket.Add(offer);
        }
        var result = new Dictionary<long, IReadOnlyList<V3Offer>>();
        foreach (var key in order)
        {
            result[key] = grouped[key];
        }
        return result;
    }

    /// <summary>
    /// The premium facade for an offer — the <see cref="V3Premium"/> of the
    /// single <c>Primary</c> (best-qualifying) pricing row, or <c>null</c> when
    /// the offer has no qualifying row (every row ineligible, or the rare
    /// eligible row whose carrier returned no priceable mode). This is the one
    /// premium a list UI shows per product without walking
    /// <see cref="V3Offer.Pricing"/>.
    /// </summary>
    public static V3Premium? OfferPremium(V3Offer offer)
    {
        foreach (var row in offer.Pricing)
        {
            if (row.Primary)
            {
                return row.Premium;
            }
        }
        return null;
    }
}

/// <summary>Options layered on top of the v3 prequalify / quote request.</summary>
public sealed record PrequalifyV3Options(
    string? OnlyProductClass = null,
    IReadOnlyList<string>? IncludeProductClass = null,
    string? MinRank = null,
    bool? ShowUnreleased = null,
    bool? SkipHealthBasedUnderwriting = null,
    bool? IncludeIneligible = null
);

/// <summary>Inputs accepted by <c>PrequalifyV3SubClient.RunAsync</c>.</summary>
public sealed record PrequalifyV3Request(
    Applicant Applicant,
    Coverage Coverage,
    IReadOnlyList<Product> Products,
    PrequalifyV3Options? Options = null
);

/// <summary>Options for the v3 quote endpoint. Same shape as the prequalify options.</summary>
public sealed record QuoteV3Options(
    string? OnlyProductClass = null,
    IReadOnlyList<string>? IncludeProductClass = null,
    string? MinRank = null,
    bool? ShowUnreleased = null,
    bool? SkipHealthBasedUnderwriting = null,
    bool? IncludeIneligible = null
);

/// <summary>Inputs accepted by <c>QuoteV3SubClient.RunAsync</c>.</summary>
public sealed record QuoteV3Request(
    Applicant Applicant,
    Coverage Coverage,
    IReadOnlyList<Product> Products,
    QuoteV3Options? Options = null
);

// ── Sub-client surface contracts ──────────────────────────────────────────────

/// <summary>Surface for <c>POST /v3/prequalify</c>.</summary>
public interface IPrequalifyV3Service
{
    /// <summary>Run a v3 prequalify call.</summary>
    Task<PrequalifyV3Result> RunAsync(PrequalifyV3Request input, CancellationToken ct = default);
}

/// <summary>Surface for <c>POST /v3/quote</c>.</summary>
public interface IQuoteV3Service
{
    /// <summary>Run a v3 quote call.</summary>
    Task<QuoteV3Result> RunAsync(QuoteV3Request input, CancellationToken ct = default);
}

// ── Implementation ────────────────────────────────────────────────────────────

/// <summary>Sub-client for the v3 prequalify endpoint.</summary>
public sealed class PrequalifyV3SubClient : IPrequalifyV3Service
{
    private const string Path = "/v3/prequalify";

    private readonly OperationContext _ctx;
    private readonly Func<string>? _idempotencyKeyFactory;

    internal PrequalifyV3SubClient(OperationContext ctx, Func<string>? idempotencyKeyFactory = null)
    {
        _ctx = ctx;
        _idempotencyKeyFactory = idempotencyKeyFactory;
    }

    /// <inheritdoc/>
    public Task<PrequalifyV3Result> RunAsync(PrequalifyV3Request input, CancellationToken ct = default) =>
        RunAsync(input, idempotencyKey: null, ct);

    /// <summary>Run a v3 prequalify call with an explicit idempotency key (UUID v4 expected).</summary>
    public async Task<PrequalifyV3Result> RunAsync(PrequalifyV3Request input, string? idempotencyKey, CancellationToken ct = default)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        var key = ResolveIdempotencyKey(idempotencyKey);
        // v3 prequalify takes the `PrequalifyV3Request` envelope shape
        // (applicant + coverage + products[]) — NOT the v2 flat shape
        // /v3/quote still consumes via `SerializeRequest`. Send
        // `Api-Version: v3` so server routing is unambiguous even when
        // a transport-layer middleware rewrites the URL.
        var body = V3WireBuilder.SerializeV3PrequalifyBody(input.Applicant, input.Coverage, input.Products, V3WireBuilder.OptionsToCommon(input.Options));
        var response = await V3Dispatcher.PostAsync(_ctx, Path, body, key, apiVersion: "v3", ct).ConfigureAwait(false);
        return V3ResponseParser.ParsePrequalify(response.Body, key, V3WireBuilder.RetryAttemptsFromHeaders(response.Headers));
    }

    private string ResolveIdempotencyKey(string? explicitKey)
    {
        if (!string.IsNullOrWhiteSpace(explicitKey)) return explicitKey!;
        return _idempotencyKeyFactory?.Invoke() ?? V3WireBuilder.MintUuidV4();
    }
}
