<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Quote;

use Sah\Sdk\Zyins\RequestOptions;
use Sah\Sdk\Zyins\Transport;

final readonly class Service
{
    private const PATH = '/v1/quote';

    public function __construct(private Transport $transport)
    {
    }

    public function run(Input $input, ?RequestOptions $options = null): Result
    {
        $response = $this->transport->post(self::PATH, $input->toWireBody(), $options);
        return Result::fromWire($response->data, $response->requestId);
    }
}
