# Sah.Sdk

Official C# SDK for the [Best Plan Pro API](https://docs.isaapi.com) — powered by the ZyINS engine.

## Install

```bash
dotnet add package Sah.Sdk
```

> **GitHub Packages fallback.** Until `Sah.Sdk` is fully published on NuGet.org, add the GitHub Packages feed and install from there:
>
> ```bash
> dotnet nuget add source https://nuget.pkg.github.com/Software-Automation-Holdings-LLC/index.json \
>   --name github-sah --username <GH_USER> --password <GH_PAT> --store-password-in-clear-text
> dotnet add package Sah.Sdk --source github-sah
> ```
>
> The wire surface is identical either way; only the feed changes.

## Hello world

```csharp
using Isa.Sdk;
using Isa.Sdk.Zyins;

// Reads ISA_TOKEN from the environment.
var isa = Isa.WithBearer();
var result = await isa.Zyins.Prequalify.RunAsync(input);
```

## Authentication

Three factories cover the three audiences described in [SDK_DESIGN.md §3](https://github.com/Software-Automation-Holdings-LLC/isa-platform/blob/main/docs/SDK_DESIGN.md):

| Factory | Audience | Env vars read |
|---|---|---|
| `Isa.WithBearer(token?)` | Server-to-server | `ISA_TOKEN` |
| `Isa.WithLicense(credentials?)` | Agent tools (BPP web/desktop) | `ISA_LICENSE_KEYCODE`, `ISA_LICENSE_EMAIL` |
| `Isa.WithSession(credentials?)` | Embedded forms | `ISA_SESSION_ID`, `ISA_SESSION_SECRET` |

Missing required env vars throw `IsaConfigException` synchronously at construction; the client never silently misbehaves.

## First call in <15 lines

```csharp
using Isa.Sdk;
using Isa.Sdk.Zyins;

var isa = await Isa.WithKeycodeAsync(new KeycodeOptions
{
    Keycode = "SDV-HWH-WDD",
    Email   = "john.doe@acme-agency.com",
});

var result = await isa.Zyins.Prequalify.RunAsync(new PrequalifyInput
{
    Applicant = new Applicant { Dob = "1962-04-18", Sex = Sex.Male, State = "NC" },
    Coverage  = Coverage.FaceValue(25_000),
});
Console.WriteLine(result.Data.Plans[0].MonthlyPremium);
```

## Per-surface API versions

The ISA API is a federation of independently versioned surfaces. Every SDK
release exports a frozen `BundledApiVersions.Map` recording which `/vN` each
surface targets:

```csharp
using Isa.Sdk.Zyins.Options;

foreach (var (surface, version) in BundledApiVersions.Map)
{
    Console.WriteLine($"{surface} => {version}");
}
// prequalify => v2
// quote      => v2
// datasets   => v2
// reference  => v2
// sessions   => v1
// branding   => v1
// cases      => v1
```

Pin individual surfaces with an `ApiVersion` override dictionary. There is
**no** `default` key and **no** string shorthand — resolution is
`ApiVersion.TryGetValue(surface, …) ?? BundledApiVersions.Map[surface]`:

```csharp
var isa = await Isa.WithKeycodeAsync(new KeycodeOptions
{
    Keycode = "SDV-HWH-WDD",
    Email   = "john.doe@acme-agency.com",
    ApiVersion = new Dictionary<string, IsaApiVersion>
    {
        ["quote"] = IsaApiVersion.V2,   // pin only quote; everything else bundled
    },
});
```

The release that retargets `prequalify` / `quote` / `datasets` / `reference`
to `v3` will bump those entries. See [SDK syntax proposal §2.7][syntax-27].

[syntax-27]: ../../docs/sdk-syntax-proposal.md#27-versioning--per-surface-not-global

## Reference data — `.Match()`

The unversioned `isa.Zyins.Reference` namespace canonicalizes free-text
medication and condition input. Unknown text never rejects — it returns a
structured `Concept` with `IsKnown=false`, so the final canonicalization
fires server-side at `/vN/prequalify`:

```csharp
var ds = await isa.Zyins.Datasets.GetAsync(new DatasetsGetInput
{
    Include = new[] { "conditions", "medications" },
});

var insulin = isa.Zyins.Medications.Match("insulin");
Console.WriteLine($"{insulin.Id}  {insulin.Name}  {insulin.IsKnown}");
// med_01KSR2WVAGC05ZGR6FA4QYEB12  INSULIN  True

// Symmetric traversal — which conditions is insulin used for?
var usedFor = insulin.Conditions(ReferenceSort.MostCommonFirst);
// frequency-ordered list; cond_01KSR2WVAGC05ZGR6FA4QYEA8X first

var novel = isa.Zyins.Medications.Match("NewExperimental XR 2026");
// novel.IsKnown == false; novel.InputText == "NewExperimental XR 2026"
```

`ReferenceSort.MostCommonFirst` and `ReferenceSort.Alphabetical` are the two
supported orderings.

## Case storage — bring your own

`isa.Zyins.Cases.*` routes through an `ICaseStorage` adapter. The default is
the zero-knowledge store — ISA's servers only hold ciphertext and an opaque
ID. To plug a carrier-controlled store, pass your adapter at construction:

```csharp
var isa = await Isa.WithKeycodeAsync(new KeycodeOptions
{
    Keycode = keycode, Email = email,
    CaseStorage = new CarrierCaseStorage(),  // optional; default = ZeroKnowledgeCaseStorage
});
```

See [cases guide](https://docs.isaapi.com/docs/cases) for the full
bring-your-own pattern.

## Thread safety

`Isa` is thread-safe and supports `Task.WhenAll` for parallel calls. Construct once per token / process; share the same instance across requests. Sub-clients (`Zyins.Prequalify`, `Zyins.Quote`, `Zyins.Datasets`, ...) hold no per-call state.

```csharp
var isa = Isa.WithBearer();
var tasks = applicants.Select(a => isa.Zyins.Prequalify.RunAsync(BuildInput(a)));
var results = await Task.WhenAll(tasks);
```

## Raw response access

Every method has a `WithRawResponseAsync` variant returning both the parsed body and a `RawResponse` (status, headers, request URI, body):

```csharp
var (data, raw) = await isa.Zyins.Prequalify.WithRawResponseAsync(input);
var requestId = raw.Headers["X-Request-Id"];
```

## Debug logging

Set `ISA_LOG=debug` in the environment to dump redacted requests and responses to **stderr** (never stdout). `Authorization`, `X-Device-Signature`, `X-Session-Signature` headers and `email` / `dob` / `ssn` / `phone` JSON fields are replaced with `[redacted]` before the line hits the wire.

## Error handling

All exceptions inherit from `IsaException`. Match on `ex.CodeEnum` (a stable `ErrorCode` enum) rather than `ex.Message`:

```csharp
try
{
    await isa.Zyins.Prequalify.RunAsync(input);
}
catch (IsaIdempotencyConflictException ex)
{
    log.Error($"key {ex.Key} reused; first seen at {ex.FirstSeenAt}");
}
catch (IsaRateLimitException ex)
{
    await Task.Delay(ex.RetryAfter ?? TimeSpan.FromSeconds(1));
}
```

## License

MIT. Copyright (c) Software Automation Holdings, LLC.

## License and readiness surface

The SDK exposes the BPP license-lifecycle surface and the platform readiness probe:

```csharp
using Isa.Sdk;
using Isa.Sdk.Zyins;

var isa = Isa.WithBearer("isa_live_4fjK2nQ7mX1aB8sR9pZ3");

var result = await isa.Zyins.License.CheckAsync(new LicenseCheckRequest
{
    Email = "john.doe@acme-agency.com",
    Keycode = "ABC-123-XYZ",
});
// result.Status: "valid" | "invalid" | "inactive"
// result.ValidationStatus: typed LicenseValidationStatus enum

var ready = await isa.Zyins.Health.GetReadinessAsync();
// ready.Ready: true on every required probe = "serving"
```

`/v1/licenses/check` and `/v1/licenses/deactivate` are public;
`/readyz` is the unauthenticated load-balancer probe.
