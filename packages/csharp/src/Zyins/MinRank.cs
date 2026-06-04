namespace Isa.Sdk.Zyins;

/// <summary>Minimum guaranteed-issue rank accepted by the server's
/// <c>min_rank</c> filter on prequalify and quote.
///
/// <para>The canonical values are <see cref="Immediate"/>, <see cref="Graded"/>,
/// <see cref="Rop"/>, and <see cref="Guaranteed"/>; <see cref="ReturnOfPremium"/>,
/// <see cref="GuaranteedIssue"/>, and <see cref="Gi"/> are synonyms sharing the
/// canonical lowercase wire token.</para>
///
/// <para>Modeled as <c>const string</c> rather than a C# enum: an int-backed enum
/// cannot carry the wire string, and synonyms that round-trip to the same token
/// cannot be expressed as distinct enum members. The server compares
/// case-insensitively and also tolerates numeric strings, so the option property
/// stays <c>string</c> — these constants are for ergonomics, not a hard gate.</para>
/// </summary>
public static class MinRank
{
    /// <summary>Immediate (full) benefit rank.</summary>
    public const string Immediate = "immediate";

    /// <summary>Graded-benefit rank.</summary>
    public const string Graded = "graded";

    /// <summary>Return-of-premium rank. Canonical; see <see cref="ReturnOfPremium"/>.</summary>
    public const string Rop = "rop";

    /// <summary>Synonym for <see cref="Rop"/>.</summary>
    public const string ReturnOfPremium = "rop";

    /// <summary>Guaranteed-issue rank. Canonical; see <see cref="GuaranteedIssue"/> and <see cref="Gi"/>.</summary>
    public const string Guaranteed = "guaranteed";

    /// <summary>Synonym for <see cref="Guaranteed"/>.</summary>
    public const string GuaranteedIssue = "guaranteed";

    /// <summary>Synonym for <see cref="Guaranteed"/>.</summary>
    public const string Gi = "guaranteed";
}
