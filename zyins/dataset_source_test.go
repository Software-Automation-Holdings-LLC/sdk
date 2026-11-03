package zyins

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
)

// fixtureBundleJSON is the slim reference-bundle shape a FileDatasetSource
// loads offline — a handful of conditions/meds plus a spelling table.
const fixtureBundleJSON = `{
  "object": "datasets_catalog",
  "data": {
    "catalog_version": "fixture-3.0",
    "datasets": {
      "conditions": {
        "version": "fixture-c1",
        "item_count": 1,
        "items": [
          {
            "id": "HIGHBLOODPRESSURE",
            "name": "High Blood Pressure",
            "treated_with": [
              {"id": "LISINOPRIL", "name": "Lisinopril", "prescription_count": 8200}
            ]
          }
        ]
      },
      "medications": {
        "version": "fixture-m1",
        "item_count": 1,
        "items": [
          {
            "id": "LISINOPRIL",
            "name": "Lisinopril",
            "used_for": [
              {"id": "HIGHBLOODPRESSURE", "name": "High Blood Pressure", "prescription_count": 8200}
            ]
          }
        ]
      }
    }
  }
}`

// explodingDoer fails on any HTTP call — proves the offline path stays off
// the wire.
type explodingDoer struct{}

func (explodingDoer) Do(_ *http.Request) (*http.Response, error) {
	return nil, errors.New("network was contacted — offline reference load is broken")
}

func TestConditionsMatch_LoadsFromFileSource_NoNetwork(t *testing.T) {
	source := NewFileDatasetSourceWith("/virtual/reference-bundle.json", func(string) ([]byte, error) {
		return []byte(fixtureBundleJSON), nil
	})
	c, err := NewClient(
		WithToken("isa_test_aaaaaaaaaaaaaaaaaaaa"),
		WithBaseURL("https://example.test"),
		WithDatasetSource(source),
	)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	c.doer = explodingDoer{}

	cond, err := c.Conditions().Match(context.Background(), "high blood pressure")
	if err != nil {
		t.Fatalf("Match returned error (network should not have been touched): %v", err)
	}
	if cond == nil {
		t.Fatal("expected a known condition concept, got nil")
	}
	if cond.ID() != "HIGHBLOODPRESSURE" {
		t.Fatalf("ID = %q, want HIGHBLOODPRESSURE", cond.ID())
	}
}

func TestFileDatasetSource_ParsesSlimBundle(t *testing.T) {
	source := NewFileDatasetSourceWith("/virtual/b.json", func(string) ([]byte, error) {
		return []byte(fixtureBundleJSON), nil
	})
	bundle, err := source.Load(context.Background())
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if bundle.Version != "fixture-3.0" {
		t.Fatalf("Version = %q, want fixture-3.0", bundle.Version)
	}
}

func TestFileDatasetSource_ReadErrorNamesPath(t *testing.T) {
	source := NewFileDatasetSourceWith("/virtual/missing.json", func(string) ([]byte, error) {
		return nil, errors.New("absent")
	})
	_, err := source.Load(context.Background())
	if err == nil {
		t.Fatal("expected an error from a failing reader")
	}
	if got := err.Error(); !strings.Contains(got, "/virtual/missing.json") {
		t.Fatalf("error %q does not name the path", got)
	}
}

func TestResolvingDatasetSource_FirstSuccessWins(t *testing.T) {
	bad := NewFileDatasetSourceWith("/virtual/missing.json", func(string) ([]byte, error) {
		return nil, errors.New("absent")
	})
	good := NewFileDatasetSourceWith("/virtual/good.json", func(string) ([]byte, error) {
		return []byte(fixtureBundleJSON), nil
	})
	chain, err := NewResolvingDatasetSource([]DatasetSource{bad, good}, nil)
	if err != nil {
		t.Fatalf("NewResolvingDatasetSource: %v", err)
	}
	bundle, err := chain.Load(context.Background())
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if bundle.Version != "fixture-3.0" {
		t.Fatalf("Version = %q, want fixture-3.0", bundle.Version)
	}
}

func TestResolvingDatasetSource_RunsOnMissingHook(t *testing.T) {
	hookRan := false
	bad := NewFileDatasetSourceWith("/virtual/missing.json", func(string) ([]byte, error) {
		return nil, errors.New("absent")
	})
	api := NewAPIDatasetSource(func(context.Context) (*DatasetBundleV3, error) {
		return ParseDatasetBundle([]byte(fixtureBundleJSON))
	})
	chain, err := NewResolvingDatasetSource([]DatasetSource{bad, api}, func(context.Context) error {
		hookRan = true
		return nil
	})
	if err != nil {
		t.Fatalf("NewResolvingDatasetSource: %v", err)
	}
	if _, err := chain.Load(context.Background()); err != nil {
		t.Fatalf("Load: %v", err)
	}
	if !hookRan {
		t.Fatal("onMissing hook did not run between the file failure and the API fallback")
	}
}

func TestResolvingDatasetSource_AllFailNamesAttempts(t *testing.T) {
	bad := NewFileDatasetSourceWith("/virtual/a.json", func(string) ([]byte, error) {
		return nil, errors.New("absent")
	})
	api := NewAPIDatasetSource(func(context.Context) (*DatasetBundleV3, error) {
		return nil, errors.New("api down")
	})
	chain, err := NewResolvingDatasetSource([]DatasetSource{bad, api}, nil)
	if err != nil {
		t.Fatalf("NewResolvingDatasetSource: %v", err)
	}
	_, loadErr := chain.Load(context.Background())
	if loadErr == nil {
		t.Fatal("expected an error when every source fails")
	}
	msg := loadErr.Error()
	if !strings.Contains(msg, "FileDatasetSource") || !strings.Contains(msg, "APIDatasetSource") {
		t.Fatalf("error %q does not name both failed sources", msg)
	}
}

func TestResolvingDatasetSource_RejectsEmpty(t *testing.T) {
	if _, err := NewResolvingDatasetSource(nil, nil); err == nil {
		t.Fatal("expected an error constructing a chain with no sources")
	}
}
