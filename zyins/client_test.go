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
	"time"
)

// newTestClient returns a Client that targets srv. The retry transport
// runs but with a single attempt so per-test latency stays bounded.
func newTestClient(t *testing.T, srv *httptest.Server) *Client {
	t.Helper()
	c, err := NewClient(
		WithToken("isa_test_4fjK2nQ7mX1aB8sR9pZ3"),
		WithBaseURL(srv.URL),
		WithMaxRetryAttempts(1),
	)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return c
}

// validApplicant returns a complete applicant that passes validation.
func validApplicant(t *testing.T) Applicant {
	t.Helper()
	h, err := NewHeight(5, 10)
	if err != nil {
		t.Fatalf("NewHeight: %v", err)
	}
	w, err := NewWeight(195)
	if err != nil {
		t.Fatalf("NewWeight: %v", err)
	}
	return Applicant{
		DOB:         "1962-04-18",
		Sex:         SexMale,
		Height:      h,
		Weight:      w,
		State:       "NC",
		NicotineUse: NicotineNone,
	}
}

func TestNewClient_DefaultsAreSafe(t *testing.T) {
	c, err := NewClient(WithToken("isa_live_abc"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.baseURL != DefaultBaseURL {
		t.Errorf("baseURL = %q, want %q", c.baseURL, DefaultBaseURL)
	}
	if c.userAgent != userAgentHeader {
		t.Errorf("userAgent = %q", c.userAgent)
	}
	if c.Prequalify == nil || c.Quote == nil || c.Datasets == nil ||
		c.ReferenceData == nil || c.Usage == nil {
		t.Errorf("sub-services not wired: %+v", c)
	}
}

func TestPrequalify_Run_HappyPath(t *testing.T) {
	var captured struct {
		auth string
		body []byte
		idem string
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured.auth = r.Header.Get("Authorization")
		captured.idem = r.Header.Get("Idempotency-Key")
		captured.body, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": {
				"plans": [
					{"brand":"colonial-penn","tier":"preferred","monthly_premium_cents":4995,"face_value_cents":1000000,"product_token":"colonial-penn.final-expense"}
				],
				"request_id": "req_01HZK2N5GQR9T8X4B6FJW3Y1AS"
			}
		}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	cov, _ := NewFaceValueCoverage(100_000)
	sel, _ := NewProductSelection("colonial-penn.final-expense")

	result, err := c.Prequalify.Run(context.Background(), &PrequalifyInput{
		Applicant: validApplicant(t),
		Coverage:  cov,
		Products:  sel,
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if !strings.HasPrefix(captured.auth, "Bearer isa_test_") {
		t.Errorf("auth header = %q", captured.auth)
	}
	if captured.idem == "" {
		t.Errorf("missing Idempotency-Key")
	}
	if len(result.Plans) != 1 || result.Plans[0].MonthlyPremiumCents != 4995 {
		t.Errorf("unexpected plans: %+v", result.Plans)
	}
	if result.RequestID != "req_01HZK2N5GQR9T8X4B6FJW3Y1AS" {
		t.Errorf("RequestID = %q", result.RequestID)
	}

	var decoded map[string]any
	if err := json.Unmarshal(captured.body, &decoded); err != nil {
		t.Fatalf("body unmarshal: %v", err)
	}
	if decoded["products"] != "colonial-penn.final-expense" {
		t.Errorf("body.products = %v", decoded["products"])
	}
}

func TestPrequalify_Run_NilInputReturnsValidationError(t *testing.T) {
	c, _ := NewClient(WithToken("isa_test_abc"))
	_, err := c.Prequalify.Run(context.Background(), nil)
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation; got %v", err)
	}
}

func TestPrequalify_Run_ServerValidationErrorTyped(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/problem+json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"code":"validation_error","param":"applicant.state","detail":"unsupported state"}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	cov, _ := NewFaceValueCoverage(100_000)
	sel, _ := NewProductSelection("x.y")

	_, err := c.Prequalify.Run(context.Background(), &PrequalifyInput{
		Applicant: validApplicant(t),
		Coverage:  cov,
		Products:  sel,
	})
	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("expected *ValidationError, got %T: %v", err, err)
	}
	if ve.Base.Param != "applicant.state" {
		t.Errorf("Param = %q", ve.Base.Param)
	}
}

