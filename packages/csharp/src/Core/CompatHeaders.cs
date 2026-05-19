using System;
using System.Collections.Generic;

namespace Sah.Sdk.Core;

/// <summary>Cross-target header-map helpers for netstandard2.0.</summary>
internal static class CompatHeaders
{
    /// <summary>Case-insensitive copy of a header map. Avoids the
    /// <see cref="Dictionary{TKey,TValue}"/>(IEnumerable{KeyValuePair}, comparer)
    /// ctor that is absent on netstandard2.0.</summary>
    public static Dictionary<string, string> Copy(IReadOnlyDictionary<string, string> source)
    {
        if (source is null) throw new ArgumentNullException(nameof(source));
        var copy = new Dictionary<string, string>(source.Count, StringComparer.OrdinalIgnoreCase);
        foreach (var kv in source)
        {
            copy[kv.Key] = kv.Value;
        }

        return copy;
    }
}