// Pluggable case-storage adapter contract. Locked by PR #361
// (docs/sdk-syntax-proposal.md §2.9). One code path through the SDK:
//
//     isa.Zyins.Cases.SaveAsync(record) → resolvedStorage.PutAsync(record)
//
// Consumer-defined implementations swap out the default
// ZeroKnowledgeCaseStorage for a server-side persistence layer (KMS,
// PG, vault, ...) without changing call sites.
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Isa.Sdk.Zyins.Cases;

/// <summary>
/// A case record as the SDK sees it before persistence — opaque
/// payload + caller-supplied identifier. The payload is the canonical
/// JSON shape the case viewer expects; storage adapters MUST NOT
/// inspect or transform its contents.
/// </summary>
/// <param name="Id">Caller-stable case identifier (content hash or UUID).</param>
/// <param name="Payload">UTF-8 JSON payload bytes.</param>
public sealed record CaseRecord(string Id, byte[] Payload)
{
    /// <summary>Inputs are validated at the boundary; this constructor enforces them.</summary>
    public static CaseRecord Of(string id, byte[] payload)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ArgumentException("CaseRecord.Of: id must be a non-empty string", nameof(id));
        }
        if (payload is null)
        {
            throw new ArgumentNullException(nameof(payload));
        }
        return new CaseRecord(id, payload);
    }
}

/// <summary>
/// Result of <see cref="ICaseStorage.PutAsync"/>. <see cref="Id"/> is
/// the canonical identifier the storage accepted (may differ from the
/// caller's hint when the storage rewrites it). <see cref="RecallToken"/>
/// is opaque to the SDK — pass it back to <c>GetAsync</c> verbatim.
/// </summary>
/// <param name="Id">Storage-canonical case identifier.</param>
/// <param name="RecallToken">Opaque recall token (e.g. base64url fragment key for zero-knowledge storage). Null when no recall material exists.</param>
public sealed record PutResult(string Id, string? RecallToken);

/// <summary>
/// Pluggable case-storage adapter. Implementations must be safe to
/// share across threads.
/// </summary>
public interface ICaseStorage
{
    /// <summary>
    /// Persist a case record. Returns the storage-canonical identifier
    /// and (where applicable) a recall token the caller must retain to
    /// read the record back.
    /// </summary>
    Task<PutResult> PutAsync(CaseRecord record, CancellationToken ct = default);

    /// <summary>
    /// Retrieve a previously-persisted case record. The
    /// <paramref name="recallToken"/> is required for zero-knowledge
    /// adapters and ignored by server-side adapters that key on
    /// <paramref name="id"/> alone. Returns null when no record matches.
    /// </summary>
    Task<CaseRecord?> GetAsync(string id, string? recallToken = null, CancellationToken ct = default);

    /// <summary>
    /// Delete a previously-persisted case record. Implementations that
    /// cannot honor deletion (e.g. append-only ledgers) MUST throw
    /// <see cref="NotSupportedException"/>; callers are expected to
    /// surface that to the user rather than silently dropping the request.
    /// </summary>
    Task DeleteAsync(string id, CancellationToken ct = default);
}
