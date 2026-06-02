// Zero-knowledge case crypto envelope, byte-compatible with the TypeScript
// SDK's account/caseCrypto.ts. The platform stores opaque ciphertext and never
// holds a key: the SDK generates a fresh data key per case, encrypts the
// payload with AES-GCM (the cleartext product tag is bound as additional
// authenticated data), and carries the key only in the share-link `#k=`
// fragment.
//
// AesGcm seals into a ciphertext buffer and a separate tag buffer, so the wire
// contract's split ciphertext / iv / tag fields map directly. AesGcm is in-box
// on net8.0 but absent on netstandard2.0; the legacy target throws
// PlatformNotSupportedException at first use, mirroring ZeroKnowledgeCaseStorage.
//
// HARD RULE — never log the fragment key. The key is the capability; leakage
// defeats the zero-knowledge guarantee.
using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Isa.Sdk.Account;

/// <summary>The opaque crypto fields the server stores for a zero-knowledge
/// case, all standard (padded) base64. Mirrors the TypeScript
/// <c>TCaseEnvelope</c> wire shape.</summary>
public sealed record CaseEnvelope
{
    /// <summary>Std-base64 AES-GCM ciphertext with the auth tag stripped.</summary>
    public string Ciphertext { get; init; } = string.Empty;
    /// <summary>Std-base64 AES-GCM nonce.</summary>
    public string Iv { get; init; } = string.Empty;
    /// <summary>Std-base64 AES-GCM authentication tag.</summary>
    public string Tag { get; init; } = string.Empty;
}

/// <summary>Result of <see cref="CaseCrypto.Encrypt"/>: the wire envelope plus
/// the base64url fragment key destined for the share link's <c>#k=</c>
/// fragment.</summary>
public sealed record EncryptedCase
{
    /// <summary>The base64 fields posted to /v1/case.</summary>
    public CaseEnvelope Envelope { get; init; } = new();
    /// <summary>The data key, base64url-encoded (no padding), for the link.</summary>
    public string KeyFragment { get; init; } = string.Empty;
}

/// <summary>Raised when a case envelope fails AES-GCM authentication: a
/// tampered, corrupt, or product-mismatched payload, or a wrong fragment key.
/// The recipient cannot recover the plaintext; treat it as terminal.</summary>
public sealed class CaseDecryptException : Exception
{
    /// <summary>Construct with a human-readable message.</summary>
    public CaseDecryptException(string message) : base(message) { }

    /// <summary>Construct with a message and an inner authentication failure.</summary>
    public CaseDecryptException(string message, Exception inner) : base(message, inner) { }
}

/// <summary>CSPRNG facade for case-key and nonce generation, so
/// <see cref="CaseCrypto"/> never calls the OS RNG directly and tests can
/// inject a deterministic source.</summary>
public interface IRandomBytes
{
    /// <summary>Return <paramref name="length"/> cryptographically random bytes.</summary>
    byte[] Next(int length);
}

/// <summary>Default <see cref="IRandomBytes"/> backed by
/// <see cref="RandomNumberGenerator"/>. The only OS-RNG touch in the
/// case-crypto path.</summary>
public sealed class SystemRandomBytes : IRandomBytes
{
    /// <inheritdoc/>
    public byte[] Next(int length)
    {
        if (length < 1) throw new ArgumentOutOfRangeException(nameof(length));
        var buffer = new byte[length];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(buffer);
        return buffer;
    }
}

/// <summary>Zero-knowledge case AES-GCM envelope, parity-identical to the
/// TypeScript SDK.</summary>
public sealed class CaseCrypto
{
    // AES-128 data-key length for fresh case keys. Decrypt is length-agnostic
    // (AesGcm picks 128/192/256 by key length), so 256-bit keys from earlier
    // envelopes still open; this governs generation only.
    private const int KeyBytes = 16;
    // AES-GCM nonce length (96-bit, the GCM-recommended size).
    private const int IvBytes = 12;
    // AES-GCM authentication-tag length (128-bit).
    private const int TagBytes = 16;

    private readonly IRandomBytes _random;

    /// <summary>Construct with the default system CSPRNG.</summary>
    public CaseCrypto() : this(new SystemRandomBytes()) { }

