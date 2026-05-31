// Stderr debug logger. Triggered by the ISA_LOG=debug environment
// variable. Writes via Console.Error so parent processes that
// JSON-parse stdout (e.g. Anthropic SDK-style CLI pipelines) are
// unaffected — never use Console.Out for diagnostics.
//
// Redaction is conservative-by-default: anything that looks like a
// credential or a PII field is replaced with "<redacted>" before the
// line hits stderr. The redaction set is the union of the patterns in
// every Isa SDK binding so audit log scans grep cleanly.
using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Isa.Sdk.Core;

/// <summary>Source of the debug-logging flag. Defaults to <see cref="EnvironmentDebugLogConfig"/>;
/// tests substitute an in-memory implementation.</summary>
public interface IDebugLogConfig
{
    /// <summary>True when ISA_LOG=debug is in effect.</summary>
    bool DebugEnabled { get; }
}

/// <summary>Reads the <c>ISA_LOG</c> environment variable on every check.
/// Cheap; consumers do not need to restart the process after toggling the flag.</summary>
public sealed class EnvironmentDebugLogConfig : IDebugLogConfig
{
    private const string EnvVarName = "ISA_LOG";
    private const string DebugValue = "debug";

    /// <summary>Shared singleton; the env var is read on each <see cref="DebugEnabled"/> access.</summary>
    public static readonly EnvironmentDebugLogConfig Instance = new();

    /// <inheritdoc />
    public bool DebugEnabled =>
        string.Equals(Environment.GetEnvironmentVariable(EnvVarName), DebugValue, StringComparison.OrdinalIgnoreCase);
}

/// <summary>Sink the debug logger writes to. Production uses <see cref="StandardErrorSink"/>;
/// tests substitute a <see cref="StringWriter"/>-backed sink.</summary>
public interface IDebugLogSink
{
    /// <summary>Write one line to the sink. Implementations must be thread-safe.</summary>
    void WriteLine(string line);
}

/// <summary>Production sink — writes to <see cref="Console.Error"/>. Never <see cref="Console.Out"/>.</summary>
public sealed class StandardErrorSink : IDebugLogSink
{
    /// <summary>Shared singleton.</summary>
    public static readonly StandardErrorSink Instance = new();

    /// <inheritdoc />
    public void WriteLine(string line) => Console.Error.WriteLine(line);
}

/// <summary>Debug logger that dumps redacted requests / responses to stderr when
/// <c>ISA_LOG=debug</c>. No-op (zero allocations) when the flag is off.</summary>
public sealed class DebugLogger
{
    private static readonly HashSet<string> RedactedHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Authorization",
        "X-Device-Signature",
        "X-Session-Signature",
    };

    private static readonly HashSet<string> RedactedJsonFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "email",
        "dob",
        "ssn",
        "phone",
    };

    private const string RedactedPlaceholder = "[redacted]";

    private readonly IDebugLogConfig _config;
    private readonly IDebugLogSink _sink;

    /// <summary>Process-wide default; reads the env var on each call and writes to stderr.</summary>
    public static readonly DebugLogger Default = new(EnvironmentDebugLogConfig.Instance, StandardErrorSink.Instance);

    /// <summary>Construct with injected config + sink. Both are required.</summary>
    public DebugLogger(IDebugLogConfig config, IDebugLogSink sink)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _sink = sink ?? throw new ArgumentNullException(nameof(sink));
    }

    /// <summary>True when the logger would emit; gives callers a fast skip path.</summary>
    public bool IsEnabled => _config.DebugEnabled;

    /// <summary>Log an outbound request with the supplied attempt number (zero on the first try).</summary>
    public void LogRequest(TransportRequest request, int attempt)
    {
        if (!IsEnabled) return;
        var headers = RedactHeaders(request.Headers);
        var body = RedactJsonBody(request.Body);
        _sink.WriteLine($"[ISA SDK DEBUG] → {request.Method.ToString().ToUpperInvariant()} {request.Url} attempt={attempt.ToString(CultureInfo.InvariantCulture)} headers={headers} body={body}");
    }

    /// <summary>Log an inbound response.</summary>
    public void LogResponse(Uri url, TransportResponse response)
    {
        if (!IsEnabled) return;
        var headers = RedactHeaders(response.Headers);
        var body = RedactJsonBody(response.Body);
        _sink.WriteLine($"[ISA SDK DEBUG] ← {response.Status.ToString(CultureInfo.InvariantCulture)} {url} headers={headers} body={body}");
    }

    private static string RedactHeaders(IReadOnlyDictionary<string, string> headers)
    {
        var redacted = new Dictionary<string, string>(headers.Count, StringComparer.OrdinalIgnoreCase);
        foreach (var kv in headers)
        {
            redacted[kv.Key] = RedactedHeaders.Contains(kv.Key) ? RedactedPlaceholder : kv.Value;
        }
        return JsonSerializer.Serialize(redacted);
    }

    /// <summary>Redact a JSON body string in place. Non-JSON bodies are returned unchanged.</summary>
    internal static string RedactJsonBody(string? body)
    {
        // Local non-null binding so flow analysis is consistent across
        // target frameworks — the netstandard2.0 BCL does not advertise
        // the nullable-state attributes that net6.0+ uses for
        // string.IsNullOrEmpty / JsonNode.Parse.
        if (body is null || body.Length == 0) return "<empty>";
        var json = body;
        try
        {
            var node = JsonNode.Parse(json);
            if (node is null) return json;
            RedactNode(node);
            return node.ToJsonString() ?? json;
        }
        catch (JsonException)
        {
            // Body was not JSON — nothing to redact field-wise.
            return json;
        }
    }

    private static void RedactNode(JsonNode node)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var kv in obj.ToArray())
                {
                    if (RedactedJsonFields.Contains(kv.Key))
                    {
                        obj[kv.Key] = JsonValue.Create(RedactedPlaceholder);
                        continue;
                    }
                    if (kv.Value is not null) RedactNode(kv.Value);
                }
                break;
            case JsonArray arr:
                foreach (var item in arr)
                {
                    if (item is not null) RedactNode(item);
                }
                break;
        }
    }
}
