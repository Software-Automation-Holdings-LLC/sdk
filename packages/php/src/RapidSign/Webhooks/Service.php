<?php

declare(strict_types=1);

namespace Isa\Sdk\RapidSign\Webhooks;

use Isa\Sdk\RapidSign\Exception\NotImplementedException;

/**
 * Webhook service exposed as `$client->webhooks`. Today every method
 * throws {@see NotImplementedException}; the SDK surface is final and
 * flips to a real verifier the moment the server lands.
 */
final readonly class Service
{
    private const NOT_IMPLEMENTED_DETAIL = 'the RapidSign server webhook verifier is not yet shipped';

    /**
     * Verify the HMAC signature on a webhook delivery and parse the
     * body into a typed {@see WebhookEvent}. Server-side support pending.
     *
     * @param array<string,string> $headers
     */
    public function verify(string $rawBody, array $headers, string $secret): WebhookEvent
    {
        throw new NotImplementedException(
            message: 'rapidsign.webhooks.verify is not yet implemented (' . self::NOT_IMPLEMENTED_DETAIL . ')',
        );
    }
}
