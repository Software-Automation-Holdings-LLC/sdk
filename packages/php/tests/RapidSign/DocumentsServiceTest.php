<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\RapidSign;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\RapidSign\Documents\AwaitOpts;
use Sah\Sdk\RapidSign\Documents\CancelRequest;
use Sah\Sdk\RapidSign\Documents\EnvelopeStatus;
use Sah\Sdk\RapidSign\Documents\PdfSource;
use Sah\Sdk\RapidSign\Documents\Recipient;
use Sah\Sdk\RapidSign\Documents\SendRequest;
use Sah\Sdk\RapidSign\Documents\Service as DocumentsService;
use Sah\Sdk\RapidSign\Exception\DeadlineExceededException;
use Sah\Sdk\RapidSign\Exception\NotFoundException;
use Sah\Sdk\RapidSign\Exception\NotImplementedException;
use Sah\Sdk\RapidSign\Exception\RapidSignException;
use Sah\Sdk\RapidSign\Exception\ValidationException;
use Sah\Sdk\RapidSign\RapidSignClient;
use Sah\Sdk\Tests\RapidSign\Support\FixedClock;
use Sah\Sdk\Tests\RapidSign\Support\FixedIdempotency;
use Sah\Sdk\Tests\RapidSign\Support\InstantSleeper;
use Sah\Sdk\Tests\RapidSign\Support\MockHttpClient;

