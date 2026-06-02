// Wire-value helpers for the ZyINS enum types.
//
// C# enums are integer constants at runtime; the custom JSON converters in
// JsonSerialization.cs own the actual wire strings.  This file is the single
// source of truth that maps each C# enum to the string set the wire contract
// requires, making the conformance enum-parity harness possible without
// reflection hacks.
//
// Each All*WireValues() method must stay in sync with its corresponding
// JsonConverter switch expression.  The conformance test catches drift.

namespace Isa.Sdk.Zyins;

/// <summary>Wire-value accessors used by the conformance enum-parity harness.
/// Production code should not depend on these; they exist purely for testing.
/// </summary>
public static class EnumWireValues
{
    /// <summary>Returns every wire string the server accepts for
    /// <see cref="Sex"/>.</summary>
    public static IReadOnlyList<string> AllSexValues() =>
        new[] { "female", "male" };

    /// <summary>Returns every wire string the server accepts for
    /// <see cref="NicotineUsage"/>.</summary>
    public static IReadOnlyList<string> AllNicotineUsageValues() =>
        new[] { "current", "former", "none" };

    /// <summary>Returns every wire string the server accepts for
    /// <see cref="NicotineDuration"/>.</summary>
    public static IReadOnlyList<string> AllNicotineDurationValues() =>
        new[]
        {
            "never",
            "within_12_months",
            "12_to_24_months",
            "24_to_36_months",
            "36_to_48_months",
            "48_to_60_months",
            "over_60_months",
        };

    /// <summary>Returns every wire string the server accepts as a product type
    /// (e.g. <c>final_expense</c>, <c>term</c>, <c>medicare_supplement</c>,
    /// <c>whole_life</c>). These are the full wire values, not the short class
    /// shorthands like <c>fex</c> or <c>medsup</c>.</summary>
    public static IReadOnlyList<string> AllProductTypeValues() =>
        new[]
        {
            "final_expense",
            "indexed",
            "medicare_supplement",
            "term",
            "universal",
            "whole_life",
        };

    /// <summary>Returns every wire string the server accepts for
    /// <see cref="Coverage"/>.</summary>
    public static IReadOnlyList<string> AllCoverageTypeValues() =>
        new[] { "face_value", "monthly_budget" };

    /// <summary>Returns the wire string for a <see cref="V3EligibilityCategory"/>
    /// value — the exact JSON string the server emits and the test fixture records.
    /// Mirrors the switch in <c>V3Internal.CoerceEligibility</c> so the mapping
    /// is a single source of truth across parse and format.
    /// <para><b>internal</b>: consumed only by the cross-SDK equivalence test via
    /// <c>InternalsVisibleTo("Isa.Sdk.Tests")</c> — deliberately kept off the public
    /// surface (this PR adds no public API).</para></summary>
    internal static string EligibilityCategoryWireValue(V3EligibilityCategory category) =>
        category switch
        {
            V3EligibilityCategory.Immediate => "immediate",
            V3EligibilityCategory.Graded    => "graded",
            V3EligibilityCategory.Rop       => "rop",
            V3EligibilityCategory.Other     => "other",
            _                               => throw new ArgumentOutOfRangeException(
                nameof(category), category, "Unknown V3EligibilityCategory"),
        };
}
