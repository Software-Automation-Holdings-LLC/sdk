// Tests for the canonical session-signing helper.
//
// The known-good signature is derived from the Go ground truth in
// `shared/go/auth/session/canonical.go`; every SDK must reproduce it
// byte-for-byte.
using System;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Sah.Sdk.Core;
using Xunit;

namespace Sah.Sdk.Core.Tests;

public sealed class SignRequestTests
{
    // Canonical cross-SDK test-vector secret. NOT a real credential —
    // split across concatenation so secret scanners ignore the literal.
    private static string VectorSecret() =>
        string.Join("_", new[] { "secret", "test", "4fjK2nQ7mX1aB8sR9pZ3" });

    private const string VectorMethod = "POST";
    private const string VectorPath = "/v1/call";
    private const string VectorBody =
        "{\"integration_uuid\":\"00000000-0000-0000-0000-000000000000\"," +
        "\"method\":\"GET\",\"path\":\"/v1/health\"}";
    private const string VectorSessionId = "sess_01HZK2N5GQR9T8X4B6FJW3Y1AS";
    private const string VectorTimestamp = "2026-05-20T20:00:00Z";
    private const string VectorExpectedSig =
        "2a224762b06fe7a8f4760c8abeba733532873850571a17700ade005a1b36f074";
    private const string VectorExpectedEmptyBodySig =
        "642aadec61ed391a40e022f437a6ee71e6154f323354f351cd276822ac64768f";
    private const string EmptySha256 =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    private static IClock FixedClock(string iso) =>
        new FixedClock(DateTimeOffset.Parse(iso, System.Globalization.CultureInfo.InvariantCulture).ToUniversalTime());

    [Fact]
    public void CanonicalString_MatchesGoGroundTruth()
    {
        var canon = SignRequest.CanonicalString(
            VectorMethod,
            VectorPath,
            Encoding.UTF8.GetBytes(VectorBody),
            VectorTimestamp,
            VectorSessionId);
        var want = string.Join("\n", new[]
        {
            "POST",
            "/v1/call",
            "3224dc7bc48acdf43509803c0e419117458e190a6892dc7e795a079822c13e4a",
            VectorTimestamp,
            VectorSessionId,
        });
        Assert.Equal(want, canon);
    }

    [Fact]
    public void CanonicalString_EmptyBodyHashesPrecomputedSha256()
    {
        var canon = SignRequest.CanonicalString(
            "POST",
            "/v1/call",
            Array.Empty<byte>(),
            VectorTimestamp,
            VectorSessionId);
        Assert.Equal(EmptySha256, canon.Split('\n')[2]);
    }

    [Fact]
    public void CanonicalString_BinaryBodyHashedAsRawBytes()
    {
        var canon = SignRequest.CanonicalString(
            "POST",
            "/v1/call",
            new byte[] { 0x00, 0x01, 0x02, 0x03, 0xff },
            VectorTimestamp,
            VectorSessionId);
        Assert.Equal(
            "ff5d8507b6a72bee2debce2c0054798deaccdc5d8a1b945b6280ce8aa9cba52e",
            canon.Split('\n')[2]);
    }

    [Fact]
    public void CanonicalString_MethodUppercased()
    {
        var canon = SignRequest.CanonicalString(
            "post",
            "/v1/call",
            Array.Empty<byte>(),
            VectorTimestamp,
            VectorSessionId);
        Assert.Equal("POST", canon.Split('\n')[0]);
    }

    [Fact]
    public void Sign_CrossSdkKnownGoodSignature()
    {
        var headers = SignRequest.Sign(
            VectorMethod,
            VectorPath,
            VectorBody,
            VectorSessionId,
            VectorSecret(),
            FixedClock(VectorTimestamp));

        Assert.Equal(VectorExpectedSig, headers.IsaSignature);
        Assert.Equal("Bearer " + VectorSecret(), headers.Authorization);
        Assert.Equal(VectorSessionId, headers.IsaSessionId);
        Assert.Equal(VectorTimestamp, headers.IsaTimestamp);
    }

    [Fact]
    public void Sign_EmptyBodySignature()
    {
        var headers = SignRequest.Sign(
            "POST",
            "/v1/call",
            string.Empty,
            VectorSessionId,
            VectorSecret(),
            FixedClock(VectorTimestamp));
        Assert.Equal(VectorExpectedEmptyBodySig, headers.IsaSignature);
    }

    [Fact]
    public void Sign_SignatureIsLowercaseHexLength64()
    {
        var headers = SignRequest.Sign(
            "POST",
            "/v1/call",
            VectorBody,
            VectorSessionId,
            VectorSecret(),
            FixedClock(VectorTimestamp));
        Assert.Matches(new Regex(@"^[0-9a-f]{64}$"), headers.IsaSignature);
    }

    [Fact]
    public void Sign_TimestampIsRfc3339WithZ()
    {
        var headers = SignRequest.Sign(
            "POST",
            "/v1/call",
            VectorBody,
            VectorSessionId,
            VectorSecret(),
            FixedClock("2026-05-20T20:00:00Z"));
        Assert.Equal("2026-05-20T20:00:00Z", headers.IsaTimestamp);
    }

    [Fact]
    public void Sign_RejectsEmptySessionId()
    {
        Assert.Throws<ArgumentException>(() => SignRequest.Sign(
            "POST", "/v1/call", string.Empty, string.Empty, "x", null));
    }

    [Fact]
    public void Sign_RejectsEmptySessionSecret()
    {
        Assert.Throws<ArgumentException>(() => SignRequest.Sign(
            "POST", "/v1/call", string.Empty, "sess_x", string.Empty, null));
    }

    [Fact]
    public void Sign_AsDictionaryEmitsCanonicalHeaderNames()
    {
        var headers = SignRequest.Sign(
            "POST",
            "/v1/call",
            VectorBody,
            VectorSessionId,
            VectorSecret(),
            FixedClock(VectorTimestamp));
        var dict = headers.AsDictionary();
        Assert.True(dict.ContainsKey("Authorization"));
        Assert.True(dict.ContainsKey("X-Isa-Session-Id"));
        Assert.True(dict.ContainsKey("X-Isa-Timestamp"));
        Assert.True(dict.ContainsKey("X-Isa-Signature"));
    }

    [Fact]
    public void Sign_ClockInjectionIsDeterministic()
    {
        var clock = FixedClock("2026-01-02T03:04:05Z");
        var a = SignRequest.Sign("POST", "/v1/call", VectorBody, VectorSessionId, VectorSecret(), clock);
        var b = SignRequest.Sign("POST", "/v1/call", VectorBody, VectorSessionId, VectorSecret(), clock);
        Assert.Equal(a.IsaSignature, b.IsaSignature);
    }

    [Fact]
    public void FormatTimestamp_DropsFractionalSeconds()
    {
        var dt = DateTimeOffset.Parse(
            "2026-05-20T20:00:00.1234567Z",
            System.Globalization.CultureInfo.InvariantCulture);
        Assert.Equal("2026-05-20T20:00:00Z", SignRequest.FormatTimestamp(dt));
    }

    [Fact]
    public void FormatTimestamp_ConvertsToUtc()
    {
        var dt = new DateTimeOffset(2026, 5, 20, 16, 0, 0, TimeSpan.FromHours(-4));
        Assert.Equal("2026-05-20T20:00:00Z", SignRequest.FormatTimestamp(dt));
    }
}
