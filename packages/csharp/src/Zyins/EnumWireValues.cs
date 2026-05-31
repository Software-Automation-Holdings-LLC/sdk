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

    /// <summary>Returns every wire string the server accepts for
    /// <see cref="ProductType"/>.</summary>
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
}
