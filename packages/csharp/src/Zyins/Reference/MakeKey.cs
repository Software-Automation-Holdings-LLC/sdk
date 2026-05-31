// `Isa.Sdk.Zyins.Reference.MakeKey` — internal canonical normalizer.
//
// Mirrors Go's `MakeKey` in `go/zyins/models/makekey.go` and the TS
// `makeKey` in `packages/ts/src/zyins/reference.ts`: ASCII uppercase,
// then strip every character that is not ASCII alphanumeric. The
// conformance corpus in `shared/schemas/sdk/testdata/reference_vectors.json`
// pins the exact byte-for-byte behavior across languages.
//
// This type is `internal` by design: the entire reason the `Reference`
// namespace exists is to make `match()` the only call site for the
// normalizer. Exposing it publicly would let consumers fabricate ids that
// could drift from server-side normalization.

using System.Runtime.CompilerServices;

namespace Isa.Sdk.Zyins.Reference;

internal static class MakeKey
{
    /// <summary>Normalize free text to the canonical server-side
    /// <c>MakeKey</c> form.</summary>
    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public static string Normalize(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }
        // Uppercase first so locale-specific casefolding does not change
        // which bytes survive the alphanumeric strip.
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
        return n == 0 ? string.Empty : new string(buf, 0, n);
    }
}
