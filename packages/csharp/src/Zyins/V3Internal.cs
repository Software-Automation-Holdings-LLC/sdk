// Shared internals for the v3 prequalify + quote sub-clients.
//
// One file owns request body serialization, the POST dispatcher, response
// parsing, and the UUID v4 minter. Both PrequalifyV3 and QuoteV3 funnel
// through here so the wire format lives in one place.

using System;
using System.Buffers;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Isa.Sdk.Core;

namespace Isa.Sdk.Zyins;

/// <summary>Common options surface for the v3 prequalify + quote request bodies.</summary>
internal sealed record V3CommonOptions(
    string? OnlyProductClass,
    IReadOnlyList<string>? IncludeProductClass,
    string? MinRank,
    bool? ShowUnreleased,
    bool? SkipHealthBasedUnderwriting,
    bool? IncludeIneligible
);

internal static class V3WireBuilder
{
    private const string ContentTypeHeader = "Content-Type";
    private const string AcceptHeader = "Accept";
    private const string JsonMediaType = "application/json";
    private const string IdempotencyKeyHeader = "Idempotency-Key";
    private const string RetryAttemptsHeader = "Isa-Retry-Attempts";

    // ── Idempotency key minting (UUID v4) ────────────────────────────────────

    internal static string MintUuidV4()
    {
        var bytes = new byte[16];
#if NET8_0_OR_GREATER
        RandomNumberGenerator.Fill(bytes);
#else
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(bytes);
        }
#endif
        // Version + variant bits per RFC 4122.
        bytes[6] = (byte)((bytes[6] & 0x0f) | 0x40);
        bytes[8] = (byte)((bytes[8] & 0x3f) | 0x80);
        return FormatUuid(bytes);
    }

    private static string FormatUuid(ReadOnlySpan<byte> bytes)
    {
        // Build the hex manually so the byte order on the wire matches the
        // bytes we just generated (every cross-language SDK does this; Guid's
        // binary layout reorders the first three groups on little-endian
        // platforms, which would diverge from the wire format).
        var buf = new char[36];
        var pos = 0;
        for (var i = 0; i < bytes.Length; i++)
        {
            if (i == 4 || i == 6 || i == 8 || i == 10) buf[pos++] = '-';
            var b = bytes[i];
            buf[pos++] = HexLower(b >> 4);
            buf[pos++] = HexLower(b & 0x0f);
        }
        return new string(buf);
    }

    private static char HexLower(int nibble) =>
        (char)(nibble < 10 ? '0' + nibble : 'a' + nibble - 10);

    // ── Options mapping ──────────────────────────────────────────────────────

    internal static V3CommonOptions? OptionsToCommon(PrequalifyV3Options? o) =>
        o is null ? null : new V3CommonOptions(
            o.OnlyProductClass, o.IncludeProductClass, o.MinRank,
            o.ShowUnreleased, o.SkipHealthBasedUnderwriting, o.IncludeIneligible);

    internal static V3CommonOptions? OptionsToCommon(QuoteV3Options? o) =>
        o is null ? null : new V3CommonOptions(
            o.OnlyProductClass, o.IncludeProductClass, o.MinRank,
            o.ShowUnreleased, o.SkipHealthBasedUnderwriting, o.IncludeIneligible);

    // ── Request body serialization ───────────────────────────────────────────
    //
    // The v3 prequalify endpoint accepts the envelope `PrequalifyV3Request`
    // shape (`applicant` + `coverage` + `products[]`) per the OpenAPI spec;
    // `/v3/quote` continues to consume the v2 flat shape. Emitting the
    // flat shape against `/v3/prequalify` produces `unknown field
    // "date_of_birth"` from the zyins server (prod incident, 2026-05-29).
    // `SerializeV3PrequalifyBody` builds the envelope shape;
    // `SerializeRequest` (legacy flat) is retained for `/v3/quote`.

    private const int CentsPerDollar = 100;

    /// <summary>
    /// Serialize the v3 prequalify envelope body per <c>PrequalifyV3Request</c>
    /// in <c>go/zyins/api/openapi.yaml</c>. Coverage serialization is
    /// shape-driven (see <see cref="WriteV3Coverage"/>): a single face amount
    /// sends <c>coverage.face_amount_cents</c> (integer cents, dollar input ×
    /// 100); a multi-amount probe sends <c>coverage.quote_options</c>
    /// (mirroring <c>/v3/quote</c>), satisfying the server's additive
    /// <c>face_amount_cents</c> XOR <c>quote_options</c> contract (zyins #400).
    /// <paramref name="options"/> fields that are not part of the v3 prequalify
    /// envelope (<c>min_rank</c>, <c>show_unreleased</c>,
    /// <c>skip_health_based_underwriting</c>, <c>only_product_class</c>,
    /// <c>include_product_class</c>) are silently dropped; they survive on
    /// <c>/v3/quote</c> via <see cref="SerializeRequest"/>.
    /// </summary>
    internal static string SerializeV3PrequalifyBody(
        Applicant applicant,
        Coverage coverage,
        IReadOnlyList<Product> products,
        V3CommonOptions? options)
    {
        if (applicant is null) throw new ArgumentNullException(nameof(applicant));
        if (coverage is null) throw new ArgumentNullException(nameof(coverage));
        if (products is null) throw new ArgumentNullException(nameof(products));

        using var stream = new System.IO.MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();

            // applicant envelope (ApplicantV3Input)
            writer.WritePropertyName("applicant");
            writer.WriteStartObject();
            writer.WriteString("sex", applicant.Sex == Sex.Male ? "male" : "female");
            writer.WriteString("dob", applicant.Dob);
            writer.WriteNumber("height_inches", applicant.HeightInches);
            writer.WriteNumber("weight_lbs", applicant.WeightPounds);
            if (applicant.Conditions is { Count: > 0 })
            {
                writer.WritePropertyName("conditions");
                writer.WriteStartArray();
                foreach (var c in applicant.Conditions)
                {
                    writer.WriteStartObject();
                    writer.WriteString("text", c.Name);
                    if (!string.IsNullOrEmpty(c.WasDiagnosed))
                        writer.WriteString("was_diagnosed", c.WasDiagnosed);
                    if (!string.IsNullOrEmpty(c.LastTreatment))
                        writer.WriteString("last_treatment", c.LastTreatment);
                    writer.WriteEndObject();
                }
                writer.WriteEndArray();
            }
            if (applicant.Medications is { Count: > 0 })
            {
                writer.WritePropertyName("medications");
                writer.WriteStartArray();
                foreach (var m in applicant.Medications)
                {
                    writer.WriteStartObject();
                    writer.WriteString("text", m.Name);
                    if (!string.IsNullOrEmpty(m.Use)) writer.WriteString("use", m.Use);
                    if (!string.IsNullOrEmpty(m.FirstFill)) writer.WriteString("first_fill", m.FirstFill);
                    if (!string.IsNullOrEmpty(m.LastFill)) writer.WriteString("last_fill", m.LastFill);
                    writer.WriteEndObject();
                }
                writer.WriteEndArray();
            }
            writer.WritePropertyName("nicotine");
            WriteV3NicotineUsage(writer, applicant);
            writer.WriteEndObject();

            // coverage envelope (CoverageV3Input)
            writer.WritePropertyName("coverage");
            WriteV3Coverage(writer, coverage, applicant.State);

            // products[]
            writer.WritePropertyName("products");
            writer.WriteStartArray();
            foreach (var p in products) writer.WriteStringValue(p.Token);
            writer.WriteEndArray();

            // include_ineligible (only option carried into the v3 envelope)
            writer.WriteBoolean("include_ineligible", options?.IncludeIneligible ?? true);

            writer.WriteEndObject();
        }
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    /// <summary>
    /// Write the v3 coverage envelope from the input shape. A single face
    /// amount keeps the proven <c>{face_amount_cents}</c> shape (integer
    /// cents). A single monthly budget and any multi-amount probe ride the
    /// <c>/v3/quote</c> <c>quote_options</c> block — <c>{quote_type, amounts}</c>
    /// — satisfying the server's additive <c>face_amount_cents</c> XOR
    /// <c>quote_options</c> contract (zyins #400). <c>state</c> rides the
    /// envelope in every case.
    /// </summary>
    private static void WriteV3Coverage(Utf8JsonWriter writer, Coverage coverage, string state)
    {
        writer.WriteStartObject();
        if (coverage.IsMulti)
        {
            var faceMulti = coverage.FaceValues.Count > 0;
            var amounts = faceMulti ? coverage.FaceValues : coverage.MonthlyBudgets;
            writer.WritePropertyName("quote_options");
            writer.WriteStartObject();
            writer.WriteString("quote_type", faceMulti ? "face_amounts" : "monthly_budget");
            writer.WritePropertyName("amounts");
            writer.WriteStartArray();
            foreach (var a in amounts) writer.WriteStringValue(a.ToString(CultureInfo.InvariantCulture));
            writer.WriteEndArray();
            writer.WriteEndObject();
            writer.WriteString("state", state);
            writer.WriteEndObject();
            return;
        }
        if (coverage.FaceValue is null)
        {
            // A single monthly budget has no face_amount_cents to express, so
            // it rides the quote_options block with one amount — the same path
            // the server accepts for the multi-amount budget probe.
            var budget = coverage.MonthlyBudget ?? 0;
            writer.WritePropertyName("quote_options");
            writer.WriteStartObject();
            writer.WriteString("quote_type", "monthly_budget");
            writer.WritePropertyName("amounts");
            writer.WriteStartArray();
            writer.WriteStringValue(budget.ToString(CultureInfo.InvariantCulture));
            writer.WriteEndArray();
            writer.WriteEndObject();
            writer.WriteString("state", state);
            writer.WriteEndObject();
            return;
        }
        var faceCents = checked((long)coverage.FaceValue.Value * CentsPerDollar);
        writer.WriteNumber("face_amount_cents", faceCents);
        writer.WriteString("state", state);
        writer.WriteEndObject();
    }

    /// <summary>v3 nicotine frequency wire enum (<c>NicotineFrequencyV3</c>).
    /// Coerces v2-grade strings (<c>DAILY</c>, <c>WEEKLY</c>, ...) the SDK
    /// surface still accepts on <see cref="NicotineProductUsage.Frequency"/>
    /// into valid v3 enum values so v3 callers do not need to know the wire
    /// names.</summary>
    private static string V3NicotineFrequencyWire(string? raw)
    {
        if (string.IsNullOrEmpty(raw)) return "daily";
        return raw switch
        {
            "daily" or "DAILY" => "daily",
            "weekly" or "WEEKLY" or "few_times_per_week" => "few_times_per_week",
            "monthly" or "MONTHLY" or "few_times_per_month" => "few_times_per_month",
            "yearly" or "YEARLY" or "few_times_per_year" => "few_times_per_year",
            _ => "daily",
        };
    }

    private static void WriteV3NicotineUsage(Utf8JsonWriter writer, Applicant applicant)
    {
        writer.WriteStartObject();
        if (applicant.NicotineUse is { } structured)
        {
            writer.WriteString("last_used", NicotineDurationWire(structured.LastUsed));
            if (structured.ProductUsage.Count > 0)
            {
                writer.WritePropertyName("specificity");
                writer.WriteStartArray();
                foreach (var p in structured.ProductUsage)
                {
                    writer.WriteStartObject();
                    writer.WriteString("text", p.Type);
                    writer.WriteString("frequency", V3NicotineFrequencyWire(p.Frequency));
                    writer.WriteEndObject();
                }
                writer.WriteEndArray();
            }
        }
        else
        {
#pragma warning disable CS0618
            var bucket = applicant.NicotineUseLegacy switch
            {
                NicotineUsage.None => "never",
                NicotineUsage.Current => "within_12_months",
                NicotineUsage.Former => "12_to_24_months",
                _ => "never",
            };
#pragma warning restore CS0618
            writer.WriteString("last_used", bucket);
        }
        writer.WriteEndObject();
    }

    internal static string SerializeRequest(
        Applicant applicant,
        Coverage coverage,
        IReadOnlyList<Product> products,
        V3CommonOptions? options)
    {
        if (applicant is null) throw new ArgumentNullException(nameof(applicant));
        if (coverage is null) throw new ArgumentNullException(nameof(coverage));
        if (products is null) throw new ArgumentNullException(nameof(products));

        using var stream = new System.IO.MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteString("date_of_birth", applicant.Dob);
            writer.WriteString("gender", applicant.Sex == Sex.Male ? "male" : "female");
            writer.WriteNumber("height", applicant.HeightInches);
            writer.WriteNumber("weight", applicant.WeightPounds);
            writer.WriteString("state", applicant.State);

            // nicotine_usage
            writer.WritePropertyName("nicotine_usage");
            WriteNicotineUsage(writer, applicant);

            // conditions
            writer.WritePropertyName("conditions");
            writer.WriteStartArray();
            foreach (var c in applicant.Conditions)
            {
                writer.WriteStartObject();
                writer.WriteString("name", c.Name);
                writer.WriteString("wasDiagnosed", c.WasDiagnosed);
                writer.WriteString("lastTreatment", c.LastTreatment);
                writer.WriteEndObject();
            }
            writer.WriteEndArray();

            // medications
            writer.WritePropertyName("medications");
            writer.WriteStartArray();
            foreach (var m in applicant.Medications)
            {
                writer.WriteStartObject();
                writer.WriteString("name", m.Name);
                writer.WriteString("use", m.Use);
                writer.WriteString("firstFill", m.FirstFill);
                writer.WriteString("lastFill", m.LastFill);
                writer.WriteEndObject();
            }
            writer.WriteEndArray();

            // quote_options
            writer.WritePropertyName("quote_options");
            writer.WriteStartObject();
            var useMonthlyBudget = coverage.MonthlyBudget.HasValue;
            var quoteType = useMonthlyBudget ? "monthly_budget" : "face_amounts";
            writer.WriteString("quote_type", quoteType);
            writer.WritePropertyName("amounts");
            writer.WriteStartArray();
            var amountValue = useMonthlyBudget ? coverage.MonthlyBudget : coverage.FaceValue;
            var amount = (amountValue ?? 0).ToString(CultureInfo.InvariantCulture);
            writer.WriteStringValue(amount);
            writer.WriteEndArray();
            writer.WriteEndObject();

            // products
            writer.WritePropertyName("products");
            writer.WriteStartArray();
            foreach (var p in products)
            {
                writer.WriteStringValue(p.Token);
            }
            writer.WriteEndArray();

            // zip (optional)
            if (!string.IsNullOrEmpty(applicant.Zip))
            {
                writer.WriteString("zip", applicant.Zip);
            }

            // options
            var includeIneligibleResolved = options?.IncludeIneligible ?? true;
            if (options is not null)
            {
                if (!string.IsNullOrEmpty(options.OnlyProductClass))
                {
                    writer.WriteString("only_product_class", options.OnlyProductClass);
                }
                if (options.IncludeProductClass is { Count: > 0 })
                {
                    writer.WritePropertyName("include_product_class");
                    writer.WriteStartArray();
                    foreach (var s in options.IncludeProductClass.Distinct())
                    {
                        writer.WriteStringValue(s);
                    }
                    writer.WriteEndArray();
                }
                if (!string.IsNullOrEmpty(options.MinRank))
                {
                    writer.WriteString("min_rank", options.MinRank);
                }
                if (options.ShowUnreleased.HasValue)
                {
                    writer.WriteBoolean("show_unreleased", options.ShowUnreleased.Value);
                }
                if (options.SkipHealthBasedUnderwriting.HasValue)
                {
                    writer.WriteBoolean("skip_health_based_underwriting", options.SkipHealthBasedUnderwriting.Value);
                }
            }
            writer.WriteBoolean("include_ineligible", includeIneligibleResolved);

            writer.WriteEndObject();
        }
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private static void WriteNicotineUsage(Utf8JsonWriter writer, Applicant applicant)
    {
        writer.WriteStartObject();
        if (applicant.NicotineUse is { } structured)
        {
            writer.WriteString("last_used", NicotineDurationWire(structured.LastUsed));
            if (structured.ProductUsage.Count > 0)
            {
                writer.WritePropertyName("product_usage");
                writer.WriteStartArray();
                foreach (var p in structured.ProductUsage)
                {
                    writer.WriteStartObject();
                    writer.WriteString("type", p.Type);
                    writer.WriteString("frequency", p.Frequency);
                    writer.WriteEndObject();
                }
                writer.WriteEndArray();
            }
        }
        else
        {
#pragma warning disable CS0618
            var bucket = applicant.NicotineUseLegacy switch
            {
                NicotineUsage.None => "never",
                NicotineUsage.Current => "within_12_months",
                NicotineUsage.Former => "12_to_24_months",
                _ => "never",
            };
#pragma warning restore CS0618
            writer.WriteString("last_used", bucket);
        }
        writer.WriteEndObject();
    }

    private static string NicotineDurationWire(NicotineDuration d) => d switch
    {
        NicotineDuration.Never => "never",
        NicotineDuration.Within12Months => "within_12_months",
        NicotineDuration.Months12To24 => "12_to_24_months",
        NicotineDuration.Months24To36 => "24_to_36_months",
        NicotineDuration.Months36To48 => "36_to_48_months",
        NicotineDuration.Months48To60 => "48_to_60_months",
        NicotineDuration.Over60Months => "over_60_months",
        _ => "never",
    };

    internal static int RetryAttemptsFromHeaders(IReadOnlyDictionary<string, string> headers)
    {
        foreach (var kv in headers)
        {
            if (string.Equals(kv.Key, RetryAttemptsHeader, StringComparison.OrdinalIgnoreCase))
            {
                return int.TryParse(kv.Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var n) ? n : 0;
            }
        }
        return 0;
    }
}

