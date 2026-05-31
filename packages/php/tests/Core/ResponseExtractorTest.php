<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Core;

use Nyholm\Psr7\Factory\Psr17Factory;
use PHPUnit\Framework\TestCase;
use RuntimeException;
use Isa\Sdk\Core\ResponseExtractor;

final class ResponseExtractorTest extends TestCase
{
    private Psr17Factory $factory;

    protected function setUp(): void
    {
        $this->factory = new Psr17Factory();
    }

    /**
     * @param array<string,mixed> $body
     */
    private function jsonResponse(array $body): \Psr\Http\Message\ResponseInterface
    {
        $stream = $this->factory->createStream(json_encode($body, JSON_THROW_ON_ERROR));
        return $this->factory->createResponse(200)->withBody($stream);
    }

    public function testExtractPayloadValidatesInnerData(): void
    {
        $response = $this->jsonResponse([
            'object' => 'customer',
            'livemode' => true,
            'request_id' => 'req_abc',
            'data' => ['id' => 'cus_1', 'email' => 'a@b.com'],
        ]);
        $validator = function (mixed $raw): array {
            if (! is_array($raw)) {
                throw new RuntimeException('customer: expected array');
            }
            return ['id' => (string) ($raw['id'] ?? ''), 'email' => (string) ($raw['email'] ?? '')];
        };
        $payload = ResponseExtractor::extractPayload($response, $validator);
        self::assertSame(['id' => 'cus_1', 'email' => 'a@b.com'], $payload);
    }

    public function testExtractPayloadThrowsWhenDataMissing(): void
    {
        $response = $this->jsonResponse([
            'object' => 'customer',
            'livemode' => false,
            'request_id' => 'req_xyz',
        ]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage(ResponseExtractor::ERR_ENVELOPE_MISSING_PAYLOAD);
        ResponseExtractor::extractPayload($response, fn (mixed $r): mixed => $r);
    }

    public function testExtractPayloadPropagatesValidatorError(): void
    {
        $response = $this->jsonResponse([
            'object' => 'customer',
            'livemode' => false,
            'request_id' => 'req_xyz',
            'data' => 'not-an-array',
        ]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('customer: expected array');
        ResponseExtractor::extractPayload($response, function (mixed $raw): array {
            if (! is_array($raw)) {
                throw new RuntimeException('customer: expected array');
            }
            return $raw;
        });
    }

    public function testExtractEnvelopeExposesRequestId(): void
    {
        $response = $this->jsonResponse([
            'object' => 'list',
            'livemode' => false,
            'request_id' => 'req_42',
            'data' => [1, 2, 3],
        ]);
        $envelope = ResponseExtractor::extractEnvelope($response);
        self::assertSame('list', $envelope->object);
        self::assertSame('req_42', $envelope->requestId);
        self::assertSame([1, 2, 3], $envelope->data);
    }

    public function testExtractEnvelopeRejectsListBody(): void
    {
        $stream = $this->factory->createStream(json_encode([1, 2, 3], JSON_THROW_ON_ERROR));
        $response = $this->factory->createResponse(200)->withBody($stream);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage(ResponseExtractor::ERR_ENVELOPE_SHAPE);
        ResponseExtractor::extractEnvelope($response);
    }
}
