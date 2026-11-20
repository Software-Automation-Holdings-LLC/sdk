package internal

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
)

// DecodeGzippedBase64 decodes a download payload under DefaultCeiling.
func DecodeGzippedBase64(s string) ([]byte, error) {
	return DefaultCeiling.DecodeGzippedBase64(s)
}

// DecodeGzippedBase64 inverts the wire format used by
// DownloadDocument: base64 → gzip → raw PDF bytes. The compressed
// payload and the PDF it inflates to, across every concatenated gzip
// member, are each materialized under c, so a payload that would expand
// past it fails with ErrDocumentTooLarge before the expansion is held.
// Each decode step wraps its own error so callers can distinguish
// transport-level corruption from server-level errors (which are
// classified before reaching this helper).
func (c Ceiling) DecodeGzippedBase64(s string) ([]byte, error) {
	gz, err := c.Materialize(func() (io.Reader, error) {
		return base64.NewDecoder(base64.StdEncoding, strings.NewReader(s)), nil
	})
	if err != nil {
		return nil, fmt.Errorf("rapidsign: failed to base64-decode download payload: %w", err)
	}
	pdf, err := c.Materialize(func() (io.Reader, error) {
		return gzip.NewReader(bytes.NewReader(gz))
	})
	if err != nil {
		return nil, fmt.Errorf("rapidsign: failed to gunzip download payload: %w", err)
	}
	return pdf, nil
}
