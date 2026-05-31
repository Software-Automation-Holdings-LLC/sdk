<?php

declare(strict_types=1);

namespace Isa\Sdk\Catalog;

/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 */
final class ScopeDescriptions
{
    /** @return array<string,string> */
    public static function all(): array
    {
        return [
            'rapidsign:documents:notify' => 'send signer notification emails.',
            'rapidsign:documents:read' => 'fetch signature state and signed PDFs.',
            'rapidsign:documents:sign' => 'submit signatures.',
            'rapidsign:documents:write' => 'create new documents.',
        ];
    }

    public static function for(Scope $scope): string
    {
        return self::all()[$scope->value]
            ?? throw new \LogicException(sprintf('No description registered for %s', $scope->value));
    }
}
