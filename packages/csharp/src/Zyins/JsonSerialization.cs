// JSON serialization for the ZyINS wire format. The wire format is
// snake_case; C# properties are PascalCase. The snake-case naming
// policy + two custom enum converters handle the mapping.
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Isa.Sdk.Zyins;

/// <summary>Naming policy: PascalCase property → snake_case wire field.</summary>
internal sealed class SnakeCaseNamingPolicy : JsonNamingPolicy
{
    public static readonly SnakeCaseNamingPolicy Instance = new();

    public override string ConvertName(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        var sb = new System.Text.StringBuilder(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            var c = name[i];
            if (char.IsUpper(c))
            {
                if (i > 0) sb.Append('_');
                sb.Append(char.ToLowerInvariant(c));
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }
}

/// <summary>Sex serialized as the canonical wire string (<c>male</c>/<c>female</c>) per v0.5.1.</summary>
internal sealed class SexJsonConverter : JsonConverter<Sex>
{
    public override Sex Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetString() switch
        {
            "male"   or "M" => Sex.Male,
            "female" or "F" => Sex.Female,
            var s => throw new JsonException($"unexpected sex wire value: {s}"),
        };

    public override void Write(Utf8JsonWriter writer, Sex value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value == Sex.Male ? "male" : "female");
}

/// <summary>NicotineDuration serialized as its 0.5.1 wire string.</summary>
internal sealed class NicotineDurationJsonConverter : JsonConverter<NicotineDuration>
{
    private static readonly Dictionary<string, NicotineDuration> _read = new()
    {
        ["never"]              = NicotineDuration.Never,
        ["within_12_months"]   = NicotineDuration.Within12Months,
        ["12_to_24_months"]    = NicotineDuration.Months12To24,
        ["24_to_36_months"]    = NicotineDuration.Months24To36,
        ["36_to_48_months"]    = NicotineDuration.Months36To48,
        ["48_to_60_months"]    = NicotineDuration.Months48To60,
        ["over_60_months"]     = NicotineDuration.Over60Months,
    };

    private static readonly string[] _write =
    [
        "never", "within_12_months", "12_to_24_months", "24_to_36_months",
        "36_to_48_months", "48_to_60_months", "over_60_months",
    ];

    public override NicotineDuration Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var s = reader.GetString();
        if (s is not null && _read.TryGetValue(s, out var v)) return v;
        throw new JsonException($"unexpected nicotine_duration wire value: {s}");
    }

    public override void Write(Utf8JsonWriter writer, NicotineDuration value, JsonSerializerOptions options) =>
        writer.WriteStringValue(_write[(int)value]);
}

/// <summary>Nicotine usage serialized as lowercase enum name (legacy converter).</summary>
#pragma warning disable CS0618
internal sealed class NicotineUsageJsonConverter : JsonConverter<NicotineUsage>
{
    public override NicotineUsage Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetString() switch
        {
            "none"    => NicotineUsage.None,
            "current" => NicotineUsage.Current,
            "former"  => NicotineUsage.Former,
            var s => throw new JsonException($"unexpected nicotine usage: {s}"),
        };

    public override void Write(Utf8JsonWriter writer, NicotineUsage value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value switch
        {
            NicotineUsage.None    => "none",
            NicotineUsage.Current => "current",
            NicotineUsage.Former  => "former",
            _ => throw new ArgumentOutOfRangeException(nameof(value)),
        });
}
#pragma warning restore CS0618

/// <summary>Process-wide JSON options for the ZyINS wire format.</summary>
internal static class ZyInsJson
{
    public static readonly JsonSerializerOptions Options = BuildOptions();

    private static JsonSerializerOptions BuildOptions()
    {
        var o = new JsonSerializerOptions
        {
            PropertyNamingPolicy = SnakeCaseNamingPolicy.Instance,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };
        o.Converters.Add(new SexJsonConverter());
        o.Converters.Add(new NicotineDurationJsonConverter());
        o.Converters.Add(new NicotineUsageJsonConverter());
        return o;
    }

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);

    public static T Deserialize<T>(string body)
    {
        var result = JsonSerializer.Deserialize<T>(body, Options);
        if (result is null)
            throw new JsonException($"deserialize of {typeof(T).Name}: body produced null");
        return result;
    }

    public static T DeserializeEnvelope<T>(string body, string context)
    {
        using var doc = JsonDocument.Parse(body);
        if (doc.RootElement.ValueKind == JsonValueKind.Object
            && doc.RootElement.TryGetProperty("data", out var data))
        {
            if (data.ValueKind == JsonValueKind.Null)
                throw new JsonException($"{context}: envelope data was null");
            var result = data.Deserialize<T>(Options);
            if (result is null)
                throw new JsonException($"{context}: envelope data produced null");
            return result;
        }
        return Deserialize<T>(body);
    }
}
