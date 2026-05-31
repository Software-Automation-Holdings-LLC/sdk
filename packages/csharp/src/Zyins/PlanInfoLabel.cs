// Title Case label derivation + typed plan-info item. Mirrors
// packages/ts/src/zyins/planInfoLabel.ts and the Python / Go / PHP
// SDKs so consumers reading any SDK see identical Title-Case behavior
// for plan-info keys.

using System;
using System.Collections;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Isa.Sdk.Zyins;

/// <summary>
/// One server-canonical entry in a plan's <c>plan_info</c> surface.
///
/// <list type="bullet">
/// <item><c>Key</c> is the stable wire identifier (snake_case).</item>
/// <item><c>Label</c> is the Title Case display string (server-emitted
/// post-zyins#349, synthesized via <see cref="PlanInfoLabel.TitleCase"/>
/// on legacy bodies).</item>
/// <item><c>Values</c> are the URL-decoded value strings in display order.</item>
/// </list>
///
/// Iteration is stable — wire array order is preserved exactly.
/// </summary>
public sealed record PlanInfoItem
{
    public string Key { get; }
    public string Label { get; }
    public IReadOnlyList<string> Values { get; }

    public PlanInfoItem(string key, string label, IReadOnlyList<string> values)
    {
        if (string.IsNullOrEmpty(key))
        {
            throw new ArgumentException("PlanInfoItem: Key must be a non-empty string", nameof(key));
        }
        Key = key;
        Label = label;
        Values = values ?? Array.Empty<string>();
    }
}

/// <summary>
/// Title Case label derivation + plan-info wire coercion helpers.
///
/// Special-cases the canonical acronyms (eApp, URL, PDF, FAQ, API, ID,
/// EFT, ACH, SSN). All other tokens follow the generic "split on `_` /
/// `-`, capitalize each word" rule.
/// </summary>
public static class PlanInfoLabel
{
    private static readonly IReadOnlyDictionary<string, string> SpecialLabels =
        new Dictionary<string, string>
        {
            ["eapp"] = "eApp",
            ["url"] = "URL",
            ["pdf"] = "PDF",
            ["faq"] = "FAQ",
            ["api"] = "API",
            ["id"] = "ID",
            ["eft"] = "EFT",
            ["ach"] = "ACH",
            ["ssn"] = "SSN",
        };

    private static readonly Regex SplitPattern = new("[_\\-]+", RegexOptions.Compiled);

    /// <summary>
    /// Title-Case a snake_case / kebab-case plan-info key.
    /// Empty string in → empty string out.
    /// </summary>
    public static string TitleCase(string key)
    {
        if (string.IsNullOrEmpty(key))
        {
            return string.Empty;
        }
        var parts = SplitPattern.Split(key);
        var output = new List<string>(parts.Length);
        foreach (var part in parts)
        {
            if (part.Length == 0)
            {
                continue;
            }
            output.Add(CapitalizeWord(part));
        }
        return string.Join(" ", output);
    }

    private static string CapitalizeWord(string word)
    {
        if (word.Length == 0)
        {
            return string.Empty;
        }
        var lower = word.ToLowerInvariant();
        if (SpecialLabels.TryGetValue(lower, out var special))
        {
            return special;
        }
        return char.ToUpperInvariant(lower[0]) + lower.Substring(1);
    }

    /// <summary>
    /// Coerce a wire <c>plan_info</c> field into the typed array surface.
    /// Accepts both the post-#349 typed array and the pre-#349 legacy
    /// map shape; returns an empty list on any unrecognized input.
    /// </summary>
    public static IReadOnlyList<PlanInfoItem> Coerce(object? raw)
    {
        switch (raw)
        {
            case JsonElement element:
                return CoerceJsonElement(element);
            case IDictionary map:
                return CoerceLegacyMap(map);
            case IReadOnlyDictionary<string, object?> map:
                return CoerceLegacyMap(map);
            case IEnumerable entries when raw is not string:
                return CoerceTypedArray(entries);
            default:
                return Array.Empty<PlanInfoItem>();
        }
    }

    private static IReadOnlyList<PlanInfoItem> CoerceTypedArray(IEnumerable entries)
    {
        var output = new List<PlanInfoItem>();
        foreach (var entry in entries)
        {
            if (!TryGetMapValue(entry, "key", out var keyObj) || keyObj is not string key || key.Length == 0)
            {
                continue;
            }
            string label;
            if (TryGetMapValue(entry, "label", out var labelObj) && labelObj is string labelRaw && labelRaw.Length > 0)
            {
                label = labelRaw;
            }
            else
            {
                label = TitleCase(key);
            }
            var values = ExtractStringList(TryGetMapValue(entry, "values", out var v) ? v : null);
            output.Add(new PlanInfoItem(key, label, values));
        }
        return output;
    }

