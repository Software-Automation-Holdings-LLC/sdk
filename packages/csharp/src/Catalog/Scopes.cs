// CATALOG-GEN: do not hand-edit; rerun packages/csharp/scripts/gen-catalog.mjs.
//
// Source data:
//   - isa-platform/shared/schemas/api/isa/v1/common.proto

using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Sah.Sdk.Catalog;

/// <summary>Bearer-token scopes recognized across the ISA platform.</summary>
public enum Scope
{
    /// <summary>send signer notification emails.</summary>
    [WireValue("rapidsign:documents:notify")] RapidsignDocumentsNotify,
    /// <summary>fetch signature state and signed PDFs.</summary>
    [WireValue("rapidsign:documents:read")] RapidsignDocumentsRead,
    /// <summary>submit signatures.</summary>
    [WireValue("rapidsign:documents:sign")] RapidsignDocumentsSign,
    /// <summary>create new documents.</summary>
    [WireValue("rapidsign:documents:write")] RapidsignDocumentsWrite,
}

/// <summary>Human-readable description per scope.</summary>
public static class ScopeDescriptions
{
    private static readonly IReadOnlyDictionary<Scope, string> MAP = new ReadOnlyDictionary<Scope, string>(new Dictionary<Scope, string>
    {
        [Scope.RapidsignDocumentsNotify] = "send signer notification emails.",
        [Scope.RapidsignDocumentsRead] = "fetch signature state and signed PDFs.",
        [Scope.RapidsignDocumentsSign] = "submit signatures.",
        [Scope.RapidsignDocumentsWrite] = "create new documents.",
    });

    /// <summary>Get the description for a scope.</summary>
    public static string Get(Scope s) => MAP.TryGetValue(s, out var v) ? v : string.Empty;
}
