<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Logos;

use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Psr7\Request;
use InvalidArgumentException;
use Psr\Http\Client\ClientExceptionInterface;
use Psr\Http\Client\ClientInterface;
use Isa\Sdk\Zyins\Exception\IsaException;

/**
 * `$isa->zyins->logos` — `GET /v1/logo/{carrier}` (synonym
 * `/v1/logos/{carrier}`). Static carrier-brand assets.
 *
 * Per `api-standards.md` (GET allowlist), the endpoint is non-
 * credentialed — the SDK does NOT attach auth headers. Two response
 * shapes are negotiated via the `?ds=` query parameter:
 *
 *   - `?ds=true` → server returns a `data:image/...;base64,...` text body.
 *   - default     → server returns the raw image bytes (typically PNG/JPEG).
 *
 * The SDK presents a single call surface — `get($carrier, ['dataUri' => true])` —
 * and branches internally on `dataUri` to return the right shape:
 *
 *   - `dataUri: true`        → returns the data URI as a `string`.
 *   - `dataUri` omitted/false → returns the raw bytes as a `string`.
 *
 * Callers never juggle two shapes. PHP collapses both onto `string`
 * (binary bytes are a PHP string); the array option toggles which.
 *
 * 404 — when the carrier has no logo asset — surfaces as
 * {@see IsaException} with code `not_found`.
 */
final readonly class Service
{
    public const DEFAULT_BASE_URL = 'https://zyins.isaapi.com';
    private const LOGOS_PATH = '/v1/logo';

    public function __construct(
        private ClientInterface $http = new GuzzleClient(['http_errors' => false]),
        private string $baseUrl = self::DEFAULT_BASE_URL,
    ) {
    }

    /**
     * Fetch the carrier-logo asset.
     *
     * @param string $carrier Carrier slug (URI-encoded by the SDK).
     * @param array{dataUri?:bool} $opts
     *   - `dataUri => true`: return a `data:image/...;base64,...` URI string.
     *   - omitted/false: return the raw image bytes as a string.
     *
     * @throws IsaException on non-2xx response or transport failure.
     */
    public function get(string $carrier, array $opts = []): string
    {
        if (trim($carrier) === '') {
            throw new InvalidArgumentException('zyins.logos.get: carrier is required');
        }
        $dataUri = (bool) ($opts['dataUri'] ?? false);
        $url = rtrim($this->baseUrl, '/')
            . self::LOGOS_PATH . '/' . rawurlencode($carrier)
            . ($dataUri ? '?ds=true' : '');

        $request = new Request('GET', $url, ['Accept' => $dataUri ? 'text/plain' : 'image/*']);
        try {
            $response = $this->http->sendRequest($request);
        } catch (ClientExceptionInterface $e) {
            throw new IsaException(
                'zyins.logos.get: transport failure: ' . $e->getMessage(),
                'transport_error',
                previous: $e,
            );
        }

        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        if ($status < 200 || $status >= 300) {
            throw $this->errorFor($status, $body);
        }
        if ($dataUri) {
            return $this->assertDataUri($body);
        }
        return $body;
    }

    private function errorFor(int $status, string $body): IsaException
    {
        if ($status === 404) {
            return new IsaException(
                message: $body === '' ? 'logo not found' : $body,
                errorCode: 'not_found',
                httpStatus: 404,
            );
        }
        return new IsaException(
            message: $body === '' ? sprintf('HTTP %d', $status) : $body,
            errorCode: 'unknown',
            httpStatus: $status,
        );
    }

    private function assertDataUri(string $body): string
    {
        if (! str_starts_with($body, 'data:image/')) {
            throw new IsaException(
                message: 'zyins.logos.get: expected a data:image/... URI but got: ' . substr($body, 0, 32),
                errorCode: 'unknown',
            );
        }
        return $body;
    }
}
