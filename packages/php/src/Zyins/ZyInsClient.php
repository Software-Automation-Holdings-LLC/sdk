<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins;

use GuzzleHttp\Client as GuzzleClient;
use Psr\Http\Client\ClientInterface;
use Psr\Log\LoggerInterface;
use Sah\Sdk\Zyins\Branding\Service as BrandingService;
use Sah\Sdk\Zyins\Cases\Service as CasesService;
use Sah\Sdk\Zyins\Datasets\Service as DatasetsService;
use Sah\Sdk\Zyins\Email\Service as EmailService;
use Sah\Sdk\Zyins\Exception\IsaConfigException;
use Sah\Sdk\Zyins\Health\Service as HealthService;
use Sah\Sdk\Zyins\Licenses\Service as LicensesService;
use Sah\Sdk\Zyins\Logos\Service as LogosService;
use Sah\Sdk\Zyins\Preferences\Service as PreferencesService;
use Sah\Sdk\Zyins\Logging\DebugLogger;
use Sah\Sdk\Zyins\Prequalify\Service as PrequalifyService;
use Sah\Sdk\Zyins\Products\Facade as ProductsFacade;
use Sah\Sdk\Zyins\Quote\Service as QuoteService;
use Sah\Sdk\Zyins\ReferenceData\Service as ReferenceDataService;
use Sah\Sdk\Zyins\Usage\Service as UsageService;

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

    public PrequalifyService $prequalify;
    public QuoteService $quote;
    public DatasetsService $datasets;
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

    public function __construct(
        string|Auth $token,
        ?ClientInterface $httpClient = null,
        ?IdempotencyKeySource $idempotency = null,
        string $baseUrl = Transport::DEFAULT_BASE_URL,
        string $apiVersion = self::DEFAULT_API_VERSION,
        ?string $userAgent = null,
        ?LoggerInterface $logger = null,
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
        $this->prequalify = new PrequalifyService($this->transport);
        $this->quote = new QuoteService($this->transport);
        $this->datasets = new DatasetsService($this->transport);
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
        $this->cases = new CasesService($this->transport, $this->email);
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
     * @see https://docs.isaapi.com/sdk/factories
     */
    public static function withBearer(?string $token = null, ?LoggerInterface $logger = null): self
    {
        $resolved = $token ?? self::env('ISA_TOKEN');
        if ($resolved === null) {
            throw new IsaConfigException(
                'ZyInsClient::withBearer(): missing token. Pass it explicitly or set ISA_TOKEN in the environment.'
            );
        }
        return new self(token: $resolved, logger: $logger);
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
     * @see https://docs.isaapi.com/sdk/factories
     */
    public static function withLicense(
        ?string $keycode = null,
        ?string $email = null,
        ?LoggerInterface $logger = null,
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
        return new self(token: Auth::license($resolvedKey, $resolvedEmail), logger: $logger);
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
     * @see https://docs.isaapi.com/sdk/factories
     */
    public static function withSession(
        ?string $sessionId = null,
        ?string $sessionSecret = null,
        ?LoggerInterface $logger = null,
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
        return new self(token: Auth::session($resolvedId, $resolvedSecret), logger: $logger);
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
