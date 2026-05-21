// CATALOG-GEN: do not hand-edit; rerun packages/csharp/scripts/gen-catalog.mjs.
//
// Source data:
//   - isa-platform/shared/go/events/registry.go

using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Sah.Sdk.Catalog;

/// <summary>RapidSign webhook event types.</summary>
public enum SignEvent
{
    [WireValue("document.signed")] DocumentSigned,
}

/// <summary>Label per sign event.</summary>
public static class SignEventLabels
{
    private static readonly IReadOnlyDictionary<SignEvent, string> MAP = new ReadOnlyDictionary<SignEvent, string>(new Dictionary<SignEvent, string>
    {
        [SignEvent.DocumentSigned] = "DocumentSigned",
    });

    /// <summary>Get the label for an event.</summary>
    public static string Get(SignEvent e) => MAP.TryGetValue(e, out var v) ? v : string.Empty;
}
