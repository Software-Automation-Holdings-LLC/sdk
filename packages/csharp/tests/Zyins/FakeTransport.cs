// Programmable transport for tests. The handler receives the request
// + cancellation token and returns the response synchronously; the
// transport wraps the result in a completed Task.
using Sah.Sdk.Core;

namespace Sah.Sdk.Zyins.Tests;

internal sealed class FakeTransport : ITransport
{
    private readonly Func<TransportRequest, CancellationToken, TransportResponse> _handler;

    public FakeTransport(Func<TransportRequest, CancellationToken, TransportResponse> handler)
    {
        _handler = handler;
    }

    public Task<TransportResponse> SendAsync(TransportRequest request, CancellationToken ct = default) =>
        Task.FromResult(_handler(request, ct));
}
