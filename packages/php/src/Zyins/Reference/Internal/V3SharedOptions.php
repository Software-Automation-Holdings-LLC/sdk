<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference\Internal;

use Isa\Sdk\Zyins\Reference\PrequalifyV3Options;

/**
 * Serializer for the scalar underwriting options the `/v3/prequalify`
 * envelope and the `/v3/quote` flat body emit identically — `min_rank`,
 * `only_product_class`, `skip_health_based_underwriting`, and
 * `show_unreleased`.
 *
 * Each key is written only when its option is set; an unset or empty string
 * option leaves the key absent so the server sees no key rather than `null`.
 * The two non-shared options live with their builders: `include_product_class`
 * is a quote-only flat-body concern, and `include_ineligible` has builder-
 * specific defaulting.
 *
 * @see V3WireBody `/v3/quote` flat builder.
 * @see V3PrequalifyWireBody `/v3/prequalify` envelope builder.
 */
final class V3SharedOptions
{
    /**
     * Merge the shared scalar options into the wire payload, in place.
     *
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function apply(array $payload, ?PrequalifyV3Options $options): array
    {
        if ($options === null) {
            return $payload;
        }
        if ($options->onlyProductClass !== null && $options->onlyProductClass !== '') {
            $payload['only_product_class'] = $options->onlyProductClass;
        }
        if ($options->minRank !== null && $options->minRank !== '') {
            $payload['min_rank'] = $options->minRank;
        }
        if ($options->showUnreleased !== null) {
            $payload['show_unreleased'] = $options->showUnreleased;
        }
        if ($options->skipHealthBasedUnderwriting !== null) {
            $payload['skip_health_based_underwriting'] = $options->skipHealthBasedUnderwriting;
        }
        return $payload;
    }

    private function __construct()
    {
    }
}
