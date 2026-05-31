// Per-row JSON parsers for the four v3 datasets.
//
// Each parser is defensive: missing required fields (<c>id</c>,
// <c>name</c>) cause the row to be skipped (returns null). Missing
// optional relations (<c>treated_with</c>, <c>used_for</c>) fall back to
// empty arrays. Server-supplied sort order is preserved verbatim — the
// SDK never re-sorts.
using System.Collections.Generic;
using System.Text.Json;

namespace Isa.Sdk.Zyins;

internal static class RowParsers
{
    private const string FieldId = "id";
    private const string FieldName = "name";
    private const string FieldType = "type";
    private const string FieldFrom = "from";
    private const string FieldTo = "to";
    private const string FieldTreatedWith = "treated_with";
    private const string FieldUsedFor = "used_for";
    private const string FieldPrescriptionCount = "prescription_count";

    public static ConditionRow? ParseCondition(JsonElement raw)
    {
        if (!TryRequiredString(raw, FieldId, out var id)) return null;
        if (!TryRequiredString(raw, FieldName, out var name)) return null;
        var treatedWith = ParseInlineMeds(raw);
        return new ConditionRow(id, name, treatedWith);
    }

    public static MedicationRow? ParseMedication(JsonElement raw)
    {
        if (!TryRequiredString(raw, FieldId, out var id)) return null;
        if (!TryRequiredString(raw, FieldName, out var name)) return null;
        var usedFor = ParseInlineConds(raw);
        return new MedicationRow(id, name, usedFor);
    }

    public static NicotineOptionRow? ParseNicotineOption(JsonElement raw)
    {
        if (!TryRequiredString(raw, FieldId, out var id)) return null;
        if (!TryRequiredString(raw, FieldName, out var name)) return null;
        var type = raw.TryGetProperty(FieldType, out var t) && t.ValueKind == JsonValueKind.String
            ? t.GetString() ?? string.Empty
            : string.Empty;
        return new NicotineOptionRow(id, name, type);
    }

    public static SpellingCorrectionRow? ParseSpellingCorrection(JsonElement raw)
    {
        if (!TryRequiredString(raw, FieldId, out var id)) return null;
        if (!TryRequiredString(raw, FieldFrom, out var from)) return null;
        if (!TryRequiredString(raw, FieldTo, out var to)) return null;
        return new SpellingCorrectionRow(id, from, to);
    }

    private static IReadOnlyList<InlineMedicationRef> ParseInlineMeds(JsonElement row)
    {
        if (!row.TryGetProperty(FieldTreatedWith, out var arr) || arr.ValueKind != JsonValueKind.Array)
        {
            return System.Array.Empty<InlineMedicationRef>();
        }
        var list = new List<InlineMedicationRef>(arr.GetArrayLength());
        foreach (var el in arr.EnumerateArray())
        {
            if (el.ValueKind != JsonValueKind.Object) continue;
            if (!TryRequiredString(el, FieldId, out var id)) continue;
            if (!TryRequiredString(el, FieldName, out var name)) continue;
            var pc = ReadPrescriptionCount(el);
            list.Add(new InlineMedicationRef(id, name, pc));
        }
        return list;
    }

    private static IReadOnlyList<InlineConditionRef> ParseInlineConds(JsonElement row)
    {
        if (!row.TryGetProperty(FieldUsedFor, out var arr) || arr.ValueKind != JsonValueKind.Array)
        {
            return System.Array.Empty<InlineConditionRef>();
        }
        var list = new List<InlineConditionRef>(arr.GetArrayLength());
        foreach (var el in arr.EnumerateArray())
        {
            if (el.ValueKind != JsonValueKind.Object) continue;
            if (!TryRequiredString(el, FieldId, out var id)) continue;
            if (!TryRequiredString(el, FieldName, out var name)) continue;
            var pc = ReadPrescriptionCount(el);
            list.Add(new InlineConditionRef(id, name, pc));
        }
        return list;
    }

    private static int ReadPrescriptionCount(JsonElement el)
    {
        return el.TryGetProperty(FieldPrescriptionCount, out var pcE)
            && pcE.ValueKind == JsonValueKind.Number
            && pcE.TryGetInt32(out var pc)
            ? pc
            : 0;
    }

    private static bool TryRequiredString(JsonElement obj, string field, out string value)
    {
        if (obj.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String)
        {
            value = v.GetString() ?? string.Empty;
            return value.Length > 0;
        }
        value = string.Empty;
        return false;
    }
}
