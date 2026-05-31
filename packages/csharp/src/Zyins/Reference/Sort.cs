// `Isa.Sdk.Zyins.Reference.Sort` — namespaced sort enum for `IConcept`
// accessors. Mirrors the canonical TS `Sort` in
// `packages/ts/src/zyins/reference.ts`.
//
// String-backed via System.Text.Json so the on-wire / conformance value
// stays `most_common_first` / `alphabetical`, identical to the TS, Go,
// Python, and PHP SDKs. No asc/desc, no closures, no string aliases —
// new sort orders ship as new enum members.

using System;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Sort order for <see cref="IConcept"/>.<see cref="IConcept.Conditions"/> /
/// <see cref="IConcept.Medications"/> accessors.</summary>
[JsonConverter(typeof(SortJsonConverter))]
public enum Sort
{
    /// <summary>Descending prescription frequency from
    /// <c>frequency_graphs.use_map</c>. Default.</summary>
    MostCommonFirst = 0,

    /// <summary>Alphabetical (invariant culture) by display name.</summary>
    Alphabetical = 1,
}

/// <summary>String-backed converter so JSON emits
/// <c>"most_common_first"</c> / <c>"alphabetical"</c> rather than the
/// integer ordinal. Keeps wire parity with the TS / PHP / Python / Go
/// SDKs.</summary>
internal sealed class SortJsonConverter : JsonConverter<Sort>
{
    private const string MostCommonFirstWire = "most_common_first";
    private const string AlphabeticalWire = "alphabetical";

    public override Sort Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType != JsonTokenType.String)
        {
            throw new JsonException($"Sort: expected string token, got {reader.TokenType}");
        }
        var value = reader.GetString();
        return value switch
        {
            MostCommonFirstWire => Sort.MostCommonFirst,
            AlphabeticalWire => Sort.Alphabetical,
            _ => throw new JsonException($"Sort: unknown wire value '{value}'"),
        };
    }

    public override void Write(Utf8JsonWriter writer, Sort value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value switch
        {
            Sort.MostCommonFirst => MostCommonFirstWire,
            Sort.Alphabetical => AlphabeticalWire,
            _ => throw new JsonException($"Sort: unmapped enum value {(int)value}"),
        });
    }
}
