// Thread-safety contract: the ZyInsClient is safe for concurrent use
// across an unbounded number of in-flight Task.WhenAll callers. The
// X-Request-Id space is wide enough that every call observes a
// distinct id; we assert that distinctness across 100 parallel calls.
using System.Collections.Concurrent;
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Zyins.Tests;

public class ThreadSafetyTests
{
    private const int ParallelCalls = 100;

    [Fact]
    public async Task Client_Supports100ParallelCalls_WithDistinctRequestIds()
    {
        var counter = 0;
        var seenIds = new ConcurrentBag<string>();
        var transport = new FakeTransport((_, _) =>
        {
            var id = $"req_01HZK2{Interlocked.Increment(ref counter):D6}";
            seenIds.Add(id);
            return new TransportResponse(
                Status: 200,
                Headers: new Dictionary<string, string> { ["X-Request-Id"] = id },
                Body: $$"""{"plans":[],"request_id":"{{id}}"}""");
        });
        var client = new ZyInsClient(new ZyInsClientOptions { Token = Fixtures.SampleToken, Transport = transport });

        var tasks = Enumerable.Range(0, ParallelCalls)
            .Select(_ => client.Prequalify.RunAsync(Fixtures.JohnDoePrequalifyInput()))
            .ToArray();

        var results = await Task.WhenAll(tasks);

        Assert.Equal(ParallelCalls, results.Length);
        var distinctIds = results.Select(r => r.RequestId).Distinct().ToArray();
        Assert.Equal(ParallelCalls, distinctIds.Length);
    }
}
