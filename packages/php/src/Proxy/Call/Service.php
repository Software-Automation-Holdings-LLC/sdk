<?php

declare(strict_types=1);

namespace Sah\Sdk\Proxy\Call;

use Sah\Sdk\Proxy\RequestOptions;
use Sah\Sdk\Proxy\Transport;

/**
 * The `/v1/call` service.
 *
 * Wraps the universal invocation envelope `{integration_id, params}`
 * the platform proxy exposes for routing into a registered integration.
 * Mirrors `proxyCall` in `@isa-sdk/proxy/transport/call` and the Go
 * transport's `Call` package.
 *
 * The SDK↔proxy hop uses plain bearer auth. The proxy↔downstream hop
 * uses Algosure HMAC; that signing happens server-side, not here.
 */
final readonly class Service
{
    public const PATH = '/v1/call';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Invokes the downstream integration identified by `$integrationUuid`.
     *
     * Idempotency is mandatory: the proxy treats every `/v1/call` as
     * mutating (downstream side effects are unknown), so the transport
     * auto-attaches `Idempotency-Key`. Override via {@see RequestOptions::withIdempotencyKey()}.
     */
    public function invoke(
        string $integrationUuid,
        InvokeInput $input,
        ?RequestOptions $options = null,
    ): InvokeResult {
        $envelope = [
            'integration_id' => $integrationUuid,
            'params' => $input->toEnvelopeParams(),
        ];
        $decoded = $this->transport->post(self::PATH, $envelope, $options);
        return InvokeResult::fromPayload($decoded->data, $decoded->requestId);
    }
}
