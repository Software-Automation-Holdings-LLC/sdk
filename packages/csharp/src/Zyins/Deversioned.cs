// De-versioned canonical SDK surface.
//
// The public call site is unversioned: a consumer writes PrequalifyRequest /
// QuoteRequest and calls client.Prequalify / client.Quote, and the SDK routes
// to whichever /vN the bundled version table (or a per-instance pin) selects
// for that surface. The wire version never leaks into the symbol a consumer
// types — see api/guides/api-version-pinning.md.
//
// The canonical (unversioned) names are the real types — PrequalifyRequest,
// QuoteRequest, PrequalifyOptions, QuoteOptions, Grouping, IsaClientOptions.
// The previously-shipped V3-suffixed names remain valid for source
// compatibility as [Obsolete] forwarders: the *Request / *Options records
// derive from their canonical bases (so an instance is assignable to the
// canonical type RunAsync accepts), and ZyInsClientOptions derives from
// IsaClientOptions.

using System.Collections.Generic;
using Product = global::Isa.Sdk.Catalog.Product;

namespace Isa.Sdk.Zyins;

/// <summary>Deprecated alias for <see cref="PrequalifyRequest"/>.</summary>
[Obsolete("Use PrequalifyRequest; the unversioned request type routes per the bundled version table.")]
public sealed record PrequalifyV3Request(
    Applicant Applicant,
    Coverage Coverage,
    IReadOnlyList<Product> Products,
    PrequalifyOptions? Options = null
) : PrequalifyRequest(Applicant, Coverage, Products, Options);

/// <summary>Deprecated alias for <see cref="QuoteRequest"/>.</summary>
[Obsolete("Use QuoteRequest; the unversioned request type routes per the bundled version table.")]
public sealed record QuoteV3Request(
    Applicant Applicant,
    Coverage Coverage,
    IReadOnlyList<Product> Products,
    QuoteOptions? Options = null
) : QuoteRequest(Applicant, Coverage, Products, Options);

/// <summary>Deprecated alias for <see cref="PrequalifyOptions"/>.</summary>
[Obsolete("Use PrequalifyOptions.")]
public sealed record PrequalifyV3Options(
    string? OnlyProductClass = null,
    IReadOnlyList<string>? IncludeProductClass = null,
    string? MinRank = null,
    bool? ShowUnreleased = null,
    bool? SkipHealthBasedUnderwriting = null,
    bool? IncludeIneligible = null
) : PrequalifyOptions(OnlyProductClass, IncludeProductClass, MinRank, ShowUnreleased, SkipHealthBasedUnderwriting, IncludeIneligible);

/// <summary>Deprecated alias for <see cref="QuoteOptions"/>.</summary>
[Obsolete("Use QuoteOptions.")]
public sealed record QuoteV3Options(
    string? OnlyProductClass = null,
    IReadOnlyList<string>? IncludeProductClass = null,
    string? MinRank = null,
    bool? ShowUnreleased = null,
    bool? SkipHealthBasedUnderwriting = null,
    bool? IncludeIneligible = null
) : QuoteOptions(OnlyProductClass, IncludeProductClass, MinRank, ShowUnreleased, SkipHealthBasedUnderwriting, IncludeIneligible);

/// <summary>Deprecated alias for <see cref="Grouping"/>.</summary>
[Obsolete("Use Grouping.")]
public static class V3Grouping
{
    /// <summary>Forwards to <see cref="Grouping.ByAmount"/>.</summary>
    public static IReadOnlyDictionary<long, IReadOnlyList<V3Offer>> ByAmount(IReadOnlyList<V3Offer> plans) =>
        Grouping.ByAmount(plans);

    /// <summary>Forwards to <see cref="Grouping.OfferPremium"/>.</summary>
    public static V3Premium? OfferPremium(V3Offer offer) =>
        Grouping.OfferPremium(offer);
}

/// <summary>Deprecated alias for <see cref="IsaClientOptions"/>.</summary>
[Obsolete("Use IsaClientOptions.")]
public sealed record ZyInsClientOptions : IsaClientOptions;
