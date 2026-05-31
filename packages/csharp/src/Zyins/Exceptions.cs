// ZyINS exception type-aliases over the Isa.Sdk.Core base hierarchy.
// Callers can catch the Core type or the ZyINS-specific subclass; the
// task spec required both names to exist.
using Isa.Sdk.Core;

namespace Isa.Sdk.Zyins;

/// <summary>Root of the ZyINS-specific exception hierarchy. Re-exports
/// the Core base so callers can `catch (IsaException)` without
/// referencing the Core package directly.</summary>
public class ZyInsException : IsaException
{
    /// <inheritdoc cref="IsaException(string,string,string?,int?,Exception?)" />
    public ZyInsException(string code, string message, string? requestId = null, int? httpStatus = null, Exception? inner = null)
        : base(code, message, requestId, httpStatus, inner)
    {
    }
}

/// <summary>The license attached to the token was rejected.</summary>
public sealed class ZyInsLicenseException : IsaLicenseException
{
    /// <inheritdoc cref="IsaLicenseException(string,string,string?,int?,Exception?)" />
    public ZyInsLicenseException(string code, string message, string? requestId = null, int? httpStatus = null, Exception? inner = null)
        : base(code, message, requestId, httpStatus, inner)
    {
    }
}