internal static class V3Dispatcher
{
    private const string ContentTypeHeader = "Content-Type";
    private const string AcceptHeader = "Accept";
    private const string JsonMediaType = "application/json";
    private const string IdempotencyKeyHeader = "Idempotency-Key";

    private const string ApiVersionHeader = "Api-Version";

    internal static Task<TransportResponse> PostAsync(
        OperationContext ctx,
        string path,
        string body,
        string idempotencyKey,
        CancellationToken ct) =>
        PostAsync(ctx, path, body, idempotencyKey, apiVersion: null, ct);

    /// <summary>
    /// POST <paramref name="body"/> to <paramref name="path"/>. When
    /// <paramref name="apiVersion"/> is non-empty, surfaces it as the
    /// <c>Api-Version</c> request header so the server routes
    /// deterministically even if a transport-layer middleware mutates
    /// the URL.
    /// </summary>
    internal static async Task<TransportResponse> PostAsync(
        OperationContext ctx,
        string path,
        string body,
        string idempotencyKey,
        string? apiVersion,
        CancellationToken ct)
    {
        var url = new Uri(ctx.BaseUrl, path);
        var headers = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            [AcceptHeader] = JsonMediaType,
            [ContentTypeHeader] = JsonMediaType,
            [IdempotencyKeyHeader] = idempotencyKey,
        };
        if (!string.IsNullOrEmpty(apiVersion)) headers[ApiVersionHeader] = apiVersion!;
        var request = new TransportRequest(HttpVerb.Post, url, headers, Body: body);
        var signed = ctx.Signer.Sign(request);
        ctx.Logger.LogRequest(signed, attempt: 0);
        var response = await ctx.Transport.SendAsync(signed, ct).ConfigureAwait(false);
        ctx.Logger.LogResponse(signed.Url, response);
        if (response.Status is >= 200 and < 300)
        {
            return response;
        }
        throw ProblemDetailsParser.ToException(response);
    }
}

