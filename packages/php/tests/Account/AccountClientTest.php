<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Account;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Account\AccountClient;
use Sah\Sdk\Account\BrandingClient;
use Sah\Sdk\Account\CasesClient;
use Sah\Sdk\Account\EmailAttachment;
use Sah\Sdk\Account\EmailClient;
use Sah\Sdk\Account\Http;
use Sah\Sdk\Account\PreferencesClient;
use Sah\Sdk\Core\StaticToken;
use Sah\Sdk\Tests\Zyins\Support\MockHttpClient;
use Sah\Sdk\Zyins\Auth;
use Sah\Sdk\Zyins\Exception\IsaException;
use Sah\Sdk\Zyins\Exception\IsaRateLimitException;

#[CoversClass(AccountClient::class)]
#[CoversClass(Http::class)]
#[CoversClass(BrandingClient::class)]
#[CoversClass(PreferencesClient::class)]
#[CoversClass(CasesClient::class)]
#[CoversClass(EmailClient::class)]
final class AccountClientTest extends TestCase
{
    public function testBrandingLookupParsesEnvelope(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'branding',
            'livemode' => true,
            'request_id' => 'req_test',
            'idempotency_key' => '',
            'data' => [
                'imo_name' => 'Acme Agency',
                'imo_logo' => 'https://cdn.example/logo.png',
                'product_restrictions' => null,
                'nav_color' => '#fff',
                'main_color' => '#000',
                'button_color' => '#0f0',
                'active_button_color' => '#0a0',
                'bg_color' => '#fafafa',
                'header_text_color' => '#111',
                'hide_affiliate_leads' => true,
                'prevent_product_selection' => false,
                'default_settings' => '{}',
            ],
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(
            httpClient: $http,
            tokenSource: new StaticToken('isa_test_' . 'ZZZZZZZZZZZZZZZZZZZZ'),
        );
        $env = $client->branding->lookup(['keycode' => 'ABC-123-XYZ']);
        self::assertSame('branding', $env->object);
        self::assertSame('req_test', $env->requestId);
        self::assertSame('Acme Agency', $env->data->imoName);
        self::assertTrue($env->data->hideAffiliateLeads);

        $request = $http->lastRequest();
        self::assertSame('POST', $request->getMethod());
        self::assertStringContainsString('/v1/branding/lookup', (string) $request->getUri());
        self::assertSame('Bearer isa_test_' . 'ZZZZZZZZZZZZZZZZZZZZ', $request->getHeaderLine('Authorization'));
        $body = json_decode((string) $request->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame(['keycode' => 'ABC-123-XYZ'], $body);
    }

    public function testRequestsUseConfiguredAuthorizationScheme(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'branding',
            'livemode' => true,
            'data' => [],
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(
            httpClient: $http,
            tokenSource: new StaticToken('license-token'),
            authorizationScheme: Auth::SCHEME_LICENSE,
        );
        $client->branding->lookup();

        self::assertSame('License license-token', $http->lastRequest()->getHeaderLine('Authorization'));
    }

    public function testPreferencesLookupRequiresScope(): void
    {
        $client = new AccountClient(httpClient: new MockHttpClient());
        $this->expectException(\InvalidArgumentException::class);
        $client->preferences->lookup('');
    }

    public function testPreferencesLookupTrimsScope(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'preferences',
            'livemode' => true,
            'data' => ['scope' => 'bpp', 'prefs' => []],
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(httpClient: $http);
        $client->preferences->lookup(' bpp ');

        $body = json_decode((string) $http->lastRequest()->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('bpp', $body['scope']);
    }

    public function testCasesCreateSerializesInputResultsProducts(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'case',
            'livemode' => true,
            'request_id' => 'req_x',
            'idempotency_key' => '',
            'data' => ['case_id' => 'abc123', 'url' => 'https://x.test/case/abc123', 'readonly' => false, 'created_at' => '2026-05-20T00:00:00Z', 'body' => null],
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(httpClient: $http);
        $env = $client->cases->create(
            input: '<applicant/>',
            results: null,
            products: ['fex-aetna-accendo'],
        );
        self::assertSame('abc123', $env->data->caseId);
        $body = json_decode((string) $http->lastRequest()->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('<applicant/>', $body['input']);
        self::assertSame(['fex-aetna-accendo'], $body['products']);
        self::assertArrayNotHasKey('results', $body);
    }

    public function testCasesListParsesHasMoreFlag(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'list',
            'livemode' => true,
            'request_id' => 'req_y',
            'data' => [
                ['case_id' => 'a1', 'url' => 'u1', 'readonly' => true, 'created_at' => '', 'body' => null],
                ['case_id' => 'a2', 'url' => 'u2', 'readonly' => false, 'created_at' => '', 'body' => null],
            ],
            'has_more' => true,
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(httpClient: $http);
        $env = $client->cases->list(cursor: 'after-this', limit: 25);
        self::assertCount(2, $env->data);
        self::assertTrue($env->hasMore);
        self::assertSame('a1', $env->data[0]->caseId);
    }

    public function testCasesListRejectsNonPositiveLimit(): void
    {
        $client = new AccountClient(httpClient: new MockHttpClient());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('account.cases: list requires limit > 0');
        $client->cases->list(limit: 0);
    }

    public function testEmailEnqueueRequiresAllFields(): void
    {
        $client = new AccountClient(httpClient: new MockHttpClient());
        $this->expectException(\InvalidArgumentException::class);
        $client->email->enqueue(['to' => 'a@b.com', 'subject' => 'Hi']);
    }

    public function testEmailEnqueueRejectsNonStringFields(): void
    {
        $client = new AccountClient(httpClient: new MockHttpClient());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('account.email: enqueue requires body');
        $client->email->enqueue(['to' => 'a@b.com', 'subject' => 'Hi', 'body' => 123]);
    }

    public function testEmailEnqueueSerializesAttachments(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'email_ack',
            'livemode' => true,
            'data' => ['object' => 'email_ack', 'status' => 'queued'],
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(httpClient: $http);
        $client->email->enqueue([
            'to' => 'a@b.com',
            'subject' => 'Hi',
            'body' => '<p>hi</p>',
            'attachments' => [new EmailAttachment('quote.pdf', 'aGVsbG8=')],
        ]);
        $body = json_decode((string) $http->lastRequest()->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame([['filename' => 'quote.pdf', 'content' => 'aGVsbG8=']], $body['attachments']);
    }

    public function testNonEmailEnvelopeRequiresDataField(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'branding',
            'livemode' => true,
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(httpClient: $http);

        $this->expectException(IsaException::class);
        $this->expectExceptionMessage('account: response envelope missing `data` field');
        $client->branding->lookup();
    }

    public function testEmailEnqueueAllowsBareAckResponse(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'email_ack',
            'livemode' => true,
            'status' => 'queued',
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(httpClient: $http);
        $env = $client->email->enqueue([
            'to' => 'a@b.com',
            'subject' => 'Hi',
            'body' => '<p>hi</p>',
        ]);

        self::assertSame('queued', $env->data->status);
    }

    public function testEmailEnqueueRejectsMalformedAck(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'email_ack',
            'livemode' => true,
            'data' => ['object' => 'email_ack'],
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(httpClient: $http);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('account: malformed email.enqueue acknowledgement payload');
        $client->email->enqueue([
            'to' => 'a@b.com',
            'subject' => 'Hi',
            'body' => '<p>hi</p>',
        ]);
    }

    public function testCasesEmailRejectsMalformedAck(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'email_ack',
            'livemode' => true,
            'data' => ['status' => 'queued'],
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(httpClient: $http);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('account: malformed cases.email acknowledgement payload');
        $client->cases->email('case_123', 'a@b.com');
    }

    public function testEnvelopeRequiresBooleanLivemode(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'branding',
            'livemode' => 'true',
            'data' => [],
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(httpClient: $http);

        $this->expectException(IsaException::class);
        $this->expectExceptionMessage('account: response envelope missing or invalid `livemode` field');
        $client->branding->lookup();
    }

    public function testProblemDetailsErrorFunnel(): void
    {
        $http = new MockHttpClient();
        $http->queue(400, json_encode([
            'type' => 'about:blank',
            'title' => 'Validation failed',
            'status' => 400,
            'code' => 'validation_error',
            'detail' => 'email is required',
            'param' => 'email',
        ], JSON_THROW_ON_ERROR));

        $client = new AccountClient(httpClient: $http);
        try {
            $client->branding->lookup();
            self::fail('expected IsaException');
        } catch (IsaException $e) {
            self::assertSame('validation_error', $e->code());
            self::assertSame(400, $e->httpStatus());
        }
    }

    public function testRateLimitErrorPreservesRetryAfter(): void
    {
        $http = new MockHttpClient();
        $http->queue(429, json_encode([
            'title' => 'Too many requests',
            'status' => 429,
            'code' => 'rate_limit_exceeded',
            'detail' => 'slow down',
        ], JSON_THROW_ON_ERROR), ['Retry-After' => '30']);

        $client = new AccountClient(httpClient: $http);

        $this->expectException(IsaRateLimitException::class);
        try {
            $client->branding->lookup();
        } catch (IsaRateLimitException $e) {
            self::assertSame(30, $e->retryAfterSeconds());
            throw $e;
        }
    }
}
