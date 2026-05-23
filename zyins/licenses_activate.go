package zyins

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const licensesActivatePath = "/v1/licenses/activate"

// LicenseActivateInput is the request shape for License.Activate.
// Every field is required; the activation surface mints a fresh
// license key bound to the supplied device fingerprint.
type LicenseActivateInput struct {
	Email    string
	Keycode  string
	DeviceID string
}

// LicenseActivateResult is the response shape from License.Activate.
// LicenseKey is auto-stashed into the attached CredentialState (when
// present) so subsequent calls authenticate without a re-bootstrap.
type LicenseActivateResult struct {
	Status               string `json:"status"`
	LicenseKey           string `json:"license_key"`
	RemainingActivations int    `json:"remaining_activations"`
}

type licensesActivateWireBody struct {
	Email    string `json:"email"`
	Keycode  string `json:"keycode"`
	DeviceID string `json:"device_id"`
}

type licensesActivateWireResponse struct {
	Status string `json:"status"`
	Auth   struct {
		LicenseKey string `json:"license_key"`
	} `json:"auth"`
	RemainingActivations int `json:"remaining_activations"`
}

// Activate runs an explicit license activation. With non-nil input the
// SDK posts the supplied values; with nil input the SDK fills email,
// keycode, and deviceId from the attached CredentialState (see
// LicenseService.WithState).
func (s *LicenseService) Activate(ctx context.Context, input *LicenseActivateInput, opts ...RunOption) (*LicenseActivateResult, error) {
	filled, err := s.fillActivate(input)
	if err != nil {
		return nil, err
	}
	body := licensesActivateWireBody{
		Email:    filled.Email,
		Keycode:  filled.Keycode,
		DeviceID: filled.DeviceID,
	}
	ro := collectRunOptions(opts)
	raw, err := s.client.doJSON(ctx, requestArgs{
		method:         http.MethodPost,
		path:           licensesActivatePath,
		body:           body,
		op:             "licenses_activate",
		idempotencyKey: ro.idempotencyKey,
	})
	if err != nil {
		return nil, fmt.Errorf("zyins: License.Activate: %w", err)
	}
	result, err := decodeLicenseActivateResponse(raw)
	if err != nil {
		return nil, err
	}
	if s.state != nil && result.LicenseKey != "" {
		if err := s.state.RefreshLicenseKey(result.LicenseKey); err != nil {
			return nil, fmt.Errorf("zyins: License.Activate refreshing state: %w", err)
		}
	}
	return result, nil
}

// fillActivate merges the caller-supplied input with the attached
// CredentialState. Missing fields after the merge fail validation so
// the wire never sees an empty required field.
func (s *LicenseService) fillActivate(input *LicenseActivateInput) (*LicenseActivateInput, error) {
	out := LicenseActivateInput{}
	if input != nil {
		out = *input
	}
	if s.state != nil {
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
	}
	if strings.TrimSpace(out.Email) == "" {
		return nil, validationFailure("zyins: License.Activate requires Email")
	}
	if strings.TrimSpace(out.Keycode) == "" {
		return nil, validationFailure("zyins: License.Activate requires Keycode")
	}
	if strings.TrimSpace(out.DeviceID) == "" {
		return nil, validationFailure("zyins: License.Activate requires DeviceID")
	}
	return &out, nil
}

func decodeLicenseActivateResponse(body []byte) (*LicenseActivateResult, error) {
	data, err := unwrapEnvelope(body, "licenses_activate")
	if err != nil {
		return nil, err
	}
	var wire licensesActivateWireResponse
	if err := json.Unmarshal(data, &wire); err != nil {
		return nil, fmt.Errorf("zyins: failed to decode licenses_activate response: %w", err)
	}
	return &LicenseActivateResult{
		Status:               wire.Status,
		LicenseKey:           wire.Auth.LicenseKey,
		RemainingActivations: wire.RemainingActivations,
	}, nil
}
