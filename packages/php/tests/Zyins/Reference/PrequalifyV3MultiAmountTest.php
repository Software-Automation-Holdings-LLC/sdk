<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\ProductType;
use Isa\Sdk\Zyins\Reference\PrequalifyV3;
use Isa\Sdk\Zyins\Reference\PrequalifyV3Request;
use Isa\Sdk\Zyins\Reference\PrequalifyV3Result;
use Isa\Sdk\Zyins\Reference\V3Period;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

/**
 * Multi-amount `POST /v3/prequalify` — native `coverage.quote_options`
 * request + flat `plans[]` response with the v3 Money primitive (zyins
 * #400, Money cutover).
 *
 * Every v3 request — single and multi-amount alike — answers with one
 * flat `plans[]` array. A single face amount keeps `{face_amount_cents}`;
 * a multi-amount probe sends `coverage.quote_options`. Group client-side
 * with PrequalifyV3Result::byAmount on the requested dimension.
 */
#[CoversClass(PrequalifyV3::class)]
final class PrequalifyV3MultiAmountTest extends TestCase
{
    private const TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    private function applicant(): Applicant
    {
        return new Applicant(
            dob: '1962-04-18',
            sex: Sex::Male,
            height: Height::fromFeetInches(5, 10),
            weight: Weight::fromPounds(195),
            state: 'NC',
            nicotineUse: NicotineUsage::None,
        );
    }

    /** @return list<Product> */
    private function products(): array
    {
        return [new Product('Carrier', ProductType::Term, 'p|term', 'Product')];
    }

    /** @return array<string,mixed> */
    private function faceOffer(int $amountCents, string $display, int $premiumCents): array
    {
        return [
            'object' => 'plan_offer',
            'id' => "p{$amountCents}",
            'eligible' => true,
            'plan_info' => [],
            'metadata' => (object)[],
            'death_benefit' => ['amount' => ['cents' => $amountCents, 'display' => $display], 'period' => null],
            'pricing' => [[
                'rate_class' => 'Preferred',
                'primary' => true,
                'eligibility' => ['category' => 'immediate', 'eligible' => true, 'reasons' => []],
                'premium' => [
                    'cents' => $premiumCents,
                    'display' => '$' . number_format($premiumCents / 100, 2),
                    'default' => ['cents' => $premiumCents, 'display' => '$' . number_format($premiumCents / 100, 2)],
                    'modes' => [],
                ],
                'rank' => 1,
            ]],
        ];
    }

