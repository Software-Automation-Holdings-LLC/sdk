// `isa.Account.Cases` — case CRUD + share over /v1/case.
//
//   create  → POST   /v1/case
//   get     → GET    /v1/case/{id}
//   list    → GET    /v1/case
//   email   → POST   /v1/case/{id}/email
using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Sah.Sdk.Zyins;

namespace Sah.Sdk.Account;

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
}
