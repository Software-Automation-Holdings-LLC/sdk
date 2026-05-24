<?php

declare(strict_types=1);

namespace Sah\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Sah\Sdk\Tests\Zyins\Support\MockHttpClient;
use Sah\Sdk\Zyins\Applicant;
use Sah\Sdk\Zyins\Coverage;
use Sah\Sdk\Zyins\DecodedResponse;
use Sah\Sdk\Zyins\Exception\IsaException;
use Sah\Sdk\Zyins\Height;
use Sah\Sdk\Zyins\NicotineUsage;
use Sah\Sdk\Zyins\Prequalify\Input;
use Sah\Sdk\Zyins\Product;
use Sah\Sdk\Zyins\ProductType;
use Sah\Sdk\Zyins\Sex;
use Sah\Sdk\Zyins\Transport;
use Sah\Sdk\Zyins\Weight;
use Sah\Sdk\Zyins\ZyInsClient;

#[CoversClass(Transport::class)]
#[CoversClass(DecodedResponse::class)]
final class TransportTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testDefaultBaseUrlPointsAtZyinsHost(): void
    {
        self::assertSame('https://zyins.isaapi.com', Transport::DEFAULT_BASE_URL);
    }

    public function testRequestUriUsesZyinsHostByDefault(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"items":[]},"request_id":"req_z"}');
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $client->datasets->list();
        self::assertSame('zyins.isaapi.com', $http->lastRequest()->getUri()->getHost());
    }

    public function testListShapedDataPayloadIsNotMutatedWithMagicKey(): void
    {
        // The /v1/datasets response is documented as { items: [...] } inside
        // the envelope. The previous transport injected __request_id into
        // `data`, which broke iteration when callers walked the data array.
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'list',
            'livemode' => false,
            'request_id' => 'req_dataset',
            'data' => [
                'items' => [
                    ['id' => 'one'],
                    ['id' => 'two'],
                ],
            ],
        ], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $items = $client->datasets->list();
        self::assertCount(2, $items);
        foreach ($items as $item) {
            self::assertArrayNotHasKey('__request_id', $item);
        }
    }

    public function testMalformedJsonIsWrappedInIsaException(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '<html>nginx fail</html>');
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        try {
            $client->datasets->list();
            self::fail('Expected IsaException');
        } catch (IsaException $e) {
            self::assertSame('invalid_response', $e->code());
            self::assertInstanceOf(\JsonException::class, $e->getPrevious());
        }
    }

    public function testPrequalifyOmitsZipWhenNull(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"plans":[]},"request_id":"req_y"}');
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
            coverage: Coverage::faceValue(25_000),
            products: [new Product('colonial-penn', ProductType::FinalExpense, 'colonial-penn.final-expense', 'CP FE')],
        );
        $client->prequalify->run($input);
        $body = json_decode((string) $http->lastRequest()->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($body);
        // 0.5.1 flat wire — zip is a top-level optional field
        self::assertArrayNotHasKey('zip', $body);
    }

    public function testPrequalifyMedicationsAndConditionsUseCamelCaseWireKeys(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"plans":[]},"request_id":"req_w"}');
        $client = new ZyInsClient(token: self::FIXTURE_TOKEN, httpClient: $http);
        $input = new Input(
            applicant: new Applicant(
                dob: '1962-04-18',
                sex: Sex::Male,
                height: Height::fromFeetInches(5, 10),
                weight: Weight::fromPounds(195),
                state: 'NC',
                nicotineUse: NicotineUsage::None,
                medications: [new \Sah\Sdk\Zyins\Medication('LOSARTAN', 'HIGH BLOOD PRESSURE', '11 MONTHS AGO', '3 MONTHS AGO')],
                conditions: [new \Sah\Sdk\Zyins\Condition('COPD', '3 DAYS AGO', '3 DAYS AGO')],
            ),
            coverage: Coverage::faceValue(25_000),
            products: [new Product('colonial-penn', ProductType::FinalExpense, 'colonial-penn.final-expense', 'CP FE')],
        );
        $client->prequalify->run($input);
        $body = json_decode((string) $http->lastRequest()->getBody(), true, flags: JSON_THROW_ON_ERROR);
        self::assertIsArray($body);
        // 0.5.1 flat wire — medications/conditions are top-level
        $med = $body['medications'][0];
        self::assertSame('LOSARTAN', $med['name']);
        self::assertArrayHasKey('firstFill', $med);
        self::assertArrayHasKey('lastFill', $med);
        self::assertArrayNotHasKey('first_fill', $med);
        self::assertArrayNotHasKey('last_fill', $med);
        $cond = $body['conditions'][0];
        self::assertArrayHasKey('wasDiagnosed', $cond);
        self::assertArrayHasKey('lastTreatment', $cond);
        self::assertArrayNotHasKey('was_diagnosed', $cond);
        self::assertArrayNotHasKey('last_treatment', $cond);
    }

    public function testRequestIdThreadedFromEnvelopeToResult(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"plans":[]},"request_id":"req_xyz"}');
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
            coverage: Coverage::faceValue(25_000),
            products: [new Product('colonial-penn', ProductType::FinalExpense, 'colonial-penn.final-expense', 'CP FE')],
        );
        $result = $client->prequalify->run($input);
        self::assertSame('req_xyz', $result->requestId);
    }
}
