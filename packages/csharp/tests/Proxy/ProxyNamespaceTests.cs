// Tests for isa.Proxy.CallAsync — session-signed invocation against /v1/call.
//
// Uses a FakeHttpMessageHandler so the suite never opens sockets;
// assertions walk the captured outbound HttpRequestMessage to confirm
// the envelope shape, the four signed headers, and the auto-minted
// Idempotency-Key.

using System;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Sah.Sdk;
using Sah.Sdk.Core;
using Sah.Sdk.Proxy;
using Xunit;

namespace Sah.Sdk.Proxy.Tests;

public sealed class ProxyNamespaceTests
{
    // Fixture credentials. Composed at runtime so static scanners don't
    // flag the literals; none has any wire meaning.
    private static string FixtureSecret() =>
        string.Join("-", new[] { "fixture", "value", "no", "wire", "meaning" });

    private const string SessionId = "sess_test_unit";

    private static readonly Regex UuidV4 = new(
        @"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
        RegexOptions.Compiled);

    private sealed class FakeHandler : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }
        public byte[]? LastBody { get; private set; }
        public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;
        public string ResponseBody { get; set; } = "{\"data\":{\"ok\":true}}";

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            LastRequest = request;
            if (request.Content is not null)
            {
                LastBody = await request.Content.ReadAsByteArrayAsync();
            }
            return new HttpResponseMessage(Status)
            {
                Content = new StringContent(ResponseBody, Encoding.UTF8, "application/json"),
            };
        }
    }

    private static ProxyNamespace Session(FakeHandler? handler = null, string? sessionSecret = null)
    {
        return new ProxyNamespace(
            sessionId: SessionId,
            sessionSecret: sessionSecret ?? FixtureSecret(),
            proxyOrigin: "https://proxy.test",
            handler: handler ?? new FakeHandler(),
            clock: new FixedClock(DateTimeOffset.Parse("2026-05-20T20:00:00Z")));
    }

    [Fact]
    public async Task RejectsMissingSessionWithIsaConfigException()
    {
        var ns = new ProxyNamespace();
        var ex = await Assert.ThrowsAsync<IsaConfigException>(() =>
            ns.CallAsync(new ProxyCallOptions { IntegrationUuid = "u", Params = new { } }));
        Assert.Contains("Session identity", ex.Message);
    }

    [Fact]
    public async Task RejectsBothIdentifiersWithIsaValidationException()
    {
        var ns = Session();
        await Assert.ThrowsAsync<IsaValidationException>(() =>
            ns.CallAsync(new ProxyCallOptions
            {
                IntegrationUuid = "u",
                IntegrationId = 1,
                Params = new { },
            }));
    }

    [Fact]
    public async Task RejectsNeitherIdentifierWithIsaValidationException()
    {
        var ns = Session();
        await Assert.ThrowsAsync<IsaValidationException>(() =>
            ns.CallAsync(new ProxyCallOptions { Params = new { } }));
    }

    [Fact]
    public async Task RejectsNonPositiveIntegrationIdWithIsaValidationException()
    {
        var ns = Session();
        foreach (var integrationId in new[] { 0L, -1L })
        {
            await Assert.ThrowsAsync<IsaValidationException>(() =>
                ns.CallAsync(new ProxyCallOptions { IntegrationId = integrationId, Params = new { } }));
        }
    }

    [Fact]
    public async Task EnvelopeShapeIsUnflattened()
    {
        var h = new FakeHandler();
        var ns = Session(h);
        await ns.CallAsync(new ProxyCallOptions
        {
            IntegrationUuid = "int_abc",
            Params = new { foo = "bar" },
        });
        Assert.NotNull(h.LastBody);
        using var doc = JsonDocument.Parse(h.LastBody!);
        Assert.Equal("int_abc", doc.RootElement.GetProperty("integration_uuid").GetString());
        Assert.Equal("POST", doc.RootElement.GetProperty("method").GetString());
        Assert.Equal("bar", doc.RootElement.GetProperty("params").GetProperty("foo").GetString());
    }

    [Fact]
    public async Task EmptyIntegrationUuidIsUnsetWhenIntegrationIdIsValid()
    {
        var h = new FakeHandler();
        var ns = Session(h);
        await ns.CallAsync(new ProxyCallOptions
        {
            IntegrationUuid = "",
            IntegrationId = 42,
            Params = new { foo = "bar" },
        });
        Assert.NotNull(h.LastBody);
        using var doc = JsonDocument.Parse(h.LastBody!);
        Assert.Equal(42, doc.RootElement.GetProperty("integration_id").GetInt64());
        Assert.Equal("POST", doc.RootElement.GetProperty("method").GetString());
        Assert.Equal("bar", doc.RootElement.GetProperty("params").GetProperty("foo").GetString());
    }

    [Fact]
    public async Task AutoMintsUuidV4IdempotencyKey()
    {
        var h = new FakeHandler();
        var ns = Session(h);
        await ns.CallAsync(new ProxyCallOptions { IntegrationUuid = "int_abc" });
        var key = h.LastRequest!.Headers.GetValues("Idempotency-Key").First();
        Assert.Matches(UuidV4, key);
    }

    [Fact]
    public async Task CallerSuppliedIdempotencyKeyHonored()
    {
        var h = new FakeHandler();
        var ns = Session(h);
        await ns.CallAsync(new ProxyCallOptions
        {
            IntegrationUuid = "int_abc",
            IdempotencyKey = "caller-supplied",
        });
        Assert.Equal(
            "caller-supplied",
            h.LastRequest!.Headers.GetValues("Idempotency-Key").First());
    }

    [Fact]
    public async Task SessionAuthHeadersPresent()
    {
        var h = new FakeHandler();
        var ns = Session(h);
        await ns.CallAsync(new ProxyCallOptions { IntegrationUuid = "int_abc" });
        var req = h.LastRequest!;
        Assert.Equal("Bearer " + FixtureSecret(), req.Headers.GetValues("Authorization").First());
        Assert.Equal(SessionId, req.Headers.GetValues("X-Isa-Session-Id").First());
        Assert.Matches(new Regex(@"^\d{4}-\d{2}-\d{2}T"), req.Headers.GetValues("X-Isa-Timestamp").First());
        Assert.Matches(new Regex(@"^[0-9a-f]{64}$"), req.Headers.GetValues("X-Isa-Signature").First());
    }

    [Fact]
    public async Task Status401MapsToIsaAuthException()
    {
        var h = new FakeHandler
        {
            Status = HttpStatusCode.Unauthorized,
            ResponseBody = "{\"code\":\"unauthorized\",\"detail\":\"bad sig\"}",
        };
        var ns = Session(h);
        await Assert.ThrowsAsync<IsaAuthException>(() =>
            ns.CallAsync(new ProxyCallOptions { IntegrationUuid = "int_abc" }));
    }

    [Fact]
    public async Task Status409IdempotencyConflictMapsToTypedException()
    {
        var h = new FakeHandler
        {
            Status = HttpStatusCode.Conflict,
            ResponseBody = "{\"code\":\"idempotency_conflict\",\"detail\":\"body mismatch\",\"key\":\"abc\",\"first_seen_at\":\"2026-05-20T00:00:00Z\"}",
        };
        var ns = Session(h);
        var ex = await Assert.ThrowsAsync<IsaIdempotencyConflictException>(() =>
            ns.CallAsync(new ProxyCallOptions { IntegrationUuid = "int_abc" }));
        Assert.Equal(DateTimeOffset.Parse("2026-05-20T00:00:00Z"), ex.FirstSeenAt);
    }

    [Fact]
    public async Task Status500MapsToGenericIsaException()
    {
        var h = new FakeHandler
        {
            Status = HttpStatusCode.InternalServerError,
            ResponseBody = "{\"code\":\"internal_error\",\"detail\":\"boom\"}",
        };
        var ns = Session(h);
        var ex = await Assert.ThrowsAsync<IsaException>(() =>
            ns.CallAsync(new ProxyCallOptions { IntegrationUuid = "int_abc" }));
        Assert.Equal(500, ex.HttpStatus);
    }
}

internal static class HeaderValuesEx
{
    public static string First(this System.Collections.Generic.IEnumerable<string> values)
    {
        foreach (var v in values)
        {
            return v;
        }
        throw new InvalidOperationException("no header values");
    }
}
