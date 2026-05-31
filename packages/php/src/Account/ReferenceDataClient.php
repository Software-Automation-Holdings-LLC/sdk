<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

use InvalidArgumentException;
use Isa\Sdk\Zyins\ReferenceData\Service as ZyinsReferenceDataService;

/**
 * `$isa->account->referenceData` — typeahead reference datasets.
 *
 * A thin facade over the existing
 * {@see \Isa\Sdk\Zyins\ReferenceData\Service}; the account namespace
 * exposes the same data under a scope-keyed surface so callers don't
 * have to remember the per-resource method names.
 *
 * Supported scopes:
 *   - `conditions`   — canonical condition list (engine wire format)
 *   - `medications`  — canonical medication list
 *   - `carriers`     — carriers + display names
 */
final readonly class ReferenceDataClient
{
    public function __construct(private ZyinsReferenceDataService $underlying)
    {
    }

    /**
     * Fetch the dataset for a scope.
     *
     * @return array<int,array<string,mixed>>
     */
    public function get(string $scope): array
    {
        return match ($scope) {
            'conditions' => $this->underlying->conditions(),
            'medications' => $this->underlying->medications(),
            'carriers' => $this->underlying->carriers(),
            default => throw new InvalidArgumentException(
                "account.referenceData: unknown scope '{$scope}' (expected one of: conditions, medications, carriers)"
            ),
        };
    }
}
