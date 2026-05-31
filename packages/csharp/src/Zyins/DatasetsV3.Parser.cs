// Inline-row parser for <c>GET /v3/datasets</c>. Defensive but never
// lossy. Unknown dataset names are skipped; missing optional fields
// fall back to safe defaults (empty arrays, name = empty string).
//
// Lives in a separate file so <c>DatasetsV3.cs</c> stays focused on the
// HTTP plumbing and the parser stays focused on the wire shape.
using System;
using System.Collections.Generic;
using System.Text.Json;

namespace Isa.Sdk.Zyins;

internal static class DatasetsV3Parser
{
    private const string DatasetConditions = "conditions";
    private const string DatasetMedications = "medications";
    private const string DatasetNicotineOptions = "nicotine_options";
    private const string DatasetSpellingCorrections = "spelling_corrections";

    // Int64CeilingAsDouble is 2^63 — the smallest double strictly greater than
    // long.MaxValue (which is not representable as a double and rounds up to
    // this value). Used as a strict upper bound when coercing an integer-valued
    // float epoch to long, so a value at-or-above it is rejected rather than
    // overflowing the cast.
    private const double Int64CeilingAsDouble = 9223372036854775808.0;

    public static DatasetBundleV3 ParseEnvelope(string body, string? etag)
    {
        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(body);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException(
                "ZyIns GET /v3/datasets: invalid JSON response body: " + ex.Message, ex);
        }
        using (doc)
        {
            var root = doc.RootElement;
            var data = root.ValueKind == JsonValueKind.Object
                && root.TryGetProperty("data", out var d)
                && d.ValueKind == JsonValueKind.Object
                ? d
                : root;
            return ParseData(data, etag);
        }
    }

    private static DatasetBundleV3 ParseData(JsonElement data, string? etag)
    {
        var catalogVersion = data.TryGetProperty("catalog_version", out var cv)
            && cv.ValueKind == JsonValueKind.String
                ? cv.GetString() ?? string.Empty
                : string.Empty;

        var conditions = EmptyDataset<ConditionRow>();
        var medications = EmptyDataset<MedicationRow>();
        var nicotineOptions = EmptyDataset<NicotineOptionRow>();
        var spellingCorrections = EmptyDataset<SpellingCorrectionRow>();

        if (data.TryGetProperty("datasets", out var ds) && ds.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in ds.EnumerateObject())
            {
                switch (prop.Name)
                {
                    case DatasetConditions:
                        conditions = ParseDataset(prop.Value, RowParsers.ParseCondition);
                        break;
                    case DatasetMedications:
                        medications = ParseDataset(prop.Value, RowParsers.ParseMedication);
                        break;
                    case DatasetNicotineOptions:
                        nicotineOptions = ParseDataset(prop.Value, RowParsers.ParseNicotineOption);
                        break;
                    case DatasetSpellingCorrections:
                        spellingCorrections = ParseDataset(prop.Value, RowParsers.ParseSpellingCorrection);
                        break;
                }
            }
        }
        return new DatasetBundleV3(
            CatalogVersion: catalogVersion,
            Conditions: conditions,
            Medications: medications,
            NicotineOptions: nicotineOptions,
            SpellingCorrections: spellingCorrections,
            Etag: etag,
            ProductsByFamily: ParseProductsByFamily(data),
            DiscontinuedProducts: ParseDiscontinuedProducts(data),
            StateDerivatives: ParseStateDerivatives(data));
    }

    // ParseProductsByFamily returns a non-null map in every case — an absent,
    // null, or explicitly-empty field all yield an empty map. The TS/Python/PHP
    // parsers surface both the omitted and the explicit-empty case as a present
    // empty collection, so returning null here would diverge. A family whose
    // value is not a JSON array is skipped entirely (no phantom key), matching
    // those parsers. Consumers range over the map without a null branch.
    private static IReadOnlyDictionary<string, IReadOnlyList<ProductRef>> ParseProductsByFamily(JsonElement data)
    {
        var outMap = new Dictionary<string, IReadOnlyList<ProductRef>>();
        if (!data.TryGetProperty("products_by_family", out var raw) || raw.ValueKind != JsonValueKind.Object)
        {
            return outMap;
        }
        foreach (var family in raw.EnumerateObject())
        {
            if (family.Value.ValueKind != JsonValueKind.Array)
            {
                continue;
            }
            var entities = new List<ProductRef>();
            foreach (var it in family.Value.EnumerateArray())
            {
                if (it.ValueKind != JsonValueKind.Object) continue;
                var id = it.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String
                    ? idEl.GetString()
                    : null;
                var name = it.TryGetProperty("name", out var nameEl) && nameEl.ValueKind == JsonValueKind.String
                    ? nameEl.GetString()
                    : null;
                // A row is valid iff it carries a non-empty id — the opaque
                // contract key. name is display enrichment the server may
                // leave blank or absent, so a missing/non-string name defaults
                // to "" and keeps the row. Matches the Go/TypeScript/Python/PHP
                // mirrors; only a row with no id is dropped.
                if (id is { Length: > 0 })
                {
                    entities.Add(new ProductRef(id, name ?? string.Empty));
                }
            }
            outMap[family.Name] = entities;
        }
        return outMap;
    }

    // ParseDiscontinuedProducts returns a non-null map in every case — same
    // always-present empty-collection contract as ParseProductsByFamily,
    // matching the TS/Python/PHP parsers.
    private static IReadOnlyDictionary<string, long> ParseDiscontinuedProducts(JsonElement data)
    {
        var outMap = new Dictionary<string, long>();
        if (!data.TryGetProperty("discontinued_products", out var raw) || raw.ValueKind != JsonValueKind.Object)
        {
            return outMap;
        }
        foreach (var prop in raw.EnumerateObject())
        {
            if (TryIntegerEpoch(prop.Value, out var epoch))
            {
                outMap[prop.Name] = epoch;
            }
        }
        return outMap;
    }

    // TryIntegerEpoch coerces a discontinued-product value to an integer
    // unix-epoch second. long, not int — unix epoch seconds overflow Int32
    // in 2038. Accepts integer-valued numbers in any JSON notation
    // (1700000000, 1700000000.0, 1.7e9) and rejects genuine fractionals
    // (1700000000.5). TryGetInt64 covers plain integer notation; the
    // GetDouble fallback covers integer-valued floats — System.Text.Json's
    // TryGetInt64 returns false for any number carrying a '.' or exponent.
    // Mirrors the Go/TS/Python/PHP epoch parsers, which all keep
    // integer-valued floats and drop fractionals.
    private static bool TryIntegerEpoch(JsonElement value, out long epoch)
    {
        epoch = 0;
        if (value.ValueKind != JsonValueKind.Number)
        {
            return false;
        }
        if (value.TryGetInt64(out epoch))
        {
            return true;
        }
        // Out-of-range guard. The upper bound is a strict `<`: (double)long.MaxValue
        // rounds up to 2^63, so a value at-or-above that threshold overflows the
        // (long)d cast. Int64CeilingAsDouble == 2^63 is the smallest double
        // strictly greater than long.MaxValue. Mirrors Go's float64Int64Ceiling.
        if (value.TryGetDouble(out var d) && !double.IsInfinity(d) && Math.Truncate(d) == d
            && d >= long.MinValue && d < Int64CeilingAsDouble)
        {
            epoch = (long)d;
            return true;
        }
        return false;
    }

    // ParseStateDerivatives returns a non-null list in every case — same
    // always-present empty-collection contract as ParseProductsByFamily,
    // matching the TS/Python/PHP parsers.
    private static IReadOnlyList<string> ParseStateDerivatives(JsonElement data)
    {
        var outList = new List<string>();
        if (!data.TryGetProperty("state_derivatives", out var raw) || raw.ValueKind != JsonValueKind.Array)
        {
            return outList;
        }
        foreach (var it in raw.EnumerateArray())
        {
            if (it.ValueKind == JsonValueKind.String && it.GetString() is { } s)
            {
                outList.Add(s);
            }
        }
        return outList;
    }

    private static DatasetEntry<TRow> ParseDataset<TRow>(JsonElement raw, RowParser<TRow> rowParser)
    {
        if (raw.ValueKind != JsonValueKind.Object) return EmptyDataset<TRow>();
        var version = raw.TryGetProperty("version", out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? string.Empty
            : string.Empty;
        var items = new List<TRow>();
        if (raw.TryGetProperty("items", out var its) && its.ValueKind == JsonValueKind.Array)
        {
            foreach (var it in its.EnumerateArray())
            {
                if (it.ValueKind != JsonValueKind.Object) continue;
                var parsed = rowParser(it);
                if (parsed is not null) items.Add(parsed);
            }
        }
        var itemCount = raw.TryGetProperty("item_count", out var ic)
            && ic.ValueKind == JsonValueKind.Number
            && ic.TryGetInt32(out var parsedCount)
            ? parsedCount
            : items.Count;
        return new DatasetEntry<TRow>(version, itemCount, items);
    }

    private static DatasetEntry<TRow> EmptyDataset<TRow>() =>
        new(Version: string.Empty, ItemCount: 0, Items: Array.Empty<TRow>());

    internal delegate TRow? RowParser<TRow>(JsonElement raw);
}
