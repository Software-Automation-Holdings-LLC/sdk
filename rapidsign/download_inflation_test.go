package rapidsign

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"runtime"
	"testing"

	"github.com/Software-Automation-Holdings-LLC/sdk/rapidsign/internal"
)

// maxSignedPDFBytes is the most uncompressed PDF bytes one download may
// materialize. The ceiling belongs to the client. The server's
// size_bytes field must not raise it, and a gzip member (or a
// concatenation of members) that expands past it must fail before the
// surplus is allocated.
//
// allocBudgetBytes leaves room for a capped read: io.ReadAll keeps the
// growth chunks and a final copy, so stopping at the ceiling costs
// about two copies plus the flate window. It is far below the fixtures
// below, which expand to 12 MiB and 16 MiB.
const (
	maxSignedPDFBytes = 4 << 20
	allocBudgetBytes  = 12 << 20

	singleMemberBombBytes = 16 << 20
	streamMemberBytes     = 3 << 20
	streamMemberCount     = 4
	acceptedDocumentBytes = 1 << 20

	// Zeros at this size compress to a few hundred bytes. A fixture
	// that stops being small is no longer the attack these tests model.
	maxCompressedFixtureBytes = 64 << 10
)

func TestDocumentsDownload_RejectsGzipMemberBeyondDocumentCeiling(t *testing.T) {
	gz := gzipZeros(t, singleMemberBombBytes)
	assertSmallFixture(t, gz)

	out, alloc, err := downloadGzip(t, gz, true, 1)
	if err == nil || alloc > allocBudgetBytes || len(out) > maxSignedPDFBytes {
		t.Fatalf("Download err=%v returned %d bytes after allocating %d from a %d-byte gzip member (ceiling %d, budget %d)",
			err, len(out), alloc, len(gz), maxSignedPDFBytes, allocBudgetBytes)
	}
}

func TestDocumentsDownload_RejectsConcatenatedGzipMembersBeyondDocumentCeiling(t *testing.T) {
	var stream bytes.Buffer
	for i := 0; i < streamMemberCount; i++ {
		stream.Write(gzipZeros(t, streamMemberBytes))
	}
	gz := stream.Bytes()
	assertSmallFixture(t, gz)

	// Each member is under the ceiling. The limit has to cover the
	// whole reader: gzip concatenates members, and a counter that
	// resets per member would accept this response.
	out, alloc, err := downloadGzip(t, gz, true, 1)
	expanded := streamMemberBytes * streamMemberCount
	if err == nil || alloc > allocBudgetBytes || len(out) > maxSignedPDFBytes {
		t.Fatalf("Download err=%v returned %d bytes after allocating %d from %d concatenated members (%d uncompressed; ceiling %d, budget %d)",
			err, len(out), alloc, streamMemberCount, expanded, maxSignedPDFBytes, allocBudgetBytes)
	}
}

func TestDecodeGzippedBase64_RejectsMemberBeyondDocumentCeiling(t *testing.T) {
	gz := gzipZeros(t, singleMemberBombBytes)
	assertSmallFixture(t, gz)
	payload := base64.StdEncoding.EncodeToString(gz)

	out, alloc, err := callDecodeGzippedBase64(payload)
	if err == nil || alloc > allocBudgetBytes || len(out) > maxSignedPDFBytes {
		t.Fatalf("DecodeGzippedBase64 err=%v returned %d bytes after allocating %d from a %d-byte member (ceiling %d, budget %d)",
			err, len(out), alloc, len(gz), maxSignedPDFBytes, allocBudgetBytes)
	}
}

func TestDocumentsDownload_AcceptsGzipWithinDocumentCeiling(t *testing.T) {
	gz := gzipZeros(t, acceptedDocumentBytes)
	out, _, err := downloadGzip(t, gz, true, acceptedDocumentBytes)
	if err != nil {
		t.Fatalf("Download: %v", err)
	}
	if len(out) != acceptedDocumentBytes || out[0] != 0 || out[len(out)-1] != 0 {
		t.Fatalf("Download len=%d, want %d zero bytes", len(out), acceptedDocumentBytes)
	}
}

// downloadGzip serves one download response and measures allocations
// inside Documents.Download. sizeBytes is whatever the server claims;
// callers pass a lie so the ceiling cannot be taken from that field.
func downloadGzip(t *testing.T, gz []byte, compressed bool, sizeBytes int64) ([]byte, uint64, error) {
	t.Helper()
	body := envelope(map[string]any{
		"sign_id":         "sig_limit",
		"pdf_gzip_base64": base64.StdEncoding.EncodeToString(gz),
		"compressed":      compressed,
		"size_bytes":      sizeBytes,
	})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/documents/sig_limit/download" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)

	client := newTestClient(t, srv)
	return callDownload(client)
}

func callDownload(client *Client) ([]byte, uint64, error) {
	runtime.GC()
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	out, err := client.Documents.Download(context.Background(), "sig_limit")
	runtime.ReadMemStats(&after)
	return out, after.TotalAlloc - before.TotalAlloc, err
}

func callDecodeGzippedBase64(payload string) ([]byte, uint64, error) {
	runtime.GC()
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	out, err := internal.DecodeGzippedBase64(payload)
	runtime.ReadMemStats(&after)
	return out, after.TotalAlloc - before.TotalAlloc, err
}

func gzipZeros(t *testing.T, n int) []byte {
	t.Helper()
	var buf bytes.Buffer
	w, err := gzip.NewWriterLevel(&buf, gzip.BestSpeed)
	if err != nil {
		t.Fatalf("gzip writer: %v", err)
	}
	chunk := make([]byte, 32<<10)
	remaining := n
	for remaining > 0 {
		write := chunk
		if remaining < len(write) {
			write = write[:remaining]
		}
		if _, err := w.Write(write); err != nil {
			t.Fatalf("gzip write: %v", err)
		}
		remaining -= len(write)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}
	return buf.Bytes()
}

func assertSmallFixture(t *testing.T, gz []byte) {
	t.Helper()
	if len(gz) > maxCompressedFixtureBytes {
		t.Fatalf("compressed fixture is %d bytes, want <= %d", len(gz), maxCompressedFixtureBytes)
	}
}
