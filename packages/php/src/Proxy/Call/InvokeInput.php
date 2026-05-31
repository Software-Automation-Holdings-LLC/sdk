<?php

declare(strict_types=1);

namespace Isa\Sdk\Proxy\Call;

/**
 * Inputs forwarded inside the `/v1/call` envelope.
 *
 * Mirrors the JS `ProxyCallParams.params` shape and the Go transport's
 * inner request struct. The proxy substitutes credentials, applies
 * Algosure signing toward the downstream, and forwards `$method`,
 * `$path`, `$headers`, and `$body` to the resolved integration host.
 */
final readonly class InvokeInput
{
    /**
     * @param string                       $method  Downstream HTTP method (e.g. POST).
     * @param string                       $path    Downstream path (e.g. /api/v1/quote).
     * @param array<string,string>         $headers Additional headers forwarded to the downstream.
     * @param array<mixed>|string|null     $body    Body for the downstream request; arrays are JSON-encoded by the proxy.
     */
    public function __construct(
        public string $method,
        public string $path,
        public array $headers = [],
        public array|string|null $body = null,
    ) {
    }

    /**
     * @return array<string,mixed>
     */
    public function toEnvelopeParams(): array
    {
        $params = [
            'method' => $this->method,
            'path' => $this->path,
        ];
        if ($this->headers !== []) {
            $params['headers'] = $this->headers;
        }
        if ($this->body !== null) {
            $params['body'] = $this->body;
        }
        return $params;
    }
}
