package zyins

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	coretransport "github.com/Software-Automation-Holdings-LLC/sdk/core/transport"
)

// DefaultBaseURL is the production ZyINS endpoint. Override with
// WithBaseURL for staging, sandbox, or local-development fixture
// servers.
const DefaultBaseURL = "https://zyins.isaapi.com"

// defaultHTTPTimeout is the per-request ceiling applied when the
// caller does not supply a custom *http.Client.
const defaultHTTPTimeout = 60 * time.Second

// Client is the top-level ZyINS API client. Construct one with
// NewClient and reuse it across requests; it is safe for concurrent
// use (see README "Concurrency"). Operations are grouped under typed
// sub-services as exported fields.
type Client struct {
	baseURL   string
	userAgent string
	doer      httpDoer
	logger    DebugLogger

	// Prequalify runs the prequalify engine against an applicant.
	Prequalify *PrequalifyService
	// Quote computes a premium for one accepted plan after prequalify.
	Quote *QuoteService
	// Datasets reads the read-only datasets surface (conditions,
	// medications, brands, plans).
	Datasets *DatasetsService
	// ReferenceData reads engine reference tables (states, products,
	// nicotine modes).
	ReferenceData *ReferenceDataService
	// Usage reads consumption and quota counters.
	Usage *UsageService
}

// Option mutates an *options block during NewClient. The functional-
// options pattern keeps the public constructor signature compact while
// allowing additive evolution (new options never break call sites).
type Option func(*options) error

// options carries the resolved construction-time configuration.
type options struct {
	baseURL     string
	httpClient  *http.Client
	tokenSource TokenSource
	userAgent   string
	timeout     time.Duration
	maxAttempts int
	// license and session capture credentials from the License/Session
	// factories. The transports for these modes ship after the
	// bearer-only baseline; NewClient rejects them with a typed
	// *ConfigError until then so callers see the gap at construction.
	license *LicenseCredential
	session *SessionCredential
	// logger overrides the default stderr debug logger. nil means
	// "use the slog handler honoring ISA_LOG".
	logger DebugLogger
}

// WithToken supplies a static bearer token. Equivalent to
// WithTokenSource(StaticToken(token)). Token shape is validated; the
// token must start with `isa_live_` or `isa_test_`.
func WithToken(token string) Option {
	return func(o *options) error {
		if err := validateTokenShape(token); err != nil {
			return fmt.Errorf("zyins: WithToken rejected token: %w", err)
		}
		o.tokenSource = StaticToken(token)
		return nil
	}
}

// WithTokenSource supplies a refreshing TokenSource. Callers that
// rotate credentials in-process pass an implementation here; the SDK
// invokes Token() once per outbound request.
func WithTokenSource(src TokenSource) Option {
	return func(o *options) error {
		if src == nil {
			return errors.New("zyins: WithTokenSource requires a non-nil TokenSource")
		}
		o.tokenSource = src
		return nil
	}
}

// WithBaseURL overrides DefaultBaseURL. Use for staging, sandbox, or
// fixture servers. Trailing slashes are trimmed.
func WithBaseURL(url string) Option {
	return func(o *options) error {
		trimmed := strings.TrimSpace(url)
		if trimmed == "" {
			return errors.New("zyins: WithBaseURL requires a non-empty URL")
		}
		o.baseURL = strings.TrimRight(trimmed, "/")
		return nil
	}
}

// WithHTTPClient overrides the SDK's default *http.Client. The supplied
// client's transport is preserved; the bearer + retry transports layer
// on top.
func WithHTTPClient(c *http.Client) Option {
	return func(o *options) error {
		if c == nil {
			return errors.New("zyins: WithHTTPClient requires a non-nil *http.Client")
		}
		o.httpClient = c
		return nil
	}
}

// WithTimeout sets the per-request HTTP timeout. Ignored when the
// caller also supplies WithHTTPClient — that client's timeout wins.
func WithTimeout(d time.Duration) Option {
	return func(o *options) error {
		if d <= 0 {
			return errors.New("zyins: WithTimeout requires a positive duration")
		}
		o.timeout = d
		return nil
	}
}