func TestQuote_Run_HappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"data": {
				"monthly_premium_cents": 5295,
				"face_value_cents": 1000000,
				"quote_id": "q_01HZ",
				"request_id": "req_q_01HZ"
			}
		}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	cov, _ := NewFaceValueCoverage(100_000)
	result, err := c.Quote.Run(context.Background(), &QuoteInput{
		Applicant:    validApplicant(t),
		Coverage:     cov,
		ProductToken: "colonial-penn.final-expense",
	})
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if result.MonthlyPremiumCents != 5295 || result.QuoteID != "q_01HZ" {
		t.Errorf("unexpected result: %+v", result)
	}
}

func TestQuote_Run_RateLimitedReturnsTyped(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Retry-After", "3")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte("rate limited"))
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	cov, _ := NewMonthlyBudgetCoverage(50)
	_, err := c.Quote.Run(context.Background(), &QuoteInput{
		Applicant:    validApplicant(t),
		Coverage:     cov,
		ProductToken: "x.y",
	})
	var rle *RateLimitError
	if !errors.As(err, &rle) {
		t.Fatalf("expected *RateLimitError, got %T: %v", err, err)
	}
	if rle.RetryAfter != 3*time.Second {
		t.Errorf("RetryAfter = %v", rle.RetryAfter)
	}
}

func TestPrequalify_Run_WithIdempotencyKey(t *testing.T) {
	const customKey = "550e8400-e29b-41d4-a716-446655440000"
	var seen string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.Header.Get("Idempotency-Key")
		_, _ = w.Write([]byte(`{"data":{"plans":[],"request_id":"req_x"}}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	cov, _ := NewFaceValueCoverage(50_000)
	sel, _ := NewProductSelection("x.y")
	_, err := c.Prequalify.Run(context.Background(), &PrequalifyInput{
		Applicant: validApplicant(t),
		Coverage:  cov,
		Products:  sel,
	}, WithIdempotencyKey(customKey))
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if seen != customKey {
		t.Errorf("Idempotency-Key = %q, want %q", seen, customKey)
	}
}

func TestUsage_Current(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"data":{"period_start":"2026-05-01","period_end":"2026-05-31","prequalify_count":42,"quote_count":3,"quota_limit":1000,"request_id":"req_u"}}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	snap, err := c.Usage.Current(context.Background())
	if err != nil {
		t.Fatalf("Current: %v", err)
	}
	if snap.PrequalifyCount != 42 || snap.QuoteCount != 3 || snap.QuotaLimit != 1000 {
		t.Errorf("unexpected snapshot: %+v", snap)
	}
}

func TestDatasets_Conditions_Pagination(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("limit") != "5" || r.URL.Query().Get("starting_after") != "c_1" {
			t.Errorf("unexpected query: %v", r.URL.RawQuery)
		}
		_, _ = w.Write([]byte(`{"data":{"data":[{"name":"COPD"}],"has_more":true,"next_id":"c_2"}}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	page, err := c.Datasets.Conditions(context.Background(), DatasetListOptions{Limit: 5, StartingAfter: "c_1"})
	if err != nil {
		t.Fatalf("Conditions: %v", err)
	}
	if len(page.Data) != 1 || page.Data[0].Name != "COPD" {
		t.Errorf("unexpected page: %+v", page)
	}
	if !page.HasMore || page.NextID != "c_2" {
		t.Errorf("pagination metadata wrong: %+v", page)
	}
}

func TestReferenceData_States(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"data":[{"code":"NC","name":"North Carolina","supported":true}]}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	states, err := c.ReferenceData.States(context.Background())
	if err != nil {
		t.Fatalf("States: %v", err)
	}
	if len(states) != 1 || states[0].Code != "NC" || !states[0].Supported {
		t.Errorf("unexpected states: %+v", states)
	}
}

func TestClient_RespectsContextCancellation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer srv.Close()

	c := newTestClient(t, srv)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := c.Usage.Current(ctx)
	if err == nil {
		t.Fatalf("expected cancellation error")
	}
}

func TestPrequalify_WireBody_CarriesFlattenedApplicant(t *testing.T) {
	cov, _ := NewFaceValueCoverage(100_000)
	sel, _ := NewProductSelection("a.b", "c.d")
	body, err := buildPrequalifyBody(&PrequalifyInput{
		Applicant: validApplicant(t),
		Coverage:  cov,
		Products:  sel,
	})
	if err != nil {
		t.Fatalf("buildPrequalifyBody: %v", err)
	}
	if body.Applicant.Sex != "M" || body.Applicant.HeightInches != 70 || body.Applicant.WeightPounds != 195 {
		t.Errorf("applicant flatten wrong: %+v", body.Applicant)
	}
	if body.Products != "a.b|c.d" {
		t.Errorf("products wire = %q", body.Products)
	}
}
