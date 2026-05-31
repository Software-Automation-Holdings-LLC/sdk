<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

use GuzzleHttp\Client as GuzzleClient;
use Psr\Http\Client\ClientInterface;
use Isa\Sdk\Core\TokenSource;
use Isa\Sdk\Zyins\Auth;
use Isa\Sdk\Zyins\ReferenceData\Service as ZyinsReferenceDataService;

/**
 * `$isa->account->*` — the elevated account API surface.
 *
 * Mounted under `account.isaapi.com`, this client groups the
 * sub-services that share the BaseResponse envelope (CONTRACT C13)
 * and ISA authentication:
 *
 *   - {@see BrandingClient}       — whitelabel branding lookup + upsert
 *   - {@see PreferencesClient}    — agent preference backup/restore
 *   - {@see CasesClient}          — shareable case create / get / list / email
 *   - {@see EmailClient}          — transactional email enqueue
 *   - {@see ReferenceDataClient}  — typeahead reference data by scope
 *
 * Facade discipline: takes a PSR-18 HTTP client and an optional
 * {@see TokenSource}; never references global state. The reference-data
 * sub-client is wired by the parent {@see \Isa\Sdk\Isa} so it shares
 * the same credential — when this class is constructed standalone the
 * `referenceData` property remains null and access throws a clear
 * `LogicException` describing the wiring requirement.
 */
final readonly class AccountClient
{
    private const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10.0;
    private const DEFAULT_TIMEOUT_SECONDS = 30.0;

    public BrandingClient $branding;
    public PreferencesClient $preferences;
    public CasesClient $cases;
    public EmailClient $email;
    public ?ReferenceDataClient $referenceData;

    public function __construct(
        ?ClientInterface $httpClient = null,
        ?TokenSource $tokenSource = null,
        string $baseUrl = Http::DEFAULT_BASE_URL,
        ?ZyinsReferenceDataService $referenceData = null,
        string $authorizationScheme = Auth::SCHEME_BEARER,
    ) {
        $http = new Http(
            http: $httpClient ?? new GuzzleClient([
                'http_errors' => false,
                'connect_timeout' => self::DEFAULT_CONNECT_TIMEOUT_SECONDS,
                'timeout' => self::DEFAULT_TIMEOUT_SECONDS,
            ]),
            baseUrl: rtrim($baseUrl, '/'),
            tokenSource: $tokenSource,
            authorizationScheme: $authorizationScheme,
        );
        $this->branding = new BrandingClient($http);
        $this->preferences = new PreferencesClient($http);
        $this->cases = new CasesClient($http);
        $this->email = new EmailClient($http);
        $this->referenceData = $referenceData === null ? null : new ReferenceDataClient($referenceData);
    }
}
