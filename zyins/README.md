# zyins — Go SDK for the ISA Platform ZyINS API

```go
import zyins "github.com/Software-Automation-Holdings-LLC/sdk/zyins"

client, err := zyins.NewClient(zyins.WithToken("isa_live_4fjK2nQ7mX1aB8sR9pZ3"))
if err != nil { return err }
result, err := client.Prequalify.Run(ctx, &zyins.PrequalifyInput{ /* applicant, coverage, products */ })
```

The bearer token is the only required configuration; the client injects
`Authorization: Bearer <token>` on every outbound request.

## Sub-services

| Field | Operations |
| --- | --- |
| `client.Prequalify` | `Run(ctx, *PrequalifyInput, ...RunOption)` |
| `client.Quote` | `Run(ctx, *QuoteInput, ...RunOption)` |
| `client.Datasets` | `Conditions`, `Medications`, `Brands`, `Plans` (paginated) |
| `client.ReferenceData` | `States`, `ProductTypes`, `NicotineModes` |
| `client.Usage` | `Current(ctx)` |

## Construction options

`NewClient` accepts the functional-options pattern.

- `WithToken(string)` — required (or `WithTokenSource`).
- `WithTokenSource(TokenSource)` — for rotating credentials.
- `WithBaseURL(string)` — defaults to `https://zyins.isaapi.com`.
- `WithHTTPClient(*http.Client)` — preserves any custom transport.
- `WithTimeout(time.Duration)` — per-request ceiling.
- `WithUserAgent(string)` — overrides the SDK identifier.
- `WithMaxRetryAttempts(int)` — caps total request attempts.

Per-call `RunOption` values:

- `WithIdempotencyKey(string)` — overrides the SDK-generated key.

## Construction from environment

For shell-style "set these env vars and go" usage, the package exposes
no-arg factories that read defaults from the environment and return a
typed `*ConfigError` when a required variable is unset:

```go
opt, err := zyins.WithBearer()                // reads ISA_TOKEN
if err != nil { return err }                  // *ConfigError naming ISA_TOKEN
client, err := zyins.NewClient(opt)
```

| Factory | Env vars read |
| --- | --- |
| `zyins.WithBearer()` | `ISA_TOKEN` |
| `zyins.WithLicense()` | `ISA_LICENSE_KEYCODE`, `ISA_LICENSE_EMAIL` |
| `zyins.WithSession()` | `ISA_SESSION_ID`, `ISA_SESSION_SECRET` |

License and Session auth modes capture credentials at construction.
The transports wire incrementally; until they ship, `NewClient` returns
a typed `*ConfigError` so the gap surfaces at construction rather than
at first request.

## Debug logging

Set `ISA_LOG=debug` to dump every request and response to **stderr**
via `slog` (never stdout — parent/child JSON pipelines route stdout to
the next process):

```bash
ISA_LOG=debug go run ./cmd/quote-demo
```

Sensitive headers (`Authorization`, `X-Device-Signature`,
`X-Session-Signature`, `Idempotency-Key`) and PII body fields (`email`,
`dob`, `ssn`, `phone`) are replaced with `[REDACTED]` before any value
reaches the logger.

Override the logger with `WithLogger(l)` to plug in zap/zerolog/etc.;
any type satisfying `DebugLogger` (a two-method `Debug`/`Warn`
interface) is accepted.

## Raw response access

Every operation has a `RunWithRawResponse` (or equivalent) variant that
returns the parsed envelope plus a `*RawResponse` exposing the
underlying HTTP status, headers, and URL:

```go
env, raw, err := client.Prequalify.RunWithRawResponse(ctx, input)
if err != nil { return err }
log.Printf("server latency header: %s", raw.Header.Get("X-Server-Time"))
log.Printf("request id: %s, retries: %d", env.RequestID, env.RetryAttempts)
```

The envelope carries `RequestID`, `IdempotencyKey`, `Livemode`, and
`RetryAttempts` so audit-grade callers do not need to parse the raw
JSON themselves.

## Concurrency

`*Client` is safe for use with `errgroup.Group`, raw goroutines, or any
`sync` primitive — it carries no shared mutable state. Each in-flight
request mints its own `Idempotency-Key` and `X-Request-Id`, so 100
concurrent `Prequalify.Run` calls produce 100 distinct request ids
server-side. The package's integration tests assert this directly.

```go
var g errgroup.Group
for _, req := range reqs {
    req := req
    g.Go(func() error {
        _, err := client.Prequalify.Run(ctx, req)
        return err
    })
}
return g.Wait()
```

## Errors

Every API error is a typed value. Switch on `Code` (stable wire enum)
rather than HTTP status or message text.

```go
result, err := client.Prequalify.Run(ctx, input)
switch {
case errors.Is(err, zyins.ErrAuth):
    // rotate token, do not retry
case errors.Is(err, zyins.ErrRateLimit):
    var rle *zyins.RateLimitError
    _ = errors.As(err, &rle)
    time.Sleep(rle.RetryAfter)
case errors.Is(err, zyins.ErrValidation):
    var ve *zyins.ValidationError
    _ = errors.As(err, &ve)
    log.Printf("field %s: %s", ve.Base.Param, ve.Base.Message)
}
```

## Tests

```bash
go test ./...                    # unit tests
go test -race ./...              # race detector
go test -tags integration ./...  # live server (requires ZYINS_TEST_BEARER)
```

## Module layout

| File | Concept |
| --- | --- |
| `client.go` | `Client`, functional options |
| `auth.go` | `TokenSource`, `StaticToken`, token-shape validation |
| `env.go` | Env-var factories (`WithBearer`, `WithLicense`, `WithSession`), `*ConfigError` |
| `debug.go` | `DebugLogger`, stderr slog handler honoring `ISA_LOG=debug`, header + body redaction |
| `errors.go` | `Error` base + typed subclasses + RFC 7807 parser + `IdempotencyConflictError` |
| `response.go` | `Envelope[T]`, `RawResponse`, envelope-metadata extraction |
| `transport.go` | JSON request/response helper |
| `idempotency.go` | Idempotency-Key generation |
| `applicant.go` | `Applicant`, `Height`, `Weight`, `Medication`, `Condition` |
| `coverage.go` | `Coverage` discriminated value |
| `product.go` | `Product`, `ProductSelection` |
| `prequalify.go` | Prequalify operation |
| `quote.go` | Quote operation |
| `datasets.go` | Read-only datasets (conditions, medications, brands, plans) |
| `referencedata.go` | Static lookup tables |
| `usage.go` | Consumption counters |

The package composes the `BearerTransport`, `RetryTransport`, and
response-envelope helpers from `sdk/core/transport`; only the
ZyINS-specific wire shape and operation builders live here.
