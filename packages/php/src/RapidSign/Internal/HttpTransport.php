<?php

declare(strict_types=1);

namespace Sah\Sdk\RapidSign\Internal;

use GuzzleHttp\Psr7\Request;
use Psr\Http\Client\ClientExceptionInterface;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\ResponseInterface;
use Sah\Sdk\RapidSign\Auth;
use Sah\Sdk\RapidSign\Exception\ErrorFactory;
use Sah\Sdk\RapidSign\Exception\RapidSignException;
use Sah\Sdk\RapidSign\Exception\UnknownException;
use Sah\Sdk\RapidSign\Idempotency;
use Sah\Sdk\RapidSign\Sleeper;

/**
 * Thin PSR-18-backed HTTP transport for RapidSign.
 *
 * Unlike the zyins-php transport, this layer hands the *raw* response
 * bytes back to the service so the documents service can implement its
 * own retry policy (Retry-After, exponential backoff with jitter) and
 * read binary download bodies without an envelope unwrap.
 *
 * Header assembly (Authorization, User-Agent, Accept, Idempotency-Key)
 * lives here so individual service methods stay focused.
 */
final readonly class HttpTransport
{
    public const DEFAULT_BASE_URL = 'https://rapidsign.isaapi.com';

    public function __construct(
        private ClientInterface $http,
        public Auth $auth,
        public Idempotency $idempotency,
        public Sleeper $sleeper,
        public string $baseUrl,
        public string $userAgent,
        public int $maxRetries,
    ) {
    }

    /**
     * Perform a request and return the response object. Connection-level
     * failures funnel into {@see UnknownException}; HTTP-status failures
     * remain the service's responsibility (because the service decides
     * whether to retry based on the typed exception).
     *
     * @param array<string,string> $headers
     */
    public function send(string $method, string $url, array $headers, string $body): ResponseInterface
    {
        $merged = $headers + $this->defaultHeaders();
        $request = new Request($method, $url, $merged, $body);
        try {
            return $this->http->sendRequest($request);
        } catch (ClientExceptionInterface $e) {
            throw new UnknownException(
                message: 'transport: HTTP client error: ' . $e->getMessage(),
                previous: $e,
            );
        }
    }

    /**
     * Throw the typed exception for a non-2xx response. Service methods
     * call this after deciding the response failed.
     */
    public static function exceptionFor(ResponseInterface $response): RapidSignException
    {
        $headers = [];
        foreach ($response->getHeaders() as $name => $values) {
            $headers[strtolower($name)] = $values;
        }
        return ErrorFactory::fromHttpResponse(
            status: $response->getStatusCode(),
            body: (string) $response->getBody(),
            headers: $headers,
        );
    }

    /**
     * @return array<string,string>
     */
    private function defaultHeaders(): array
    {
        return [
            'Authorization' => $this->auth->authorizationHeader(),
            'User-Agent' => $this->userAgent,
            'Accept' => 'application/json, application/problem+json',
        ];
    }
}
