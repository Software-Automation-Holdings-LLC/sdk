<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Zyins\Licenses;

use InvalidArgumentException;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Tests\Zyins\Support\FixedKeySource;
use Sah\Sdk\Tests\Zyins\Support\MockHttpClient;
use Sah\Sdk\Zyins\Exception\IsaException;
use Sah\Sdk\Zyins\Licenses\CheckInput;
use Sah\Sdk\Zyins\Licenses\DeactivateInput;
use Sah\Sdk\Zyins\Licenses\Service as LicensesService;
use Sah\Sdk\Zyins\ZyInsClient;

#[CoversClass(LicensesService::class)]
#[CoversClass(CheckInput::class)]
#[CoversClass(DeactivateInput::class)]
final class ServiceTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testCheckReturnsValidStatus(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['status' => 'valid'], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource('550e8400-e29b-41d4-a716-446655440000'),
        );

        $result = $client->licenses->check(new CheckInput(
            email: 'john.doe@acme-agency.com',
            keycode: 'ABC-123-XYZ',
            deviceId: 'device-1',
        ));

        self::assertSame('valid', $result->status);

        $request = $http->lastRequest();
        self::assertSame('POST', $request->getMethod());
        self::assertStringContainsString('/v1/licenses/check', (string) $request->getUri());
        self::assertSame('550e8400-e29b-41d4-a716-446655440000', $request->getHeaderLine('Idempotency-Key'));

        $body = json_decode((string) $request->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('john.doe@acme-agency.com', $body['email']);
        self::assertSame('ABC-123-XYZ', $body['keycode']);
        self::assertSame('device-1', $body['device_id']);
    }

    public function testCheckToleratesAdr012Envelope(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['data' => ['status' => 'inactive']], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $result = $client->licenses->check(new CheckInput('x@x', 'ABC-123-XYZ'));
        self::assertSame('inactive', $result->status);
    }

    public function testCheckMissingEmailThrows(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new CheckInput(email: '', keycode: 'ABC-123-XYZ');
    }

    public function testCheckInputTrimsWireValues(): void
    {
        $input = new CheckInput(
            email: ' john.doe@acme-agency.com ',
            keycode: ' ABC-123-XYZ ',
            deviceId: ' device-1 ',
            licenseKey: ' license-1 ',
        );

        self::assertSame([
            'email' => 'john.doe@acme-agency.com',
            'keycode' => 'ABC-123-XYZ',
            'device_id' => 'device-1',
            'license_key' => 'license-1',
        ], $input->toWireBody());
    }

    public function testCheckServerErrorPropagates(): void
    {
        $http = new MockHttpClient();
        $http->queue(500, json_encode(['code' => 'server_error', 'detail' => 'boom'], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $this->expectException(IsaException::class);
        $client->licenses->check(new CheckInput('x@x', 'ABC-123-XYZ'));
    }

    public function testDeactivateReturnsDeactivatedStatus(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['status' => 'deactivated'], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $result = $client->licenses->deactivate(new DeactivateInput(
            email: 'john.doe@acme-agency.com',
            keycode: 'ABC-123-XYZ',
        ));
        self::assertSame('deactivated', $result->status);
        self::assertStringContainsString('/v1/licenses/deactivate', (string) $http->lastRequest()->getUri());
    }

    public function testDeactivateMissingKeycodeThrows(): void
    {
        $this->expectException(InvalidArgumentException::class);
        new DeactivateInput(email: 'x@x', keycode: '');
    }

    public function testDeactivateInputTrimsWireValues(): void
    {
        $input = new DeactivateInput(email: ' x@x ', keycode: ' ABC-123-XYZ ', deviceId: ' device-1 ');

        self::assertSame([
            'email' => 'x@x',
            'keycode' => 'ABC-123-XYZ',
            'device_id' => 'device-1',
        ], $input->toWireBody());
    }
}
