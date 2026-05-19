<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign;

use GuzzleHttp\Client as GuzzleClient;
use Psr\Http\Client\ClientInterface;
use Sah\Sdk\RapidSign\Documents\Service as DocumentsService;
use Sah\Sdk\RapidSign\Internal\HttpTransport;
use Sah\Sdk\RapidSign\Webhooks\Service as WebhooksService;

/**
 * Tier-3 RapidSign facade.
 *
 * The single-arg constructor is the documented entry point — callers
 * pass the bearer token, every other dependency falls back to a
 * sensible production default:
 *
 *     $client = new RapidSignClient('isa_live_4fjK2nQ7mX1aB8sR9pZ3');
 *     $envelope = $client->documents->send($request);
 *
 * Override hooks are exposed via the named-args constructor signature
 * for tests and advanced deployments (custom PSR-18 client, pinned
 * idempotency source, alternate base URL, pluggable clock/sleeper).
 */
final readonly class RapidSignClient
{
    public const DEFAULT_BASE_URL = HttpTransport::DEFAULT_BASE_URL;
    public const PACKAGE_VERSION = '1.0.0';
    public const DEFAULT_MAX_RETRIES = 2;

    public DocumentsService $documents;
    public WebhooksService $webhooks;
    public Auth $auth;
    private HttpTransport $transport;

    public function __construct(
        string $token,
        ?ClientInterface $httpClient = null,
        ?Idempotency $idempotency = null,
        ?Clock $clock = null,
        ?Sleeper $sleeper = null,
        string $baseUrl = self::DEFAULT_BASE_URL,
        ?string $userAgent = null,
        int $maxRetries = self::DEFAULT_MAX_RETRIES,
    ) {
        $this->auth = new Auth($token);
        $this->transport = new HttpTransport(
            http: $httpClient ?? new GuzzleClient(['http_errors' => false]),
            auth: $this->auth,
            idempotency: $idempotency ?? new Uuid4Idempotency(),
            sleeper: $sleeper ?? new SystemSleeper(),
            baseUrl: rtrim($baseUrl, '/'),
            userAgent: $userAgent ?? self::defaultUserAgent(),
            maxRetries: $maxRetries,
        );
        $this->documents = new DocumentsService($this->transport, $clock ?? new SystemClock());
        $this->webhooks = new WebhooksService();
    }

    public static function defaultUserAgent(): string
    {
        return sprintf('sah-sdk-rapidsign-php/%s php/%s', self::PACKAGE_VERSION, PHP_VERSION);
    }
}
