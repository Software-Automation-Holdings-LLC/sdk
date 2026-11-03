// Bytewise conformance gate for the steady-state session-HMAC signature.
//
// The fixture at tests/conformance/fixtures/session-vector.json (repo
// root) is the binding contract. This Go SDK MUST reproduce the
// identical canonical string, signature, and Authorization header as
// the TypeScript, Python, PHP, and C# SDKs.
//
// Mirrors the fixture-loading shape already established by
// loadAuthVector/auth-vector.json in this same package — see
// bootstrap_test.go. This is test-harness setup, not production code:
// reading a committed, static JSON fixture off disk during `go test`
// is the standard Go testing idiom and is not a system boundary a
// production caller ever crosses, so no injectable FS facade applies
// here (there is nothing to fake the fixture read against — the
// fixture bytes ARE the test input).
//
// If this test fails after an intentional change to the session wire
// format, regenerate the fixture from this package (see the fixture's
// $comment for the regeneration recipe), update
// shared/go/auth/session/canonical.go's doc comment if the shape
// changed, and bump every SDK's major version — the change is breaking.

package core

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type sessionVectorFixture struct {
	Inputs struct {
		SessionID     string `json:"sessionId"`
		SessionSecret string `json:"sessionSecret"`
		Method        string `json:"method"`
		Path          string `json:"path"`
		Body          string `json:"body"`
		Timestamp     string `json:"timestamp"`
	} `json:"inputs"`
	Canonical string `json:"canonical"`
	Expected  struct {
		Algorithm string `json:"algorithm"`
		Signature string `json:"signature"`
		Header    string `json:"header"`
	} `json:"expected"`
}

// readSessionVectorFixture reads the committed test fixture from disk.
// Test-harness I/O only (see file header) — mirrors loadAuthVector's
// os.ReadFile precedent in this same package.
func readSessionVectorFixture(t *testing.T) sessionVectorFixture {
	t.Helper()
	// packages/go/core → repo root is three levels up.
	fixturePath := filepath.Join("..", "..", "..", "tests", "conformance", "fixtures", "session-vector.json")
	rawFixtureBytes, readErr := os.ReadFile(filepath.Clean(fixturePath))
	if readErr != nil {
		t.Fatalf("read session-vector fixture at %s: %v", fixturePath, readErr)
	}
	var fixture sessionVectorFixture
	if decodeErr := json.Unmarshal(rawFixtureBytes, &fixture); decodeErr != nil {
		t.Fatalf("decode session-vector fixture: %v", decodeErr)
	}
	return fixture
}

func TestSessionVector_CanonicalStringMatchesFixture(t *testing.T) {
	fx := readSessionVectorFixture(t)
	canonical := CanonicalString(
		fx.Inputs.Method,
		fx.Inputs.Path,
		[]byte(fx.Inputs.Body),
		fx.Inputs.Timestamp,
		fx.Inputs.SessionID,
	)
	if canonical != fx.Canonical {
		t.Errorf("canonical mismatch\n  got:  %q\n  want: %q", canonical, fx.Canonical)
	}
}

func TestSessionVector_SignatureMatchesFixtureBytewise(t *testing.T) {
	fx := readSessionVectorFixture(t)
	now, err := time.Parse(time.RFC3339, fx.Inputs.Timestamp)
	if err != nil {
		t.Fatalf("parse fixture timestamp: %v", err)
	}
	headers, err := SignRequest(SignRequestInput{
		Method:        fx.Inputs.Method,
		Path:          fx.Inputs.Path,
		Body:          []byte(fx.Inputs.Body),
		SessionID:     fx.Inputs.SessionID,
		SessionSecret: fx.Inputs.SessionSecret,
		Now:           now,
	})
	if err != nil {
		t.Fatalf("SignRequest: %v", err)
	}
	if headers.IsaSignature != fx.Expected.Signature {
		t.Errorf("signature mismatch\n  got:  %s\n  want: %s", headers.IsaSignature, fx.Expected.Signature)
	}
}

func TestSessionVector_AuthorizationHeaderUsesSessionSchemeNotBearer(t *testing.T) {
	// This is the exact drift that shipped in all five SDKs: hard-coding
	// `Bearer <secret>` for the session scheme. The gate exists to make
	// that class of bug a CI failure instead of a production incident.
	fx := readSessionVectorFixture(t)
	now, err := time.Parse(time.RFC3339, fx.Inputs.Timestamp)
	if err != nil {
		t.Fatalf("parse fixture timestamp: %v", err)
	}
	headers, err := SignRequest(SignRequestInput{
		Method:        fx.Inputs.Method,
		Path:          fx.Inputs.Path,
		Body:          []byte(fx.Inputs.Body),
		SessionID:     fx.Inputs.SessionID,
		SessionSecret: fx.Inputs.SessionSecret,
		Now:           now,
	})
	if err != nil {
		t.Fatalf("SignRequest: %v", err)
	}
	if headers.Authorization != fx.Expected.Header {
		t.Errorf("Authorization header mismatch\n  got:  %s\n  want: %s", headers.Authorization, fx.Expected.Header)
	}
}
