// Branding / Preferences / Cases / Email sub-clients.
//
// All four target zyins.isaapi.com endpoints, matching the design-doc
// decision (docs/design/cases-email-branding-surface.md sec B.2) to
// namespace these surfaces under zyins.* since that's where the data
// lives.

using System.Text.Json;
using System.Text.Json.Serialization;
using Isa.Sdk.Core;
using Isa.Sdk.Zyins.Cases;

namespace Isa.Sdk.Zyins;

// =====================================================================
// Branding
// =====================================================================

/// <summary>Whitelabel branding detail returned by
/// <see cref="BrandingSubClient.LookupAsync"/>. Zero-valued when no row
/// exists; the server intentionally does not 404.</summary>
public sealed record BrandingDetail
{
    [JsonPropertyName("imo_name")] public string ImoName { get; init; } = string.Empty;
    [JsonPropertyName("imo_logo")] public string ImoLogo { get; init; } = string.Empty;
    [JsonPropertyName("nav_color")] public string NavColor { get; init; } = string.Empty;
    [JsonPropertyName("main_color")] public string MainColor { get; init; } = string.Empty;
    [JsonPropertyName("button_color")] public string ButtonColor { get; init; } = string.Empty;
    [JsonPropertyName("active_button_color")] public string ActiveButtonColor { get; init; } = string.Empty;
    [JsonPropertyName("bg_color")] public string BgColor { get; init; } = string.Empty;
    [JsonPropertyName("header_text_color")] public string HeaderTextColor { get; init; } = string.Empty;

    /// <summary>The handler ships either a JSON bool or the legacy
    /// "true"/"1" string. <see cref="FlexBoolConverter"/> normalizes.</summary>
    [JsonPropertyName("hide_affiliate_leads")]
    [JsonConverter(typeof(FlexBoolConverter))]
    public bool HideAffiliateLeads { get; init; }

    [JsonPropertyName("prevent_product_selection")]
    [JsonConverter(typeof(FlexBoolConverter))]
    public bool PreventProductSelection { get; init; }

    [JsonPropertyName("default_settings")] public string DefaultSettings { get; init; } = string.Empty;
}

internal sealed class FlexBoolConverter : JsonConverter<bool>
{
    public override bool Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType switch
        {
            JsonTokenType.True => true,
            JsonTokenType.False => false,
            JsonTokenType.String => reader.GetString() is "true" or "1",
            JsonTokenType.Null => false,
            _ => false,
        };

    public override void Write(Utf8JsonWriter writer, bool value, JsonSerializerOptions options) =>
        writer.WriteBooleanValue(value);
}

/// <summary>Sub-client for whitelabel branding lookup.</summary>
public sealed class BrandingSubClient
{
    private const string LookupPath = "/v1/branding";
    private readonly OperationContext _ctx;
    internal BrandingSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Fetch the whitelabel branding for the caller's license.</summary>
    public Task<BrandingDetail> LookupAsync(CancellationToken ct = default) =>
        HttpDispatcher.GetAsync<BrandingDetail>(_ctx, LookupPath, ct: ct);
}

// =====================================================================
// Preferences
// =====================================================================

/// <summary>Input for <see cref="PreferencesSubClient.SetAsync"/>.</summary>
public sealed record PreferencesSetRequest
{
    /// <summary>Opaque preferences document. Required.</summary>
    [JsonPropertyName("prefs")]
    public IReadOnlyDictionary<string, object?> Prefs { get; init; } =
        new Dictionary<string, object?>();
}

/// <summary>Result of <see cref="PreferencesSubClient.LookupAsync"/> /
/// <see cref="PreferencesSubClient.SetAsync"/>.</summary>
public sealed record PreferencesResult
{
    [JsonPropertyName("prefs")]
    public IReadOnlyDictionary<string, object?> Prefs { get; init; } =
        new Dictionary<string, object?>();
}

/// <summary>Sub-client for preferences lookup + upsert.</summary>
public sealed class PreferencesSubClient
{
    private const string Path = "/v1/preferences";
    private readonly OperationContext _ctx;
    internal PreferencesSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Fetch the caller's preferences document.</summary>
    public Task<PreferencesResult> LookupAsync(CancellationToken ct = default) =>
        HttpDispatcher.GetAsync<PreferencesResult>(_ctx, Path, ct: ct);

    /// <summary>Upsert the caller's preferences document.</summary>
    public Task<PreferencesResult> SetAsync(PreferencesSetRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (request.Prefs is null)
            throw new ArgumentException("Prefs must be non-null", nameof(request));
        return HttpDispatcher.PostJsonEnvelopeAsync<PreferencesSetRequest, PreferencesResult>(
            _ctx, Path, request, "preferences.set", ct);
    }
}

// =====================================================================
// Cases
// =====================================================================

/// <summary>Input for <see cref="CasesSubClient.CreateAsync"/>. <c>Input</c>
/// is polymorphic at the wire — a structured object is converted to XML
/// server-side; a string is treated as raw XML.</summary>
public sealed record CaseCreateRequest
{
    /// <summary>Quote input — structured payload or raw XML string. Required.</summary>
    [JsonPropertyName("input")] public object Input { get; init; } = default!;

