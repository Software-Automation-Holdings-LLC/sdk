// `Isa.Sdk.Zyins.Reference.CheckKey` — internal sorted check-key normalizer.
//
// Mirrors the engine's `CondNameMakeCheckKey` in
// `go/zyins/utils/strings/normalize.go` (and Perl
// `cond_name_make_check_key_xs`): ASCII uppercase, strip every character
// that is not ASCII alphanumeric, then SORT the surviving characters
// ascending. Digits ('0'-'9') sort before letters ('A'-'Z'), byte-identical
// to the engine.
//
// Sorting collapses word order so prefix / suffix / no-space severity
// variants of one concept resolve identically, while severity qualifiers
// stay distinct (MILD vs SEVERE differ in letter multiset):
//
//   "SEVERE COPD"   → "CCDEEOPRSV"
//   "COPD (SEVERE)" → "CCDEEOPRSV"
//   "COPD (MILD)"   → "CCDDILMOP"
//
// Used ONLY for word-order-invariant NAME matching. Opaque catalog ids
// (e.g. HIGHBLOODPRESSURE, cond_<ULID>) are never keyed this way — sorting
// an id would let unrelated ids collide. Id and exact-name lookups stay on
// `MakeKey`. `internal` for the same reason as `MakeKey`.

using System;

namespace Isa.Sdk.Zyins.Reference;

internal static class CheckKey
{
    /// <summary>Normalize free text to the engine's sorted condition
    /// check-key.</summary>
    public static string Normalize(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }
        var upper = text!.ToUpperInvariant();
        var buf = new char[upper.Length];
        var n = 0;
        for (var i = 0; i < upper.Length; i++)
        {
            var ch = upper[i];
            if ((ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z'))
            {
                buf[n++] = ch;
            }
        }
        if (n == 0)
        {
            return string.Empty;
        }
        Array.Sort(buf, 0, n);
        return new string(buf, 0, n);
    }
}
