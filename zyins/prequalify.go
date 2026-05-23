package zyins

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
)

// prequalifyPath is the canonical path for the prequalify operation.
const prequalifyPath = "/v1/prequalify"

// PrequalifyService is the typed sub-service exposing the prequalify
// operation. Constructed by NewClient; do not construct directly.
type PrequalifyService struct {
	client *Client
}

// PrequalifyInput is the typed request shape for Prequalify.Run.
type PrequalifyInput struct {
	// Applicant captures the underwriting profile. All inner required
	// fields must be populated; Run returns *ValidationError otherwise.
	Applicant Applicant
	// Coverage selects either a face-value or monthly-budget request.
	Coverage Coverage
	// Products is the list of carrier/type combinations to evaluate.
	Products ProductSelection
}

// PrequalifyResult is the typed response shape for Prequalify.Run.
type PrequalifyResult struct {
	// Plans is the engine's qualified list, ordered by ranking.
	Plans []PrequalifyPlan `json:"plans"`
	// RequestID is the server's correlation identifier; surface in
	// logs and support tickets.
	RequestID string `json:"request_id"`
}

// PrequalifyPlan is one plan the engine accepted for the applicant.
type PrequalifyPlan struct {
	// Brand is the carrier identifier (e.g., "colonial-penn").
	Brand string `json:"brand"`
	// Tier is the plan tier within the carrier.
	Tier string `json:"tier"`
	// MonthlyPremiumCents is the bucketed monthly premium in USD cents.
	// Money is integer cents (not float) to avoid binary-float rounding
	// error; format to a UI string by dividing by 100.
	MonthlyPremiumCents int64 `json:"monthly_premium_cents"`
	// FaceValueCents is the death benefit in USD cents.
	FaceValueCents int64 `json:"face_value_cents"`
	// ProductToken is the wire token; useful for routing into eApp.
	ProductToken string `json:"product_token"`
}

// RunOption customizes a single Prequalify.Run call without affecting
// the surrounding Client.
type RunOption func(*runOptions)

// runOptions carries per-call overrides.
type runOptions struct {
	idempotencyKey string
}

// WithIdempotencyKey overrides the SDK-generated Idempotency-Key for
// one call. Useful when the caller wants the same key across an
// external retry loop.
func WithIdempotencyKey(key string) RunOption {
	return func(o *runOptions) { o.idempotencyKey = key }
}

// Run executes a prequalify request and returns the typed result.
// Validation runs locally before the request hits the wire; missing
// required fields yield a *ValidationError without a server round-trip.
func (s *PrequalifyService) Run(ctx context.Context, input *PrequalifyInput, opts ...RunOption) (*PrequalifyResult, error) {
	if input == nil {
		return nil, &ValidationError{Base: &Error{
			Code:    ErrorCodeValidationError,
			Message: "zyins: PrequalifyInput is nil",
		}}
	}
	if err := input.Applicant.validate(); err != nil {
		return nil, &ValidationError{Base: &Error{
			Code:    ErrorCodeValidationError,
			Message: err.Error(),
		}}
	}
	if err := input.Coverage.validate(); err != nil {
		return nil, &ValidationError{Base: &Error{
			Code:    ErrorCodeValidationError,
			Message: err.Error(),
		}}
	}
	if input.Products.Len() == 0 {
		return nil, &ValidationError{Base: &Error{
			Code:    ErrorCodeValidationError,
			Message: "zyins: Products must contain at least one entry",
		}}
	}

	body, err := buildPrequalifyBody(input)
	if err != nil {
		return nil, &ValidationError{Base: &Error{
			Code:    ErrorCodeValidationError,
			Message: err.Error(),
		}}
	}
	ro := runOptions{}
	for _, o := range opts {
		if o != nil {
			o(&ro)
		}
	}

	raw, err := s.client.doJSON(ctx, requestArgs{
		method:         http.MethodPost,
		path:           prequalifyPath,
		body:           body,
		op:             "prequalify",
		idempotencyKey: ro.idempotencyKey,
	})
	if err != nil {
		return nil, fmt.Errorf("zyins: Prequalify.Run: %w", err)
	}
	return decodePrequalifyResponse(raw)
}

