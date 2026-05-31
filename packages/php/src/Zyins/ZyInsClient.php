<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins;

use GuzzleHttp\Client as GuzzleClient;
use Isa\Sdk\Zyins\Branding\Service as BrandingService;
use Isa\Sdk\Zyins\Cases\CaseStorage;
use Isa\Sdk\Zyins\Cases\Service as CasesService;
use Isa\Sdk\Zyins\Cases\ZeroKnowledgeCaseStorage;
use Isa\Sdk\Zyins\Datasets\Service as DatasetsService;
use Isa\Sdk\Zyins\Email\Service as EmailService;
use Isa\Sdk\Zyins\Exception\IsaConfigException;
use Isa\Sdk\Zyins\Health\Service as HealthService;
use Isa\Sdk\Zyins\Licenses\Service as LicensesService;
use Isa\Sdk\Zyins\Logging\DebugLogger;
use Isa\Sdk\Zyins\Logos\Service as LogosService;
use Isa\Sdk\Zyins\Options\BundledApiVersions;
use Isa\Sdk\Zyins\Preferences\Service as PreferencesService;
use Isa\Sdk\Zyins\Prequalify\Service as PrequalifyService;
use Isa\Sdk\Zyins\Products\Facade as ProductsFacade;
use Isa\Sdk\Zyins\Quote\Service as QuoteService;
use Isa\Sdk\Zyins\Reference\AutocompleteAlgorithmInterface;
use Isa\Sdk\Zyins\Reference\AutocorrectorInterface;
use Isa\Sdk\Zyins\Reference\BundleBoundAutocorrector;
use Isa\Sdk\Zyins\Reference\ConditionsMatcher;
use Isa\Sdk\Zyins\Reference\DatasetsV3;
use Isa\Sdk\Zyins\Reference\MatchAlgorithmInterface;
use Isa\Sdk\Zyins\Reference\MedicationsMatcher;
use Isa\Sdk\Zyins\Reference\PrequalifyV3;
use Isa\Sdk\Zyins\Reference\QuoteV3;
use Isa\Sdk\Zyins\Reference\Reference as ReferenceFacade;
use Isa\Sdk\Zyins\Reference\ReferenceBundleCache;
use Isa\Sdk\Zyins\ReferenceData\Service as ReferenceDataService;
use Isa\Sdk\Zyins\Usage\Service as UsageService;
use Psr\Http\Client\ClientInterface;
use Psr\Log\LoggerInterface;

/**
 * Tier-3 ZyINS facade.
 *
 * Prefer one of the three named factories — they pick up sensible
 * defaults from the environment so the hello-world snippet is two
 * lines:
 *
 *     $isa = ZyInsClient::withBearer();           // reads ISA_TOKEN
 *     $result = $isa->prequalify->run($input);
 *
 * Factory → env vars:
 *  - `ZyInsClient::withBearer()`  → `ISA_TOKEN`
 *  - `ZyInsClient::withLicense()` → `ISA_LICENSE_KEYCODE`, `ISA_LICENSE_EMAIL`
 *  - `ZyInsClient::withSession()` → `ISA_SESSION_ID`, `ISA_SESSION_SECRET`
 *
 * Missing env vars raise {@see IsaConfigException} with a clear message
 * naming the variable that was empty.
 *
 * The full constructor accepts named overrides for tests and advanced
 * deployments (custom PSR-18 client, pinned idempotency source,
 * alternate base URL, alternate API version, PSR-3 logger). The class
 * is `readonly`, so all configuration is captured at construction;
 * sub-service properties are wired once and shared across every call.
 */
