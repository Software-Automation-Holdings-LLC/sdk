// Embedded HMAC bootstrap signature for POST /v1/sessions.
//
// This class pins the byte-exact wire format documented at
// api/guides/authentication-advanced.md#test-vector and reproduced in
// tests/conformance/fixtures/auth-vector.json. The reference TypeScript
// implementation lives at packages/ts/src/core/internal/auth/bootstrap.ts;
// this file MUST reproduce the identical hex against the same inputs.
//
// Two-stage flow:
//   1. Serialize the request body as JSON, keys in source order
//      (keycode, email, deviceId), no whitespace, no trailing newline.
//   2. Build the canonical signing string and HMAC-SHA256 it with the
//      LicenseKey as the key.
//
// Why a dedicated module: the bootstrap signature predates any session
// (no sessionSecret exists yet), uses the LicenseKey as the HMAC key,
// and is the only call where DeviceId appears in the body. The
// steady-state session-signing helper (SignRequest) handles all other
// calls.
using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Isa.Sdk.Core;

/// <summary>
/// Inputs to the embedded HMAC bootstrap signature. Mirrors the
/// <c>auth-vector</c> fixture one-for-one. Property order matches the
/// canonical serialized-body order (<c>keycode, email, deviceId</c>);
/// the body is hand-serialized so neither field order nor JSON
/// whitespace can drift.
/// </summary>
public sealed record BootstrapInput(
    string Keycode,
    string Email,
    string LicenseKey,
    string DeviceId,
    string Method,
    string Path,
    long Timestamp);

/// <summary>
/// Output bundle. Returns every intermediate so conformance tests can
/// assert each stage independently — if a future regression flips the
/// serialized body, the failure points at exactly that stage instead
/// of just "hex differs".
/// </summary>
public sealed record BootstrapSignature(
    string SerializedBody,
    string Canonical,
    string Hex,
    string Header);

/// <summary>
/// Builds the embedded HMAC bootstrap signature for
/// <c>POST /v1/sessions</c>. Pinned bytewise by the
/// <c>tests/conformance/fixtures/auth-vector.json</c> fixture.
/// </summary>
public static class Bootstrap
{
    /// <summary>
    /// Builds the byte-exact bootstrap signature.
    /// </summary>
    /// <param name="input">Bootstrap inputs.</param>
    /// <returns>Every intermediate stage of the signing flow.</returns>
    /// <exception cref="ArgumentException">
    /// Thrown when any required field is blank or the timestamp is not positive.
    /// </exception>
    public static BootstrapSignature Build(BootstrapInput input)
    {
        if (input is null)
        {
            throw new ArgumentNullException(nameof(input));
        }
        Require(input.Keycode, nameof(input.Keycode));
        Require(input.Email, nameof(input.Email));
        Require(input.LicenseKey, nameof(input.LicenseKey));
        Require(input.DeviceId, nameof(input.DeviceId));
        Require(input.Method, nameof(input.Method));
        Require(input.Path, nameof(input.Path));
        if (input.Timestamp <= 0)
        {
            throw new ArgumentException(
                "bootstrap signature: timestamp must be positive",
                nameof(input.Timestamp));
        }

        var serializedBody = SerializeBody(input.Keycode, input.Email, input.DeviceId);
        var canonical = string.Concat(
            input.Timestamp.ToString(CultureInfo.InvariantCulture),
            ".",
            input.Method.ToUpperInvariant(),
            " ",
            input.Path,
            ".",
            serializedBody);

        var hex = ComputeHmacHex(input.LicenseKey, canonical);
        var header = "ISA-Signature: t="
            + input.Timestamp.ToString(CultureInfo.InvariantCulture)
            + ",v1=" + hex;

        return new BootstrapSignature(serializedBody, canonical, hex, header);
    }

    /// <summary>
    /// Hand-rolled JSON serialization to guarantee key order and no
    /// whitespace. System.Text.Json with PropertyNamingPolicy preserved
    /// would also work, but a hand-rolled writer is unambiguous: any
    /// future field addition is a deliberate edit here, not an
    /// accidental reorder elsewhere.
    /// </summary>
    private static string SerializeBody(string keycode, string email, string deviceId)
    {
        var sb = new StringBuilder(64 + keycode.Length + email.Length + deviceId.Length);
        sb.Append("{\"keycode\":");
        AppendJsonString(sb, keycode);
        sb.Append(",\"email\":");
        AppendJsonString(sb, email);
        sb.Append(",\"deviceId\":");
        AppendJsonString(sb, deviceId);
        sb.Append('}');
        return sb.ToString();
    }

    private static string ComputeHmacHex(string key, string canonical)
    {
        var keyBytes = Encoding.UTF8.GetBytes(key);
        var canonicalBytes = Encoding.UTF8.GetBytes(canonical);
        using var hmac = new HMACSHA256(keyBytes);
        var digest = hmac.ComputeHash(canonicalBytes);
        var sb = new StringBuilder(digest.Length * 2);
        for (var i = 0; i < digest.Length; i++)
        {
            sb.Append(digest[i].ToString("x2", CultureInfo.InvariantCulture));
        }
        return sb.ToString();
    }

    private static void AppendJsonString(StringBuilder sb, string s)
    {
        sb.Append('"');
        for (var i = 0; i < s.Length; i++)
        {
            var c = s[i];
            switch (c)
            {
                case '"':
                    sb.Append("\\\"");
                    break;
                case '\\':
                    sb.Append("\\\\");
                    break;
                case '\n':
                    sb.Append("\\n");
                    break;
                case '\r':
                    sb.Append("\\r");
                    break;
                case '\t':
                    sb.Append("\\t");
                    break;
                case '\b':
                    sb.Append("\\b");
                    break;
                case '\f':
                    sb.Append("\\f");
                    break;
                default:
                    if (c < 0x20)
                    {
                        sb.Append("\\u");
                        sb.Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    }
                    else
                    {
                        sb.Append(c);
                    }
                    break;
            }
        }
        sb.Append('"');
    }

    private static void Require(string value, string name)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException(
                $"bootstrap signature: {name} is required",
                name);
        }
    }
}
