// Proxy sub-namespace accessor on the unified Isa client. Wraps the
// transport-signing helpers (BearerTokenSigner) that ship today.
namespace Sah.Sdk.Proxy;

/// <summary>
/// Accessor for proxy/transport-signing helpers, reached via
/// <see cref="Sah.Sdk.Isa.Proxy"/>.
/// </summary>
/// <example>
/// <code>
/// var isa = Isa.WithBearer();
/// // var signed = isa.Proxy.SignBearer(request);    // v0.3.x wiring
/// </code>
/// </example>
public sealed class ProxyNamespace
{
    /// <summary>Internal: bound by <see cref="Sah.Sdk.Isa"/> at construction.</summary>
    public ProxyNamespace()
    {
    }
}
