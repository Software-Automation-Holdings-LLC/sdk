package zyins

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path"
	"strings"
	"sync"
	"testing"
)

// placeholderToken is an obvious non-secret. It exists only to satisfy
// the SDK prefix check and to recognize the Authorization header the
// client attaches. Tests never print the header value.
const placeholderToken = "isa_test_placeholder"

// caseRecallPathPrefix is the only path a case recall may address.
const caseRecallPathPrefix = "/v1/cases/"

// recallCall is one public operation that loads a case by caller-supplied id.
type recallCall struct {
	name string
	call func(c *Client, ctx context.Context, id, recallToken string) error
}

// TestCaseRecall_SuppliedIDCannotRetargetBearerRequest guards the
// recall URL. A caller-supplied case id must not choose the query
// string, and after one path unescape plus dot-segment removal the
// request must still be a single segment under /v1/cases/. The bearer
// token rides on that same request, so a retargeted request is the
// token leaving on an attacker-chosen target.
func TestCaseRecall_SuppliedIDCannotRetargetBearerRequest(t *testing.T) {
	recallToken := base64.RawURLEncoding.EncodeToString([]byte("recall-token-placeholder-32bytes"))
	ops := []recallCall{
		{name: "Recall", call: func(c *Client, ctx context.Context, id, token string) error {
			_, err := c.Cases.Recall(ctx, id, token)
			return err
		}},
		{name: "Open", call: func(c *Client, ctx context.Context, id, token string) error {
			_, err := c.Cases.Open(ctx, id, token)
			return err
		}},
	}
	attacks := []struct {
		name string
		id   string
	}{
		{name: "dotdot_datasets", id: "../v3/datasets"},
		{name: "query", id: "x?include=conditions"},
		{name: "nested_dotdot", id: "foo/../../v3/quote"},
		{name: "encoded_dot_segments", id: "%2e%2e/%2e%2e/v3/datasets"},
		{name: "encoded_slashes", id: "..%2f..%2fv3%2fdatasets"},
		{name: "dotdot_segment", id: ".."},
		{name: "dot_segment", id: "."},
	}
	for _, op := range ops {
		for _, attack := range attacks {
			t.Run(op.name+"/"+attack.name, func(t *testing.T) {
				assertRecallStaysOnCase(t, op, attack.id, recallToken, false)
			})
		}
		t.Run(op.name+"/ordinary_id", func(t *testing.T) {
			assertRecallStaysOnCase(t, op, "case_abc", recallToken, true)
		})
	}
}

// assertRecallStaysOnCase performs one recall against a local server.
// ordinary requires exactly one confined request for that id. An
// attacker-supplied id may produce no request (refused first) or a
// confined request, and never a request whose normalized target leaves
// /v1/cases/<segment> or carries a query.
func assertRecallStaysOnCase(t *testing.T, op recallCall, id, recallToken string, ordinary bool) {
	t.Helper()
	rec, client, closeServer := newRecallRecorder(t)
	defer closeServer()

	err := op.call(client, context.Background(), id, recallToken)
	calls := rec.snapshot()
	if ordinary {
		if len(calls) != 1 {
			t.Fatalf("%s id %q issued %d requests, want 1", op.name, id, len(calls))
		}
		if !calls[0].confinedTo(id) {
			t.Fatalf("%s id %q request %s", op.name, id, calls[0])
		}
		return
	}
	if err == nil && len(calls) == 0 {
		t.Fatalf("%s id %q returned success without a request", op.name, id)
	}
	for _, call := range calls {
		if !call.confined() {
			t.Fatalf("%s id %q sent the bearer request off the case segment: %s", op.name, id, call)
		}
	}
}

type recallHit struct {
	method    string
	target    string
	host      string
	serverURL string
	authMatch bool
}

func (h recallHit) String() string {
	return h.method + " " + h.target + " host=" + h.host + " authorization_matches_placeholder=" + boolWord(h.authMatch)
}

func (h recallHit) confined() bool {
	if !h.authMatch || h.host != hostOf(h.serverURL) {
		return false
	}
	cleaned, rawQuery, err := normalizeRequestTarget(h.target)
	if err != nil || rawQuery != "" {
		return false
	}
	segment, ok := strings.CutPrefix(cleaned, caseRecallPathPrefix)
	return ok && segment != "" && segment != "." && segment != ".." && !strings.Contains(segment, "/")
}

func (h recallHit) confinedTo(id string) bool {
	if !h.confined() {
		return false
	}
	cleaned, _, err := normalizeRequestTarget(h.target)
	return err == nil && cleaned == caseRecallPathPrefix+id
}

// normalizeRequestTarget applies the same two transforms the standard
// library applies to a request-target: unescape the path once
// (net/url setPath), then remove dot segments (path.Clean, which
// net/http cleanPath uses).
func normalizeRequestTarget(requestURI string) (string, string, error) {
	parsed, err := url.ParseRequestURI(requestURI)
	if err != nil {
		return "", "", err
	}
	decoded, err := url.PathUnescape(parsed.EscapedPath())
	if err != nil {
		return "", "", err
	}
	return path.Clean(decoded), parsed.RawQuery, nil
}

type recallRecorder struct {
	mu        sync.Mutex
	serverURL string
	calls     []recallHit
}

func (r *recallRecorder) snapshot() []recallHit {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]recallHit, len(r.calls))
	copy(out, r.calls)
	return out
}

func newRecallRecorder(t *testing.T) (*recallRecorder, *Client, func()) {
	t.Helper()
	rec := &recallRecorder{}
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		rec.mu.Lock()
		rec.calls = append(rec.calls, recallHit{
			method:    r.Method,
			target:    r.RequestURI,
			host:      r.Host,
			serverURL: rec.serverURL,
			authMatch: auth == "Bearer "+placeholderToken,
		})
		rec.mu.Unlock()
		w.WriteHeader(http.StatusNotFound)
	}))
	rec.serverURL = srv.URL
	client, err := NewClient(
		WithToken(placeholderToken),
		WithBaseURL(srv.URL),
		WithMaxRetryAttempts(1),
	)
	if err != nil {
		srv.Close()
		t.Fatalf("NewClient: %v", err)
	}
	return rec, client, srv.Close
}

func hostOf(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return parsed.Host
}

func boolWord(v bool) string {
	if v {
		return "true"
	}
	return "false"
}
