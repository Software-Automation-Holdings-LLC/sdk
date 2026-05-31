<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

/**
 * Free-text → {@see ConceptInterface} matcher. Never throws on a miss;
 * unknown input yields a handle with `isKnown() === false`,
 * `inputText()` preserved, and empty accessors.
 *
 * Implementations of `Matcher` form the three accessors on the
 * `isa->zyins->reference` namespace: medications, conditions, concepts.
 * Tier 3 sugar (`matchMany()`, `list()`) is layered on the concrete
 * matchers, not in this base contract.
 */
interface Matcher
{
    /**
     * Resolve free text against the catalog.
     *
     * `$bundle` is optional. When omitted (bundleless form), the matcher
     * consults the {@see ReferenceBundleCache} the parent {@see Reference}
     * facade was constructed with — typically warmed by a prior
     * `$isa->zyins->datasetsV3->get()` call. If no bundle has been
     * cached and none is supplied, returns an unknown handle.
     */
    public function match(string $text, ?DatasetBundleV3 $bundle = null): ConceptInterface;
}
