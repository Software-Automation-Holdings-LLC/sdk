<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Branding;

use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;

/**
 * Branding sub-service. Targets GET /v1/branding.
 *
 * Branding is per-license-order whitelabel configuration: agency name,
 * logo URL, colors, and product restrictions. Identity is derived from
 * the auth context — no body fields required. The server deliberately
 * does NOT 404 when a row is missing; it returns a zero-value
 * {@see BrandingDetail}.
 *
 * See docs/design/cases-email-branding-surface.md for the #149 auth
 * elevation context.
 */
final readonly class Service
{
    private const LOOKUP_PATH = '/v1/branding';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Fetch the whitelabel branding for the caller's license.
     */
    public function lookup(?RequestOptions $options = null): BrandingDetail
    {
        $response = $this->transport->get(self::LOOKUP_PATH, $options);
        return BrandingDetail::fromWire($response->data);
    }
}
