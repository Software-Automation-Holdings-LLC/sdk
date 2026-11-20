package internal

import (
	"encoding/base64"
	"errors"
	"io"
	"math"
	"strings"
)

// Ceiling is the most bytes of one document the client will hold in
// memory. Every layer a download passes through is read against it, so
// a payload that is small on the wire cannot expand past it at any
// later layer.
type Ceiling int64

// DefaultCeiling bounds a signed PDF when the caller configures none.
const DefaultCeiling Ceiling = 4 << 20

// ErrDocumentTooLarge reports a read that ran past its Ceiling. The
// read stops at the ceiling; the surplus is never buffered.
var ErrDocumentTooLarge = errors.New("rapidsign: document exceeds the configured size ceiling")

// AdmitsBase64 reports whether s decodes to at most c bytes, in any of
// the base64 alphabets, padded or not, without decoding it: each packs
// three bytes into four characters.
func (c Ceiling) AdmitsBase64(s string) bool {
	return int64(base64.RawStdEncoding.DecodedLen(len(strings.TrimRight(s, "=")))) <= int64(c)
}

// Wire is the ceiling on a JSON response that carries a document of at
// most c bytes as base64. Base64 spends four characters per three bytes
// and JSON may escape a character to two, so the bound is twice the
// encoded length; that also leaves the envelope's other fields ample
// room. It saturates rather than overflow.
func (c Ceiling) Wire() Ceiling {
	if c > math.MaxInt64/8*3 {
		return math.MaxInt64
	}
	return 2 * ((c + 2) / 3 * 4)
}

// Reader returns a reader over r that yields at most c bytes and then
// fails with ErrDocumentTooLarge if r has more, rather than truncating
// silently the way io.LimitReader does.
func (c Ceiling) Reader(r io.Reader) io.Reader {
	return &ceilingReader{r: r, remaining: int64(c)}
}

// Materialize reads the stream open yields twice: first under c into
// io.Discard, which measures it without holding a byte, then into a
// buffer of exactly that size. A stream past c is refused before any of
// it is held, and one that fits costs a single allocation. open must
// yield the same bytes each time, as a decoder over fixed input does.
func (c Ceiling) Materialize(open func() (io.Reader, error)) ([]byte, error) {
	r, err := open()
	if err != nil {
		return nil, err
	}
	n, err := io.Copy(io.Discard, c.Reader(r))
	if err != nil {
		return nil, err
	}
	if r, err = open(); err != nil {
		return nil, err
	}
	out := make([]byte, n)
	if _, err := io.ReadFull(r, out); err != nil {
		return nil, err
	}
	return out, nil
}

type ceilingReader struct {
	r         io.Reader
	remaining int64
}

func (cr *ceilingReader) Read(p []byte) (int, error) {
	if cr.remaining == 0 {
		return cr.probe()
	}
	if int64(len(p)) > cr.remaining {
		p = p[:cr.remaining]
	}
	n, err := cr.r.Read(p)
	cr.remaining -= int64(n)
	return n, err
}

// probe reads past the ceiling: a stream that ends there fit, and one
// more byte means it did not.
func (cr *ceilingReader) probe() (int, error) {
	var b [1]byte
	if n, err := cr.r.Read(b[:]); n == 0 {
		return 0, err
	}
	return 0, ErrDocumentTooLarge
}
