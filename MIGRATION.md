# Migrating from per-product Go SDKs to the unified `sdk` module

The ISA Go SDK is now published as a single Go module instead of four.
Sub-package import paths are unchanged; only the consumer `go.mod`
requirement entry needs to change.

## `go.mod`

Before:

```
require (
    github.com/Software-Automation-Holdings-LLC/sdk/core v0.2.4
    github.com/Software-Automation-Holdings-LLC/sdk/zyins v0.2.4
    github.com/Software-Automation-Holdings-LLC/sdk/rapidsign v0.2.4
    github.com/Software-Automation-Holdings-LLC/sdk/proxy v0.2.4
)
```

After:

```
require github.com/Software-Automation-Holdings-LLC/sdk v0.3.0
```

Run (with `GOPRIVATE=github.com/Software-Automation-Holdings-LLC/*`):

```
go mod edit -droprequire=github.com/Software-Automation-Holdings-LLC/sdk/core
go mod edit -droprequire=github.com/Software-Automation-Holdings-LLC/sdk/zyins
go mod edit -droprequire=github.com/Software-Automation-Holdings-LLC/sdk/rapidsign
go mod edit -droprequire=github.com/Software-Automation-Holdings-LLC/sdk/proxy
go get github.com/Software-Automation-Holdings-LLC/sdk@v0.3.0
go mod tidy
```

## Imports unchanged

```go
import (
    "github.com/Software-Automation-Holdings-LLC/sdk/zyins"
    "github.com/Software-Automation-Holdings-LLC/sdk/rapidsign"
    "github.com/Software-Automation-Holdings-LLC/sdk/proxy/algosure"
    coretransport "github.com/Software-Automation-Holdings-LLC/sdk/core/transport"
)
```

## New root facade

```go
import sdk "github.com/Software-Automation-Holdings-LLC/sdk"

isa, err := sdk.WithBearer("")  // reads ISA_TOKEN
if err != nil { return err }
resp, err := isa.Zyins.Prequalify.Run(ctx, req)
```

Phase 1-5 capabilities are preserved on the sub-packages unchanged.

## Codemod

A minimal scaffold lives at `codemod-v2/cmd/isa-sdk-go-v0.3.0/main.go`.
