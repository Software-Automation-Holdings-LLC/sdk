package rapidsign

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestVoiceMintCode_HappyPath(t *testing.T) {
	t.Parallel()
	var gotBody mintCodeRequestBody
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/documents/sig_abc/voice-code" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("method = %q", r.Method)
		}
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write(envelope(map[string]any{
			"sign_id":    "sig_abc",
			"code":       "482913",
			"expires_at": 1715823600,
		}))
	}))
	defer srv.Close()
	c := newTestClient(t, srv)

	got, err := c.Voice.MintCode(context.Background(), "sig_abc", &MintCodeRequest{
		SessionID: "sess_1",
		SecretKey: "shh",
		Form:      "form_1",
		Signer:    "signer_1",
	})
	if err != nil {
		t.Fatalf("MintCode: %v", err)
	}
	if got.Code != "482913" {
		t.Errorf("Code = %q, want 482913", got.Code)
	}
	if got.SignID != "sig_abc" {
		t.Errorf("SignID = %q, want sig_abc", got.SignID)
	}
	if got.ExpiresAt.IsZero() {
		t.Error("ExpiresAt must be set")
	}
	if gotBody.SessionID != "sess_1" || gotBody.SecretKey != "shh" || gotBody.Form != "form_1" || gotBody.Signer != "signer_1" {
		t.Errorf("request body = %+v", gotBody)
	}
	if gotBody.VoiceScript != nil {
		t.Errorf("VoiceScript = %+v, want nil when Script omitted", gotBody.VoiceScript)
	}
}

func TestVoiceMintCode_PublishesScript(t *testing.T) {
	t.Parallel()
	var gotBody mintCodeRequestBody
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Errorf("decode request body: %v", err)
		}
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write(envelope(map[string]any{
			"sign_id":    "sig_abc",
			"code":       "111222",
			"expires_at": 1715823600,
		}))
	}))
	defer srv.Close()
	c := newTestClient(t, srv)

	script := &VoiceScript{
		DisclosureText: "This call is being recorded.",
		Steps: []VoiceStep{
			{Kind: VoiceStepSay, Text: "Please listen carefully."},
			{Kind: VoiceStepCaptureName, Text: "Please say your full name."},
		},
		ExpectedSignerName: "Jane Doe",
	}
	_, err := c.Voice.MintCode(context.Background(), "sig_abc", &MintCodeRequest{
		SessionID: "sess_1",
		SecretKey: "shh",
		Form:      "form_1",
		Signer:    "signer_1",
		Script:    script,
	})
	if err != nil {
		t.Fatalf("MintCode: %v", err)
	}
	if gotBody.VoiceScript == nil {
		t.Fatal("VoiceScript was not sent")
	}
	if gotBody.VoiceScript.DisclosureText != script.DisclosureText {
		t.Errorf("DisclosureText = %q", gotBody.VoiceScript.DisclosureText)
	}
	if len(gotBody.VoiceScript.Steps) != 2 || gotBody.VoiceScript.Steps[1].Kind != VoiceStepCaptureName {
		t.Errorf("Steps = %+v", gotBody.VoiceScript.Steps)
	}
}

func TestVoiceMintCode_ValidatesInputs(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("server should not be reached")
	}))
	defer srv.Close()
	c := newTestClient(t, srv)

	cases := []struct {
		name   string
		signID string
		req    *MintCodeRequest
	}{
		{"empty sign id", "", &MintCodeRequest{SessionID: "s", SecretKey: "k", Form: "f", Signer: "sg"}},
		{"nil request", "sig_abc", nil},
		{"missing session id", "sig_abc", &MintCodeRequest{SecretKey: "k", Form: "f", Signer: "sg"}},
		{"missing secret key", "sig_abc", &MintCodeRequest{SessionID: "s", Form: "f", Signer: "sg"}},
		{"missing form", "sig_abc", &MintCodeRequest{SessionID: "s", SecretKey: "k", Signer: "sg"}},
		{"missing signer", "sig_abc", &MintCodeRequest{SessionID: "s", SecretKey: "k", Form: "f"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := c.Voice.MintCode(context.Background(), tc.signID, tc.req); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestVoiceMintCode_RateLimited(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write(errorBody(http.StatusTooManyRequests, "rate_limit_exceeded", "too many voice codes minted recently; try again shortly", ""))
	}))
	defer srv.Close()
	c := newTestClient(t, srv)

	_, err := c.Voice.MintCode(context.Background(), "sig_abc", &MintCodeRequest{
		SessionID: "sess_1",
		SecretKey: "shh",
		Form:      "form_1",
		Signer:    "signer_1",
	})
	var rle *RateLimitedError
	if !errorsAs(err, &rle) {
		t.Fatalf("err = %v, want *RateLimitedError", err)
	}
}

func TestVoiceMintCode_MissingCodeIsError(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write(envelope(map[string]any{"sign_id": "sig_abc", "expires_at": 1715823600}))
	}))
	defer srv.Close()
	c := newTestClient(t, srv)

	if _, err := c.Voice.MintCode(context.Background(), "sig_abc", &MintCodeRequest{
		SessionID: "sess_1",
		SecretKey: "shh",
		Form:      "form_1",
		Signer:    "signer_1",
	}); err == nil {
		t.Fatal("expected error on missing code")
	}
}

func TestVoiceMintCode_MismatchedSignIDIsError(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
		// Server echoes a sign_id for a different document than the one
		// addressed in the request path.
		_, _ = w.Write(envelope(map[string]any{"sign_id": "sig_wrong", "code": "482913", "expires_at": 1715823600}))
	}))
	defer srv.Close()
	c := newTestClient(t, srv)

	if _, err := c.Voice.MintCode(context.Background(), "sig_abc", &MintCodeRequest{
		SessionID: "sess_1",
		SecretKey: "shh",
		Form:      "form_1",
		Signer:    "signer_1",
	}); err == nil {
		t.Fatal("expected error on mismatched sign_id")
	}
}
