// Canonical session-signing helper.
//
// Produces the four headers the ISA Platform session verifier admits
// (shared/go/auth/session/verifier.go):
//
//   Authorization:    Bearer <sessionSecret>
//   X-Isa-Session-Id: <sessionId>
//   X-Isa-Timestamp:  <iso8601_z>
//   X-Isa-Signature:  hex(HMAC-SHA256(sessionSecret, canonical))
//
// The canonical string is byte-identical to session.CanonicalString in
// the Go server package:
//
//   <METHOD>\n<path>\n<hex(sha256(body))>\n<timestamp>\n<sessionId>
//
// No trailing newline. The Go ground truth pins the bytes both sides
// hash; this helper mirrors it for SDK-side signing.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Sah.Sdk.Core;

/// <summary>
/// The four headers emitted by <see cref="SignRequest.Sign(string,string,byte[],string,string,IClock)"/>.
/// </summary>
public sealed record SignedHeaders(
    string Authorization,
    string IsaSessionId,
    string IsaTimestamp,
    string IsaSignature)
{
    /// <summary>Canonical header name for the bearer credential.</summary>
    public const string AuthorizationHeader = "Authorization";
    /// <summary>Canonical header name for the session identifier.</summary>
    public const string IsaSessionIdHeader = "X-Isa-Session-Id";
    /// <summary>Canonical header name for the request timestamp.</summary>
    public const string IsaTimestampHeader = "X-Isa-Timestamp";
    /// <summary>Canonical header name for the per-request HMAC signature.</summary>
    public const string IsaSignatureHeader = "X-Isa-Signature";

    /// <summary>Return the headers as a case-insensitive dictionary.</summary>
    public IReadOnlyDictionary<string, string> AsDictionary()
    {
        var dict = new Dictionary<string, string>(4, StringComparer.OrdinalIgnoreCase);
        dict[AuthorizationHeader] = Authorization;
        dict[IsaSessionIdHeader] = IsaSessionId;
        dict[IsaTimestampHeader] = IsaTimestamp;
        dict[IsaSignatureHeader] = IsaSignature;
        return dict;
    }
}

/// <summary>
/// Canonical session-signing helper. Pure static methods; injectable
/// clock via <see cref="IClock"/>.
/// </summary>
public static class SignRequest
{
    private const string EmptyBodySha256Hex =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    private const string BearerScheme = "Bearer";

    /// <summary>Format <paramref name="now"/> as RFC 3339 UTC with a <c>Z</c>
    /// suffix and no fractional seconds. Matches Go's <c>time.RFC3339</c>
    /// rendering for whole-second instants.</summary>
    public static string FormatTimestamp(DateTimeOffset now)
    {
        return now.ToUniversalTime().ToString(
            "yyyy-MM-ddTHH:mm:ssZ",
            CultureInfo.InvariantCulture);
    }

    /// <summary>Build the canonical signing string. Pure; exported for
    /// cross-SDK byte-parity tests.</summary>
    public static string CanonicalString(
        string method,
        string path,
        byte[]? body,
        string timestamp,
        string sessionId)
    {
        var bodyHashHex = body is null || body.Length == 0
            ? EmptyBodySha256Hex
            : ComputeSha256Hex(body);
        var parts = new[]
        {
            method.ToUpperInvariant(),
            path,
            bodyHashHex,
            timestamp,
            sessionId,
        };
        return string.Join("\n", parts);
    }

    /// <summary>Compute the canonical session-auth headers for one request.</summary>
    /// <param name="method">HTTP method (uppercased internally).</param>
    /// <param name="path">Request path including query string.</param>
    /// <param name="body">Raw request body bytes (may be null or empty).</param>
    /// <param name="sessionId">Session identifier (<c>sess_…</c>).</param>
    /// <param name="sessionSecret">HMAC key; travels in Authorization.</param>
    /// <param name="clock">Injectable clock; defaults to <see cref="SystemClock.Instance"/>.</param>
    public static SignedHeaders Sign(
        string method,
        string path,
        byte[]? body,
        string sessionId,
        string sessionSecret,
        IClock? clock = null)
    {
        if (string.IsNullOrEmpty(sessionId))
        {
            throw new ArgumentException(
                "SignRequest: sessionId must be a non-empty string",
                nameof(sessionId));
        }
        if (string.IsNullOrEmpty(sessionSecret))
        {
            throw new ArgumentException(
                "SignRequest: sessionSecret must be a non-empty string",
                nameof(sessionSecret));
        }

        var now = (clock ?? SystemClock.Instance).UtcNow();
        var timestamp = FormatTimestamp(now);
        var canonical = CanonicalString(method, path, body, timestamp, sessionId);
        var signature = ComputeHmacSha256Hex(sessionSecret, canonical);

        return new SignedHeaders(
            Authorization: BearerScheme + " " + sessionSecret,
            IsaSessionId: sessionId,
            IsaTimestamp: timestamp,
            IsaSignature: signature);
    }

    /// <summary>Convenience overload that accepts the body as a UTF-8 string.</summary>
    public static SignedHeaders Sign(
        string method,
        string path,
        string body,
        string sessionId,
        string sessionSecret,
        IClock? clock = null)
    {
        var bytes = string.IsNullOrEmpty(body)
            ? Array.Empty<byte>()
            : Encoding.UTF8.GetBytes(body);
        return Sign(method, path, bytes, sessionId, sessionSecret, clock);
    }

    private static string ComputeSha256Hex(byte[] body)
    {
        using var sha = SHA256.Create();
        return ToLowerHex(sha.ComputeHash(body));
    }

    private static string ComputeHmacSha256Hex(string secret, string message)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return ToLowerHex(hmac.ComputeHash(Encoding.UTF8.GetBytes(message)));
    }

    private static string ToLowerHex(byte[] bytes)
    {
        const string hex = "0123456789abcdef";
        var chars = new char[bytes.Length * 2];
        for (var i = 0; i < bytes.Length; i++)
        {
            chars[i * 2] = hex[bytes[i] >> 4];
            chars[i * 2 + 1] = hex[bytes[i] & 0x0F];
        }
        return new string(chars);
    }
}
