<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

// Cross-SDK V3 decoded-response equivalence — PHP SDK in-process gate.
//
// Loads the shared fixture
// (conformance/scenarios/.fixtures/prequalify-v3-fex-immediate.response.json)
// and the shared expected triples (…expected.json), feeds the fixture through
// ZyInsClient->prequalifyV3->run() via a MockHttpClient, and asserts the
// decoded values match the shared expected triples.
//
// Because this test goes through the real Transport/PrequalifyV3::run() stack
// it exercises the same parseEnvelope code path that production uses — no
// reflection or visibility tricks needed.
//
// Sibling tests in packages/go, packages/python, and packages/csharp assert
// against the same expected.json so any decode divergence between languages
// produces a failing test in the diverging language's own CI job.

use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Coverage;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Product;
use Isa\Sdk\Zyins\Reference\PrequalifyV3Request;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\TestCase;

final class CrossSdkEquivalenceTest extends TestCase
{
    private const TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';

    public function testCrossSDKEquivalencePrequalifyV3(): void
    {
        [$fixturePath, $expectedPath] = $this->resolveFixturePaths();

        if (! file_exists($fixturePath)) {
            self::fail("fixture not found at $fixturePath — missing file is a gate failure, not a skip");
        }
        if (! file_exists($expectedPath)) {
            self::fail("expected triples not found at $expectedPath — missing file is a gate failure, not a skip");
        }

        $fixtureBody = file_get_contents($fixturePath);
        self::assertIsString($fixtureBody);

        $expectedData = json_decode(
            (string) file_get_contents($expectedPath),
            true,
            flags: JSON_THROW_ON_ERROR,
        );
        $expectedPlans = $expectedData['plans'];

        // Feed the fixture through the full Transport → PrequalifyV3::run() stack via
        // MockHttpClient. This exercises the same parseEnvelope code path production uses.
        $http = new MockHttpClient();
        $http->queue(200, $fixtureBody);

        $client = new ZyInsClient(token: self::TOKEN, httpClient: $http);
        $result = $client->prequalifyV3->run(
            new PrequalifyV3Request(
                applicant: new Applicant(
                    dob: '1962-04-18',
                    sex: Sex::Male,
                    height: Height::fromFeetInches(5, 10),
                    weight: Weight::fromPounds(195),
                    state: 'NC',
                    nicotineUse: NicotineUsage::None,
                ),
                coverage: Coverage::faceValue(25000),
                products: [new Product(
                    id: '8a3976f7-0f32-567c-abd8-c8febd17e4d5',
                    name: 'Product 03-01',
                    class: 'fex',
                    carrier: 'Carrier 03',
                )],
            ),
            RequestOptions::default()->withIdempotencyKey('550e8400-e29b-41d4-a716-446655440000'),
        );

        self::assertGreaterThanOrEqual(
            count($expectedPlans),
            count($result->plans),
            sprintf('decoded %d plans, want at least %d', count($result->plans), count($expectedPlans)),
        );

        foreach ($expectedPlans as $i => $want) {
            $offer = $result->plans[$i];

            self::assertSame($want['id'], $offer->id, "plan[$i].id mismatch");

            $primary = \Isa\Sdk\Zyins\Reference\PrequalifyV3Result::offerPremium($offer);
            self::assertNotNull($primary, "plan[$i] offerPremium = null, want {$want['premium_cents']} cents");
            self::assertSame(
                $want['premium_cents'],
                $primary->amount->cents,
                "plan[$i].premium_cents mismatch",
            );

            $primaryRow = null;
            foreach ($offer->pricing as $row) {
                if ($row->primary) {
                    $primaryRow = $row;
                    break;
                }
            }
            self::assertNotNull($primaryRow, "plan[$i] has no primary pricing row");
            $gotCategory = $primaryRow->eligibility->category?->value;
            self::assertSame(
                $want['eligibility_category'],
                $gotCategory,
                "plan[$i].eligibility_category mismatch",
            );
        }
    }

    /**
     * Resolve paths to the shared fixture and expected files.
     * Walk up from the test file location to find the repo root.
     *
     * @return array{string, string}
     */
    private function resolveFixturePaths(): array
    {
        $dir = __DIR__;
        for ($i = 0; $i < 10; $i++) {
            $candidate = $dir . '/conformance/scenarios/.fixtures';
            if (is_dir($candidate)) {
                return [
                    $candidate . '/prequalify-v3-fex-immediate.response.json',
                    $candidate . '/prequalify-v3-fex-immediate.expected.json',
                ];
            }
            $parent = dirname($dir);
            if ($parent === $dir) {
                break;
            }
            $dir = $parent;
        }
        // Fallback: walk from the project root marker (composer.json).
        $dir = __DIR__;
        for ($i = 0; $i < 10; $i++) {
            if (file_exists($dir . '/composer.json') && is_dir($dir . '/../../conformance')) {
                $fixtures = realpath($dir . '/../../conformance/scenarios/.fixtures');
                if ($fixtures !== false) {
                    return [
                        $fixtures . '/prequalify-v3-fex-immediate.response.json',
                        $fixtures . '/prequalify-v3-fex-immediate.expected.json',
                    ];
                }
            }
            $parent = dirname($dir);
            if ($parent === $dir) {
                break;
            }
            $dir = $parent;
        }
        self::fail('conformance/scenarios/.fixtures not found by walking up from test file');
    }
}
