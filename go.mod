// Unified ISA SDK for Go.
//
// Published as a single module: github.com/Software-Automation-Holdings-LLC/sdk
//
// Layout:
//
//	core/      — Auth, errors, Envelope, transport, debug, replay
//	zyins/     — Prequalify, Quote, datasets, namespace
//	rapidsign/ — Documents, webhooks, awaitSignature
//	proxy/     — Algosure verifier, raw-call transport
//
// Consumers depend on the root module and import sub-packages:
//
//	import (
//	    sdk "github.com/Software-Automation-Holdings-LLC/sdk"
//	    "github.com/Software-Automation-Holdings-LLC/sdk/zyins"
//	)
//
// See SDK_DESIGN.md §0 for consolidation rationale.

module github.com/Software-Automation-Holdings-LLC/sdk

go 1.26.1

require (
	connectrpc.com/connect v1.19.2
	golang.org/x/sync v0.20.0
	google.golang.org/genproto/googleapis/api v0.0.0-20260518230821-037a81a441c8
	google.golang.org/protobuf v1.36.11
)
