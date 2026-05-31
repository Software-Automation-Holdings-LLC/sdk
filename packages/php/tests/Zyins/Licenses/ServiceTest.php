<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Licenses;

use InvalidArgumentException;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Tests\Zyins\Support\FixedKeySource;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Exception\IsaException;
use Isa\Sdk\Zyins\Licenses\ActivateInput;
use Isa\Sdk\Zyins\Licenses\CheckInput;
use Isa\Sdk\Zyins\Licenses\DeactivateInput;
use Isa\Sdk\Zyins\Licenses\Service as LicensesService;
use Isa\Sdk\Zyins\ZyInsClient;

#[CoversClass(LicensesService::class)]
#[CoversClass(ActivateInput::class)]
#[CoversClass(CheckInput::class)]
#[CoversClass(DeactivateInput::class)]
final class ServiceTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testActivateUsesV2BootstrapContract(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'status' => 'active',
            'licenseKey' => 'license-1',
            'remainingActivations' => 2,
        ], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource('550e8400-e29b-41d4-a716-446655440000'),
        );

        $result = $client->license->activate(new ActivateInput(
            email: 'john.doe@acme-agency.com',
            keycode: 'ABC-123-XYZ',
            deviceId: 'device-1',
        ));

        self::assertSame('active', $result->status);
        self::assertSame('license-1', $result->auth->licenseKey);
        self::assertSame(2, $result->remainingActivations);

        $request = $http->lastRequest();
        self::assertSame('POST', $request->getMethod());
        self::assertStringContainsString('/v2/licenses/activate', (string) $request->getUri());
        self::assertSame('550e8400-e29b-41d4-a716-446655440000', $request->getHeaderLine('Idempotency-Key'));
        self::assertSame('', $request->getHeaderLine('Authorization'));
        self::assertSame('device-1', $request->getHeaderLine('X-Device-ID'));

        $body = json_decode((string) $request->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('john.doe@acme-agency.com', $body['email']);
        self::assertSame('ABC-123-XYZ', $body['keycode']);
        self::assertSame('device-1', $body['deviceId']);
    }

    public function testActivateRejectsMalformedSuccessBody(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['status' => 'active'], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);

        $this->expectException(IsaException::class);
        $client->license->activate(new ActivateInput('x@x', 'ABC-123-XYZ', 'device-1'));
    }

    public function testCheckReturnsValidStatus(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['status' => 'valid'], JSON_THROW_ON_ERROR));

        $client = new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: $http,
            idempotency: new FixedKeySource('550e8400-e29b-41d4-a716-446655440000'),
        );

        $result = $client->license->check(new CheckInput(
            email: 'john.doe@acme-agency.com',
            keycode: 'ABC-123-XYZ',
            deviceId: 'device-1',
        ));

        self::assertSame('valid', $result->status);

        $request = $http->lastRequest();
        self::assertSame('POST', $request->getMethod());
        self::assertStringContainsString('/v2/licenses/check', (string) $request->getUri());
        self::assertSame('550e8400-e29b-41d4-a716-446655440000', $request->getHeaderLine('Idempotency-Key'));
        // Bootstrap endpoints emit no Authorization header — the server
        // sits outside AuthMiddleware on these three paths.
        self::assertSame('', $request->getHeaderLine('Authorization'));
        self::assertSame('device-1', $request->getHeaderLine('X-Device-ID'));

        $body = json_decode((string) $request->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('john.doe@acme-agency.com', $body['email']);
        self::assertSame('ABC-123-XYZ', $body['keycode']);
        self::assertSame('device-1', $body['deviceId']);
    }

    public function testCheckToleratesAdr012Envelope(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['data' => ['status' => 'inactive']], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $result = $client->license->check(new CheckInput('x@x', 'ABC-123-XYZ'));
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
            'deviceId' => 'device-1',
            'licenseKey' => 'license-1',
        ], $input->toWireBody());
    }

    public function testCheckServerErrorPropagates(): void
    {
        $http = new MockHttpClient();
        $http->queue(500, json_encode(['code' => 'server_error', 'detail' => 'boom'], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $this->expectException(IsaException::class);
        $client->license->check(new CheckInput('x@x', 'ABC-123-XYZ'));
    }

    public function testDeactivateReturnsInactiveStatus(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['status' => 'inactive'], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $result = $client->license->deactivate(new DeactivateInput(
            email: 'john.doe@acme-agency.com',
            keycode: 'ABC-123-XYZ',
        ));
        self::assertSame('inactive', $result->status);
        self::assertStringContainsString('/v2/licenses/deactivate', (string) $http->lastRequest()->getUri());
        self::assertSame('', $http->lastRequest()->getHeaderLine('Authorization'));
    }

    public function testDeactivateToleratesLegacyDeactivatedStatus(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode(['status' => 'deactivated'], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $result = $client->license->deactivate(new DeactivateInput(
            email: 'john.doe@acme-agency.com',
            keycode: 'ABC-123-XYZ',
        ));
        self::assertSame('deactivated', $result->status);
    }

    public function testDeactivateRejectsMalformedSuccessBody(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);

        $this->expectException(IsaException::class);
        $client->license->deactivate(new DeactivateInput('x@x', 'ABC-123-XYZ'));
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
            'deviceId' => 'device-1',
        ], $input->toWireBody());
    }
}
