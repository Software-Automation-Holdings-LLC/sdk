<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Tests\Zyins\Support\MockHttpClient;
use Sah\Sdk\Zyins\Applicant;
use Sah\Sdk\Zyins\Coverage;
use Sah\Sdk\Zyins\Exception\IsaAuthException;
use Sah\Sdk\Zyins\Exception\IsaException;
use Sah\Sdk\Zyins\Exception\IsaLicenseException;
use Sah\Sdk\Zyins\Exception\IsaRateLimitException;
use Sah\Sdk\Zyins\Exception\IsaValidationException;
use Sah\Sdk\Zyins\Height;
use Sah\Sdk\Zyins\NicotineUsage;
use Sah\Sdk\Zyins\Prequalify\Input;
use Sah\Sdk\Zyins\Product;
use Sah\Sdk\Zyins\ProductType;
use Sah\Sdk\Zyins\Sex;
use Sah\Sdk\Zyins\Weight;
use Sah\Sdk\Zyins\ZyInsClient;

#[CoversClass(\Sah\Sdk\Zyins\Transport::class)]
#[CoversClass(IsaException::class)]
#[CoversClass(IsaAuthException::class)]
#[CoversClass(IsaLicenseException::class)]
#[CoversClass(IsaRateLimitException::class)]
#[CoversClass(IsaValidationException::class)]
final class ExceptionTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testHierarchy(): void
    {
        self::assertInstanceOf(IsaException::class, new IsaAuthException('x', 'unauthorized'));
        self::assertInstanceOf(IsaException::class, new IsaLicenseException('x', 'locked'));
        self::assertInstanceOf(IsaException::class, new IsaRateLimitException('x'));
        self::assertInstanceOf(IsaException::class, new IsaValidationException('x'));
    }

    public function test401MapsToAuthException(): void
    {
        $http = $this->httpReturning(401, '{"code":"unauthorized","detail":"missing bearer token","request_id":"req_a"}');
        $this->expectException(IsaAuthException::class);
        $this->prequalify($http);
    }

    public function test400MapsToValidationException(): void
    {
        $http = $this->httpReturning(400, '{"code":"validation_error","detail":"dob is required","param":"/applicant/dob","request_id":"req_b"}');
        try {
            $this->prequalify($http);
            self::fail('Expected IsaValidationException');
        } catch (IsaValidationException $e) {
            self::assertSame('validation_error', $e->code());
            self::assertSame('/applicant/dob', $e->param());
            self::assertSame('req_b', $e->requestId());
        }
    }

    public function test429MapsToRateLimitException(): void
    {
        $http = new MockHttpClient();
        $http->queue(429, '{"code":"rate_limited","detail":"slow down"}', ['Retry-After' => '7']);
        try {
            $this->prequalify($http);
            self::fail('Expected IsaRateLimitException');
        } catch (IsaRateLimitException $e) {
            self::assertSame(7, $e->retryAfterSeconds());
        }
    }

    public function testLicenseCodeMapsToLicenseException(): void
    {
        $http = $this->httpReturning(409, '{"code":"locked","detail":"license is locked","request_id":"req_c"}');
        $this->expectException(IsaLicenseException::class);
        $this->prequalify($http);
    }

    public function testUnknown5xxMapsToBaseException(): void
    {
        $http = $this->httpReturning(500, '{"code":"engine_error","detail":"boom"}');
        try {
            $this->prequalify($http);
            self::fail('Expected IsaException');
        } catch (IsaException $e) {
            self::assertSame('engine_error', $e->code());
            self::assertNotInstanceOf(IsaAuthException::class, $e);
            self::assertNotInstanceOf(IsaValidationException::class, $e);
            self::assertNotInstanceOf(IsaRateLimitException::class, $e);
            self::assertNotInstanceOf(IsaLicenseException::class, $e);
        }
    }

    private function httpReturning(int $status, string $body): MockHttpClient
    {
        $http = new MockHttpClient();
        $http->queue($status, $body);
        return $http;
    }

    private function prequalify(MockHttpClient $http): void
    {
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $input = new Input(
            applicant: new Applicant(
                dob: '1962-04-18',
                sex: Sex::Male,
                height: Height::fromFeetInches(5, 10),
                weight: Weight::fromPounds(195),
                state: 'NC',
                nicotineUse: NicotineUsage::None,
            ),
            coverage: Coverage::faceValue(25000),
            products: [new Product('colonial-penn', ProductType::FinalExpense, 'colonial-penn.final-expense', 'CP FE')],
        );
        $client->prequalify->run($input);
    }
}