    /// <summary>Construct with an injected CSPRNG (tests use a deterministic one).</summary>
    public CaseCrypto(IRandomBytes random) =>
        _random = random ?? throw new ArgumentNullException(nameof(random));

#if NET8_0_OR_GREATER
    /// <summary>Encrypt a JSON-serializable payload under a fresh 128-bit key,
    /// binding <paramref name="product"/> as AEAD additional data. Returns the
    /// base64 wire envelope and the base64url fragment key.</summary>
    public EncryptedCase Encrypt(string product, object? payload)
    {
        if (string.IsNullOrEmpty(product)) throw new ArgumentException("account: CaseCrypto.Encrypt requires a product", nameof(product));
        var rawKey = _random.Next(KeyBytes);
        try
        {
            var iv = _random.Next(IvBytes);
            var plaintext = JsonSerializer.SerializeToUtf8Bytes(payload);
            var ciphertext = new byte[plaintext.Length];
            var tag = new byte[TagBytes];
            var aad = Encoding.UTF8.GetBytes(product);
            using (var gcm = new AesGcm(rawKey, TagBytes))
            {
                gcm.Encrypt(iv, plaintext, ciphertext, tag, aad);
            }
            return new EncryptedCase
            {
                Envelope = new CaseEnvelope
                {
                    Ciphertext = Convert.ToBase64String(ciphertext),
                    Iv = Convert.ToBase64String(iv),
                    Tag = Convert.ToBase64String(tag),
                },
                KeyFragment = BytesToBase64Url(rawKey),
            };
        }
        finally
        {
            CryptographicOperations.ZeroMemory(rawKey);
        }
    }

    /// <summary>Decrypt a wire envelope with the fragment key, verifying the
    /// <paramref name="product"/> AEAD binding, and return the parsed JSON
    /// payload as a <see cref="JsonElement"/>. Throws
    /// <see cref="CaseDecryptException"/> on any authentication failure.</summary>
    public JsonElement Decrypt(string product, CaseEnvelope envelope, string keyFragment)
    {
        if (envelope is null) throw new ArgumentNullException(nameof(envelope));
        var rawKey = DecodeFragmentKey(keyFragment);
        try
        {
            var iv = Convert.FromBase64String(envelope.Iv);
            var ciphertext = Convert.FromBase64String(envelope.Ciphertext);
            var tag = Convert.FromBase64String(envelope.Tag);
            var plaintext = new byte[ciphertext.Length];
            var aad = Encoding.UTF8.GetBytes(product);
            try
            {
                using var gcm = new AesGcm(rawKey, TagBytes);
                gcm.Decrypt(iv, ciphertext, tag, plaintext, aad);
            }
            catch (CryptographicException ex)
            {
                throw new CaseDecryptException(
                    $"account: case envelope failed authentication for product {product}: "
                    + "wrong key, wrong product, or tampered ciphertext", ex);
            }
            return JsonSerializer.Deserialize<JsonElement>(plaintext);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(rawKey);
        }
    }
#else
    /// <summary>Not supported on netstandard2.0 — AES-GCM is unavailable. Target
    /// net8.0+.</summary>
    public EncryptedCase Encrypt(string product, object? payload) => throw NotSupportedOnLegacyTarget();

    /// <summary>Not supported on netstandard2.0 — AES-GCM is unavailable. Target
    /// net8.0+.</summary>
    public JsonElement Decrypt(string product, CaseEnvelope envelope, string keyFragment) => throw NotSupportedOnLegacyTarget();

    private static PlatformNotSupportedException NotSupportedOnLegacyTarget() =>
        new PlatformNotSupportedException(
            "CaseCrypto: AES-GCM is not available on netstandard2.0. Target net8.0+.");
#endif

    private static string BytesToBase64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).Replace('+', '-').Replace('/', '_').TrimEnd('=');

    // Decode a fragment key. Accepts the base64url share-link form (with or
    // without padding) and standard base64, mirroring the TS decoder that
    // normalizes the URL-safe alphabet before decoding.
    private static byte[] DecodeFragmentKey(string fragment)
    {
        var normalized = fragment.Replace('-', '+').Replace('_', '/');
        var padding = normalized.Length % 4;
        if (padding > 0) normalized += new string('=', 4 - padding);
        return Convert.FromBase64String(normalized);
    }
}
