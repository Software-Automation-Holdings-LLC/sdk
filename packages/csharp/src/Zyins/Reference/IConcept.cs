// `Isa.Sdk.Zyins.Reference.IConcept` — the read-only handle returned by
// every `Reference.*.Match()` call. Mirrors the canonical TS `Concept`
// interface in `packages/ts/src/zyins/reference.ts`.
//
// Locked invariants:
//   - `Match()` never throws on unknown text; the handle's `IsKnown` is
//     `false`, `Id` is `null`, `InputText` is preserved verbatim, and the
//     `Conditions()` / `Medications()` accessors return empty lists.
//   - Symmetric traversal: on a medication handle, `Conditions(sort)`
//     walks the v3 `medications_by_condition` reverse map; on a condition
//     handle, `Medications(sort)` walks the forward map. The handle for
//     the opposite axis returns an empty list — never throws.
//   - `IConcept.Equals(IConcept)` compares on `Id` + `Kind` so case
//     differences in the original input text do not affect handle
//     identity. Unknown handles equal only when both `InputText` values
//     match (no opaque id to compare).

using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Discriminator on an <see cref="IConcept"/>. String-backed via
/// <see cref="ConceptKindJsonConverter"/> so the wire value stays
/// <c>"medication"</c> / <c>"condition"</c> / <c>"unknown"</c>.</summary>
[JsonConverter(typeof(ConceptKindJsonConverter))]
public enum ConceptKind
{
    /// <summary>The handle resolved to a medication entity.</summary>
    Medication = 0,
    /// <summary>The handle resolved to a condition entity.</summary>
    Condition = 1,
    /// <summary>The input text did not match a known catalog entity.</summary>
    Unknown = 2,
}

/// <summary>String-backed wire converter for <see cref="ConceptKind"/>.
/// Keeps parity with the TS, Go, Python, and PHP SDKs.</summary>
internal sealed class ConceptKindJsonConverter : JsonConverter<ConceptKind>
{
    private const string MedicationWire = "medication";
    private const string ConditionWire = "condition";
    private const string UnknownWire = "unknown";

    public override ConceptKind Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.String)
        {
            throw new JsonException($"ConceptKind: expected string token, got {reader.TokenType}");
        }
        var value = reader.GetString();
        return value switch
        {
            MedicationWire => ConceptKind.Medication,
            ConditionWire => ConceptKind.Condition,
            UnknownWire => ConceptKind.Unknown,
            _ => throw new JsonException($"ConceptKind: unknown wire value '{value}'"),
        };
    }

    public override void Write(Utf8JsonWriter writer, ConceptKind value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            ConceptKind.Medication => MedicationWire,
            ConceptKind.Condition => ConditionWire,
            ConceptKind.Unknown => UnknownWire,
            _ => throw new JsonException($"ConceptKind: unmapped enum value {(int)value}"),
        });
    }
}

/// <summary>
/// The handle returned by every <c>Reference.*.Match()</c> call. Never
/// constructed directly — call <c>Match()</c> and inspect the handle.
/// </summary>
/// <remarks>
/// Aliases are intentionally absent from this surface. Aliases are
/// resolved server-side; consumers compare on <see cref="Id"/> (or via
/// <see cref="IEquatable{T}.Equals(T)"/>) instead.
/// </remarks>
public interface IConcept : IEquatable<IConcept>
{
    /// <summary>Opaque entity identifier. Today equals the server-side
    /// <c>MakeKey</c> normalized form (e.g. <c>"HIGHBLOODPRESSURE"</c>).
    /// Treat as a stable opaque token. <c>null</c> when
    /// <see cref="IsKnown"/> is <c>false</c>.</summary>
    string? Id { get; }

    /// <summary>Human-readable display name from the catalog. Falls back
    /// to <see cref="InputText"/> when <see cref="IsKnown"/> is
    /// <c>false</c> so the UI always has something to render.</summary>
    string Name { get; }

    /// <summary>Discriminator. <see cref="ConceptKind.Unknown"/> when
    /// <see cref="IsKnown"/> is <c>false</c>.</summary>
    ConceptKind Kind { get; }

    /// <summary>Whether the input text matched a known catalog entity.</summary>
    bool IsKnown { get; }

    /// <summary>The original input text passed to <c>Match()</c>.
    /// Preserved verbatim — no normalization, no trimming, no
    /// lowercasing.</summary>
    string InputText { get; }

    /// <summary>Conditions associated with this concept. Returns a non-null
    /// empty list on misses, on medication-on-medication traversal, or
    /// when the catalog has no associated conditions. Defaults to
    /// <see cref="Sort.MostCommonFirst"/>.</summary>
    IReadOnlyList<IConditionConcept> Conditions(Sort sort = Sort.MostCommonFirst);

    /// <summary>Medications associated with this concept. Returns a
    /// non-null empty list on misses, on condition-on-condition
    /// traversal, or when the catalog has no associated medications.
    /// Defaults to <see cref="Sort.MostCommonFirst"/>.</summary>
    IReadOnlyList<IMedicationConcept> Medications(Sort sort = Sort.MostCommonFirst);
}

/// <summary>Marker interface — an <see cref="IConcept"/> whose
/// <see cref="IConcept.Kind"/> is statically known to be
/// <see cref="ConceptKind.Medication"/>.</summary>
public interface IMedicationConcept : IConcept
{
}

/// <summary>Marker interface — an <see cref="IConcept"/> whose
/// <see cref="IConcept.Kind"/> is statically known to be
/// <see cref="ConceptKind.Condition"/>.</summary>
public interface IConditionConcept : IConcept
{
}