#[CoversClass(DocumentsService::class)]
#[CoversClass(\Sah\Sdk\RapidSign\Internal\HttpTransport::class)]
#[CoversClass(\Sah\Sdk\RapidSign\Internal\Duration::class)]
#[CoversClass(\Sah\Sdk\RapidSign\Exception\ErrorFactory::class)]
final class DocumentsServiceTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    private function buildClient(MockHttpClient $http, FixedIdempotency $ids, ?FixedClock $clock = null): RapidSignClient
    {
        return new RapidSignClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: $ids,
            clock: $clock ?? new FixedClock(1_700_000_000_000),
            sleeper: new InstantSleeper(),
        );
    }

    private function sendRequest(?string $idempotencyKey = null): SendRequest
    {
        return new SendRequest(
            packet: [new PdfSource('https://example.com/contract.pdf', 'a' . str_repeat('b', 63))],
            recipient: new Recipient('john.doe@acme-agency.com', 'John Doe'),
            legalText: 'By signing you agree...',
            metadata: ['account_id' => 'acct_42'],
            idempotencyKey: $idempotencyKey,
        );
    }

    public function testSendIssuesCreateThenNotifyAndAssemblesEnvelope(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'document_id' => 'doc_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            'sign_ids' => ['sig_server_42'],
            'sign_url' => 'https://rapidsign.isaapi.com/sign/sig_server_42',
            'view_url' => 'https://rapidsign.isaapi.com/view/sig_server_42',
            'hashes' => ['https://example.com/contract.pdf' => 'aabbcc'],
            'created_at' => '2026-05-14T14:32:01Z',
            'expires_at' => '2026-06-13T14:32:01Z',
        ], JSON_THROW_ON_ERROR));
        $http->queue(200, '{"sign_id":"sig_server_42","status":"notified"}');

        $ids = new FixedIdempotency([
            'session-uuid',
            'client-sign-uuid',
            'caller-idem-key',
            'notify-idem-key',
        ]);
        $client = $this->buildClient($http, $ids);

        $envelope = $client->documents->send($this->sendRequest());

        self::assertSame('doc_01HZK2N5GQR9T8X4B6FJW3Y1AS', $envelope->id);
        self::assertSame('sig_server_42', $envelope->signId);
        self::assertSame(EnvelopeStatus::Notified, $envelope->status);
        self::assertSame('John Doe', $envelope->recipient->name);
        self::assertSame(['https://example.com/contract.pdf' => 'aabbcc'], $envelope->hashes);

        $create = $http->requests[0];
        self::assertSame('POST', $create->getMethod());
        self::assertSame('/v1/documents', $create->getUri()->getPath());
        self::assertSame('caller-idem-key', $create->getHeaderLine('Idempotency-Key'));
        self::assertStringContainsString('Bearer ' . self::FIXTURE_TOKEN, $create->getHeaderLine('Authorization'));

        $body = json_decode((string) $create->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('session-uuid', $body['session_id']);
        self::assertSame(['client-sign-uuid'], $body['sign_ids']);
        self::assertSame('https://example.com/contract.pdf', $body['packet'][0]['url']);
        self::assertSame(['account_id' => 'acct_42'], $body['metadata']);

        $notify = $http->requests[1];
        self::assertSame('/v1/documents/sig_server_42/notify', $notify->getUri()->getPath());
        self::assertSame('notify-idem-key', $notify->getHeaderLine('Idempotency-Key'));
    }

    public function testSendCallerSuppliedIdempotencyKeyTakesPriority(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"document_id":"doc_x","sign_ids":["s1"],"hashes":{}}');
        $http->queue(200, '{}');

        $ids = new FixedIdempotency(['sess', 'sid', 'auto-fallback', 'notify-key']);
        $client = $this->buildClient($http, $ids);

        $client->documents->send($this->sendRequest(idempotencyKey: 'caller-pinned'));
        self::assertSame('caller-pinned', $http->requests[0]->getHeaderLine('Idempotency-Key'));
    }

    public function testSendRejectsEmptyPacket(): void
    {
        $client = $this->buildClient(new MockHttpClient(), new FixedIdempotency([]));
        $this->expectException(ValidationException::class);
        $client->documents->send(new SendRequest(
            packet: [],
            recipient: new Recipient('a@b.co'),
        ));
    }

    public function testSendRejectsEmptyRecipientEmail(): void
    {
        $client = $this->buildClient(new MockHttpClient(), new FixedIdempotency([]));
        $this->expectException(ValidationException::class);
        $client->documents->send(new SendRequest(
            packet: [new PdfSource('https://example.com/p.pdf')],
            recipient: new Recipient(''),
        ));
    }

    public function testGetReturnsSignatureWhenServerHas200(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'sign_id' => 'sig_42',
            'signature' => base64_encode('BINARY-SIG'),
            'timestamp' => 1_715_692_321,
            'signer_ip' => '203.0.113.7',
            'user_agent' => 'Mozilla/5.0',
            'user_metadata' => ['account_id' => 'acct_42'],
        ], JSON_THROW_ON_ERROR));

        $client = $this->buildClient($http, new FixedIdempotency(['k']));
        $sig = $client->documents->get('sig_42');
        self::assertSame('sig_42', $sig->signId);
        self::assertSame('BINARY-SIG', $sig->signature);
        self::assertSame('203.0.113.7', $sig->signerIp);
        self::assertSame(['account_id' => 'acct_42'], $sig->metadata);
    }

    public function testGetThrowsNotFoundOn404(): void
    {
        $http = new MockHttpClient();
        $http->queue(404, json_encode([
            'title' => 'Not Found',
            'status' => 404,
            'code' => 'not_found',
            'detail' => 'no signature captured yet',
        ], JSON_THROW_ON_ERROR), ['Content-Type' => 'application/problem+json']);

        $client = $this->buildClient($http, new FixedIdempotency(['k']));
        $this->expectException(NotFoundException::class);
        $client->documents->get('sig_42');
    }

    public function testGetRetriesOn503AndEventuallySucceeds(): void
    {
        $http = new MockHttpClient();
        $http->queue(503, '{"title":"Service Unavailable","status":503,"code":"service_unavailable"}');
        $http->queue(200, json_encode([
            'sign_id' => 'sig_x',
            'signature' => base64_encode('OK'),
            'timestamp' => 1_715_692_321,
        ], JSON_THROW_ON_ERROR));

        $client = $this->buildClient($http, new FixedIdempotency(['k1', 'k2']));
        $sig = $client->documents->get('sig_x');
        self::assertSame('sig_x', $sig->signId);
    }

    public function testAwaitSignatureRetriesTransientErrorsFromGet(): void
    {
        $signedBody = json_encode([
            'sign_id' => 'sig_test_1',
            'signature' => base64_encode('SIG'),
            'timestamp' => 1_700_000_500,
        ], JSON_THROW_ON_ERROR);
        $unavailable = '{"title":"Service Unavailable","status":503,"code":"service_unavailable"}';
        $http = new MockHttpClient();
        // Exhaust get()'s internal retry budget, then succeed on the next poll.
        $http->queue(503, $unavailable);
        $http->queue(503, $unavailable);
        $http->queue(503, $unavailable);
        $http->queue(200, $signedBody);

        $client = $this->buildClient(
            $http,
            new FixedIdempotency(array_fill(0, 10, '0a0a0000-0000-4000-8000-000000000000')),
        );
        $sig = $client->documents->awaitSignature('sig_test_1');
        self::assertSame('sig_test_1', $sig->signId);
    }

    public function testAwaitSignaturePropagatesNonRetryableErrorsImmediately(): void
    {
        $http = new MockHttpClient();
        $http->queue(403, '{"title":"Forbidden","status":403,"code":"forbidden"}');

        $client = $this->buildClient($http, new FixedIdempotency(['k']));
        $this->expectException(RapidSignException::class);
        $client->documents->awaitSignature('sig_test_1');
    }

    public function testDownloadDecompressesGzipBase64Payload(): void
    {
        $pdfBytes = '%PDF-1.7 fake bytes';
        $gz = gzencode($pdfBytes);
        self::assertNotFalse($gz);
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'pdf_gzip_base64' => base64_encode($gz),
            'compressed' => true,
            'size_bytes' => strlen($pdfBytes),
        ], JSON_THROW_ON_ERROR));

        $client = $this->buildClient($http, new FixedIdempotency(['k']));
        $result = $client->documents->download('sig_42');
        self::assertSame($pdfBytes, $result);
    }

    public function testDownloadAcceptsUncompressedPayload(): void
    {
        $pdfBytes = '%PDF-1.7 plain';
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'pdf_gzip_base64' => base64_encode($pdfBytes),
            'compressed' => false,
        ], JSON_THROW_ON_ERROR));

        $client = $this->buildClient($http, new FixedIdempotency(['k']));
        self::assertSame($pdfBytes, $client->documents->download('sig_42'));
    }

    public function testCancelThrowsNotImplemented(): void
    {
        $client = $this->buildClient(new MockHttpClient(), new FixedIdempotency([]));
        $this->expectException(NotImplementedException::class);
        $client->documents->cancel('sig_42', new CancelRequest('caller withdrew'));
    }

    public function testCancelRejectsEmptyReasonBeforeServerStub(): void
    {
        $client = $this->buildClient(new MockHttpClient(), new FixedIdempotency([]));
        $this->expectException(ValidationException::class);
        $client->documents->cancel('sig_42', new CancelRequest(''));
    }

    public function testAwaitSignatureTimesOut(): void
    {
        $http = new MockHttpClient();
        // Every get → 404, download probe → 200 (stored), so we keep polling.
        $http->queue(404, '{"title":"NF","status":404,"code":"not_found"}');
        $http->queue(200, '{"pdf_gzip_base64":"' . base64_encode(gzencode('x') ?: '') . '"}');
        // Subsequent gets stay 404 so the loop hits the timeout.
        for ($i = 0; $i < 30; $i++) {
            $http->queue(404, '{"title":"NF","status":404,"code":"not_found"}');
        }

        $clock = new FixedClock(0);
        // Wrap sleep behavior: every "sleep" advances the clock so the
        // loop exits via DeadlineExceededException in bounded iterations
        // without burning real wall time.
        $advancing = new class ($clock) implements \Sah\Sdk\RapidSign\Sleeper {
            public function __construct(private readonly FixedClock $clock)
            {
            }

            public function sleepMs(int $ms): void
            {
                $this->clock->advance(max(1, $ms));
            }
        };
        $client = new RapidSignClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedIdempotency(array_fill(0, 50, '0a0a0000-0000-4000-8000-000000000000')),
            clock: $clock,
            sleeper: $advancing,
        );

        $this->expectException(DeadlineExceededException::class);
        $client->documents->awaitSignature('sig_42', new AwaitOpts(timeout: '5s'));
    }

    public function testAwaitSignatureRaisesNotFoundWhenDocumentStoreEmpty(): void
    {
        $http = new MockHttpClient();
        $http->queue(404, '{"title":"NF","status":404,"code":"not_found"}'); // get
        $http->queue(404, '{"title":"NF","status":404,"code":"not_found"}'); // download probe

        $client = $this->buildClient($http, new FixedIdempotency(array_fill(0, 10, 'aa000000-0000-4000-8000-000000000000')));
        $this->expectException(NotFoundException::class);
        $client->documents->awaitSignature('sig_unknown', new AwaitOpts(timeout: 100));
    }

    public function testSignIdRequiredOnGet(): void
    {
        $client = $this->buildClient(new MockHttpClient(), new FixedIdempotency([]));
        $this->expectException(ValidationException::class);
        $client->documents->get('');
    }

    public function testGetRejectsInvalidBase64SignaturePayload(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"signature":"!!!not-base64!!!","timestamp":1}');
        $client = $this->buildClient($http, new FixedIdempotency(['k']));
        $this->expectException(RapidSignException::class);
        $client->documents->get('sig_42');
    }

    public function testAwaitSignatureHonorsDeadlineDuringGetRetries(): void
    {
        $http = new MockHttpClient();
        for ($i = 0; $i < 5; $i++) {
            $http->queue(
                503,
                '{"title":"Service Unavailable","status":503,"code":"service_unavailable"}',
                ['Retry-After' => '86400'],
            );
        }

        $clock = new FixedClock(0);
        $advancing = new class ($clock) implements \Sah\Sdk\RapidSign\Sleeper {
            public function __construct(private readonly FixedClock $clock)
            {
            }

            public function sleepMs(int $ms): void
            {
                $this->clock->advance(max(1, $ms));
            }
        };
        $client = new RapidSignClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedIdempotency(array_fill(0, 20, '0a0a0000-0000-4000-8000-000000000000')),
            clock: $clock,
            sleeper: $advancing,
        );

        $this->expectException(DeadlineExceededException::class);
        $client->documents->awaitSignature('sig_42', new AwaitOpts(timeout: 1_000));
    }

    public function testUnknownExceptionBubbleOnMalformed200(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{not valid json');
        $client = $this->buildClient($http, new FixedIdempotency(['k']));
        $this->expectException(RapidSignException::class);
        $client->documents->get('sig_42');
    }
}
