package zyins

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// Paths for the ZyINS public license-lifecycle surface (see ADR-013).
const (
	licensesCheckPath      = "/v1/licenses/check"
	licensesDeactivatePath = "/v1/licenses/deactivate"
)

// LicenseValidationStatus mirrors the proto `LicenseStatus` enum
// (api.zyins.v1.LicenseStatus). Wire values are lower-case strings.
type LicenseValidationStatus string

// Enumerated license validation states. Unknown wire values are
// surfaced verbatim so the SDK never drops information.
const (
	LicenseStatusValid    LicenseValidationStatus = "valid"
	LicenseStatusInvalid  LicenseValidationStatus = "invalid"
	LicenseStatusInactive LicenseValidationStatus = "inactive"
)

// LicensesService groups the public BPP license-lifecycle calls
// (PublicCheck, PublicDeactivate). Authenticated self-* operations
// (LockSelf, RefreshSelf, etc.) ship after the LicenseHMAC transport
// lands; this service exposes the no-auth + body-credential surface
// only.
type LicensesService struct {
	client *Client
	// state is the optional CredentialState attached via WithState. When
	// non-nil, zero-arg ergonomic variants (Activate / Check / Deactivate
	// without an explicit input) pull credentials from it.
	state *CredentialState
}

// WithState attaches a CredentialState to the service so zero-arg
// activate/check/deactivate variants can pull credentials and stash the
// minted license key back into shared state automatically.
func (s *LicensesService) WithState(state *CredentialState) *LicensesService {
	s.state = state
	return s
}

// State returns the attached CredentialState, or nil when none is set.
func (s *LicensesService) State() *CredentialState { return s.state }

// LicenseCheckInput is the typed request shape for Licenses.Check.
type LicenseCheckInput struct {
	// Email associated with the license. Required.
	Email string
	// Keycode is the BPP order keycode (XXX-XXX-XXX, case-insensitive).
	// Required.
	Keycode string
	// DeviceID is the client-generated device fingerprint. Optional;
	// when supplied, the server includes it in the anti-piracy check.
	DeviceID string
	// LicenseKey is the deterministic license key to verify. Optional;
	// when supplied, the server validates it against the order.
	LicenseKey string
}

// LicenseCheckResult is the typed response from Licenses.Check.
type LicenseCheckResult struct {
	// Status is the validation outcome (valid, invalid, inactive).
	Status LicenseValidationStatus `json:"status"`
}

// LicenseDeactivateInput is the typed request shape for
// Licenses.Deactivate.
type LicenseDeactivateInput struct {
	// Email associated with the license. Required.
	Email string
	// Keycode is the BPP order keycode. Required.
	Keycode string
	// DeviceID is the device fingerprint. Optional; reset on success.
	DeviceID string
}

// LicenseDeactivateResult is the typed response from
// Licenses.Deactivate.
type LicenseDeactivateResult struct {
	// Status is always "deactivated" on success.
	Status string `json:"status"`
}

// licensesCheckWireBody is the on-wire JSON body for /v1/licenses/check.
type licensesCheckWireBody struct {
	Email      string `json:"email"`
	Keycode    string `json:"keycode"`
	DeviceID   string `json:"device_id,omitempty"`
	LicenseKey string `json:"license_key,omitempty"`
}

// licensesDeactivateWireBody is the on-wire JSON body for
// /v1/licenses/deactivate.
type licensesDeactivateWireBody struct {
	Email    string `json:"email"`
	Keycode  string `json:"keycode"`
	DeviceID string `json:"device_id,omitempty"`
}

// Check performs a lightweight phone-home validation. The server does
// not require authentication for this call; an attached bearer token
// is harmless and lets one client struct serve every operation.
func (s *LicensesService) Check(ctx context.Context, input *LicenseCheckInput, opts ...RunOption) (*LicenseCheckResult, error) {
	filled := s.fillCheck(input)
	if strings.TrimSpace(filled.Email) == "" {
		return nil, validationFailure("zyins: LicenseCheckInput.Email is required")
	}
	if strings.TrimSpace(filled.Keycode) == "" {
		return nil, validationFailure("zyins: LicenseCheckInput.Keycode is required")
	}
	body := licensesCheckWireBody{
		Email:      filled.Email,
		Keycode:    filled.Keycode,
		DeviceID:   filled.DeviceID,
		LicenseKey: filled.LicenseKey,
	}
	ro := collectRunOptions(opts)
	raw, err := s.client.doJSON(ctx, requestArgs{
		method:         http.MethodPost,
		path:           licensesCheckPath,
		body:           body,
		op:             "licenses_check",
		idempotencyKey: ro.idempotencyKey,
	})
	if err != nil {
		return nil, fmt.Errorf("zyins: Licenses.Check: %w", err)
	}
	return decodeLicenseCheckResponse(raw)
}

