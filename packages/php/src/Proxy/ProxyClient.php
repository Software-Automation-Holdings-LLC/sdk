<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy;

use GuzzleHttp\Client as GuzzleClient;
use Psr\Http\Client\ClientInterface;
use Sah\Sdk\Proxy\Algosure\AlgosureSigner;
use Sah\Sdk\Proxy\Call\Service as CallService;
use Sah\Sdk\Proxy\Call\SessionCallService;
use Sah\Sdk\Zyins\Auth as IdentityAuth;

/**
 * ISA Platform proxy SDK entry point.
 *
 * The proxy brokers downstream integrations (per-scope, per-host bridges
 * to backend services), substitutes operator-stored credentials at the
 * proxy boundary, and signs the proxy↔downstream hop with Algosure
 * HMAC. The SDK↔proxy hop itself uses plain bearer auth — one token,
 * no signing on this hop.
 *
 *     $client = new ProxyClient('isa_live_4fjK2nQ7mX1aB8sR9pZ3');
 *     $result = $client->call->invoke($integrationUuid, new InvokeInput(
 *         method: 'POST',
 *         path: '/api/v1/quote',
 *         body: ['date_of_birth' => '1962-04-18'],
 *     ));
 *
 * The proxy SDK is internal-facing per ADR-035 — product facades
 * (`sah/sdk-zyins`, `sah/sdk-rapidsign`) compose it. Direct use is
 * supported for advanced integration owners driving a custom flow
 * (e.g., a Laravel eApp running the Mountain Life rapidsign loop).
 *
 * The class is `readonly`: configuration is captured at construction
 * and sub-service properties are wired once.
 */
final readonly class ProxyClient
{
    public CallService $call;
    public AlgosureSigner $algosure;
    public Auth $auth;
    /**
     * Typed identity threaded from the parent Isa instance. Carries the
     * scheme (Bearer / License / Session) so {@see invokeSession()} can
     * refuse non-session callers at the boundary. Null when the
     * ProxyClient was constructed directly with a raw token string (the
     * legacy entry-point preserved for back-compat).
     */
    public ?IdentityAuth $identityAuth;
    public SessionCallService $callSession;
    private Transport $transport;

    public function __construct(
        string $token,
        ?ClientInterface $httpClient = null,
        ?IdempotencyKeySource $idempotency = null,
        string $baseUrl = Transport::DEFAULT_BASE_URL,
        string $apiVersion = Transport::DEFAULT_API_VERSION,
        ?string $userAgent = null,
        ?Clock $clock = null,
        ?IdentityAuth $identityAuth = null,
    ) {
        $this->auth = new Auth($token);
        $this->identityAuth = $identityAuth;
        $this->transport = new Transport(
            http: $httpClient ?? new GuzzleClient(['http_errors' => false]),
            auth: $this->auth,
            keys: $idempotency ?? new RandomIdempotencyKeySource(),
            baseUrl: rtrim($baseUrl, '/'),
            apiVersion: $apiVersion,
            userAgent: $userAgent ?? self::defaultUserAgent(),
        );
        $this->call = new CallService($this->transport);
        $this->algosure = new AlgosureSigner(clock: $clock ?? new SystemClock());
        $this->callSession = new SessionCallService(
            http: $httpClient ?? new GuzzleClient(['http_errors' => false]),
            baseUrl: rtrim($baseUrl, '/'),
            identityAuth: $identityAuth,
            idempotency: $idempotency ?? new RandomIdempotencyKeySource(),
            clock: $clock ?? new SystemClock(),
        );
    }

    private static function defaultUserAgent(): string
    {
        return sprintf('sah-sdk-proxy-php/%s php/%s', Transport::USER_AGENT_VERSION, PHP_VERSION);
    }
}
