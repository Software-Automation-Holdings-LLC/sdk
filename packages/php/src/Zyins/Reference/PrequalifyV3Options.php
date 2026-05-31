<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Options layered on top of the v3 prequalify / quote request.
 *
 *  - `onlyProductClass` restricts evaluation to a single carrier product
 *    class (the wire token, e.g. `"term"`).
 *  - `includeProductClass` adds classes to the response that the caller
 *    wants visible even if not part of the typed selection.
 *  - `minRank` is the carrier-defined rank floor.
 *  - `showUnreleased` opts into unreleased products (development mode).
 *  - `skipHealthBasedUnderwriting` short-circuits health checks.
 *  - `includeIneligible` (default `true`) keeps ineligible products and
 *    ineligible rate-class rows in the response so the UI can render
 *    them with `eligibility.eligible === false`. Set `false` to drop.
 */
final readonly class PrequalifyV3Options
{
    /**
     * @param list<string>|null $includeProductClass List of class wire tokens.
     * @throws \InvalidArgumentException when `includeProductClass` carries
     *         non-string elements.
     */
    public function __construct(
        public ?string $onlyProductClass = null,
        public ?array $includeProductClass = null,
        public ?string $minRank = null,
        public ?bool $showUnreleased = null,
        public ?bool $skipHealthBasedUnderwriting = null,
        public ?bool $includeIneligible = null,
    ) {
        if ($this->includeProductClass !== null) {
            foreach ($this->includeProductClass as $i => $token) {
                if (! is_string($token)) {
                    throw new \InvalidArgumentException(sprintf(
                        'PrequalifyV3Options.includeProductClass expects string wire tokens; ' .
                        'element at index %d is not a string.',
                        $i,
                    ));
                }
            }
        }
    }
}
