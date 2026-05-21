package zyins

import (
	"context"
	"errors"
	"fmt"
	"net/http"
)

// LegacyBlob runs a prequalify call from a pre-encoded payload produced
// by a legacy encoder (e.g., bpp2.0's prepEncObj / prepEncObjV2). The
// payload is JSON-marshaled verbatim; the SDK supplies the standard
// transport stack — auth headers, idempotency key, error funnel, and
// envelope unwrapping.
//
// This entry point exists so long-standing consumers do not have to
// restructure their encoder to take advantage of the SDK. The server
// accepts both the typed and legacy-blob shapes on the same path; new
// code should prefer Run(ctx, *PrequalifyInput).
func (s *PrequalifyService) LegacyBlob(ctx context.Context, encodedPayload map[string]any, opts ...RunOption) (*PrequalifyResult, error) {
	if encodedPayload == nil {
		return nil, errors.New("zyins: Prequalify.LegacyBlob requires a non-nil encodedPayload")
	}
	ro := collectRunOptions(opts)
	raw, err := s.client.doJSON(ctx, requestArgs{
		method:         http.MethodPost,
		path:           prequalifyPath,
		body:           encodedPayload,
		op:             "prequalify_legacy",
		idempotencyKey: ro.idempotencyKey,
	})
	if err != nil {
		return nil, fmt.Errorf("zyins: Prequalify.LegacyBlob: %w", err)
	}
	return decodePrequalifyResponse(raw)
}
