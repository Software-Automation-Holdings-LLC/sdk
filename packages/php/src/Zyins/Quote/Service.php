<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Quote;

use Isa\Sdk\Zyins\LegacyWire;
use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;

final readonly class Service
{
    private const PATH = '/v1/quote';
    private const LEGACY_PATH = '/v2/quote';

    public function __construct(private Transport $transport)
    {
    }

    public function run(Input $input, ?RequestOptions $options = null): Result
    {
        $response = $this->transport->post(self::PATH, $input->toWireBody(), $options);
        return Result::fromWire($response->data, $response->requestId);
    }

    /**
     * Run quote and return the full JSON envelope for conformance.
     *
     * @return array<string,mixed>
     */
    public function runEnvelope(Input $input, ?RequestOptions $options = null): array
    {
        $legacy = LegacyWire::enabled();
        $body = $legacy
            ? LegacyWire::quoteBodyFromApplicant(
                $input->applicant,
                LegacyWire::faceAmountFromCoverage($input->coverage),
            )
            : $input->toWireBody();
        return $this->transport->postEnvelope($legacy ? self::LEGACY_PATH : self::PATH, $body, $options);
    }
}
