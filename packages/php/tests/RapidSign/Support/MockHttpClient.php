<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\RapidSign\Support;

use Nyholm\Psr7\Response;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * In-memory PSR-18 client used by the unit suite.
 *
 * Records every outbound request and serves a pre-staged response;
 * tests assert on the captured request after `sendRequest` returns.
 */
final class MockHttpClient implements ClientInterface
{
    /** @var list<RequestInterface> */
    public array $requests = [];

    /** @var list<ResponseInterface> */
    private array $responses = [];

    /**
     * @param array<string,string|array<int,string>> $headers
     */
    public function queue(int $status, string $body, array $headers = []): void
    {
        $this->responses[] = new Response($status, $headers, $body);
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $this->requests[] = $request;
        if ($this->responses === []) {
            return new Response(200, [], '{}');
        }
        return array_shift($this->responses);
    }

    public function lastRequest(): RequestInterface
    {
        if ($this->requests === []) {
            throw new \LogicException('No requests have been recorded yet.');
        }
        return $this->requests[array_key_last($this->requests)];
    }
}
