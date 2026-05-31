// RapidSign sub-namespace accessor on the unified Isa client. Document
// workflow (create / send / poll / webhook verify) ships in v0.3.x;
// for now this is a discoverable shell so the public surface contract
// is satisfied across all five language bindings.
namespace Isa.Sdk.RapidSign;

/// <summary>
/// Accessor for RapidSign product methods, reached via <see cref="global::Isa.Sdk.Isa.RapidSign"/>.
/// </summary>
/// <example>
/// <code>
/// var isa = Isa.WithBearer();
/// // var doc = await isa.RapidSign.Documents.CreateAsync(...);   // v0.3.x
/// </code>
/// </example>
public sealed class RapidSignNamespace
{
    /// <summary>Internal: bound by <see cref="global::Isa.Sdk.Isa"/> at construction.</summary>
    public RapidSignNamespace()
    {
    }
}