// RunWithRawResponse executes a prequalify request and returns the
// typed result alongside a RawResponse exposing the underlying HTTP
// status, headers, and URL. Mirrors the Stainless SDK convention so
// callers that need wire metadata (server-side timing headers, custom
// X-* echoes, etc.) reach for the same idiom across products.
//
// Both inputs and validation rules are identical to Run; the only
// difference is the return signature.
func (s *PrequalifyService) RunWithRawResponse(
	ctx context.Context, input *PrequalifyInput, opts ...RunOption,
) (*Envelope[*PrequalifyResult], *RawResponse, error) {
	if input == nil {
		return nil, nil, &ValidationError{Base: &Error{
			Code: ErrorCodeValidationError, Message: "zyins: PrequalifyInput is nil",
		}}
	}
	if err := input.Applicant.validate(); err != nil {
		return nil, nil, &ValidationError{Base: &Error{
			Code: ErrorCodeValidationError, Message: err.Error(),
		}}
	}
	if err := input.Coverage.validate(); err != nil {
		return nil, nil, &ValidationError{Base: &Error{
			Code: ErrorCodeValidationError, Message: err.Error(),
		}}
	}
	if input.Products.Len() == 0 {
		return nil, nil, &ValidationError{Base: &Error{
			Code: ErrorCodeValidationError, Message: "zyins: Products must contain at least one entry",
		}}
	}
	body, err := buildPrequalifyBody(input)
	if err != nil {
		return nil, nil, &ValidationError{Base: &Error{
			Code: ErrorCodeValidationError, Message: err.Error(),
		}}
	}
	ro := runOptions{}
	for _, o := range opts {
		if o != nil {
			o(&ro)
		}
	}
	raw, httpResp, err := s.client.doJSONRaw(ctx, requestArgs{
		method:         http.MethodPost,
		path:           prequalifyPath,
		body:           body,
		op:             "prequalify",
		idempotencyKey: ro.idempotencyKey,
	})
	if err != nil {
		return nil, captureRawResponse(httpResp), fmt.Errorf("zyins: Prequalify.RunWithRawResponse: %w", err)
	}
	result, err := decodePrequalifyResponse(raw)
	if err != nil {
		return nil, captureRawResponse(httpResp), err
	}
	env := newEnvelope[*PrequalifyResult](result, raw, httpResp)
	return env, captureRawResponse(httpResp), nil
}

// prequalifyWireBody is the on-wire JSON shape for the prequalify
// request. Kept private so external callers can never construct one
// directly — the SDK builds it from the typed PrequalifyInput.
type prequalifyWireBody struct {
	Applicant prequalifyWireApplicant `json:"applicant"`
	Coverage  Coverage                `json:"coverage"`
	Products  string                  `json:"products"`
}

// prequalifyWireApplicant flattens the Applicant struct to the keys the
// engine expects (e.g., wire-coded sex, height_inches, weight_pounds).
type prequalifyWireApplicant struct {
	DOB          string        `json:"dob"`
	Sex          string        `json:"sex"`
	HeightInches int           `json:"height_inches"`
	WeightPounds int           `json:"weight_pounds"`
	State        string        `json:"state"`
	Zip          string        `json:"zip,omitempty"`
	NicotineUse  NicotineUsage `json:"nicotine_use"`
	Medications  []Medication  `json:"medications,omitempty"`
	Conditions   []Condition   `json:"conditions,omitempty"`
}

// buildPrequalifyBody renders the wire body from the typed input. It
// returns an error when a field cannot be encoded (e.g., an unknown Sex
// value) so the SDK fails fast at the call site rather than shipping a
// silently-corrupted request.
func buildPrequalifyBody(in *PrequalifyInput) (prequalifyWireBody, error) {
	sex, err := SexWireCode(in.Applicant.Sex)
	if err != nil {
		return prequalifyWireBody{}, err
	}
	return prequalifyWireBody{
		Applicant: prequalifyWireApplicant{
			DOB:          in.Applicant.DOB,
			Sex:          sex,
			HeightInches: in.Applicant.Height.TotalInches,
			WeightPounds: in.Applicant.Weight.Pounds,
			State:        string(in.Applicant.State),
			Zip:          in.Applicant.Zip,
			NicotineUse:  in.Applicant.NicotineUse,
			Medications:  in.Applicant.Medications,
			Conditions:   in.Applicant.Conditions,
		},
		Coverage: in.Coverage,
		Products: in.Products.WireString(),
	}, nil
}

// decodePrequalifyResponse parses the engine's JSON response. The
// server speaks the ADR-012 envelope `{ data: { plans, request_id } }`;
// fallback paths accept a flat shape for compatibility with older
// fixtures.
func decodePrequalifyResponse(body []byte) (*PrequalifyResult, error) {
	if len(body) == 0 {
		return nil, errors.New("zyins: prequalify response body was empty")
	}
	var env struct {
		Data      json.RawMessage `json:"data"`
		RequestID string          `json:"request_id"`
	}
	if err := json.Unmarshal(body, &env); err != nil {
		return nil, fmt.Errorf("zyins: failed to decode prequalify envelope: %w", err)
	}
	target := body
	if len(env.Data) > 0 {
		target = env.Data
	}
	var result PrequalifyResult
	if err := json.Unmarshal(target, &result); err != nil {
		return nil, fmt.Errorf("zyins: failed to decode prequalify data: %w", err)
	}
	if result.RequestID == "" && env.RequestID != "" {
		result.RequestID = env.RequestID
	}
	return &result, nil
}
