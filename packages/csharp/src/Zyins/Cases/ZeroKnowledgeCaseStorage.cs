// Default zero-knowledge ICaseStorage implementation. Locked by
// PR #361 — payloads are sealed client-side under a per-record
// AES-GCM-256 key; only ciphertext leaves the SDK. The recall token
// is the base64url-encoded encryption key, returned to the caller
// and required for retrieval. The server stores the ciphertext at
// /v1/case but never the key.
//
// Cryptographic envelope:
//   - key  : 32 random bytes (AES-256), from RandomNumberGenerator
//   - nonce: 12 random bytes per record (AES-GCM standard)
//   - tag  : 16 bytes (AES-GCM standard)
//   - wire : { id, nonce_b64, ciphertext_b64, tag_b64 }
//
// Mirrors packages/ts/src/zyins/zeroKnowledgeCaseStorage.ts (PR #347).
//
// Platform note: AesGcm is in-box on net6.0+ but not on
// netstandard2.0 (only via Cng on Windows). On netstandard2.0 the
// Default singleton throws PlatformNotSupportedException at first use
// rather than silently degrading. Consumers on the legacy target who
// need zero-knowledge storage must implement ICaseStorage themselves.
using System;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;

namespace Isa.Sdk.Zyins.Cases;

/// <summary>
/// Default <see cref="ICaseStorage"/> — encrypts case payloads
/// client-side under a per-record key (AES-GCM-256); the server holds
/// only ciphertext. The recall token is the base64url-encoded key,
/// returned to the caller in <see cref="PutResult.RecallToken"/> and
/// required by <see cref="GetAsync"/> to decrypt the response.
///
/// The default singleton is unwired — calling its methods throws
/// <see cref="NotSupportedException"/> until a transport is attached
/// via <see cref="WithTransport"/>. The IsaOptions resolver substitutes
/// the wired instance built from the active <c>ZyInsClient</c>.
/// </summary>
public sealed class ZeroKnowledgeCaseStorage : ICaseStorage
{
    private const int KeyBytes = 32;     // AES-256
    private const int NonceBytes = 12;   // AES-GCM standard
    private const int TagBytes = 16;     // AES-GCM standard

    private readonly ICaseStorageTransport? _transport;

    private ZeroKnowledgeCaseStorage(ICaseStorageTransport? transport)
    {
        _transport = transport;
    }

    /// <summary>
    /// Process-wide default. Unwired — calling its methods throws
    /// <see cref="NotSupportedException"/>. The options resolver
    /// substitutes a wired instance per <see cref="ZyInsClient"/>.
    /// </summary>
    public static ZeroKnowledgeCaseStorage Default { get; } = new ZeroKnowledgeCaseStorage(transport: null);

    /// <summary>
    /// Construct a wired instance backed by <paramref name="transport"/>.
    /// </summary>
    public static ZeroKnowledgeCaseStorage WithTransport(ICaseStorageTransport transport)
    {
        if (transport is null) throw new ArgumentNullException(nameof(transport));
        return new ZeroKnowledgeCaseStorage(transport);
    }

    /// <inheritdoc />
#if NET8_0_OR_GREATER
    public async Task<PutResult> PutAsync(CaseRecord record, CancellationToken ct = default)
    {
        if (record is null) throw new ArgumentNullException(nameof(record));
        var transport = RequireTransport();
        var key = new byte[KeyBytes];
        RandomNumberGenerator.Fill(key);
        try
        {
            var nonce = new byte[NonceBytes];
            RandomNumberGenerator.Fill(nonce);
            var ciphertext = new byte[record.Payload.Length];
            var tag = new byte[TagBytes];

            using (var gcm = new AesGcm(key, TagBytes))
            {
                gcm.Encrypt(nonce, record.Payload, ciphertext, tag);
            }

            var envelope = new CipherEnvelope(
                Id: record.Id,
                NonceB64: Convert.ToBase64String(nonce),
                CiphertextB64: Convert.ToBase64String(ciphertext),
                TagB64: Convert.ToBase64String(tag));

            // Encode the recall token before zeroing key; the server only
            // ever sees ciphertext, never the key.
            var recall = Base64Url.Encode(key);
            await transport.PutCiphertextAsync(envelope, ct).ConfigureAwait(false);
            // The id the caller addresses the record by is the one they
            // supplied; the server's echoed id is not trusted to redefine
            // the caller's local identity.
            return new PutResult(Id: record.Id, RecallToken: recall);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
        }
    }
#else
    public Task<PutResult> PutAsync(CaseRecord record, CancellationToken ct = default)
    {
        if (record is null) throw new ArgumentNullException(nameof(record));
        _ = RequireTransport();
        return Task.FromException<PutResult>(NotSupportedOnLegacyTarget());
    }
#endif

