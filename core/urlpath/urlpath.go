// Package urlpath places caller-supplied values into request paths.
//
// A value spliced into a path must address exactly one segment, as seen
// by every hop that will read it: the client, any gateway in front of the
// API, and the server. Percent-encoding alone does not guarantee that.
// "." and ".." pass through encoding unchanged and are removed as dot
// segments, and a gateway that decodes once turns an encoded separator
// back into a real one. Such a value would move the request, and the
// credentials attached to it, onto a different route.
package urlpath

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
)

// ErrNotSegment is returned when a value cannot address exactly one path
// segment. Callers match it with errors.Is.
var ErrNotSegment = errors.New("not a single path segment")

// separators are the bytes some hop may treat as a segment boundary once
// decoded: the path separator, the backslash some servers fold into it,
// and the percent sign that would hide either from a single decode.
const separators = `/\%`

// Segment returns value escaped as exactly one URL path segment.
//
// It returns ErrNotSegment for the empty string, the dot segments "." and
// "..", and any value containing '/', '\', or '%'. Everything else is
// returned through url.PathEscape, so '?' and '#' stay inside the segment
// instead of starting a query or fragment.
func Segment(value string) (string, error) {
	if value == "" || value == "." || value == ".." || strings.ContainsAny(value, separators) {
		return "", fmt.Errorf("urlpath: %q: %w", value, ErrNotSegment)
	}
	return url.PathEscape(value), nil
}
