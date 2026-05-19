<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

use Psr\Http\Message\ResponseInterface;
use RuntimeException;

/**
 * Unwraps the ADR-012 response envelope.
 *
 * The wire JSON shape (`object`, `livemode`, `request_id`, `data`) is
 * fixed by ADR-012 and MUST NOT be renamed here — every product SDK
 * (Stripe-node, AWS-SDK-JS, etc) speaks the same envelope so consumers
 * can pattern-match across them. Domain-specific naming kicks in INSIDE
 * the validator callback, which deserializes `data` into a generated
 * resource type (Invoice, Customer, ProxyCallResult, etc).
 *
 * Returns either the validated inner payload (Stripe-node pattern) or
 * the complete Envelope for callers that want `request_id` for logging.
 *
 * Per-product SDK code generates validators from protobuf message
 * descriptors; application code may pass an ad-hoc validator for
 * prototypes, but production paths should always use the generated one.
 */
final class ResponseExtractor
{
    public const ERR_ENVELOPE_MISSING_PAYLOAD = 'transport: response envelope has no data field';
    public const ERR_ENVELOPE_SHAPE = 'transport: response body is not a JSON object';
    public const ERR_VALIDATOR_REQUIRED = 'transport: extractPayload requires a validator';

    /**
     * Validates and returns the inner resource payload (envelope `data`).
     *
     * @template T
     * @param callable(mixed): T $validator narrows the wire payload into a domain type.
     * @return T
     */
    public static function extractPayload(ResponseInterface $response, callable $validator): mixed
    {
        $envelopeArray = self::decodeEnvelopeArray($response);
        if (! array_key_exists('data', $envelopeArray) || $envelopeArray['data'] === null) {
            throw new RuntimeException(self::ERR_ENVELOPE_MISSING_PAYLOAD);
        }
        return $validator($envelopeArray['data']);
    }

    public static function extractEnvelope(ResponseInterface $response): Envelope
    {
        $envelopeArray = self::decodeEnvelopeArray($response);
        return new Envelope(
            object: is_string($envelopeArray['object'] ?? null) ? $envelopeArray['object'] : '',
            livemode: is_bool($envelopeArray['livemode'] ?? null) ? $envelopeArray['livemode'] : false,
            requestId: is_string($envelopeArray['request_id'] ?? null) ? $envelopeArray['request_id'] : '',
            data: $envelopeArray['data'] ?? null,
        );
    }

    /**
     * @return array<string,mixed>
     */
    private static function decodeEnvelopeArray(ResponseInterface $response): array
    {
        $body = (string) $response->getBody();
        $decoded = json_decode($body, associative: true, flags: JSON_THROW_ON_ERROR);
        if (! is_array($decoded) || array_is_list($decoded)) {
            throw new RuntimeException(self::ERR_ENVELOPE_SHAPE);
        }
        return $decoded;
    }
}
