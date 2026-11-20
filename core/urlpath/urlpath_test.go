package urlpath

import (
	"errors"
	"testing"
)

func TestSegment_EscapesValueIntoOneSegment(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		value string
		want  string
	}{
		{name: "plain id", value: "case_abc", want: "case_abc"},
		{name: "uuid", value: "0b8f1f1e-2f7a-4c55-9d36-1f9a3c1b2e4d", want: "0b8f1f1e-2f7a-4c55-9d36-1f9a3c1b2e4d"},
		{name: "query marker stays in segment", value: "x?include=conditions", want: "x%3Finclude=conditions"},
		{name: "fragment marker stays in segment", value: "x#y", want: "x%23y"},
		{name: "space", value: "mutual of omaha", want: "mutual%20of%20omaha"},
		{name: "dots inside a name", value: "v1.2..3", want: "v1.2..3"},
		{name: "three dots is not a dot segment", value: "...", want: "..."},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := Segment(tt.value)
			if err != nil {
				t.Fatalf("Segment(%q) error = %v", tt.value, err)
			}
			if got != tt.want {
				t.Fatalf("Segment(%q) = %q, want %q", tt.value, got, tt.want)
			}
		})
	}
}

func TestSegment_WithValueThatLeavesItsSegment_ReturnsErrNotSegment(t *testing.T) {
	t.Parallel()
	for _, value := range []string{
		"",
		".",
		"..",
		"../v3/datasets",
		"foo/../../v3/quote",
		"a/b",
		`..\v3`,
		"%2e%2e",
		"..%2f..%2fv3%2fdatasets",
		"%2F",
	} {
		t.Run(value, func(t *testing.T) {
			t.Parallel()
			got, err := Segment(value)
			if !errors.Is(err, ErrNotSegment) {
				t.Fatalf("Segment(%q) = %q, %v; want ErrNotSegment", value, got, err)
			}
		})
	}
}
