// Package sdk is the unified ISA SDK for Go.
//
// It provides one client type, [Isa], with product namespaces attached
// as fields:
//
//	isa, err := sdk.WithBearer("isa_live_…")
//	if err != nil { return err }
//	resp, err := isa.Zyins.Prequalify.Run(ctx, req)
//
// The factory functions read environment-variable defaults when called
// with empty arguments (see SDK_DESIGN.md §3.3):
//
//	ISA_TOKEN                 → WithBearer
//	ISA_LICENSE_KEYCODE/EMAIL → WithLicense
//	ISA_SESSION_ID/SECRET     → WithSession
//
// All Phase 1-5 capabilities — stderr-only debug logging, typed
// [zyins.IdempotencyConflictError], envelope fields (RequestID,
// IdempotencyKey, RetryAttempts), *WithRawResponse variants, cursor
// escape hatch on iter structs — live in the product sub-packages and
// are reached via the namespaces below.
//
// Example:
//
//	isa, err := sdk.WithBearer("")  // reads ISA_TOKEN
//	if err != nil { return err }
//	resp, err := isa.Zyins.Prequalify.Run(ctx, &zyins.PrequalifyInput{...})
package sdk

import (
	"fmt"
	"os"

	"github.com/Software-Automation-Holdings-LLC/sdk/rapidsign"
	"github.com/Software-Automation-Holdings-LLC/sdk/zyins"
)

// Isa is the unified entry point. Construct one per process via the
// factory functions below; the namespaces share underlying transport
// resources and are safe for concurrent use.
type Isa struct {
	Zyins     *zyins.Client
	RapidSign *rapidsign.Client
	Webhooks  *WebhooksNamespace
}

// WebhooksNamespace is the placeholder for cross-product webhook
// helpers; per-product webhook verifiers continue to live on their
// product namespaces today.
type WebhooksNamespace struct{}

// LicenseOptions configures the License auth mode. Empty fields are
// filled from the environment (ISA_LICENSE_KEYCODE, ISA_LICENSE_EMAIL).
type LicenseOptions struct {
	Keycode string
	Email   string
}

// SessionOptions configures the Session auth mode. Empty fields are
// filled from the environment (ISA_SESSION_ID, ISA_SESSION_SECRET).
type SessionOptions struct {
	SessionID     string
	SessionSecret string //nolint:gosec // documented credential field
}

// WithBearer constructs an Isa client authenticated by a long-lived
// bearer token. When the token argument is empty, ISA_TOKEN is read
// from the environment; absence returns *zyins.ConfigError.
//
// Example:
//
//	isa, err := sdk.WithBearer("")
//	if err != nil { return err }
//	resp, err := isa.Zyins.Prequalify.Run(ctx, req)
func WithBearer(token string) (*Isa, error) {
	if len(token) == 0 {
		envToken, ok := os.LookupEnv(zyins.EnvTokenVar)
		if !ok || len(envToken) == 0 {
			return nil, &zyins.ConfigError{
				Factory:    "WithBearer",
				MissingEnv: []string{zyins.EnvTokenVar},
			}
		}
		token = envToken
	}
	zc, err := zyins.NewClient(zyins.WithToken(token))
	if err != nil {
		return nil, fmt.Errorf("sdk: WithBearer: zyins.NewClient: %w", err)
	}
	rc, err := rapidsign.New(token)
	if err != nil {
		return nil, fmt.Errorf("sdk: WithBearer: rapidsign.New: %w", err)
	}
	return &Isa{Zyins: zc, RapidSign: rc, Webhooks: &WebhooksNamespace{}}, nil
}

// WithLicense constructs an Isa client authenticated by the License
// auth mode. Empty option fields are filled from the environment.
//
// License transport is not wired yet: valid credentials still return
// *zyins.ConfigError explaining the pending transport (same as
// [zyins.WithLicenseCredential]). Use [WithBearer] until it ships.
//
// Example:
//
//	isa, err := sdk.WithLicense(sdk.LicenseOptions{})  // reads env
//	if err != nil { return err }
func WithLicense(opts LicenseOptions) (*Isa, error) {
	zyinsAuthOpt, err := buildLicenseOption(opts)
	if err != nil {
		return nil, err
	}
	zc, err := zyins.NewClient(zyinsAuthOpt)
	if err != nil {
		return nil, fmt.Errorf("sdk: WithLicense: zyins.NewClient: %w", err)
	}
	return &Isa{Zyins: zc, RapidSign: nil, Webhooks: &WebhooksNamespace{}}, nil
}

// WithSession constructs an Isa client authenticated by the Session
// auth mode. Empty option fields are filled from the environment.
//
// Session transport is not wired yet: valid credentials still return
// *zyins.ConfigError explaining the pending transport (same as
// [zyins.WithSessionCredential]). Use [WithBearer] until it ships.
//
// Example:
//
//	isa, err := sdk.WithSession(sdk.SessionOptions{})  // reads env
//	if err != nil { return err }
func WithSession(opts SessionOptions) (*Isa, error) {
	zyinsAuthOpt, err := buildSessionOption(opts)
	if err != nil {
		return nil, err
	}
	zc, err := zyins.NewClient(zyinsAuthOpt)
	if err != nil {
		return nil, fmt.Errorf("sdk: WithSession: zyins.NewClient: %w", err)
	}
	return &Isa{Zyins: zc, RapidSign: nil, Webhooks: &WebhooksNamespace{}}, nil
}

func buildLicenseOption(opts LicenseOptions) (zyins.Option, error) {
	keycode := opts.Keycode
	email := opts.Email
	missing := make([]string, 0, 2)
	if len(keycode) == 0 {
		if v := os.Getenv(zyins.EnvLicenseKeycodeVar); len(v) > 0 {
			keycode = v
		} else {
			missing = append(missing, zyins.EnvLicenseKeycodeVar)
		}
	}
	if len(email) == 0 {
		if v := os.Getenv(zyins.EnvLicenseEmailVar); len(v) > 0 {
			email = v
		} else {
			missing = append(missing, zyins.EnvLicenseEmailVar)
		}
	}
	if len(missing) > 0 {
		return nil, &zyins.ConfigError{Factory: "WithLicense", MissingEnv: missing}
	}
	return zyins.WithLicenseCredential(zyins.LicenseCredential{Keycode: keycode, Email: email}), nil
}

func buildSessionOption(opts SessionOptions) (zyins.Option, error) {
	id := opts.SessionID
	secret := opts.SessionSecret
	missing := make([]string, 0, 2)
	if len(id) == 0 {
		if v := os.Getenv(zyins.EnvSessionIDVar); len(v) > 0 {
			id = v
		} else {
			missing = append(missing, zyins.EnvSessionIDVar)
		}
	}
	if len(secret) == 0 {
		if v := os.Getenv(zyins.EnvSessionSecretVar); len(v) > 0 {
			secret = v
		} else {
			missing = append(missing, zyins.EnvSessionSecretVar)
		}
	}
	if len(missing) > 0 {
		return nil, &zyins.ConfigError{Factory: "WithSession", MissingEnv: missing}
	}
	return zyins.WithSessionCredential(zyins.SessionCredential{SessionID: id, SessionSecret: secret}), nil
}
