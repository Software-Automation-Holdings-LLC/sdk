<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * Bearer-token transport helper for the unified ISA SDK.
 *
 * Decorates any PSR-18 client, injecting `Authorization: Bearer <token>`
 * before delegating. Any pre-existing Authorization header is overwritten
 * — matching how AWS SigV4 and Google ADC behave.
 *
 * The inner client is constructor-injected so tests substitute a fake
 * without touching globals or the network stack.
 */
final readonly class BearerClient implements ClientInterface
{
    public function __construct(
        private TokenSource $source,
        private ClientInterface $inner,
    ) {
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $token = $this->source->token();
        $authenticated = $request->withHeader('Authorization', sprintf('Bearer %s', $token));
        return $this->inner->sendRequest($authenticated);
    }
}
