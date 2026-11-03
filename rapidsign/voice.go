package rapidsign

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Software-Automation-Holdings-LLC/sdk/rapidsign/internal"
)

// Voice groups the voice-signing operations on a Client. A voice
// ceremony still resolves to the same signing envelope every other
// ceremony type produces (SAH-4608): once the signer completes the
// phone call, the resulting signature and PDF are fetched exactly as
// for any other sign_id, via Documents.Get / Documents.AwaitSignature /
// Documents.Download. Voice adds exactly one new step ahead of that
// shared lifecycle — minting the single-use code the signer dials in
// with.
type Voice struct {
	c *Client
}

// VoiceStepKind names one step behavior in a voice script. Mirrors
// api.rapidsign.v1's voice-sign step kinds; kept as a string type so
// future server-side additions do not require a client release.
type VoiceStepKind string

// Documented step kinds.
const (
	VoiceStepSay         VoiceStepKind = "say"
	VoiceStepPlay        VoiceStepKind = "play"
	VoiceStepConfirm     VoiceStepKind = "confirm"
	VoiceStepCaptureName VoiceStepKind = "capture-name"
)

// VoiceStep is one carrier-configured ceremony step.
type VoiceStep struct {
	Kind     VoiceStepKind `json:"kind"`
	Text     string        `json:"text,omitempty"`
	AudioURL string        `json:"audio_url,omitempty"`
}

// VoiceScript is the ordered step list plus the mandatory
// recording-disclosure copy a voice ceremony opens with. Pass a Script
// on MintCodeRequest to publish (or republish) the script for a form;
// omit it to mint against whatever was published earlier for the same
// Form.
type VoiceScript struct {
	DisclosureText     string      `json:"disclosure_text,omitempty"`
	Steps              []VoiceStep `json:"steps"`
	ExpectedSignerName string      `json:"expected_signer_name,omitempty"`
}

// MintCodeRequest is the input to Voice.MintCode.
type MintCodeRequest struct {
	SessionID string
	SecretKey string
	Form      string
	Signer    string
	// Script, when supplied, publishes the voice script for Form before
	// minting the code. Omit to mint against an already-published
	// script.
	Script *VoiceScript
}

// VoiceCode is a freshly minted, single-use code a signer dials into
// the ceremony's universal number with.
type VoiceCode struct {
	SignID    string    `json:"sign_id"`
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expires_at"`
}

// mintCodeRequestBody is the on-wire body for POST
// /v1/documents/{sign_id}/voice-code.
type mintCodeRequestBody struct {
	SessionID   string       `json:"session_id"`
	SecretKey   string       `json:"secret_key"`
	Form        string       `json:"form"`
	Signer      string       `json:"signer"`
	VoiceScript *VoiceScript `json:"voice_script,omitempty"`
}

// mintCodeResponse is the wire shape of a successful mint-code call.
type mintCodeResponse struct {
	SignID    string `json:"sign_id"`
	Code      string `json:"code"`
	ExpiresAt int64  `json:"expires_at"`
}

// MintCode mints a single-use voice-sign application code bound to
// signID and notifies nobody — the caller is responsible for
// delivering the code to the signer through its own channel. The
// signer dials the ceremony's universal number and enters the code to
// begin the call; once the call completes, drive the rest of the
// lifecycle the same way as any other ceremony: Documents.AwaitSignature
// (or Documents.Get) for the signature, Documents.Download for the PDF.
func (v *Voice) MintCode(ctx context.Context, signID string, req *MintCodeRequest) (*VoiceCode, error) {
	if signID == "" {
		return nil, errors.New("rapidsign: Voice.MintCode requires a non-empty sign id")
	}
	if req == nil {
		return nil, errors.New("rapidsign: Voice.MintCode requires a non-nil MintCodeRequest")
	}
	if req.SessionID == "" {
		return nil, errors.New("rapidsign: Voice.MintCode requires a non-empty SessionID")
	}
	if req.SecretKey == "" {
		return nil, errors.New("rapidsign: Voice.MintCode requires a non-empty SecretKey")
	}
	if req.Form == "" {
		return nil, errors.New("rapidsign: Voice.MintCode requires a non-empty Form")
	}
	if req.Signer == "" {
		return nil, errors.New("rapidsign: Voice.MintCode requires a non-empty Signer")
	}

	body := mintCodeRequestBody{
		SessionID:   req.SessionID,
		SecretKey:   req.SecretKey,
		Form:        req.Form,
		Signer:      req.Signer,
		VoiceScript: req.Script,
	}

	url := fmt.Sprintf("%s/v1/documents/%s/voice-code", v.c.baseURL, signID)
	resp, err := internal.JSONRequest(ctx, v.c.doer, http.MethodPost, url, body, internal.RequestOptions{
		Headers: map[string]string{"User-Agent": v.c.userAgent},
	})
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, parseErrorResponse(resp, v.c.clock())
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()

	var payload mintCodeResponse
	if err := decodeEnvelope(resp.Body, &payload); err != nil {
		return nil, err
	}
	if payload.Code == "" {
		return nil, fmt.Errorf("rapidsign: server response missing code (sign_id=%s)", signID)
	}
	// The caller-supplied signID is already validated non-empty above and is
	// what addressed the request; payload.SignID is the server's echo of it.
	// When the server includes it, cross-check rather than silently trust
	// the caller's copy — a mismatch means the response landed against the
	// wrong document and proceeding would sign the wrong caller's request.
	if payload.SignID != "" && payload.SignID != signID {
		return nil, fmt.Errorf(
			"rapidsign: server echoed sign_id %q for request to sign_id %q",
			payload.SignID, signID,
		)
	}
	return &VoiceCode{
		SignID:    signID,
		Code:      payload.Code,
		ExpiresAt: time.Unix(payload.ExpiresAt, 0).UTC(),
	}, nil
}
