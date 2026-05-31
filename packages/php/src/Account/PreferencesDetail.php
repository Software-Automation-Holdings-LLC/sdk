<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * Resource shape carried inside the preferences-response envelope's
 * `data` field. `prefs` is the opaque JSON the agent stored.
 */
final readonly class PreferencesDetail
{
    public function __construct(
        public string $scope,
        public mixed $prefs,
    ) {
    }

    public static function fromWire(mixed $raw): self
    {
        $r = is_array($raw) ? $raw : [];
        /** @var array<string,mixed> $r */
        $scope = is_string($r['scope'] ?? null) ? (string) $r['scope'] : '';
        return new self(scope: $scope, prefs: $r['prefs'] ?? null);
    }
}