internal static class V3ResponseParser
{
    // ── Top-level envelope ───────────────────────────────────────────────────

    internal static PrequalifyV3Result ParsePrequalify(string body, string fallbackIdempotencyKey, int retryAttempts)
    {
        var (root, requestId, idempotencyKey, livemode) = ParseEnvelope(body, fallbackIdempotencyKey, "/v3/prequalify");
        var data = ExtractData(root);
        // The v3 response is always a flat `plans[]` array — single amount and
        // multi-amount alike. Group client-side with V3Grouping.ByAmount on the
        // requested dimension (DeathBenefit for face amounts, Budget for
        // monthly budgets).
        return new PrequalifyV3Result(CoercePlans(data), requestId, idempotencyKey, livemode, retryAttempts);
    }

    internal static QuoteV3Result ParseQuote(string body, string fallbackIdempotencyKey, int retryAttempts)
    {
        var (root, requestId, idempotencyKey, livemode) = ParseEnvelope(body, fallbackIdempotencyKey, "/v3/quote");
        var data = ExtractData(root);
        return new QuoteV3Result(CoercePlans(data), requestId, idempotencyKey, livemode, retryAttempts);
    }

    private static IReadOnlyList<V3Offer> CoercePlans(JsonElement data)
    {
        // Absent plans (vs present-but-empty) indicates wire-shape drift; fail fast.
        if (!data.TryGetProperty("plans", out var p))
        {
            throw new InvalidOperationException("ZyIns v3 response: missing plans field");
        }
        var plans = new List<V3Offer>();
        if (p.ValueKind == JsonValueKind.Array)
        {
            foreach (var raw in p.EnumerateArray())
            {
                plans.Add(CoerceOffer(raw));
            }
        }
        return plans;
    }

