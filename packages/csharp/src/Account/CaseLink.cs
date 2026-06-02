// Zero-knowledge case share-link assembly + parsing, byte-compatible with the
// TypeScript SDK's account/caseWire.ts. The link is the capability: it carries
// the case code in the path and the decryption key in the `#k=` fragment.
// These helpers never log it.
using System;

namespace Isa.Sdk.Account;

/// <summary>A case's code and fragment key, parsed out of a share link.</summary>
public sealed record ParsedLink
{
    /// <summary>The case identifier from the link's last path segment.</summary>
    public string Code { get; init; } = string.Empty;
    /// <summary>The base64url data key from the <c>#k=</c> fragment.</summary>
    public string KeyFragment { get; init; } = string.Empty;
}

/// <summary>Share-link assembly + parsing for the zero-knowledge case store.</summary>
public static class CaseLink
{
    /// <summary>Default share-link viewer origin. The SDK appends
    /// <c>/&lt;code&gt;#k=&lt;key&gt;</c>; the base omits any path segment so a
    /// deployment can point it at any host without re-encoding the path shape.</summary>
    public const string DefaultViewerBaseUrl = "https://link.isaapi.com";

    private const string FragmentKeyPrefix = "#k=";

    /// <summary>Build <c>{base}/&lt;code&gt;#k=&lt;keyFragment&gt;</c>, stripping
    /// a trailing slash on the viewer base. The code is the only path segment
    /// added; any product prefix rides inside the configured base URL.</summary>
    public static string Assemble(string viewerBaseUrl, string code, string keyFragment)
    {
        var trimmed = viewerBaseUrl.TrimEnd('/');
        return $"{trimmed}/{Uri.EscapeDataString(code)}{FragmentKeyPrefix}{keyFragment}";
    }

    /// <summary>Parse a share link into its case code and fragment key. Accepts
    /// both the current single-segment shape (<c>{base}/&lt;code&gt;#k=&lt;key&gt;</c>)
    /// and the legacy <c>{base}/c/&lt;id&gt;#k=&lt;key&gt;</c> shape, so links
    /// shared before the format change keep opening. The code is the last
    /// non-empty path segment.</summary>
    public static ParsedLink Parse(string link)
    {
        if (string.IsNullOrEmpty(link))
            throw new ArgumentException("account: cases.open requires a non-empty link", nameof(link));
        var hashAt = link.IndexOf(FragmentKeyPrefix, StringComparison.Ordinal);
        if (hashAt < 0)
            throw new ArgumentException("account: cases.open link is missing its #k= fragment key", nameof(link));
        var keyFragment = link.Substring(hashAt + FragmentKeyPrefix.Length);
        if (keyFragment.Length == 0)
            throw new ArgumentException("account: cases.open link has an empty #k= fragment key", nameof(link));
        var code = LastPathSegment(link.Substring(0, hashAt));
        if (code.Length == 0)
            throw new ArgumentException("account: cases.open link must carry a case id before #k=<key>", nameof(link));
        return new ParsedLink { Code = Uri.UnescapeDataString(code), KeyFragment = keyFragment };
    }

    private static string LastPathSegment(string path)
    {
        var segments = path.Split('/');
        for (var i = segments.Length - 1; i >= 0; i--)
        {
            if (segments[i].Length > 0) return segments[i];
        }
        return string.Empty;
    }
}
