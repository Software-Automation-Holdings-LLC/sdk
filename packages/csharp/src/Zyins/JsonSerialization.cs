// JSON serialization for the ZyINS wire format. The wire format is
// snake_case; C# properties are PascalCase. The snake-case naming
// policy + two custom enum converters handle the mapping.
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sah.Sdk.Zyins;

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

/// <summary>Sex serialized as the single-letter wire code (<c>M</c>/<c>F</c>).</summary>
internal sealed class SexJsonConverter : JsonConverter<Sex>
{
    public override Sex Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetString() switch
        {
            "M" => Sex.Male,
            "F" => Sex.Female,
            var s => throw new JsonException($"unexpected sex wire code: {s}"),
        };

    public override void Write(Utf8JsonWriter writer, Sex value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value == Sex.Male ? "M" : "F");
}

/// <summary>Nicotine usage serialized as lowercase enum name.</summary>
internal sealed class NicotineUsageJsonConverter : JsonConverter<NicotineUsage>
{
    public override NicotineUsage Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetString() switch
        {
            "none" => NicotineUsage.None,
            "current" => NicotineUsage.Current,
            "former" => NicotineUsage.Former,
            var s => throw new JsonException($"unexpected nicotine usage: {s}"),
        };

    public override void Write(Utf8JsonWriter writer, NicotineUsage value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value switch
        {
            NicotineUsage.None => "none",
            NicotineUsage.Current => "current",
            NicotineUsage.Former => "former",
            _ => throw new ArgumentOutOfRangeException(nameof(value)),
        });
}

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
