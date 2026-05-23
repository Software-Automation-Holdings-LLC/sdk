package zyins

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// captureLicensesRequest records the headers and body of one request
// for assertion in tests that exercise the licenses sub-service.
type captureLicensesRequest struct {
	method string
	path   string
	auth   string
	idem   string
	body   []byte
}

func TestLicenses_Check_HappyPath(t *testing.T) {
	var captured captureLicensesRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured.method = r.Method
		captured.path = r.URL.Path
		captured.auth = r.Header.Get("Authorization")
		captured.idem = r.Header.Get("Idempotency-Key")
		captured.body, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"valid"}`))
	}))
	defer srv.Close()
	c := newTestClient(t, srv)
	result, err := c.License.Check(context.Background(), &LicenseCheckInput{
		Email:      "john.doe@acme-agency.com",
		Keycode:    "ABC-123-XYZ",
		DeviceID:   "device-1",
		LicenseKey: "abc123",
	})
	if err != nil {
		t.Fatalf("Check: %v", err)
	}
	if result.Status != LicenseStatusValid {
		t.Errorf("status = %q, want valid", result.Status)
	}
	if captured.method != http.MethodPost || captured.path != licensesCheckPath {
		t.Errorf("captured %s %s, want POST %s", captured.method, captured.path, licensesCheckPath)
	}
	if !strings.HasPrefix(captured.auth, "Bearer ") {
		t.Errorf("expected Bearer auth, got %q", captured.auth)
	}
	if captured.idem == "" {
		t.Errorf("expected Idempotency-Key header on POST")
	}
	var bodyParsed licensesCheckWireBody
	if err := json.Unmarshal(captured.body, &bodyParsed); err != nil {
		t.Fatalf("body unmarshal: %v", err)
	}
	if bodyParsed.Email != "john.doe@acme-agency.com" || bodyParsed.Keycode != "ABC-123-XYZ" {
		t.Errorf("body fields not propagated: %+v", bodyParsed)
	}
}

func TestLicenses_Check_AcceptsEnvelopedResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":{"status":"inactive"}}`))
	}))
	defer srv.Close()
	c := newTestClient(t, srv)
	result, err := c.License.Check(context.Background(), &LicenseCheckInput{
		Email: "x@x", Keycode: "ABC-123-XYZ",
	})
	if err != nil {
		t.Fatalf("Check: %v", err)
	}
	if result.Status != LicenseStatusInactive {
		t.Errorf("status = %q, want inactive", result.Status)
	}
}

func TestLicenses_Check_RejectsMissingEmail(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("request must not hit the wire on validation failure")
	}))
	defer srv.Close()
	c := newTestClient(t, srv)
	_, err := c.License.Check(context.Background(), &LicenseCheckInput{Keycode: "ABC-123-XYZ"})
	if err == nil {
		t.Fatalf("expected validation error, got nil")
	}
	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("expected *ValidationError, got %T: %v", err, err)
	}
}

func TestLicenses_Check_NilInput(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()
	c := newTestClient(t, srv)
	_, err := c.License.Check(context.Background(), nil)
	if err == nil {
		t.Fatalf("expected validation error on nil input")
	}
}

func TestLicenses_Check_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"type":"about:blank","title":"server error","status":500,"code":"server_error"}`))
	}))
	defer srv.Close()
	c := newTestClient(t, srv)
	_, err := c.License.Check(context.Background(), &LicenseCheckInput{
		Email: "x@x", Keycode: "ABC-123-XYZ",
	})
	if err == nil {
		t.Fatalf("expected error from 500 response")
	}
}

func TestLicenses_Deactivate_HappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != licensesDeactivatePath {
			t.Errorf("path = %q, want %q", r.URL.Path, licensesDeactivatePath)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"deactivated"}`))
	}))
	defer srv.Close()
	c := newTestClient(t, srv)
	result, err := c.License.Deactivate(context.Background(), &LicenseDeactivateInput{
		Email:    "john.doe@acme-agency.com",
		Keycode:  "ABC-123-XYZ",
		DeviceID: "device-1",
	}, WithIdempotencyKey("550e8400-e29b-41d4-a716-446655440000"))
	if err != nil {
		t.Fatalf("Deactivate: %v", err)
	}
	if result.Status != "deactivated" {
		t.Errorf("status = %q, want deactivated", result.Status)
	}
}

func TestLicenses_Deactivate_RejectsMissingKeycode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer srv.Close()
	c := newTestClient(t, srv)
	_, err := c.License.Deactivate(context.Background(), &LicenseDeactivateInput{Email: "x@x"})
	if err == nil {
		t.Fatalf("expected validation error")
	}
}