    /// <inheritdoc />
#if NET8_0_OR_GREATER
    public async Task<CaseRecord?> GetAsync(string id, string? recallToken = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ArgumentException("ZeroKnowledgeCaseStorage.GetAsync: id must be non-empty", nameof(id));
        }
        if (string.IsNullOrWhiteSpace(recallToken))
        {
            throw new ArgumentException(
                "ZeroKnowledgeCaseStorage.GetAsync: recallToken is required (the key never leaves the SDK)",
                nameof(recallToken));
        }
        var transport = RequireTransport();
        var envelope = await transport.GetCiphertextAsync(id, ct).ConfigureAwait(false);
        if (envelope is null) return null;

        var key = Base64Url.Decode(recallToken!);
        try
        {
            if (key.Length != KeyBytes)
            {
                throw new CryptographicException(
                    $"ZeroKnowledgeCaseStorage.GetAsync: recallToken decodes to {key.Length} bytes; expected {KeyBytes}");
            }
            var nonce = Convert.FromBase64String(envelope.NonceB64);
            var ciphertext = Convert.FromBase64String(envelope.CiphertextB64);
            var tag = Convert.FromBase64String(envelope.TagB64);
            // AES-GCM authenticates the tag during Decrypt; a truncated or
            // forged tag raises CryptographicException. Reject any tag that
            // is not exactly the standard 16 bytes up front so a malicious
            // server cannot probe shortened-tag behavior.
            if (tag.Length != TagBytes)
            {
                throw new CryptographicException(
                    $"ZeroKnowledgeCaseStorage.GetAsync: authentication tag is {tag.Length} bytes; expected {TagBytes}");
            }
            var plaintext = new byte[ciphertext.Length];

            using (var gcm = new AesGcm(key, TagBytes))
            {
                gcm.Decrypt(nonce, ciphertext, tag, plaintext);
            }

            // Address the record by the id the caller requested, not the
            // server-echoed envelope.Id: a tampering server must not be able
            // to rebind decrypted plaintext to a different identity.
            return new CaseRecord(id, plaintext);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
        }
    }
#else
    public Task<CaseRecord?> GetAsync(string id, string? recallToken = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ArgumentException("ZeroKnowledgeCaseStorage.GetAsync: id must be non-empty", nameof(id));
        }
        if (string.IsNullOrWhiteSpace(recallToken))
        {
            throw new ArgumentException(
                "ZeroKnowledgeCaseStorage.GetAsync: recallToken is required (the key never leaves the SDK)",
                nameof(recallToken));
        }
        _ = RequireTransport();
        return Task.FromException<CaseRecord?>(NotSupportedOnLegacyTarget());
    }
#endif

    /// <inheritdoc />
    public Task DeleteAsync(string id, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new ArgumentException("ZeroKnowledgeCaseStorage.DeleteAsync: id must be non-empty", nameof(id));
        }
        var transport = RequireTransport();
        return transport.DeleteAsync(id, ct);
    }

    private ICaseStorageTransport RequireTransport()
    {
        if (_transport is null)
        {
            throw new NotSupportedException(
                "ZeroKnowledgeCaseStorage.Default is unwired. Construct with WithTransport(...) " +
                "or pass a custom ICaseStorage via IsaOptions.CaseStorage.");
        }
        return _transport;
    }

#if !NET8_0_OR_GREATER
    private static PlatformNotSupportedException NotSupportedOnLegacyTarget() =>
        new PlatformNotSupportedException(
            "ZeroKnowledgeCaseStorage: AES-GCM is not available on netstandard2.0. " +
            "Target net6.0+ or supply a custom ICaseStorage via IsaOptions.CaseStorage.");
#endif
}

/// <summary>
/// Cipher-envelope wire shape. The server stores this verbatim; the
/// key never leaves the SDK.
/// </summary>
public sealed record CipherEnvelope(string Id, string NonceB64, string CiphertextB64, string TagB64);

/// <summary>
/// Transport seam used by <see cref="ZeroKnowledgeCaseStorage"/> to
/// reach the <c>/v1/case</c> surface. Injecting the transport keeps
/// the storage class free of HTTP plumbing and trivially testable
/// (in-memory fakes implement this without HTTP).
/// </summary>
public interface ICaseStorageTransport
{
    /// <summary>POST the ciphertext envelope to <c>/v1/case</c>.</summary>
    Task<CipherEnvelope> PutCiphertextAsync(CipherEnvelope envelope, CancellationToken ct);
    /// <summary>GET the ciphertext envelope from <c>/v1/case/{id}</c>; null when not found.</summary>
    Task<CipherEnvelope?> GetCiphertextAsync(string id, CancellationToken ct);
    /// <summary>DELETE <c>/v1/case/{id}</c>.</summary>
    Task DeleteAsync(string id, CancellationToken ct);
}

internal static class Base64Url
{
    internal static string Encode(byte[] input)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        var b64 = Convert.ToBase64String(input);
        return b64.TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    internal static byte[] Decode(string input)
    {
        if (input is null) throw new ArgumentNullException(nameof(input));
        var b64 = input.Replace('-', '+').Replace('_', '/');
        switch (b64.Length % 4)
        {
            case 2: b64 += "=="; break;
            case 3: b64 += "="; break;
            case 0: break;
            default: throw new FormatException("Base64Url.Decode: invalid input length");
        }
        return Convert.FromBase64String(b64);
    }
}
