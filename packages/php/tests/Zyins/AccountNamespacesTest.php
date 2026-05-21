<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Zyins;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Tests\Zyins\Support\FixedKeySource;
use Sah\Sdk\Tests\Zyins\Support\MockHttpClient;
use Sah\Sdk\Zyins\Branding\BrandingDetail;
use Sah\Sdk\Zyins\Cases\CreateInput;
use Sah\Sdk\Zyins\Email\EnqueueInput;
use Sah\Sdk\Zyins\Exception\IsaException;
use Sah\Sdk\Zyins\Preferences\SetInput;
use Sah\Sdk\Zyins\ZyInsClient;

final class AccountNamespacesTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';
    private const FIXED_IDEM = '550e8400-e29b-41d4-a716-446655440000';

    private function client(MockHttpClient $http): ZyInsClient
    {
        return new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource(self::FIXED_IDEM),
        );
    }

    // ---------------------- Branding -----------------------------

    public function testBrandingLookupParsesSnakeCaseFields(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'imo_name' => 'Acme Agency',
            'imo_logo' => 'https://cdn.example/logo.png',
            'hide_affiliate_leads' => 'true',
            'prevent_product_selection' => false,
            'nav_color' => '#111',
        ], JSON_THROW_ON_ERROR));

        $result = $this->client($http)->branding->lookup();

        self::assertSame('Acme Agency', $result->imoName);
        self::assertSame('https://cdn.example/logo.png', $result->imoLogo);
        self::assertTrue($result->hideAffiliateLeads);
        self::assertFalse($result->preventProductSelection);

        $request = $http->lastRequest();
        self::assertSame('GET', $request->getMethod());
        self::assertStringContainsString('/v1/branding', (string) $request->getUri());
    }

    public function testBrandingLookupReturnsZeroValuesOnEmptyRow(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{}');
        $result = $this->client($http)->branding->lookup();
        self::assertSame('', $result->imoName);
        self::assertFalse($result->hideAffiliateLeads);
    }

    public function testBrandingLookup500ThrowsTypedError(): void
    {
        $http = new MockHttpClient();
        $http->queue(500, json_encode([
            'type' => 'about:blank',
            'title' => 'server',
            'status' => 500,
            'code' => 'server_error',
        ], JSON_THROW_ON_ERROR));

        $this->expectException(IsaException::class);
        $this->client($http)->branding->lookup();
    }

    // ---------------------- Preferences --------------------------

    public function testPreferencesLookupReturnsPrefs(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['prefs' => ['theme' => 'dark']], JSON_THROW_ON_ERROR));
        $result = $this->client($http)->preferences->lookup();
        self::assertSame(['theme' => 'dark'], $result->prefs);
    }

    public function testPreferencesSetSerializesBodyAndMintsIdempotencyKey(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['prefs' => ['theme' => 'dark']], JSON_THROW_ON_ERROR));
        $result = $this->client($http)->preferences->set(new SetInput(['theme' => 'dark']));

        self::assertSame(['theme' => 'dark'], $result->prefs);
        $request = $http->lastRequest();
        self::assertSame('POST', $request->getMethod());
        self::assertSame(self::FIXED_IDEM, $request->getHeaderLine('Idempotency-Key'));
        $body = json_decode((string) $request->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame(['prefs' => ['theme' => 'dark']], $body);
    }

    public function testPreferencesSet401ThrowsTypedError(): void
    {
        $http = new MockHttpClient();
        $http->queue(401, json_encode([
            'type' => 'about:blank',
            'title' => 'unauthorized',
            'status' => 401,
            'code' => 'unauthorized',
        ], JSON_THROW_ON_ERROR));

        $this->expectException(IsaException::class);
        $this->client($http)->preferences->set(new SetInput(['a' => 1]));
    }

    // ---------------------- Cases --------------------------------

    public function testCasesCreateSerializesAndParsesHash(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'case',
            'hash' => 'abc123',
            'url' => 'https://share.example/case/abc123',
            'readonly' => true,
            'created_at' => '2026-05-20T14:32:01Z',
        ], JSON_THROW_ON_ERROR));

        $result = $this->client($http)->cases->create(new CreateInput(
            input: ['applicant' => ['name' => 'John Doe']],
            results: ['decided' => true],
            products: ['senior-life'],
        ));

        self::assertSame('abc123', $result->hash);
        self::assertTrue($result->readonly);
        self::assertSame('2026-05-20T14:32:01Z', $result->createdAt);

        $request = $http->lastRequest();
        self::assertSame('POST', $request->getMethod());
        self::assertStringContainsString('/v1/case', (string) $request->getUri());
        self::assertSame(self::FIXED_IDEM, $request->getHeaderLine('Idempotency-Key'));

        $body = json_decode((string) $request->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame(['applicant' => ['name' => 'John Doe']], $body['input']);
        self::assertSame(['senior-life'], $body['products']);
    }

    public function testCasesCreateAcceptsRawXMLInput(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'case', 'hash' => 'x', 'url' => '', 'readonly' => false, 'created_at' => '',
        ], JSON_THROW_ON_ERROR));
        $this->client($http)->cases->create(new CreateInput(input: '<applicant/>'));

        $body = json_decode((string) $http->lastRequest()->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('<applicant/>', $body['input']);
    }

    public function testCasesCreateRejectsEmptyInput(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new CreateInput(input: '');
    }

    // ---------------------- Email --------------------------------

    public function testEmailEnqueueSerializesBase64Attachment(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['enqueue_id' => 'eq_1'], JSON_THROW_ON_ERROR));

        $result = $this->client($http)->email->enqueue(new EnqueueInput(
            to: 'jane@smith.com',
            subject: 'Your case',
            bodyHtml: '<p>Hi</p>',
            attachmentFilename: 'case-1.pdf',
            attachmentContent: 'PDF-bytes',
        ));

        self::assertSame('eq_1', $result->enqueueId);
        $request = $http->lastRequest();
        self::assertStringContainsString('/v1/email/enqueue', (string) $request->getUri());
        $body = json_decode((string) $request->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame(base64_encode('PDF-bytes'), $body['attachment']['content_base64']);
    }

    public function testEmailEnqueueRejectsMissingTo(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new EnqueueInput(to: '', subject: 's', bodyHtml: 'b');
    }

    public function testCasesEmailTargetsEnqueueEndpoint(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['enqueue_id' => 'eq_2'], JSON_THROW_ON_ERROR));
        $this->client($http)->cases->email(new EnqueueInput(
            to: 'jane@smith.com', subject: 's', bodyHtml: 'b',
        ));
        self::assertStringContainsString(
            '/v1/email/enqueue',
            (string) $http->lastRequest()->getUri(),
        );
    }
}
