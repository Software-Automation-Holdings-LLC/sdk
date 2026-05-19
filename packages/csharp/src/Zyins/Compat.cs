// Cross-target shims for BCL APIs that ship on net6.0+ but not on
// netstandard2.0. The SDK is dual-targeted; these helpers are the only
// approved bridge — call sites use them unconditionally so the rest of
// the codebase stays free of #if frags.
using System;
using System.Collections.Generic;

namespace Sah.Sdk.Zyins;

internal static class CompatHex
{
    /// <summary>Hex-encode <paramref name="bytes"/> as a lowercase string.</summary>
    public static string ToLowerHex(byte[] bytes)
    {
        if (bytes is null) throw new ArgumentNullException(nameof(bytes));
#if NETSTANDARD2_0
        // Manual conversion — Convert.ToHexString lands in .NET 5.
        const string hexLower = "0123456789abcdef";
        var chars = new char[bytes.Length * 2];
        for (var i = 0; i < bytes.Length; i++)
        {
            var b = bytes[i];
            chars[i * 2] = hexLower[b >> 4];
            chars[i * 2 + 1] = hexLower[b & 0x0F];
        }
        return new string(chars);
#else
        return Convert.ToHexString(bytes).ToLowerInvariant();
#endif
    }
}
