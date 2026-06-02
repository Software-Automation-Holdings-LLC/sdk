// `isa.Account.Cases` — case CRUD + share over /v1/case.
//
//   create  → POST   /v1/case
//   get     → GET    /v1/case/{id}
//   list    → GET    /v1/case
//   email   → POST   /v1/case/{id}/email
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Zyins;

namespace Isa.Sdk.Account;

/// <summary>Inputs for <see cref="AccountCases.CreateAsync"/>. <c>Input</c> is
/// polymorphic at the wire — a structured object is converted to XML
/// server-side; a raw XML string is forwarded verbatim.</summary>
public sealed record CaseCreateRequest
{
    /// <summary>Quote input — structured payload or raw XML string. Required.</summary>
    [JsonPropertyName("input")] public object Input { get; init; } = default!;

    /// <summary>Optional quote results payload.</summary>
    [JsonPropertyName("results")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Results { get; init; }

    /// <summary>Optional product selection (list of product identifiers).</summary>
    [JsonPropertyName("products")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? Products { get; init; }
}

/// <summary>Result of <see cref="AccountCases.CreateAsync"/>.</summary>
public sealed record CaseCreateResult
{
    /// <summary>Content-addressed case identifier.</summary>
    [JsonPropertyName("hash")] public string Hash { get; init; } = string.Empty;
    /// <summary>Absolute share URL for the case viewer.</summary>
    [JsonPropertyName("url")] public string Url { get; init; } = string.Empty;
    /// <summary>True when the case was created by another license (read-only here).</summary>
    [JsonPropertyName("readonly")] public bool Readonly { get; init; }
    /// <summary>RFC 3339 timestamp the case was first created.</summary>
    [JsonPropertyName("created_at")] public string CreatedAt { get; init; } = string.Empty;
}

/// <summary>A case as returned by <c>GetAsync</c> / <c>ListAsync</c>.</summary>
public sealed record CaseSummary
{
    /// <summary>Content-addressed case identifier.</summary>
    [JsonPropertyName("hash")] public string Hash { get; init; } = string.Empty;
    /// <summary>Absolute share URL.</summary>
    [JsonPropertyName("url")] public string Url { get; init; } = string.Empty;
    /// <summary>True when the caller does not own the case.</summary>
    [JsonPropertyName("readonly")] public bool Readonly { get; init; }
    /// <summary>RFC 3339 timestamp.</summary>
    [JsonPropertyName("created_at")] public string CreatedAt { get; init; } = string.Empty;
    /// <summary>Optional original input (server returns when caller owns the case).</summary>
    [JsonPropertyName("input")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Input { get; init; }
    /// <summary>Optional results payload.</summary>
    [JsonPropertyName("results")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Results { get; init; }
    /// <summary>Optional product selection.</summary>
    [JsonPropertyName("products")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<string>? Products { get; init; }
}

/// <summary>Inputs for <see cref="AccountCases.EmailAsync"/>.</summary>
public sealed record CaseEmailRequest
{
    /// <summary>Case identifier (hash).</summary>
    [JsonIgnore] public string CaseId { get; init; } = string.Empty;
    /// <summary>Recipient email.</summary>
    [JsonPropertyName("to")] public string To { get; init; } = string.Empty;
}

/// <summary>Result of <see cref="AccountCases.EmailAsync"/>.</summary>
public sealed record CaseEmailResult
{
    /// <summary>True when the email was queued.</summary>
    [JsonPropertyName("queued")] public bool Queued { get; init; } = true;
}

/// <summary>Inputs for <see cref="AccountCases.ShareAsync"/> — the
/// zero-knowledge share path.</summary>
public sealed record CaseShareRequest
{
    /// <summary>Routing tag stored cleartext and bound as AEAD data during encryption.</summary>
    public string Product { get; init; } = string.Empty;
    /// <summary>Arbitrary JSON payload, encrypted client-side before it leaves the SDK.</summary>
    public object? Payload { get; init; }
}

/// <summary>Result of <see cref="AccountCases.ShareAsync"/>: the server-assigned
/// case id and the assembled share link.</summary>
public sealed record CaseShareResult
{
    /// <summary>Server-assigned case id.</summary>
    public string Id { get; init; } = string.Empty;
    /// <summary>Full share link <c>{viewer}/&lt;id&gt;#k=&lt;base64url(key)&gt;</c>.</summary>
    public string Link { get; init; } = string.Empty;
}

/// <summary>A decrypted case returned by <see cref="AccountCases.OpenAsync"/>.</summary>
public sealed record CaseOpenResult
{
    /// <summary>Routing tag the case was created under.</summary>
    public string Product { get; init; } = string.Empty;
    /// <summary>The decrypted payload.</summary>
    public JsonElement Payload { get; init; }
}

/// <summary>Wire body for the zero-knowledge case create: cleartext product
/// tag alongside the opaque envelope fields.</summary>
internal sealed record CaseShareWire
{
    [JsonPropertyName("product")] public string Product { get; init; } = string.Empty;
    [JsonPropertyName("ciphertext")] public string Ciphertext { get; init; } = string.Empty;
    [JsonPropertyName("iv")] public string Iv { get; init; } = string.Empty;
    [JsonPropertyName("tag")] public string Tag { get; init; } = string.Empty;
}

/// <summary>Server response to a case create — only the assigned id is read.</summary>
internal sealed record CaseShareCreatedWire
{
    [JsonPropertyName("id")] public string Id { get; init; } = string.Empty;
}

/// <summary>Server response to a case GET — the product tag + opaque envelope.</summary>
internal sealed record CaseDetailWire
{
    [JsonPropertyName("product")] public string Product { get; init; } = string.Empty;
    [JsonPropertyName("ciphertext")] public string Ciphertext { get; init; } = string.Empty;
    [JsonPropertyName("iv")] public string Iv { get; init; } = string.Empty;
    [JsonPropertyName("tag")] public string Tag { get; init; } = string.Empty;
}

/// <summary>`isa.Account.Cases` facade.</summary>
public sealed class AccountCases
{
    private const string CasesPath = "/v1/case";
    private readonly AccountContext _ctx;

    internal AccountCases(AccountContext ctx) => _ctx = ctx;

    /// <summary>Create a shareable case from quote input + results + products.</summary>
    public Task<CaseCreateResult> CreateAsync(CaseCreateRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (request.Input is null)
            throw new ArgumentException("account: cases.create requires input", nameof(request));
        if (request.Input is string s && string.IsNullOrWhiteSpace(s))
            throw new ArgumentException("account: cases.create requires non-empty input", nameof(request));
        var op = _ctx.RequireOp();
        return HttpDispatcher.PostJsonEnvelopeAsync<CaseCreateRequest, CaseCreateResult>(
            op, CasesPath, request, "cases.create", ct);
    }

    /// <summary>Retrieve a single case by hash.</summary>
    public Task<CaseSummary> GetAsync(string caseId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(caseId))
            throw new ArgumentException("account: cases.get requires a non-empty caseId", nameof(caseId));
        var op = _ctx.RequireOp();
        return HttpDispatcher.GetAsync<CaseSummary>(op, $"{CasesPath}/{Uri.EscapeDataString(caseId)}", ct: ct);
    }

    /// <summary>List all cases visible to the caller.</summary>
    public Task<IReadOnlyList<CaseSummary>> ListAsync(CancellationToken ct = default)
    {
        var op = _ctx.RequireOp();
        return HttpDispatcher.GetAsync<IReadOnlyList<CaseSummary>>(op, CasesPath, ct: ct);
    }

    /// <summary>Email a case PDF / artifact to a recipient.</summary>
    public Task<CaseEmailResult> EmailAsync(CaseEmailRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.CaseId))
            throw new ArgumentException("account: cases.email requires a non-empty caseId", nameof(request));
        if (string.IsNullOrWhiteSpace(request.To))
            throw new ArgumentException("account: cases.email requires a non-empty to address", nameof(request));
        var op = _ctx.RequireOp();
        var path = $"{CasesPath}/{Uri.EscapeDataString(request.CaseId)}/email";
        return HttpDispatcher.PostJsonEnvelopeAsync<CaseEmailRequest, CaseEmailResult>(
            op, path, request, "cases.email", ct);
    }

    /// <summary>Encrypt a payload client-side, store the opaque envelope via
    /// <c>POST /v1/case</c>, and return the fragment-keyed share link. The
    /// decryption key never reaches the server. The returned link is a value
    /// and nothing else — never logged, never attached to a thrown error.</summary>
    public async Task<CaseShareResult> ShareAsync(CaseShareRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrEmpty(request.Product))
            throw new ArgumentException("account: cases.share requires a product", nameof(request));
        if (request.Payload is null)
            throw new ArgumentException("account: cases.share requires a payload", nameof(request));
        var op = _ctx.RequireOp();
        var encrypted = _ctx.CaseCrypto.Encrypt(request.Product, request.Payload);
        var wire = new CaseShareWire
        {
            Product = request.Product,
            Ciphertext = encrypted.Envelope.Ciphertext,
            Iv = encrypted.Envelope.Iv,
            Tag = encrypted.Envelope.Tag,
        };
        var created = await HttpDispatcher
            .PostJsonEnvelopeAsync<CaseShareWire, CaseShareCreatedWire>(op, CasesPath, wire, "cases.share", ct)
            .ConfigureAwait(false);
        if (string.IsNullOrEmpty(created.Id))
            throw new InvalidOperationException("account: cases.share response missing id");
        return new CaseShareResult
        {
            Id = created.Id,
            Link = CaseLink.Assemble(_ctx.CaseViewerBaseUrl, created.Id, encrypted.KeyFragment),
        };
    }

    /// <summary>Resolve a share link: parse the code + fragment key, fetch the
    /// opaque envelope via <c>GET /v1/case/{code}</c>, and decrypt locally. The
    /// key comes only from the link the caller already holds.</summary>
    public async Task<CaseOpenResult> OpenAsync(string link, CancellationToken ct = default)
    {
        var parsed = CaseLink.Parse(link);
        var op = _ctx.RequireOp();
        var detail = await HttpDispatcher
            .GetAsync<CaseDetailWire>(op, $"{CasesPath}/{Uri.EscapeDataString(parsed.Code)}", ct: ct)
            .ConfigureAwait(false);
        if (string.IsNullOrEmpty(detail.Product))
            throw new InvalidOperationException("account: cases.open response missing product");
        var envelope = new CaseEnvelope
        {
            Ciphertext = detail.Ciphertext,
            Iv = detail.Iv,
            Tag = detail.Tag,
        };
        var payload = _ctx.CaseCrypto.Decrypt(detail.Product, envelope, parsed.KeyFragment);
        return new CaseOpenResult { Product = detail.Product, Payload = payload };
    }
}