    private static (JsonElement Root, string RequestId, string IdempotencyKey, bool Livemode) ParseEnvelope(
        string body, string fallbackIdempotencyKey, string path)
    {
        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(body);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException(
                $"ZyIns POST {path}: invalid JSON response body: {ex.Message}", ex);
        }
        // We deliberately do not `using` the JsonDocument here — callers need
        // the JsonElement to outlive this scope (records take ownership of
        // their copied strings, so once the records are built the document
        // may be disposed).
        try
        {
            var root = doc.RootElement;
            var requestId = ReadString(root, "request_id");
            var echoKey = ReadString(root, "idempotency_key");
            var idempotencyKey = string.IsNullOrEmpty(echoKey) ? fallbackIdempotencyKey : echoKey;
            var livemode = !root.TryGetProperty("livemode", out var l) || ReadBool(l, defaultIfMissing: true);
            // Clone the root element so its strings survive disposal of the
            // owning JsonDocument.
            var cloned = root.Clone();
            return (cloned, requestId, idempotencyKey, livemode);
        }
        finally
        {
            doc.Dispose();
        }
    }

    private static JsonElement ExtractData(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var d) && d.ValueKind == JsonValueKind.Object)
        {
            return d;
        }
        return root;
    }

    // ── Element coercion ────────────────────────────────────────────────────

    private static V3Offer CoerceOffer(JsonElement raw)
    {
        if (raw.ValueKind != JsonValueKind.Object) raw = default;
        var metadata = new Dictionary<string, object?>();
        if (raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("metadata", out var m) && m.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in m.EnumerateObject())
            {
                metadata[prop.Name] = JsonElementToObject(prop.Value);
            }
        }
        var planInfo = raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("plan_info", out var pi)
            ? CoercePlanInfo(pi)
            : Array.Empty<PlanInfoItem>();
        var pricing = raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("pricing", out var pr) && pr.ValueKind == JsonValueKind.Array
            ? CoercePricing(pr)
            : (IReadOnlyList<V3PricingRow>)Array.Empty<V3PricingRow>();
        V3Money? budget = raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("budget", out var bd) && bd.ValueKind == JsonValueKind.Object
            ? CoerceMoney(bd)
            : null;
        return new V3Offer(
            Object: "plan_offer",
            Id: ReadString(raw, "id"),
            Eligible: ReadBool(raw, "eligible"),
            Carrier: CoerceCarrier(raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("carrier", out var c) ? c : default),
            Product: CoerceProduct(raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("product", out var pp) ? pp : default),
            PlanInfo: planInfo,
            DeathBenefit: CoerceMoney(raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("death_benefit", out var db) ? db : default),
            Pricing: pricing,
            Metadata: metadata,
            Budget: budget);
    }

    private static IReadOnlyList<V3PricingRow> CoercePricing(JsonElement raw)
    {
        var list = new List<V3PricingRow>();
        foreach (var r in raw.EnumerateArray())
        {
            list.Add(CoercePricingRow(r));
        }
        return list;
    }

    private static V3PricingRow CoercePricingRow(JsonElement raw)
    {
        if (raw.ValueKind != JsonValueKind.Object) raw = default;
        var rateClass = ReadString(raw, "rate_class");
        var primary = ReadBool(raw, "primary");
        var eligibility = CoerceEligibility(
            raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("eligibility", out var e) ? e : default);
        int? rank = raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("rank", out var rk) && rk.ValueKind == JsonValueKind.Number && rk.TryGetInt32(out var rkv)
            ? rkv
            : (int?)null;
        V3Premium? premium = raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("premium", out var pm) && pm.ValueKind == JsonValueKind.Object
            ? CoercePremium(pm)
            : null;
        return new V3PricingRow(rateClass, primary, eligibility, rank, premium);
    }

    private static V3Eligibility CoerceEligibility(JsonElement raw)
    {
        if (raw.ValueKind != JsonValueKind.Object) raw = default;
        V3EligibilityCategory? category = null;
        if (raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("category", out var c) && c.ValueKind == JsonValueKind.String)
        {
            category = c.GetString() switch
            {
                "immediate" => V3EligibilityCategory.Immediate,
                "graded" => V3EligibilityCategory.Graded,
                "rop" => V3EligibilityCategory.Rop,
                "other" => V3EligibilityCategory.Other,
                _ => null,
            };
        }
        var reasons = new List<string>();
        if (raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty("reasons", out var rs) && rs.ValueKind == JsonValueKind.Array)
        {
            foreach (var r in rs.EnumerateArray())
            {
                if (r.ValueKind == JsonValueKind.String) reasons.Add(r.GetString() ?? string.Empty);
            }
        }
        return new V3Eligibility(category, ReadBool(raw, "eligible"), reasons);
    }

    private static V3Premium? CoercePremium(JsonElement raw)
    {
        var cents = ReadLong(raw, "cents");
        var display = ReadString(raw, "display");
        var def = CoerceAmount(raw.TryGetProperty("default", out var d) ? d : default);
        var modes = new Dictionary<string, V3Amount>(StringComparer.Ordinal);
        if (raw.TryGetProperty("modes", out var m) && m.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in m.EnumerateObject())
            {
                modes[prop.Name] = CoerceAmount(prop.Value);
            }
        }
        return new V3Premium(cents, display, def, modes);
    }

    // Coerce the leaf {cents, display} amount (OpenAPI AmountResponse).
    private static V3Amount CoerceAmount(JsonElement raw)
    {
        if (raw.ValueKind != JsonValueKind.Object) return new V3Amount(0, string.Empty);
        return new V3Amount(ReadLong(raw, "cents"), ReadString(raw, "display"));
    }

    // Coerce a {amount: {cents, display}, period} value (OpenAPI Money).
    // period falls back to null (a one-time lump sum) for any value outside the
    // closed enum, so an unknown future period never poisons the type.
    private static V3Money CoerceMoney(JsonElement raw)
    {
        if (raw.ValueKind != JsonValueKind.Object)
        {
            return new V3Money(new V3Amount(0, string.Empty), null);
        }
        var amount = CoerceAmount(raw.TryGetProperty("amount", out var a) ? a : default);
        V3Period? period = null;
        if (raw.TryGetProperty("period", out var p) && p.ValueKind == JsonValueKind.String)
        {
            period = p.GetString() switch
            {
                "monthly" => V3Period.Monthly,
                "quarterly" => V3Period.Quarterly,
                "semiannual" => V3Period.Semiannual,
                "annual" => V3Period.Annual,
                _ => null,
            };
        }
        return new V3Money(amount, period);
    }

    private static V3OfferCarrier CoerceCarrier(JsonElement raw)
    {
        if (raw.ValueKind != JsonValueKind.Object) return new V3OfferCarrier(string.Empty, string.Empty, string.Empty);
        return new V3OfferCarrier(
            Id: ReadString(raw, "id"),
            Name: ReadString(raw, "name"),
            LogoUrl: ReadString(raw, "logo_url"));
    }

    private static V3OfferProduct CoerceProduct(JsonElement raw)
    {
        if (raw.ValueKind != JsonValueKind.Object)
        {
            return new V3OfferProduct(string.Empty, string.Empty, string.Empty, string.Empty, string.Empty, string.Empty);
        }
        return new V3OfferProduct(
            Id: ReadString(raw, "id"),
            Slug: ReadString(raw, "slug"),
            Name: ReadString(raw, "name"),
            DisplayName: ReadString(raw, "display_name"),
            Type: ReadString(raw, "type"),
            WireToken: ReadString(raw, "wire_token"));
    }

    private static IReadOnlyList<PlanInfoItem> CoercePlanInfo(JsonElement raw)
    {
        // The server may emit either the typed array shape or the legacy
        // record-of-arrays. PrequalifyV2 has a shared coercer; mirror its
        // behaviour here to avoid taking a dependency on internals that
        // may shift. Keep the v3 path tight: array → typed, object →
        // synthesize titlecase labels via PlanInfoLabel.
        if (raw.ValueKind == JsonValueKind.Array)
        {
            var items = new List<PlanInfoItem>();
            foreach (var entry in raw.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object) continue;
                var key = ReadString(entry, "key");
                if (string.IsNullOrEmpty(key)) continue;
                var labelRaw = ReadString(entry, "label");
                var label = string.IsNullOrEmpty(labelRaw) ? PlanInfoLabel.TitleCase(key) : labelRaw;
                var values = new List<string>();
                if (entry.TryGetProperty("values", out var v) && v.ValueKind == JsonValueKind.Array)
                {
                    foreach (var x in v.EnumerateArray())
                    {
                        if (x.ValueKind == JsonValueKind.String) values.Add(x.GetString() ?? string.Empty);
                    }
                }
                items.Add(new PlanInfoItem(key, label, values));
            }
            return items;
        }
        if (raw.ValueKind == JsonValueKind.Object)
        {
            var items = new List<PlanInfoItem>();
            foreach (var prop in raw.EnumerateObject())
            {
                if (string.IsNullOrWhiteSpace(prop.Name)) continue;
                var values = new List<string>();
                if (prop.Value.ValueKind == JsonValueKind.Array)
                {
                    foreach (var x in prop.Value.EnumerateArray())
                    {
                        if (x.ValueKind == JsonValueKind.String) values.Add(x.GetString() ?? string.Empty);
                    }
                }
                items.Add(new PlanInfoItem(prop.Name, PlanInfoLabel.TitleCase(prop.Name), values));
            }
            return items;
        }
        return Array.Empty<PlanInfoItem>();
    }

    // ── Primitives ──────────────────────────────────────────────────────────

    private static string ReadString(JsonElement obj, string name)
    {
        if (obj.ValueKind != JsonValueKind.Object) return string.Empty;
        return obj.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? (v.GetString() ?? string.Empty)
            : string.Empty;
    }

    private static bool ReadBool(JsonElement obj, string name)
    {
        if (obj.ValueKind != JsonValueKind.Object) return false;
        if (!obj.TryGetProperty(name, out var v)) return false;
        return ReadBool(v, defaultIfMissing: false);
    }

    private static bool ReadBool(JsonElement v, bool defaultIfMissing)
    {
        return v.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => defaultIfMissing,
        };
    }

    private static long ReadLong(JsonElement obj, string name)
    {
        if (obj.ValueKind != JsonValueKind.Object) return 0;
        if (!obj.TryGetProperty(name, out var v) || v.ValueKind != JsonValueKind.Number) return 0;
        return v.TryGetInt64(out var n) ? n : 0;
    }

    private static object? JsonElementToObject(JsonElement e)
    {
        return e.ValueKind switch
        {
            JsonValueKind.String => e.GetString(),
            JsonValueKind.Number => e.TryGetInt64(out var i) ? (object)i : e.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            JsonValueKind.Array => e.EnumerateArray().Select(JsonElementToObject).ToList(),
            JsonValueKind.Object => e.EnumerateObject().ToDictionary(p => p.Name, p => JsonElementToObject(p.Value)),
            _ => null,
        };
    }
}