    public function testMultiFaceValuesEmitQuoteOptionsNotFaceAmountCents(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"plans":[]},"request_id":"req_x"}');
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $client->prequalifyV3->run(new PrequalifyV3Request(
            applicant: $this->applicant(),
            coverage: Coverage::faceValues([25000, 50000]),
            products: $this->products(),
        ));

        $body = (string) $http->lastRequest()->getBody();
        /** @var array<string,mixed> $decoded */
        $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        $coverage = $decoded['coverage'];
        self::assertArrayNotHasKey('face_amount_cents', $coverage);
        self::assertSame('NC', $coverage['state']);
        self::assertSame(
            ['quote_type' => 'face_amounts', 'amounts' => ['25000', '50000']],
            $coverage['quote_options'],
        );
    }

    public function testMultiMonthlyBudgetsEmitMonthlyBudgetQuoteType(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"data":{"plans":[]},"request_id":"req_x"}');
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $client->prequalifyV3->run(new PrequalifyV3Request(
            applicant: $this->applicant(),
            coverage: Coverage::monthlyBudgets([50, 75]),
            products: $this->products(),
        ));

        $body = (string) $http->lastRequest()->getBody();
        /** @var array<string,mixed> $decoded */
        $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        self::assertSame(
            ['quote_type' => 'monthly_budget', 'amounts' => ['50', '75']],
            $decoded['coverage']['quote_options'],
        );
    }

    public function testFlatFaceResponseParsesMoneyTypedDeathBenefit(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'prequalify_result',
            'request_id' => 'req_v3pm',
            'idempotency_key' => '550e8400-e29b-41d4-a716-446655440000',
            'livemode' => true,
            'data' => ['plans' => [
                $this->faceOffer(2500000, '$25,000', 4500),
                $this->faceOffer(5000000, '$50,000', 8100),
            ]],
        ], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $result = $client->prequalifyV3->run(new PrequalifyV3Request(
            applicant: $this->applicant(),
            coverage: Coverage::faceValues([25000, 50000]),
            products: $this->products(),
        ));

        self::assertCount(2, $result->plans);
        self::assertSame(2500000, $result->plans[0]->deathBenefit->amount->cents);
        self::assertSame('$25,000', $result->plans[0]->deathBenefit->amount->display);
        self::assertNull($result->plans[0]->deathBenefit->period);
        self::assertNull($result->plans[0]->budget);
        self::assertSame(8100, $result->plans[1]->pricing[0]->premium?->cents);

        $grouped = PrequalifyV3Result::byAmount($result->plans);
        self::assertSame([2500000, 5000000], array_keys($grouped));
        self::assertCount(1, $grouped[2500000]);
    }

    public function testBudgetResponseDecodesBudgetAndGroupsByBudget(): void
    {
        $budgetOffer = function (int $budgetCents, string $display): array {
            $offer = $this->faceOffer(5000000, '$50,000', 4500);
            $offer['budget'] = ['amount' => ['cents' => $budgetCents, 'display' => $display], 'period' => 'monthly'];
            return $offer;
        };
        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'prequalify_result',
            'request_id' => 'r',
            'idempotency_key' => 'k',
            'livemode' => true,
            'data' => ['plans' => [$budgetOffer(5000, '$50.00'), $budgetOffer(7500, '$75.00')]],
        ], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $result = $client->prequalifyV3->run(new PrequalifyV3Request(
            applicant: $this->applicant(),
            coverage: Coverage::monthlyBudgets([50, 75]),
            products: $this->products(),
        ));

        self::assertNotNull($result->plans[0]->budget);
        self::assertSame(5000, $result->plans[0]->budget->amount->cents);
        self::assertSame(V3Period::Monthly, $result->plans[0]->budget->period);

        $grouped = PrequalifyV3Result::byAmount($result->plans);
        self::assertSame([5000, 7500], array_keys($grouped));
    }

    public function testEmptyFlatResponseParsesNoPlans(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"object":"prequalify_result","data":{"plans":[]},"request_id":"req_x","livemode":true}');
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $result = $client->prequalifyV3->run(new PrequalifyV3Request(
            applicant: $this->applicant(),
            coverage: Coverage::faceValues([25000]),
            products: $this->products(),
        ));

        self::assertSame([], $result->plans);
    }

    public function testAbsentPlansFieldThrows(): void
    {
        $http = new MockHttpClient();
        $http->queue(200, '{"object":"prequalify_result","data":{"other_field":"value"},"request_id":"req_x"}');
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('missing plans field');
        $client->prequalifyV3->run(new PrequalifyV3Request(
            applicant: $this->applicant(),
            coverage: Coverage::faceValues([25000]),
            products: $this->products(),
        ));
    }

    public function testByAmountBudgetModeSkipsOfferMissingBudget(): void
    {
        $withBudget = $this->faceOffer(2500000, '$25,000', 4500);
        $withBudget['budget'] = ['amount' => ['cents' => 5000, 'display' => '$50.00'], 'period' => 'monthly'];
        // In budget mode this offer is missing budget; byAmount must skip it
        // rather than mis-bucket it under its death benefit (5000000 cents).
        $missingBudget = $this->faceOffer(5000000, '$50,000', 8100);

        $http = new MockHttpClient();
        $http->queue(200, json_encode([
            'object' => 'prequalify_result',
            'request_id' => 'r',
            'idempotency_key' => 'k',
            'livemode' => true,
            'data' => ['plans' => [$withBudget, $missingBudget]],
        ], JSON_THROW_ON_ERROR));
        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);

        $result = $client->prequalifyV3->run(new PrequalifyV3Request(
            applicant: $this->applicant(),
            coverage: Coverage::monthlyBudgets([50]),
            products: $this->products(),
        ));

        $grouped = PrequalifyV3Result::byAmount($result->plans);
        self::assertSame([5000], array_keys($grouped));
        self::assertCount(1, $grouped[5000]);
        self::assertArrayNotHasKey(5000000, $grouped);
    }
}
