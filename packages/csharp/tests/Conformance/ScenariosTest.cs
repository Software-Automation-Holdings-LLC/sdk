// Cross-language SDK parity test.
//
// Loads tests/conformance/scenarios.json and verifies that for each scenario
// the SDK (or raw HTTP, as a fallback) produces a response matching the
// declared assertion vector. The same JSON drives parametrized tests in
// every language SDK; drift between SDKs surfaces here.
//
// Set ISA_MOCK_URL to run against isa-mock. Missing local mock configuration
// skips replay; an explicitly configured but unreachable mock fails loudly.

using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Sah.Sdk.Tests.Conformance;

public sealed class ScenariosTest
{
    private const int MinScenarios = 10;
    private static readonly TimeSpan ProbeTimeout = TimeSpan.FromMilliseconds(500);
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(5);

    [Fact]
    public void ScenariosFileLoadsAndHasMinimumCases()
    {
        var scenarios = LoadScenarios();
        Assert.True(scenarios.Count >= MinScenarios,
            $"expected >={MinScenarios} scenarios, got {scenarios.Count}");
    }

    [SkippableTheory]
    [Trait("Category", "Conformance")]
    [MemberData(nameof(ScenarioNames))]
    public async Task ScenarioAgainstIsaMock(string scenarioName)
    {
        var mockUrl = Environment.GetEnvironmentVariable("ISA_MOCK_URL");
        if (string.IsNullOrWhiteSpace(mockUrl))
        {
            Skip.If(true, "ISA_MOCK_URL is not set");
            return;
        }
        if (!await MockReachable(mockUrl))
        {
            throw new InvalidOperationException($"isa-mock is not reachable at {mockUrl}");
        }

        var scenario = LoadScenarios().Single(s => GetString(s, "name") == scenarioName);
        var (status, contentType, payload, body) = await ExecuteScenario(mockUrl, scenario);
        var expected = GetObject(scenario, "expected");

        var expectedStatus = GetInt(expected, "status");
        Assert.True(status == expectedStatus,
            $"scenario {scenarioName}: status mismatch — want {expectedStatus}, got {status}, body={body}");

        if (TryGetString(expected, "content_type", out var expectedCt))
        {
            Assert.Contains(expectedCt, contentType ?? string.Empty);
        }
        if (!(contentType ?? string.Empty).Contains("json"))
        {
            return;
        }
        AssertScenarioPayload(scenarioName, scenario, expected, payload);
    }

    public static IEnumerable<object[]> ScenarioNames =>
        LoadScenarios().Select(s => new object[] { GetString(s, "name") });

    private static List<JsonElement> LoadScenarios()
    {
        var path = ScenariosPath();
        var raw = File.ReadAllText(path);
        using var doc = JsonDocument.Parse(raw);
        return doc.RootElement.Clone().GetProperty("scenarios").EnumerateArray().ToList();
    }

    private static string ScenariosPath()
    {
        var dir = AppContext.BaseDirectory;
        for (var i = 0; i < 8 && dir is not null; i++)
        {
            var candidate = Path.Combine(dir, "tests", "conformance", "scenarios.json");
            if (File.Exists(candidate))
            {
                return candidate;
            }
            dir = Directory.GetParent(dir)?.FullName;
        }
        throw new FileNotFoundException("scenarios.json not found by walking parents of test base dir");
    }

    private static async Task<bool> MockReachable(string url)
    {
        using var client = new HttpClient { Timeout = ProbeTimeout };
        try
        {
            using var resp = await client.GetAsync($"{url}/__healthz_probe__");
            return resp.StatusCode == HttpStatusCode.NoContent;
        }
        catch (HttpRequestException)
        {
            return false;
        }
        catch (TaskCanceledException)
        {
            return false;
        }
    }

    private static async Task<(int Status, string? ContentType, JsonElement Payload, string Body)> ExecuteScenario(
        string mockUrl, JsonElement scenario)
    {
        var request = GetObject(scenario, "request");
        var method = new HttpMethod(GetString(request, "method"));
        var path = GetString(request, "path");
        using var client = new HttpClient { Timeout = RequestTimeout };
        using var req = new HttpRequestMessage(method, mockUrl + path);

        if (request.TryGetProperty("body_raw", out var bodyRaw) && bodyRaw.ValueKind == JsonValueKind.String)
        {
            req.Content = new StringContent(bodyRaw.GetString() ?? string.Empty, Encoding.UTF8, "application/json");
        }
        else if (request.TryGetProperty("body", out var body) && body.ValueKind != JsonValueKind.Null)
        {
            req.Content = new StringContent(body.GetRawText(), Encoding.UTF8, "application/json");
        }

        if (request.TryGetProperty("headers", out var headers) && headers.ValueKind == JsonValueKind.Object)
        {
            foreach (var h in headers.EnumerateObject())
            {
                if (string.Equals(h.Name, "Content-Type", StringComparison.OrdinalIgnoreCase) && req.Content != null)
                {
                    var headerValue = h.Value.GetString();
                    if (!string.IsNullOrWhiteSpace(headerValue))
                    {
                        req.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(headerValue);
                    }
                    continue;
                }
                req.Headers.TryAddWithoutValidation(h.Name, h.Value.GetString() ?? string.Empty);
            }
        }

        using var resp = await client.SendAsync(req);
        var raw = await resp.Content.ReadAsStringAsync();
        var ct = resp.Content.Headers.ContentType?.ToString();
        JsonElement payload = default;
        if ((ct ?? string.Empty).Contains("json") && !string.IsNullOrEmpty(raw))
        {
            using var doc = JsonDocument.Parse(raw);
            payload = doc.RootElement.Clone();
        }
        return ((int)resp.StatusCode, ct, payload, raw);
    }

    private static void AssertScenarioPayload(string name, JsonElement scenario, JsonElement expected, JsonElement payload)
    {
        if (expected.TryGetProperty("envelope_fields", out var envelope))
        {
            foreach (var f in envelope.EnumerateArray())
            {
                Assert.True(payload.TryGetProperty(f.GetString()!, out _), $"{name}: envelope missing {f.GetString()}");
            }
        }
        if (expected.TryGetProperty("problem_fields", out var problem))
        {
            foreach (var f in problem.EnumerateArray())
            {
                Assert.True(payload.TryGetProperty(f.GetString()!, out _), $"{name}: ProblemDetails missing {f.GetString()}");
            }
        }
        if (expected.TryGetProperty("code", out var codeEl) && codeEl.ValueKind == JsonValueKind.String)
        {
            Assert.True(payload.TryGetProperty("code", out var payloadCode));
            Assert.Equal(codeEl.GetString(), payloadCode.GetString());
        }
        if (expected.TryGetProperty("idempotency_key_echoed", out var echoed)
            && echoed.ValueKind == JsonValueKind.True)
        {
            var headers = GetObject(GetObject(scenario, "request"), "headers");
            var sentKey = GetString(headers, "X-Isa-Idempotency-Key");
            Assert.True(payload.TryGetProperty("idempotency_key", out var payloadKey),
                $"{name}: envelope missing idempotency_key");
            Assert.Equal(sentKey, payloadKey.GetString());
        }
    }

    private static string GetString(JsonElement el, string prop) => el.GetProperty(prop).GetString()!;
    private static int GetInt(JsonElement el, string prop) => el.GetProperty(prop).GetInt32();
    private static JsonElement GetObject(JsonElement el, string prop) => el.GetProperty(prop);
    private static bool TryGetString(JsonElement el, string prop, out string value)
    {
        if (el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String)
        {
            value = v.GetString()!;
            return true;
        }
        value = string.Empty;
        return false;
    }
}
