package transport

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// recordingDoer captures the request it sees so tests can assert on
// headers without binding the network stack.
type recordingDoer struct {
	got    *http.Request
	err    error
	calls  int
	bodies []string
}

func (r *recordingDoer) Do(req *http.Request) (*http.Response, error) {
	r.calls++
	r.got = req
	if req.Body != nil {
		b, _ := io.ReadAll(req.Body)
		r.bodies = append(r.bodies, string(b))
	}
	if r.err != nil {
		return nil, r.err
	}
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader("")),
		Header:     http.Header{},
	}, nil
}

type erroringToken struct{}

func (erroringToken) Token() (string, error) { return "", errors.New("token oracle offline") }

// doClosing performs one request and closes the response body, returning
// only the status so tests never hold an open body.
func doClosing(d HTTPDoer, req *http.Request) (int, error) {
	resp, err := d.Do(req)
	if err != nil {
		return 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode, nil
}

func TestNewBearerTransport_NilTokenSource_ReturnsTypedError(t *testing.T) {
	_, err := NewBearerTransport(nil, &recordingDoer{})
	if !errors.Is(err, ErrNilTokenSource) {
		t.Fatalf("expected ErrNilTokenSource, got %v", err)
	}
}

func TestNewBearerTransport_NilInner_ReturnsTypedError(t *testing.T) {
	_, err := NewBearerTransport(StaticToken("t"), nil)
	if !errors.Is(err, ErrNilInnerDoer) {
		t.Fatalf("expected ErrNilInnerDoer, got %v", err)
	}
}

func TestBearerTransport_Do_SetsAuthorizationHeader(t *testing.T) {
	inner := &recordingDoer{}
	bt, err := NewBearerTransport(StaticToken("secret123"), inner)
	if err != nil {
		t.Fatalf("ctor: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	if _, err := doClosing(bt, req); err != nil {
		t.Fatalf("Do: %v", err)
	}
	if got, want := inner.got.Header.Get("Authorization"), "Bearer secret123"; got != want {
		t.Fatalf("Authorization header = %q, want %q", got, want)
	}
}

func TestBearerTransport_Do_OverwritesExistingHeader(t *testing.T) {
	inner := &recordingDoer{}
	bt, err := NewBearerTransport(StaticToken("new"), inner)
	if err != nil {
		t.Fatalf("ctor: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	req.Header.Set("Authorization", "Bearer old")
	if _, err := doClosing(bt, req); err != nil {
		t.Fatalf("Do: %v", err)
	}
	if got := inner.got.Header.Get("Authorization"); got != "Bearer new" {
		t.Fatalf("Authorization not overwritten: %q", got)
	}
}

func TestBearerTransport_Do_TokenSourceError_PropagatesUnchanged(t *testing.T) {
	inner := &recordingDoer{}
	bt, err := NewBearerTransport(erroringToken{}, inner)
	if err != nil {
		t.Fatalf("ctor: %v", err)
	}
	_, err = doClosing(bt, httptest.NewRequest(http.MethodGet, "/v1/x", nil))
	if err == nil {
		t.Fatalf("expected error from token source, got nil")
	}
	if inner.calls != 0 {
		t.Fatalf("inner doer should not be called when token oracle fails; calls=%d", inner.calls)
	}
}

func TestStaticToken_Empty_ReturnsError(t *testing.T) {
	_, err := StaticToken("").Token()
	if err == nil {
		t.Fatalf("expected error for empty static token")
	}
}
