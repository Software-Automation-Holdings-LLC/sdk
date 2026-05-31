<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use Isa\Sdk\Tests\Zyins\Support\MockHttpClient;
use Isa\Sdk\Zyins\Applicant;
use Isa\Sdk\Zyins\Auth;
use Isa\Sdk\Zyins\Height;
use Isa\Sdk\Zyins\NicotineUsage;
use Isa\Sdk\Zyins\Sex;
use Isa\Sdk\Zyins\Weight;

#[CoversClass(Auth::class)]
#[CoversClass(Height::class)]
#[CoversClass(Applicant::class)]
#[CoversClass(MockHttpClient::class)]
final class ValidationTest extends TestCase
{
    public function testAuthRejectsWhitespaceOnlyToken(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Auth("   \t  ");
    }

    public function testAuthRejectsTokenWithEmbeddedNewline(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Auth("isa_test_abc\r\nX-Injected: yes");
    }

    public function testAuthRejectsTokenWithEmbeddedNull(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Auth("isa_test_abc\x00");
    }

    public function testAuthRejectsWhitespaceOnlyScheme(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Auth("isa_test_abc", "   \t  ");
    }

    public function testAuthRejectsSchemeWithEmbeddedNewline(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Auth("isa_test_abc", "Bearer\r\nX-Injected:");
    }

    public function testHeightRejectsInchesGreaterThanEleven(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        Height::fromFeetInches(5, 22);
    }

    public function testHeightAcceptsElevenInches(): void
    {
        $h = Height::fromFeetInches(5, 11);
        self::assertSame(71, $h->totalInches);
    }

    public function testApplicantRejectsNonMedicationInMedicationsArray(): void
    {
        $this->expectException(\TypeError::class);
        new Applicant(
            dob: '1962-04-18',
            sex: Sex::Male,
            height: Height::fromFeetInches(5, 10),
            weight: Weight::fromPounds(195),
            state: 'NC',
            nicotineUse: NicotineUsage::None,
            medications: ['not-a-medication-instance'], // @phpstan-ignore-line
        );
    }

    public function testApplicantRejectsNonConditionInConditionsArray(): void
    {
        $this->expectException(\TypeError::class);
        new Applicant(
            dob: '1962-04-18',
            sex: Sex::Male,
            height: Height::fromFeetInches(5, 10),
            weight: Weight::fromPounds(195),
            state: 'NC',
            nicotineUse: NicotineUsage::None,
            conditions: [new \stdClass()], // @phpstan-ignore-line
        );
    }

    public function testMockHttpClientLastRequestThrowsWhenEmpty(): void
    {
        $this->expectException(\LogicException::class);
        (new MockHttpClient())->lastRequest();
    }
}
