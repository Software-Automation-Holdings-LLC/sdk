// `isa.Account.Email` — POST /v1/email/enqueue.
//
// Transactional email enqueue. `To` accepts a single address or a list.
// `Attachments` is optional; each entry carries the filename and base64-
// encoded content verbatim — encoding is the caller's responsibility so
// binary payloads (PDFs) do not pay the cost of a UTF-8 round-trip.
using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Zyins;

namespace Isa.Sdk.Account;

/// <summary>One attachment in an email-enqueue request.</summary>
public sealed record EmailAttachment
{
    /// <summary>Attachment filename.</summary>
    [JsonPropertyName("filename")] public string Filename { get; init; } = string.Empty;
    /// <summary>Base64-encoded content. Caller encodes; SDK passes through.</summary>
    [JsonPropertyName("content")] public string Content { get; init; } = string.Empty;
}

/// <summary>Inputs for <see cref="AccountEmail.EnqueueAsync"/>.</summary>
public sealed record EmailEnqueueRequest
{
    /// <summary>Recipient address(es). The single string overload uses
    /// <see cref="ToList"/> with one entry; populate either field, not both.</summary>
    [JsonIgnore] public string? To { get; init; }

    /// <summary>Multiple recipients (server treats as a multi-send).</summary>
    [JsonIgnore] public IReadOnlyList<string>? ToList { get; init; }

    /// <summary>Email subject line.</summary>
    [JsonPropertyName("subject")] public string Subject { get; init; } = string.Empty;

    /// <summary>Body — server treats as HTML when content looks like HTML, else text.</summary>
    [JsonPropertyName("body")] public string Body { get; init; } = string.Empty;

    /// <summary>Optional attachments (each Content is pre-base64-encoded by caller).</summary>
    [JsonPropertyName("attachments")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<EmailAttachment>? Attachments { get; init; }

    /// <summary>Wire field — set by the SDK from <see cref="To"/> or <see cref="ToList"/>.</summary>
    [JsonPropertyName("to")]
    public object ToWire
    {
        get
        {
            var recipients = AccountEmail.NormalizeRecipients(this);
            return ToList is null && recipients.Count == 1 ? recipients[0] : recipients;
        }
    }
}

/// <summary>Result of <see cref="AccountEmail.EnqueueAsync"/>.</summary>
public sealed record EmailEnqueueResult
{
    /// <summary>Normalized to <c>"queued"</c> on success.</summary>
    [JsonPropertyName("status")] public string Status { get; init; } = "queued";
}

/// <summary>`isa.Account.Email` facade.</summary>
public sealed class AccountEmail
{
    private const string Path = "/v1/email/enqueue";
    private readonly AccountContext _ctx;

    internal AccountEmail(AccountContext ctx) => _ctx = ctx;

    /// <summary>Enqueue a transactional email.</summary>
    public Task<EmailEnqueueResult> EnqueueAsync(EmailEnqueueRequest request, CancellationToken ct = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        var recipients = NormalizeRecipients(request);
        if (recipients.Count == 0)
            throw new ArgumentException("account: email.enqueue requires at least one recipient", nameof(request));
        if (string.IsNullOrEmpty(request.Subject))
            throw new ArgumentException("account: email.enqueue requires a subject", nameof(request));
        if (request.Body is null)
            throw new ArgumentException("account: email.enqueue requires a body", nameof(request));
        var op = _ctx.RequireOp();
        return HttpDispatcher.PostJsonEnvelopeAsync<EmailEnqueueRequest, EmailEnqueueResult>(
            op, Path, request, "email.enqueue", ct);
    }

    internal static IReadOnlyList<string> NormalizeRecipients(EmailEnqueueRequest r)
    {
        if (r.ToList is { Count: > 0 })
        {
            var keep = new List<string>(r.ToList.Count);
            foreach (var x in r.ToList)
            {
                if (!string.IsNullOrEmpty(x)) keep.Add(x);
            }
            return keep;
        }
        if (!string.IsNullOrEmpty(r.To)) return new[] { r.To! };
        return Array.Empty<string>();
    }
}
