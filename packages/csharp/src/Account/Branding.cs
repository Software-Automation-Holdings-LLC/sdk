// `isa.Account.Branding` — GET /v1/branding.
//
// Whitelabel detail for the calling license. The server returns a
// zero-value document when no branding row exists (it does NOT 404), so
// the SDK never synthesizes a "no branding" error — callers receive an
// empty BrandingDetail.
using System;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Sah.Sdk.Zyins;

namespace Sah.Sdk.Account;

/// <summary>Whitelabel detail returned by <see cref="AccountBranding.LookupAsync(CancellationToken)"/>.</summary>
public sealed record BrandingDetail
{
    /// <summary>Display name of the agency.</summary>
    [JsonPropertyName("imo_name")] public string ImoName { get; init; } = string.Empty;
    /// <summary>Absolute URL to the agency logo.</summary>
    [JsonPropertyName("imo_logo")] public string ImoLogo { get; init; } = string.Empty;
    /// <summary>Primary brand color (hex).</summary>
    [JsonPropertyName("primary_color")] public string PrimaryColor { get; init; } = string.Empty;
    /// <summary>Header background color (hex).</summary>
    [JsonPropertyName("nav_color")] public string NavColor { get; init; } = string.Empty;
    /// <summary>Body / content background color (hex).</summary>
    [JsonPropertyName("bg_color")] public string BgColor { get; init; } = string.Empty;
    /// <summary>Button background color (hex).</summary>
    [JsonPropertyName("button_color")] public string ButtonColor { get; init; } = string.Empty;
    /// <summary>Active-state button color (hex).</summary>
    [JsonPropertyName("active_button_color")] public string ActiveButtonColor { get; init; } = string.Empty;
    /// <summary>Header text color (hex).</summary>
    [JsonPropertyName("header_text_color")] public string HeaderTextColor { get; init; } = string.Empty;
    /// <summary>When true, affiliate-lead capture UI is hidden.</summary>
    [JsonPropertyName("hide_affiliate_leads")] public bool HideAffiliateLeads { get; init; }
    /// <summary>When true, product-selection UI is hidden.</summary>
    [JsonPropertyName("prevent_product_selection")] public bool PreventProductSelection { get; init; }
    /// <summary>Opaque per-agency defaults document (JSON or URL-encoded form).</summary>
    [JsonPropertyName("default_settings")] public string DefaultSettings { get; init; } = string.Empty;
}

/// <summary>`isa.Account.Branding` facade.</summary>
public sealed class AccountBranding
{
    private const string Path = "/v1/branding";
    private readonly AccountContext _ctx;

    internal AccountBranding(AccountContext ctx) => _ctx = ctx;

    /// <summary>Fetch the whitelabel branding for the caller's license.
    /// Returns an empty <see cref="BrandingDetail"/> when no row exists.</summary>
    public Task<BrandingDetail> LookupAsync(CancellationToken ct = default) =>
        LookupAsync(source: null, ct);

    /// <summary>Fetch the whitelabel branding with an optional per-vendor
    /// source override (e.g. <c>"mountain-life"</c>). The source value is
    /// forwarded as a query parameter; the server-side allowlist applies.</summary>
    public Task<BrandingDetail> LookupAsync(string? source, CancellationToken ct = default)
    {
        var op = _ctx.RequireOp();
        var query = source is { Length: > 0 }
            ? new System.Collections.Generic.Dictionary<string, string?> { ["source"] = source }
            : null;
        return HttpDispatcher.GetAsync<BrandingDetail>(op, Path, query, ct);
    }
}
