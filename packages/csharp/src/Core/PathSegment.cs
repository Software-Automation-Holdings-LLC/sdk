// Places caller-supplied values into request paths.
//
// A value spliced into a path must address exactly one segment, as seen by
// every hop that reads it: the client, any gateway in front of the API, and
// the server. Percent-encoding alone does not guarantee that. "." and ".."
// pass through Uri.EscapeDataString unchanged and are compacted away by
// System.Uri itself, and a gateway that decodes once turns an encoded "/"
// back into a separator. Either way the request, and the credentials
// attached to it, lands on another route.
using System;

namespace Isa.Sdk.Core;

internal static class PathSegment
{
  // Characters some hop may treat as a segment boundary once decoded: the
  // path separator, the backslash some servers fold into it, and the percent
  // sign that would hide either from a single decode.
  private static readonly char[] Separators = { '/', '\\', '%' };

  /// <summary>Return <paramref name="value"/> percent-encoded as exactly one URL path segment.</summary>
  /// <exception cref="ArgumentException">for a null or empty value, <c>.</c> and <c>..</c>,
  /// and any value containing <c>/</c>, <c>\</c>, or <c>%</c>.</exception>
  internal static string Encode(string? value, string paramName)
  {
    if (value is null || value.Length == 0 || value == "." || value == ".." || value.IndexOfAny(Separators) >= 0)
      throw new ArgumentException($"\"{value}\" is not a single path segment", paramName);
    return Uri.EscapeDataString(value);
  }
}
