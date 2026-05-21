package zyins

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type pqFakeDoer struct {
	last *http.Request
	body []byte
}

func (f *pqFakeDoer) Do(req *http.Request) (*http.Response, error) {
	f.last = req
	if req.Body != nil {
		f.body, _ = io.ReadAll(req.Body)
	}
	return &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(`{"plans":[{"brand":"a","tier":"std","monthly_premium":42,"face_value":10000,"product_token":"tok"}],"request_id":"req_1"}`)),
	}, nil
}

func TestPrequalify_LegacyBlob(t *testing.T) {
	c, err := NewClient(WithToken("isa_test_abc"))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	doer := &pqFakeDoer{}
	c.doer = doer
	out, err := c.Prequalify.LegacyBlob(context.Background(), map[string]any{
		"applicant": map[string]any{"sex": "M"},
	})
	if err != nil {
		t.Fatalf("LegacyBlob: %v", err)
	}
	if out.RequestID != "req_1" {
		t.Errorf("RequestID=%q", out.RequestID)
	}
	if len(out.Plans) != 1 || out.Plans[0].Brand != "a" {
		t.Errorf("Plans=%+v", out.Plans)
	}
	if !strings.Contains(string(doer.body), `"applicant"`) {
		t.Errorf("expected applicant in body: %s", doer.body)
	}
}

func TestPrequalify_LegacyBlob_RejectsNil(t *testing.T) {
	c, _ := NewClient(WithToken("isa_test_abc"))
	if _, err := c.Prequalify.LegacyBlob(context.Background(), nil); err == nil {
		t.Fatal("expected error for nil payload")
	}
}
