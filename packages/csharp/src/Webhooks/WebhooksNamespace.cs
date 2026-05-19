// Webhooks sub-namespace accessor on the unified Isa client.
// HMAC-SHA256 verification with timestamp tolerance, mirroring the
// TS/Python/Go bindings per SDK_DESIGN.md §4.
namespace Sah.Sdk.Webhooks;

/// <summary>
/// Accessor for webhook helpers (signature verification, replay tolerance),
/// reached via <see cref="Sah.Sdk.Isa.Webhooks"/>.
/// </summary>
/// <example>
/// <code>
/// var isa = Isa.WithBearer();
/// // var ok = isa.Webhooks.Verify(body, sigHeader, secret);   // v0.3.x wiring
/// </code>
/// </example>
public sealed class WebhooksNamespace
{
    /// <summary>Internal: bound by <see cref="Sah.Sdk.Isa"/> at construction.</summary>
    public WebhooksNamespace()
    {
    }
}
