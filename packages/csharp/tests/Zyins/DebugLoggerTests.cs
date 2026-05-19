// Tests for the ISA_LOG=debug stderr logger and its redaction rules.
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

internal sealed class FixedConfig : IDebugLogConfig
{
    public bool DebugEnabled { get; init; }
}

internal sealed class CapturingSink : IDebugLogSink
{
    private readonly List<string> _lines = new();
    private readonly object _lock = new();

    public void WriteLine(string line)
    {
        lock (_lock) _lines.Add(line);
    }

    public IReadOnlyList<string> Lines
    {
        get { lock (_lock) return _lines.ToArray(); }
    }
}

public class DebugLoggerTests
{
    [Fact]
    public void Disabled_DoesNotEmit()
    {
        var sink = new CapturingSink();
        var logger = new DebugLogger(new FixedConfig { DebugEnabled = false }, sink);
        var req = new TransportRequest(HttpVerb.Post, new Uri("https://api.example/v1/x"),
            new Dictionary<string, string> { ["Authorization"] = "Bearer isa_test_secret" }, Body: "{}");

        logger.LogRequest(req, attempt: 0);

        Assert.Empty(sink.Lines);
    }

    [Fact]
    public void Enabled_RedactsAuthorizationAndSignatureHeaders()
    {
        var sink = new CapturingSink();
        var logger = new DebugLogger(new FixedConfig { DebugEnabled = true }, sink);
        var req = new TransportRequest(HttpVerb.Post, new Uri("https://api.example/v1/x"),
            new Dictionary<string, string>
            {
                ["Authorization"] = "Bearer isa_live_supersecret",
                ["X-Device-Signature"] = "deadbeefcafe",
                ["X-Session-Signature"] = "feedfacefeed",
                ["X-Isa-Request-Id"] = "req_01HZK2",
            }, Body: null);

        logger.LogRequest(req, attempt: 0);

        var line = Assert.Single(sink.Lines);
        Assert.DoesNotContain("isa_live_supersecret", line);
        Assert.DoesNotContain("deadbeefcafe", line);
        Assert.DoesNotContain("feedfacefeed", line);
        Assert.Contains("[redacted]", line);
        Assert.Contains("req_01HZK2", line); // non-secret header survives
    }

    [Fact]
    public void Enabled_RedactsPiiFieldsInJsonBody()
    {
        var sink = new CapturingSink();
        var logger = new DebugLogger(new FixedConfig { DebugEnabled = true }, sink);
        var body = """
            {
              "applicant": {
                "email": "john.doe@example.com",
                "dob": "1962-04-18",
                "ssn": "123-45-6789",
                "phone": "+1-555-0100",
                "state": "NC"
              }
            }
            """;
        var req = new TransportRequest(HttpVerb.Post, new Uri("https://api.example/v1/x"),
            new Dictionary<string, string>(), body);

        logger.LogRequest(req, attempt: 1);

        var line = Assert.Single(sink.Lines);
        Assert.DoesNotContain("john.doe@example.com", line);
        Assert.DoesNotContain("1962-04-18", line);
        Assert.DoesNotContain("123-45-6789", line);
        Assert.DoesNotContain("+1-555-0100", line);
        Assert.Contains("NC", line); // non-PII field passes through
        Assert.Contains("attempt=1", line);
    }

    [Fact]
    public void StandardErrorSink_WritesToStderr_NotStdout()
    {
        var origErr = Console.Error;
        var origOut = Console.Out;
        var errWriter = new StringWriter();
        var outWriter = new StringWriter();
        try
        {
            Console.SetError(errWriter);
            Console.SetOut(outWriter);
            StandardErrorSink.Instance.WriteLine("hello stderr");
        }
        finally
        {
            Console.SetError(origErr);
            Console.SetOut(origOut);
        }
        Assert.Contains("hello stderr", errWriter.ToString());
        Assert.Empty(outWriter.ToString());
    }
}