    /// <summary>Optional quote results.</summary>
    [JsonPropertyName("results")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Results { get; init; }

    /// <summary>Optional list of product identifiers.</summary>
    [JsonPropertyName("products")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? Products { get; init; }
}

/// <summary>Result of <see cref="CasesSubClient.CreateAsync"/>.</summary>
public sealed record CaseCreateResult
{
    [JsonPropertyName("object")] public string Object { get; init; } = "case";
    [JsonPropertyName("hash")] public string Hash { get; init; } = string.Empty;
    [JsonPropertyName("url")] public string Url { get; init; } = string.Empty;
    [JsonPropertyName("readonly")] public bool Readonly { get; init; }
    [JsonPropertyName("created_at")] public string CreatedAt { get; init; } = string.Empty;
}

/// <summary>Sub-client for case create + share, plus the locked
/// top-level <see cref="SaveAsync"/> / <see cref="RecallAsync"/>
/// surface backed by a pluggable
/// <see cref="global::Isa.Sdk.Zyins.Cases.ICaseStorage"/> adapter.</summary>
public sealed class CasesSubClient
{
    private const string CreatePath = "/v1/case";
    private readonly OperationContext _ctx;
    private readonly EmailSubClient _email;
    private readonly ICaseStorage _caseStorage;
    internal CasesSubClient(OperationContext ctx, EmailSubClient email, ICaseStorage caseStorage)
    {
        _ctx = ctx;
        _email = email;
        _caseStorage = caseStorage ?? throw new ArgumentNullException(nameof(caseStorage));
    }

    /// <summary>Create a shareable case from quote input + results + products.</summary>
    /// <remarks>Deprecated: use <see cref="ShareAsync"/> — the canonical
    /// verb per the locked SDK syntax (TS canon: <c>isa.zyins.cases.share</c>).
    /// This alias is retained for one minor and will be removed in v0.7.0.</remarks>
    public Task<CaseCreateResult> CreateAsync(CaseCreateRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (request.Input is null)
            throw new ArgumentException("Input must be non-null", nameof(request));
        if (request.Input is string s && string.IsNullOrWhiteSpace(s))
            throw new ArgumentException("Input must be non-empty", nameof(request));
        return HttpDispatcher.PostJsonEnvelopeAsync<CaseCreateRequest, CaseCreateResult>(
            _ctx, CreatePath, request, "cases.create", ct);
    }

    /// <summary>Create (share) a shareable case. Canonical verb per the
    /// locked SDK syntax (TS canon: <c>isa.zyins.cases.share</c>);
    /// equivalent to <see cref="CreateAsync"/>, which is retained as a
    /// deprecated alias.</summary>
    public Task<CaseCreateResult> ShareAsync(CaseCreateRequest request, CancellationToken ct = default)
        => CreateAsync(request, ct);

    /// <summary>Email a case-share payload — delegates to <see cref="EmailSubClient.EnqueueAsync"/>.</summary>
    public Task<EmailEnqueueResult> EmailAsync(EmailEnqueueRequest request, CancellationToken ct = default) =>
        _email.EnqueueAsync(request, ct);

    /// <summary>Persist a case record through the configured
    /// <see cref="global::Isa.Sdk.Zyins.Cases.ICaseStorage"/> adapter.
    /// Defaults to the unwired
    /// <see cref="global::Isa.Sdk.Zyins.Cases.ZeroKnowledgeCaseStorage"/>
    /// singleton — pass <c>ZyInsClientOptions.CaseStorage</c> to wire a
    /// transport.</summary>
    public Task<PutResult> SaveAsync(
        CaseRecord record,
        CancellationToken ct = default)
    {
        if (record is null) throw new ArgumentNullException(nameof(record));
        return _caseStorage.PutAsync(record, ct);
    }

    /// <summary>Retrieve a previously-persisted case record. The
    /// <paramref name="recallToken"/> is required by zero-knowledge
    /// adapters and ignored by server-side adapters.</summary>
    public Task<CaseRecord?> RecallAsync(
        string id,
        string? recallToken = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("id must be non-empty", nameof(id));
        return _caseStorage.GetAsync(id, recallToken, ct);
    }
}

// =====================================================================
// Email
// =====================================================================

/// <summary>Optional attachment for <see cref="EmailEnqueueRequest"/>.</summary>
public sealed record EmailAttachment
{
    [JsonPropertyName("filename")] public string Filename { get; init; } = string.Empty;
    [JsonPropertyName("content_base64")] public string ContentBase64 { get; init; } = string.Empty;
}

/// <summary>Input for <see cref="EmailSubClient.EnqueueAsync"/>.</summary>
public sealed record EmailEnqueueRequest
{
    [JsonPropertyName("to")] public string To { get; init; } = string.Empty;
    [JsonPropertyName("subject")] public string Subject { get; init; } = string.Empty;
    [JsonPropertyName("body_html")] public string BodyHtml { get; init; } = string.Empty;
    [JsonPropertyName("attachment")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public EmailAttachment? Attachment { get; init; }
}

/// <summary>Result of <see cref="EmailSubClient.EnqueueAsync"/>.</summary>
public sealed record EmailEnqueueResult
{
    [JsonPropertyName("enqueue_id")] public string EnqueueId { get; init; } = string.Empty;
}

/// <summary>Sub-client for transactional email enqueue.</summary>
public sealed class EmailSubClient
{
    private const string EnqueuePath = "/v1/email/enqueue";
    private readonly OperationContext _ctx;
    internal EmailSubClient(OperationContext ctx) => _ctx = ctx;

    /// <summary>Enqueue a transactional email for delivery.</summary>
    public Task<EmailEnqueueResult> EnqueueAsync(EmailEnqueueRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.To))
            throw new ArgumentException("To must be non-empty", nameof(request));
        return HttpDispatcher.PostJsonEnvelopeAsync<EmailEnqueueRequest, EmailEnqueueResult>(
            _ctx, EnqueuePath, request, "email.enqueue", ct);
    }
}
