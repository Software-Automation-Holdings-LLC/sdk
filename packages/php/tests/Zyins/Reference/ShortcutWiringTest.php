<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

use Isa\Sdk\Tests\Zyins\Support\FixedKeySource;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Reference\ConditionsMatcher;
use Isa\Sdk\Zyins\Reference\MedicationsMatcher;
use Isa\Sdk\Zyins\ZyInsClient;
use PHPUnit\Framework\TestCase;

/**
 * `$isa->zyins->medications` and `$isa->zyins->conditions` are
 * shortcuts to the matchers hanging off `$isa->zyins->reference`. Same
 * instance, same behavior — only the navigation differs.
 */
final class ShortcutWiringTest extends TestCase
{
    private const FIXTURE_TOKEN = 'isa_test_' . 'EXAMPLE000000000000000';
    private const FIXED_IDEM = '550e8400-e29b-41d4-a716-446655440000';

    public function testMedicationsShortcutIsSameInstanceAsReferenceMedications(): void
    {
        $client = $this->client();
        self::assertInstanceOf(MedicationsMatcher::class, $client->medications);
        self::assertSame($client->reference->medications, $client->medications);
    }

    public function testConditionsShortcutIsSameInstanceAsReferenceConditions(): void
    {
        $client = $this->client();
        self::assertInstanceOf(ConditionsMatcher::class, $client->conditions);
        self::assertSame($client->reference->conditions, $client->conditions);
    }

    private function client(): ZyInsClient
    {
        return new ZyInsClient(
            token: self::FIXTURE_TOKEN,
            httpClient: new MockHttpClient(),
            idempotency: new FixedKeySource(self::FIXED_IDEM),
        );
    }
}
