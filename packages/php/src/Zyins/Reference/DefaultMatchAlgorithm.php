<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Reference;

use Isa\Sdk\Zyins\Reference\Internal\ConceptHandle;

/**
 * Default text → concept matcher: `smart_cmp` normalize then exact key
 * lookup. Mirrors the Go engine `MakeKey` algorithm and the v3 server's
 * normalization, so a hit here means the catalog row is the authoritative
 * answer.
 *
 * Algorithm:
 *  1. Run {@see MakeKey::normalize()} on `query` (uppercase + strip to
 *     ASCII alphanumeric).
 *  2. Walk `candidates` and pick the first concept whose `id()` matches.
 *  3. Miss → return an unknown concept preserving the verbatim input.
 *
 * @example
 *  $algo = new DefaultMatchAlgorithm();
 *  $hbp = $algo->match('high blood pressure', $catalog);
 */
final class DefaultMatchAlgorithm implements MatchAlgorithmInterface
{
    public function __construct(public readonly ?string $versionTag = null)
    {
    }

    public function match(string $query, array $candidates): ConceptInterface
    {
        $key = MakeKey::normalize($query);
        if ($key === '') {
            return ConceptHandle::unknown($query);
        }
        // First pass: exact id key. Identity-preserving — the sorted
        // fallback never reroutes a query that already matched here.
        foreach ($candidates as $candidate) {
            if ($candidate->id() === $key) {
                return $candidate;
            }
        }
        // Second pass: word-order-invariant name match via the engine
        // sorted check-key. A strict superset; first candidate wins.
        // Severity qualifiers stay distinct (different letter multisets).
        $checkKey = CheckKey::normalize($query);
        if ($checkKey !== '') {
            foreach ($candidates as $candidate) {
                if (CheckKey::normalize($candidate->name()) === $checkKey) {
                    return $candidate;
                }
            }
        }
        return ConceptHandle::unknown($query);
    }

    public function clone(?string $versionTag = null): self
    {
        return new self(versionTag: $versionTag ?? $this->versionTag);
    }
}
