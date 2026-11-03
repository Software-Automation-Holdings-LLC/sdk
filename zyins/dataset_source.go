// Package zyins — pluggable reference-bundle source.
//
// The reference layer (Conditions/Medications/Concepts Match, autocomplete,
// fuzzy, autocorrect) is warmed by default from a live DatasetsV3.Get HTTP
// call. A DatasetSource lets the same layer load from a local artifact —
// offline, inside the engine, or anywhere a network round-trip is
// undesirable. The contract is a single Load(ctx) (*DatasetBundleV3, error);
// how the bytes arrive is the source's business.
//
// Three implementations ship:
//   - FileDatasetSource — read a file, parse with the EXISTING
//     ParseDatasetBundle (no second parser).
//   - APIDatasetSource — the current DatasetsV3.Get HTTP path.
//   - ResolvingDatasetSource — try sources in order, first success wins.
//     Documented chain: local file → optional generate hook → API fallback.
//
// Default behavior is unchanged: with no WithDatasetSource option the
// client uses the API path exactly as before.

package zyins

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// DatasetSource resolves a *DatasetBundleV3 for the reference layer.
// Implementations resolve the bundle however they like — HTTP, a local
// file, an in-memory value — and surface one method.
type DatasetSource interface {
	// Load resolves the bundle. Returns a descriptive error naming the
	// source and the failing input when the bundle cannot be produced.
	Load(ctx context.Context) (*DatasetBundleV3, error)
}

// FileReader reads a file's bytes by path. Injectable so the file source
// stays testable without touching the disk. The name describes WHAT (read
// a file) not HOW (which syscall backs it).
type FileReader func(path string) ([]byte, error)

// defaultFileReader reads from the OS filesystem. The single os.ReadFile
// call is isolated behind the injectable FileReader facade so every other
// code path stays testable without disk I/O.
func defaultFileReader(path string) ([]byte, error) {
	return os.ReadFile(filepath.Clean(path))
}

// FileDatasetSource loads the bundle from a local file and parses it with
// the shared ParseDatasetBundle. Accepts the slim reference-bundle.json OR
// the full datasets.json — both carry the same data.datasets shape; the
// reference layer reads only the reference fields.
type FileDatasetSource struct {
	path string
	read FileReader
}

// NewFileDatasetSource builds a file-backed source reading from the OS
// filesystem.
func NewFileDatasetSource(path string) *FileDatasetSource {
	return &FileDatasetSource{path: path, read: defaultFileReader}
}

// NewFileDatasetSourceWith builds a file-backed source with an injected
// reader (tests supply an in-memory reader).
func NewFileDatasetSourceWith(path string, read FileReader) *FileDatasetSource {
	return &FileDatasetSource{path: path, read: read}
}

// Load reads and parses the file.
func (s *FileDatasetSource) Load(_ context.Context) (*DatasetBundleV3, error) {
	body, err := s.read(s.path)
	if err != nil {
		return nil, fmt.Errorf("zyins: FileDatasetSource: read %s: %w", s.path, err)
	}
	bundle, err := ParseDatasetBundle(body)
	if err != nil {
		return nil, fmt.Errorf("zyins: FileDatasetSource: parse %s as a v3 dataset bundle: %w", s.path, err)
	}
	return bundle, nil
}

// APIDatasetSource loads the bundle from a caller-supplied fetcher — the
// current DatasetsV3.Get HTTP path. Uses the already-configured client
// credential; it introduces no new service key.
type APIDatasetSource struct {
	fetch func(ctx context.Context) (*DatasetBundleV3, error)
}

// NewAPIDatasetSource wraps a bundle fetcher (typically a client's
// DatasetsV3.Get) as a DatasetSource.
func NewAPIDatasetSource(fetch func(ctx context.Context) (*DatasetBundleV3, error)) *APIDatasetSource {
	return &APIDatasetSource{fetch: fetch}
}

// Load invokes the fetcher.
func (s *APIDatasetSource) Load(ctx context.Context) (*DatasetBundleV3, error) {
	return s.fetch(ctx)
}

// StaticDatasetSource serves a bundle already in memory.
type StaticDatasetSource struct {
	bundle *DatasetBundleV3
}

// NewStaticDatasetSource wraps an in-memory bundle.
func NewStaticDatasetSource(bundle *DatasetBundleV3) *StaticDatasetSource {
	return &StaticDatasetSource{bundle: bundle}
}

// Load returns the wrapped bundle.
func (s *StaticDatasetSource) Load(_ context.Context) (*DatasetBundleV3, error) {
	if s.bundle == nil {
		return nil, errors.New("zyins: StaticDatasetSource: nil bundle")
	}
	return s.bundle, nil
}

// OnMissingHook is invoked between the first source's failure and the next
// source in a ResolvingDatasetSource chain.
type OnMissingHook func(ctx context.Context) error

// ResolvingDatasetSource tries each source in order; the first that
// resolves wins. The documented chain is local file → optional generate
// hook → API fallback: pass the generate hook as the OnMissing option and
// it runs once, after the first source fails and before the next is tried.
// When every source fails, Load returns an error naming each attempt.
type ResolvingDatasetSource struct {
	sources   []DatasetSource
	onMissing OnMissingHook
}

// NewResolvingDatasetSource builds a chain. onMissing may be nil.
func NewResolvingDatasetSource(sources []DatasetSource, onMissing OnMissingHook) (*ResolvingDatasetSource, error) {
	if len(sources) == 0 {
		return nil, errors.New("zyins: ResolvingDatasetSource: at least one source is required")
	}
	return &ResolvingDatasetSource{sources: sources, onMissing: onMissing}, nil
}

// Load walks the chain.
func (s *ResolvingDatasetSource) Load(ctx context.Context) (*DatasetBundleV3, error) {
	failures := make([]string, 0, len(s.sources))
	for i, source := range s.sources {
		bundle, err := source.Load(ctx)
		if err == nil {
			return bundle, nil
		}
		failures = append(failures, fmt.Sprintf("%T failed (%v)", source, err))
		if i == 0 && s.onMissing != nil {
			if hookErr := s.onMissing(ctx); hookErr != nil {
				failures = append(failures, fmt.Sprintf("onMissing hook failed (%v)", hookErr))
			}
		}
	}
	return nil, fmt.Errorf("zyins: ResolvingDatasetSource: every source failed — %s", strings.Join(failures, "; "))
}
