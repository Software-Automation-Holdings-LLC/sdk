<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Preferences;

use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;

/**
 * Preferences sub-service. Targets GET / POST /v1/preferences.
 *
 * Preferences are an opaque JSON document stored per (email,
 * license_order). The SDK does not interpret the document; callers
 * serialize their own settings shape and pass through.
 */
final readonly class Service
{
    private const PATH = '/v1/preferences';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Fetch the caller's preferences document.
     */
    public function lookup(?RequestOptions $options = null): PreferencesResult
    {
        $response = $this->transport->get(self::PATH, $options);
        return PreferencesResult::fromWire($response->data);
    }

    /**
     * Upsert the caller's preferences document.
     */
    public function set(SetInput $input, ?RequestOptions $options = null): PreferencesResult
    {
        $response = $this->transport->post(self::PATH, $input->toWireBody(), $options);
        return PreferencesResult::fromWire($response->data, $input->prefs);
    }
}