// Deactivate revokes an activation, resets the anti-piracy device
// record, and marks the order inactive. The server does not require
// authentication for this call.
func (s *LicensesService) Deactivate(ctx context.Context, input *LicenseDeactivateInput, opts ...RunOption) (*LicenseDeactivateResult, error) {
	filled := s.fillDeactivate(input)
	if strings.TrimSpace(filled.Email) == "" {
		return nil, validationFailure("zyins: LicenseDeactivateInput.Email is required")
	}
	if strings.TrimSpace(filled.Keycode) == "" {
		return nil, validationFailure("zyins: LicenseDeactivateInput.Keycode is required")
	}
	body := licensesDeactivateWireBody{
		Email:    filled.Email,
		Keycode:  filled.Keycode,
		DeviceID: filled.DeviceID,
	}
	ro := collectRunOptions(opts)
	raw, err := s.client.doJSON(ctx, requestArgs{
		method:         http.MethodPost,
		path:           licensesDeactivatePath,
		body:           body,
		op:             "licenses_deactivate",
		idempotencyKey: ro.idempotencyKey,
	})
	if err != nil {
		return nil, fmt.Errorf("zyins: Licenses.Deactivate: %w", err)
	}
	result, err := decodeLicenseDeactivateResponse(raw)
	if err != nil {
		return nil, err
	}
	if s.state != nil {
		if err := s.state.ClearLicenseKey(); err != nil {
			return nil, fmt.Errorf("zyins: Licenses.Deactivate clearing state: %w", err)
		}
	}
	return result, nil
}

// fillCheck merges the caller-supplied input with the attached state.
func (s *LicensesService) fillCheck(input *LicenseCheckInput) LicenseCheckInput {
	out := LicenseCheckInput{}
	if input != nil {
		out = *input
	}
	if s.state == nil {
		return out
	}
	snap := s.state.Snapshot()
	if out.Email == "" {
		out.Email = snap.Email
	}
	if out.Keycode == "" {
		out.Keycode = snap.Keycode
	}
	if out.DeviceID == "" {
		out.DeviceID = snap.DeviceID
	}
	if out.LicenseKey == "" {
		out.LicenseKey = snap.LicenseKey
	}
	return out
}

// fillDeactivate merges the caller-supplied input with the attached state.
func (s *LicensesService) fillDeactivate(input *LicenseDeactivateInput) LicenseDeactivateInput {
	out := LicenseDeactivateInput{}
	if input != nil {
		out = *input
	}
	if s.state == nil {
		return out
	}
	snap := s.state.Snapshot()
	if out.Email == "" {
		out.Email = snap.Email
	}
	if out.Keycode == "" {
		out.Keycode = snap.Keycode
	}
	if out.DeviceID == "" {
		out.DeviceID = snap.DeviceID
	}
	return out
}

// collectRunOptions folds opts into a single runOptions value. Defined
// here so future per-call options can be added without touching every
// sub-service.
func collectRunOptions(opts []RunOption) runOptions {
	ro := runOptions{}
	for _, o := range opts {
		if o != nil {
			o(&ro)
		}
	}
	return ro
}

// validationFailure produces a typed *ValidationError. Identical to
// the construction pattern used in Prequalify.Run; extracted so every
// sub-service speaks the same error idiom.
func validationFailure(msg string) error {
	return &ValidationError{Base: &Error{
		Code:    ErrorCodeValidationError,
		Message: msg,
	}}
}

// decodeLicenseCheckResponse parses the /v1/licenses/check 200 body.
// Tolerates both the bare proto shape and the platform ADR-012
// envelope `{ data: { ... } }` so a future server-side wrap does not
// break clients.
func decodeLicenseCheckResponse(body []byte) (*LicenseCheckResult, error) {
	data, err := unwrapEnvelope(body, "licenses_check")
	if err != nil {
		return nil, err
	}
	var result LicenseCheckResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("zyins: failed to decode licenses_check response: %w", err)
	}
	return &result, nil
}

// decodeLicenseDeactivateResponse parses the /v1/licenses/deactivate
// 200 body, applying the same envelope tolerance as Check.
func decodeLicenseDeactivateResponse(body []byte) (*LicenseDeactivateResult, error) {
	data, err := unwrapEnvelope(body, "licenses_deactivate")
	if err != nil {
		return nil, err
	}
	var result LicenseDeactivateResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("zyins: failed to decode licenses_deactivate response: %w", err)
	}
	return &result, nil
}

// unwrapEnvelope returns the inner data bytes for an ADR-012 response,
// or the full body when no envelope is present.
func unwrapEnvelope(body []byte, op string) ([]byte, error) {
	if len(body) == 0 {
		return nil, fmt.Errorf("zyins: %s response body was empty", op)
	}
	var env map[string]json.RawMessage
	if err := json.Unmarshal(body, &env); err != nil {
		return nil, fmt.Errorf("zyins: failed to decode %s envelope: %w", op, err)
	}
	if data, ok := env["data"]; ok {
		if len(data) == 0 || bytes.Equal(bytes.TrimSpace(data), []byte("null")) {
			return nil, fmt.Errorf("zyins: %s envelope data was null", op)
		}
		return data, nil
	}
	return body, nil
}