    private static bool TryGetMapValue(object? raw, string key, out object? value)
    {
        switch (raw)
        {
            case IReadOnlyDictionary<string, object?> map:
                return map.TryGetValue(key, out value);
            case IDictionary map when map.Contains(key):
                value = map[key];
                return true;
            default:
                value = null;
                return false;
        }
    }

    private static IReadOnlyList<PlanInfoItem> CoerceLegacyMap(IDictionary map)
    {
        var output = new List<PlanInfoItem>(map.Count);
        var keys = new List<string>();
        foreach (var key in map.Keys)
        {
            if (key is string s)
            {
                keys.Add(s);
            }
        }
        keys.Sort(StringComparer.Ordinal);
        foreach (var key in keys)
        {
            if (key.Length == 0)
            {
                continue;
            }
            output.Add(new PlanInfoItem(key, TitleCase(key), ExtractStringList(map[key])));
        }
        return output;
    }

    private static IReadOnlyList<PlanInfoItem> CoerceLegacyMap(IReadOnlyDictionary<string, object?> map)
    {
        var output = new List<PlanInfoItem>(map.Count);
        var keys = new List<string>(map.Keys);
        keys.Sort(StringComparer.Ordinal);
        foreach (var key in keys)
        {
            if (string.IsNullOrEmpty(key))
            {
                continue;
            }
            output.Add(new PlanInfoItem(key, TitleCase(key), ExtractStringList(map[key])));
        }
        return output;
    }

    private static IReadOnlyList<PlanInfoItem> CoerceJsonElement(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Array:
                return CoerceJsonTypedArray(element);
            case JsonValueKind.Object:
                return CoerceJsonLegacyMap(element);
            default:
                return Array.Empty<PlanInfoItem>();
        }
    }

    private static IReadOnlyList<PlanInfoItem> CoerceJsonTypedArray(JsonElement element)
    {
        var output = new List<PlanInfoItem>();
        foreach (var entry in element.EnumerateArray())
        {
            if (entry.ValueKind != JsonValueKind.Object)
            {
                continue;
            }
            if (!entry.TryGetProperty("key", out var keyElement) || keyElement.ValueKind != JsonValueKind.String)
            {
                continue;
            }
            var key = keyElement.GetString() ?? string.Empty;
            if (key.Length == 0)
            {
                continue;
            }
            var label = TitleCase(key);
            if (entry.TryGetProperty("label", out var labelElement) && labelElement.ValueKind == JsonValueKind.String)
            {
                if (labelElement.GetString() is string labelRaw && labelRaw.Length > 0)
                {
                    label = labelRaw;
                }
            }
            var values = entry.TryGetProperty("values", out var valuesElement)
                ? ExtractStringList(valuesElement)
                : Array.Empty<string>();
            output.Add(new PlanInfoItem(key, label, values));
        }
        return output;
    }

    private static IReadOnlyList<PlanInfoItem> CoerceJsonLegacyMap(JsonElement element)
    {
        var output = new List<PlanInfoItem>();
        var keys = new List<string>();
        foreach (var pair in element.EnumerateObject())
        {
            keys.Add(pair.Name);
        }
        keys.Sort(StringComparer.Ordinal);
        foreach (var key in keys)
        {
            if (string.IsNullOrEmpty(key) || !element.TryGetProperty(key, out var value))
            {
                continue;
            }
            output.Add(new PlanInfoItem(key, TitleCase(key), ExtractStringList(value)));
        }
        return output;
    }

    private static IReadOnlyList<string> ExtractStringList(object? raw)
    {
        switch (raw)
        {
            case JsonElement element:
                return ExtractStringList(element);
            case IEnumerable<string> strings:
                return ExtractStringList(strings);
            case IReadOnlyList<object?> list:
                return ExtractStringList(list);
            default:
                return Array.Empty<string>();
        }
    }

    private static IReadOnlyList<string> ExtractStringList(IReadOnlyList<object?> list)
    {
        var output = new List<string>(list.Count);
        foreach (var item in list)
        {
            if (item is string s)
            {
                output.Add(s);
            }
        }
        return output;
    }

    private static IReadOnlyList<string> ExtractStringList(IEnumerable<string> strings)
    {
        var output = new List<string>();
        foreach (var item in strings)
        {
            output.Add(item);
        }
        return output;
    }

    private static IReadOnlyList<string> ExtractStringList(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<string>();
        }
        var output = new List<string>();
        foreach (var item in element.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                var value = item.GetString();
                if (value is not null)
                {
                    output.Add(value);
                }
            }
        }
        return output;
    }
}
