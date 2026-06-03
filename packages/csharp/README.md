# IsaSdk

Official C# SDK for the [Best Plan Pro API](https://docs.isaapi.com) — powered by the ZyINS engine.

The NuGet package is `IsaSdk`; the C# namespace you import is `Isa.Sdk`. The two differ because the bare `Isa.Sdk` nuget id is reserved on nuget.org.

## Install

```bash
dotnet add package IsaSdk
```

## Hello world

```csharp @no-compile
using Isa.Sdk;
using Isa.Sdk.Zyins;

// Reads ISA_TOKEN from the environment. PrequalifyAsync routes to v3 by
// default and returns the flat plans[] result with the uniform pricing table.
var isa = IsaClient.WithBearer();
var result = await isa.Zyins.PrequalifyAsync(request);
```

## Authentication

Three factories cover the three audiences described in [SDK_DESIGN.md §3](https://github.com/Software-Automation-Holdings-LLC/isa-platform/blob/main/docs/SDK_DESIGN.md):

| Factory | Audience | Env vars read |
|---|---|---|
| `IsaClient.WithBearer(token?)` | Server-to-server | `ISA_TOKEN` |
| `IsaClient.WithLicense(credentials?)` | Agent tools (BPP web/desktop) | `ISA_LICENSE_KEYCODE`, `ISA_LICENSE_EMAIL` |
| `IsaClient.WithSession(credentials?)` | Embedded forms | `ISA_SESSION_ID`, `ISA_SESSION_SECRET` |

Missing required env vars throw `IsaConfigException` synchronously at construction; the client never silently misbehaves.

## First call in <15 lines

```csharp
using Isa.Sdk;
using Isa.Sdk.Catalog;
using Isa.Sdk.Zyins;

var isa = await IsaClient.WithKeycodeAsync(new LicenseOptions
{
    Keycode = "ABC-123-XYZ",
    Email   = "john.doe@acme-agency.com",
});

var result = await isa.Zyins.PrequalifyAsync(new PrequalifyRequest(
    Applicant: new Applicant
    {
        Dob = "1962-04-18", Sex = Sex.Male, State = "NC",
        HeightInches = 70, WeightPounds = 195,
    },
    Coverage: Coverage.ByFaceValue(25_000),
    Products: new[] { Products.Fex.AetnaAccendo }));

foreach (var offer in result.Plans)
{
    var headline = Grouping.OfferPremium(offer);
    Console.WriteLine($"{offer.Carrier.Name} {offer.Product.Name}: {headline?.Amount.Display}");
}
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
// prequalify => v3
// quote      => v3
// datasets   => v3
// reference  => v3
// sessions   => v1
// branding   => v1
// cases      => v1
```

Pin individual surfaces with an `ApiVersion` override dictionary. There is
**no** `default` key and **no** string shorthand — resolution is
`ApiVersion.TryGetValue(surface, …) ?? BundledApiVersions.Map[surface]`:

The per-surface `ApiVersion` override map lives on `IsaClientOptions`:

```csharp
using Isa.Sdk.Zyins;
using Isa.Sdk.Zyins.Options;

var zyins = new ZyInsClient(new IsaClientOptions
{
    Token = Environment.GetEnvironmentVariable("ISA_TOKEN")!,
    ApiVersion = new Dictionary<string, IsaApiVersion>
    {
        ["quote"] = IsaApiVersion.V2,   // pin only quote; everything else bundled
    },
});
```

`prequalify` / `quote` / `datasets` / `reference` default to `v3` — call
`PrequalifyAsync` / `QuoteAsync` for the flat `plans[]` shape and the Money
primitive. Pin `["prequalify"] = IsaApiVersion.V2` only when a consumer still
needs the legacy v2 shape. See [SDK syntax proposal §2.7][syntax-27].

[syntax-27]: ../../docs/sdk-syntax-proposal.md#27-versioning--per-surface-not-global

## Reference data — `.MatchAsync()`

The unversioned `isa.Zyins.Reference` namespace canonicalizes free-text
medication and condition input. Unknown text never rejects — it returns a
structured `Concept` with `IsKnown=false`, so the final canonicalization
fires server-side at `/vN/prequalify`:

The bundleless `MatchAsync` lazily fetches and caches the reference
catalog on its first call — no explicit dataset fetch is required.

```csharp
var insulin = await isa.Zyins.Medications.MatchAsync("insulin");
Console.WriteLine($"{insulin.Id}  {insulin.Name}  {insulin.IsKnown}");
// med_01KSR2WVAGC05ZGR6FA4QYEB12  INSULIN  True

// Symmetric traversal — which conditions is insulin used for?
var usedFor = insulin.Conditions(Sort.MostCommonFirst);
// frequency-ordered list; cond_01KSR2WVAGC05ZGR6FA4QYEA8X first

var novel = await isa.Zyins.Medications.MatchAsync("NewExperimental XR 2026");
// novel.IsKnown == false; novel.InputText == "NewExperimental XR 2026"
```

`Sort.MostCommonFirst` and `Sort.Alphabetical` (from
`Isa.Sdk.Zyins.Reference`) are the two supported orderings.

## Case storage — bring your own

`isa.Zyins.Cases.*` routes through an `ICaseStorage` adapter. The default is
the zero-knowledge store — ISA's servers only hold ciphertext and an opaque
ID. To plug a carrier-controlled store, pass your adapter at construction:

```csharp @no-compile
using Isa.Sdk.Zyins;

var zyins = new ZyInsClient(new IsaClientOptions
{
    Token = Environment.GetEnvironmentVariable("ISA_TOKEN")!,
    CaseStorage = new CarrierCaseStorage(),  // optional; default = ZeroKnowledgeCaseStorage
});
```

See [cases guide](https://docs.isaapi.com/docs/cases) for the full
bring-your-own pattern.

## Thread safety

`IsaClient` is thread-safe and supports `Task.WhenAll` for parallel calls. Construct once per token / process; share the same instance across requests. Sub-clients (`Zyins.Prequalify`, `Zyins.Quote`, `Zyins.Datasets`, ...) hold no per-call state.

```csharp
var isa = IsaClient.WithBearer();
var tasks = applicants.Select(a => isa.Zyins.PrequalifyAsync(BuildRequest(a)));
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

var isa = IsaClient.WithBearer("isa_live_4fjK2nQ7mX1aB8sR9pZ3");

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