// WithUserAgent overrides the default User-Agent header. Useful for
// callers that want their app name surfaced in the server logs.
func WithUserAgent(ua string) Option {
	return func(o *options) error {
		if strings.TrimSpace(ua) == "" {
			return errors.New("zyins: WithUserAgent requires a non-empty value")
		}
		o.userAgent = ua
		return nil
	}
}

// WithLogger overrides the default stderr debug logger. Any
// implementation of DebugLogger is accepted (slog, custom adapter,
// etc.). Passing nil resets to the default.
func WithLogger(l DebugLogger) Option {
	return func(o *options) error {
		o.logger = l
		return nil
	}
}

// WithMaxRetryAttempts caps the total request attempts including the
// first. The value MUST be a positive integer; zero and negative
// counts are rejected as programming errors because "no retries" is
// not the same intent as "use the SDK default" — callers who want the
// default should omit this option entirely.
func WithMaxRetryAttempts(n int) Option {
	return func(o *options) error {
		if n <= 0 {
			return errors.New("zyins: WithMaxRetryAttempts requires a positive count")
		}
		o.maxAttempts = n
		return nil
	}
}

// NewClient returns a ready-to-use Client. The single required option
// is WithToken or WithTokenSource; everything else falls back to the
// SDK defaults.
//
// NewClient never panics: every misconfiguration is surfaced as a
// returned error.
func NewClient(opts ...Option) (*Client, error) {
	o := options{
		baseURL:   DefaultBaseURL,
		userAgent: userAgentHeader,
		timeout:   defaultHTTPTimeout,
	}
	for _, opt := range opts {
		if opt == nil {
			continue
		}
		if err := opt(&o); err != nil {
			return nil, fmt.Errorf("zyins: NewClient option failed: %w", err)
		}
	}
	if o.tokenSource == nil {
		// Surface pending-transport credentials with a typed error so
		// callers can distinguish "you forgot to configure auth" from
		// "License/Session auth is captured but not yet wired".
		if o.license != nil {
			return nil, errLicenseTransportPending
		}
		if o.session != nil {
			return nil, errSessionTransportPending
		}
		return nil, errors.New("zyins: NewClient requires WithToken, WithTokenSource, or WithBearer")
	}

	httpClient := o.httpClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: o.timeout}
	}

	retry, err := coretransport.NewRetryTransport(httpClient, coretransport.RetryConfig{
		MaxAttempts: o.maxAttempts,
	})
	if err != nil {
		return nil, fmt.Errorf("zyins: NewClient retry transport: %w", err)
	}
	logger := o.logger
	if logger == nil {
		logger = newDefaultDebugLogger()
	}
	// Wire order: bearer wraps debug wraps retry. Putting debug INSIDE
	// bearer means the Authorization header is already attached at log
	// time so redaction has something to redact; putting debug OUTSIDE
	// retry keeps a single log entry per logical request rather than
	// one per retry attempt.
	debugged := &debugDoer{inner: retry, logger: logger}
	bearer, err := coretransport.NewBearerTransport(asCoreTokenSource(o.tokenSource), debugged)
	if err != nil {
		return nil, fmt.Errorf("zyins: NewClient bearer transport: %w", err)
	}
	c := &Client{
		baseURL:   o.baseURL,
		userAgent: o.userAgent,
		doer:      bearer,
		logger:    logger,
	}
	c.Prequalify = &PrequalifyService{client: c}
	c.Quote = &QuoteService{client: c}
	c.Datasets = &DatasetsService{client: c}
	c.ReferenceData = &ReferenceDataService{client: c}
	c.Usage = &UsageService{client: c}
	return c, nil
}

// tokenSourceAdapter bridges the SDK's TokenSource interface to the
// core package's identically-shaped interface. Two declarations rather
// than one re-export so the public API of this package does not depend
// on consumers importing sdk/core just to satisfy a type assertion.
type tokenSourceAdapter struct{ inner TokenSource }

func (t tokenSourceAdapter) Token() (string, error) {
	tok, err := t.inner.Token()
	if err != nil {
		return "", fmt.Errorf("zyins: token source returned error: %w", err)
	}
	return tok, nil
}

func asCoreTokenSource(src TokenSource) coretransport.TokenSource {
	return tokenSourceAdapter{inner: src}
}
