# IsaSdk.ZyINS

Official C# SDK for the [ISA Platform](https://docs.isaapi.com) ZyINS insurance-prequalification API.

## Install

```bash
dotnet add package IsaSdk.ZyINS
```

## Hello world

```csharp
using IsaSdk.ZyINS;

// Reads ISA_TOKEN from the environment.
var isa = Isa.WithBearer();
var result = await isa.Prequalify.RunAsync(input);
```

## Authentication

Three factories cover the three audiences described in [SDK_DESIGN.md §3](https://github.com/Software-Automation-Holdings-LLC/isa-platform/blob/main/docs/SDK_DESIGN.md):

| Factory | Audience | Env vars read |
|---|---|---|
| `Isa.WithBearer(token?)` | Server-to-server | `ISA_TOKEN` |
| `Isa.WithLicense(credentials?)` | Agent tools (BPP web/desktop) | `ISA_LICENSE_KEYCODE`, `ISA_LICENSE_EMAIL` |
| `Isa.WithSession(credentials?)` | Embedded forms | `ISA_SESSION_ID`, `ISA_SESSION_SECRET` |

Missing required env vars throw `IsaConfigException` synchronously at construction; the client never silently misbehaves.

## Thread safety

The `ZyInsClient` is thread-safe and supports `Task.WhenAll` for parallel calls. Construct once per token / process; share the same instance across requests. Sub-clients (`Prequalify`, `Quote`, `Datasets`, ...) hold no per-call state.

```csharp
var isa = Isa.WithBearer();
var tasks = applicants.Select(a => isa.Prequalify.RunAsync(BuildInput(a)));
var results = await Task.WhenAll(tasks);
```

## Raw response access

Every method has a `WithRawResponseAsync` variant returning both the parsed body and a `RawResponse` (status, headers, request URI, body):

```csharp
var (data, raw) = await isa.Prequalify.WithRawResponseAsync(input);
var requestId = raw.Headers["X-Request-Id"];
```

## Debug logging

Set `ISA_LOG=debug` in the environment to dump redacted requests and responses to **stderr** (never stdout). `Authorization`, `X-Device-Signature`, `X-Session-Signature` headers and `email` / `dob` / `ssn` / `phone` JSON fields are replaced with `[redacted]` before the line hits the wire.

## Error handling

All exceptions inherit from `IsaException`. Match on `ex.CodeEnum` (a stable `ErrorCode` enum) rather than `ex.Message`:

```csharp
try
{
    await isa.Prequalify.RunAsync(input);
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

## Licenses and Ready

The C# SDK exposes the public BPP license-lifecycle surface and the
platform readiness probe on every `ZyInsClient`:

```csharp
using Sah.Sdk.Zyins;

var client = new ZyInsClient("isa_live_...");

var result = await client.Licenses.CheckAsync(new LicensesCheckRequest
{
    Email = "john.doe@acme-agency.com",
    Keycode = "ABC-123-XYZ",
});
// result.Status: "valid" | "invalid" | "inactive"
// result.ValidationStatus: typed LicenseValidationStatus enum

var ready = await client.Health.GetReadinessAsync();
// ready.Ready: true on every required probe = "serving"
```

`/v1/licenses/check` and `/v1/licenses/deactivate` are public;
`/ready` is the unauthenticated load-balancer probe.