final readonly class ZyInsClient
{
    /** API version the SDK pins to today. Override per-request via {@see RequestOptions::withVersion()}. */
    public const DEFAULT_API_VERSION = '2026-05-18';

    private const REFERENCE_DATA_PATH = '/v1/reference-data';

    /**
     * `isa->zyins->prequalify` — runs the prequalify decision against the
     * version pinned on the parent {@see ZyInsClient}.
     *
     * With the default (`BundledApiVersions::MAP['prequalify']`) this is
     * an alias of {@see $prequalify} (the v1 service hitting
     * `POST /v1/prequalify`). With `apiVersion: ['prequalify' => 'v3']`
     * it routes to {@see $prequalifyV3} so the namespace-level call site
     * remains stable across surface upgrades. Narrow on the property's
     * concrete type to disambiguate the typed return shape — `Result` for
     * v1, `PrequalifyV3Result` for v3.
     *
     * Mirrors the TS facade routing on `ZyInsNamespace.prequalify`.
     */
    public PrequalifyService|PrequalifyV3 $prequalify;
    /**
     * `isa->zyins->quote` — runs the quote operation against the version
     * pinned on the parent {@see ZyInsClient}.
     *
     * With the default this is an alias of the v1 {@see QuoteService}
     * (`POST /v1/quote`). With `apiVersion: ['quote' => 'v3']` it routes
     * to {@see $quoteV3} (`POST /v3/quote`). Narrow on the property's
     * concrete type to disambiguate the typed return shape.
     */
    public QuoteService|QuoteV3 $quote;
    public DatasetsService $datasets;
    /** `isa->zyins->datasetsV3` — typed, id-keyed reference catalog (`GET /v3/datasets`). */
    public DatasetsV3 $datasetsV3;
    /**
     * `isa->zyins->prequalifyV3` — callable for the typed v3 prequalify
     * decision (`POST /v3/prequalify`). Returns one offer per product
     * with a uniform `pricing[]` table — each row is a rate class
     * carrying its own eligibility, premium, and rank. Array order of
     * `pricing` is authoritative for display. Pin via
     * `apiVersion: ['prequalify' => 'v3']` to make
     * `isa->zyins->prequalify` route here.
     */
    public PrequalifyV3 $prequalifyV3;
    /**
     * `isa->zyins->quoteV3` — callable for the typed v3 quote call
     * (`POST /v3/quote`). Returns qualifying products grouped by
     * requested amount with the same uniform `pricing[]` table as v3
     * prequalify. Pin via `apiVersion: ['quote' => 'v3']` to make
     * `isa->zyins->quote` route here.
     */
    public QuoteV3 $quoteV3;
    /**
     * `isa->zyins->reference` — typed catalog access via `match()`
     * returning `Concept` handles. Pair with `$datasetsV3->get()` to
     * obtain the bundle the matchers walk.
     */
    public ReferenceFacade $reference;
    /**
     * `isa->zyins->medications` — shortcut to `$reference->medications`.
     * Identical instance; `match()`, `matchMany()`, and `list()` behave
     * the same way regardless of which path the caller picks.
     */
    public MedicationsMatcher $medications;
    /**
     * `isa->zyins->conditions` — shortcut to `$reference->conditions`.
     * Identical instance; `match()`, `matchMany()`, and `list()` behave
     * the same way regardless of which path the caller picks.
     */
    public ConditionsMatcher $conditions;
    /**
     * `isa->zyins->autocorrector` — domain-bound autocorrector wired to
     * the v3 spelling_corrections dataset. After
     * `$isa->zyins->datasetsV3->get()` warms the cache, this corrects
     * free-text input using the catalog typo map. Replace via the
     * `autocorrector` constructor parameter on {@see \Isa\Sdk\Isa} for
     * custom autocorrection (e.g. language models).
     */
    public AutocorrectorInterface $autocorrector;
    public ProductsFacade $products;
    public ReferenceDataService $referenceData;
    public UsageService $usage;
    /**
     * Canonical license lifecycle service per the locked SDK syntax (TS
     * canon: `isa.zyins.license`). A device has exactly one license;
     * activate, check, and deactivate all go through this property.
     */
    public LicensesService $license;
    public LogosService $logos;
    public HealthService $health;
    public BrandingService $branding;
    public PreferencesService $preferences;
    public CasesService $cases;
    public EmailService $email;
    public Auth $auth;
    private Transport $transport;

    /**
     * @param array<string, string> $apiVersionMap Per-surface API version overrides;
     *                                             keys are surface names (e.g. `prequalify`,
     *                                             `quote`). Surfaces absent from the map
     *                                             fall back to {@see BundledApiVersions::MAP}.
     *                                             When `prequalify` resolves to `v3` the
     *                                             {@see $prequalify} property routes to
     *                                             {@see $prequalifyV3}; same for `quote`.
     */
    public function __construct(
        string|Auth $token,
        ?ClientInterface $httpClient = null,
        ?IdempotencyKeySource $idempotency = null,
        string $baseUrl = Transport::DEFAULT_BASE_URL,
        string $apiVersion = self::DEFAULT_API_VERSION,
        ?string $userAgent = null,
        ?LoggerInterface $logger = null,
        ?CaseStorage $caseStorage = null,
        array $apiVersionMap = [],
        ?AutocorrectorInterface $autocorrector = null,
        ?MatchAlgorithmInterface $matchAlgorithm = null,
        ?AutocompleteAlgorithmInterface $autocompleteAlgorithm = null,
    ) {
        $this->auth = $token instanceof Auth ? $token : new Auth($token);
        $this->transport = new Transport(
            http: $httpClient ?? new GuzzleClient(['http_errors' => false]),
            auth: $this->auth,
            keys: $idempotency ?? new Uuid4IdempotencyKeySource(),
            baseUrl: rtrim($baseUrl, '/'),
            apiVersion: $apiVersion,
            userAgent: $userAgent ?? self::defaultUserAgent(),
            logger: new DebugLogger($logger),
        );
        $this->datasets = new DatasetsService($this->transport);
        // Shared reference-bundle cache: warmed by `datasetsV3->get()`
        // on every successful fetch, read by the bundleless `match()`
        // path on the matchers below. One instance per client so the
        // matchers and the dataset service stay in lock-step without
        // consumer-side plumbing.
        $referenceCache = new ReferenceBundleCache();
        $this->datasetsV3 = new DatasetsV3($this->transport, $referenceCache);
        $this->prequalifyV3 = new PrequalifyV3($this->transport);
        $this->quoteV3 = new QuoteV3($this->transport);

        // Per-surface facade routing — narrow which concrete service the
        // namespace-level `prequalify` / `quote` properties point at, based
        // on the resolved per-surface API version. Mirrors the TS selector
        // in `ZyInsNamespace` (packages/ts/src/zyins/isa.ts).
        $this->prequalify = BundledApiVersions::resolve('prequalify', $apiVersionMap) === 'v3'
            ? $this->prequalifyV3
            : new PrequalifyService($this->transport);
        $this->quote = BundledApiVersions::resolve('quote', $apiVersionMap) === 'v3'
            ? $this->quoteV3
            : new QuoteService($this->transport);
        $this->reference = new ReferenceFacade($referenceCache, $matchAlgorithm, $autocompleteAlgorithm);
        $this->medications = $this->reference->medications;
        $this->conditions = $this->reference->conditions;
        $this->autocorrector = $autocorrector ?? new BundleBoundAutocorrector($referenceCache);
        $this->products = new ProductsFacade(
            fn (array $query): array => $this->fetchReferenceData($query)
        );
        $this->referenceData = new ReferenceDataService($this->transport);
        $this->usage = new UsageService($this->transport);
        $this->license = new LicensesService($this->transport);
        $this->logos = new LogosService(
            http: $httpClient ?? new GuzzleClient(['http_errors' => false]),
            baseUrl: rtrim($baseUrl, '/'),
        );
        $this->health = new HealthService($this->transport);
        $this->branding = new BrandingService($this->transport);
        $this->preferences = new PreferencesService($this->transport);
        $this->email = new EmailService($this->transport);
        $this->cases = new CasesService(
            $this->transport,
            $this->email,
            $caseStorage ?? new ZeroKnowledgeCaseStorage($this->transport),
        );
    }

    /**
     * Construct a bearer-token client. When no argument is supplied,
     * reads `ISA_TOKEN` from the environment.
     *
     * @param string|null          $token  Optional bearer token; env is consulted when null.
     * @param LoggerInterface|null $logger Optional PSR-3 logger; defaults to stderr at ISA_LOG=debug.
     *
     * @return self A fully constructed client in bearer mode.
     *
     * @throws IsaConfigException when neither argument nor env supplies a token.
     *
     * @example
     * // Reads ISA_TOKEN from the environment:
     * $isa = ZyInsClient::withBearer();
     *
     * @param array<string, string> $apiVersionMap per-surface API version overrides.
     *
     * @see https://docs.isaapi.com/sdk/factories
     */
    public static function withBearer(
        ?string $token = null,
        ?LoggerInterface $logger = null,
        ?CaseStorage $caseStorage = null,
        array $apiVersionMap = [],
    ): self {
        $resolved = $token ?? self::env('ISA_TOKEN');
        if ($resolved === null) {
            throw new IsaConfigException(
                'ZyInsClient::withBearer(): missing token. Pass it explicitly or set ISA_TOKEN in the environment.'
            );
        }
        return new self(
            token: $resolved,
            logger: $logger,
            caseStorage: $caseStorage,
            apiVersionMap: $apiVersionMap,
        );
    }

    /**
     * Construct a License-mode client. When invoked without arguments,
     * reads `ISA_LICENSE_KEYCODE` and `ISA_LICENSE_EMAIL` from the
     * environment.
     *
     * @param string|null          $keycode License keycode; env is consulted when null.
     * @param string|null          $email   License email; env is consulted when null.
     * @param LoggerInterface|null $logger  Optional PSR-3 logger.
     *
     * @return self A fully constructed client in license mode.
     *
     * @throws IsaConfigException when either credential is missing.
     *
     * @example
     * $isa = ZyInsClient::withLicense('ABC-123-XYZ', 'agent@example.com');
     *
     * @param array<string, string> $apiVersionMap per-surface API version overrides.
     *
     * @see https://docs.isaapi.com/sdk/factories
     */
    public static function withLicense(
        ?string $keycode = null,
        ?string $email = null,
        ?LoggerInterface $logger = null,
        ?CaseStorage $caseStorage = null,
        array $apiVersionMap = [],
    ): self {
        $resolvedKey = $keycode ?? self::env('ISA_LICENSE_KEYCODE');
        $resolvedEmail = $email ?? self::env('ISA_LICENSE_EMAIL');
        if ($resolvedKey === null) {
            throw new IsaConfigException(
                'ZyInsClient::withLicense(): missing keycode. Pass it explicitly or set ISA_LICENSE_KEYCODE in the environment.'
            );
        }
        if ($resolvedEmail === null) {
            throw new IsaConfigException(
                'ZyInsClient::withLicense(): missing email. Pass it explicitly or set ISA_LICENSE_EMAIL in the environment.'
            );
        }
        return new self(
            token: Auth::license($resolvedKey, $resolvedEmail),
            logger: $logger,
            caseStorage: $caseStorage,
            apiVersionMap: $apiVersionMap,
        );
    }

    /**
     * Construct a Session-mode client. When invoked without arguments,
     * reads `ISA_SESSION_ID` and `ISA_SESSION_SECRET` from the
     * environment.
     *
     * @param string|null          $sessionId     Session id; env is consulted when null.
     * @param string|null          $sessionSecret Session signing secret; env is consulted when null.
     * @param LoggerInterface|null $logger        Optional PSR-3 logger.
     *
     * @return self A fully constructed client in session mode.
     *
     * @throws IsaConfigException when either credential is missing.
     *
     * @example
     * // Reads ISA_SESSION_ID and ISA_SESSION_SECRET from the environment:
     * $isa = ZyInsClient::withSession();
     *
     * @param array<string, string> $apiVersionMap per-surface API version overrides.
     *
     * @see https://docs.isaapi.com/sdk/factories
     */
    public static function withSession(
        ?string $sessionId = null,
        ?string $sessionSecret = null,
        ?LoggerInterface $logger = null,
        ?CaseStorage $caseStorage = null,
        array $apiVersionMap = [],
    ): self {
        $resolvedId = $sessionId ?? self::env('ISA_SESSION_ID');
        $resolvedSecret = $sessionSecret ?? self::env('ISA_SESSION_SECRET');
        if ($resolvedId === null) {
            throw new IsaConfigException(
                'ZyInsClient::withSession(): missing session id. Pass it explicitly or set ISA_SESSION_ID in the environment.'
            );
        }
        if ($resolvedSecret === null) {
            throw new IsaConfigException(
                'ZyInsClient::withSession(): missing session secret. Pass it explicitly or set ISA_SESSION_SECRET in the environment.'
            );
        }
        return new self(
            token: Auth::session($resolvedId, $resolvedSecret),
            logger: $logger,
            caseStorage: $caseStorage,
            apiVersionMap: $apiVersionMap,
        );
    }

    private static function env(string $name): ?string
    {
        $value = getenv($name);
        if (! is_string($value) || $value === '') {
            return null;
        }
        return $value;
    }

    /**
     * @param  array<string,mixed> $query
     * @return array<string,mixed>
     */
    private function fetchReferenceData(array $query): array
    {
        $queryString = http_build_query($query);
        $path = self::REFERENCE_DATA_PATH . ($queryString === '' ? '' : '?' . $queryString);
        /** @var array<string,mixed> $data */
        $data = $this->transport->get($path)->data;
        return $data;
    }

    private static function defaultUserAgent(): string
    {
        return sprintf('sah-sdk-zyins-php/%s php/%s', '0.4.0-rc.1', PHP_VERSION);
    }
}
