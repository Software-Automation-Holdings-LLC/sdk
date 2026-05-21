<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

/**
 * Process-local {@see CredentialStore}. Loses its contents on
 * interpreter shutdown and is not shared across workers — suitable for
 * tests and short-lived scripts. Production hosts inject a persistent
 * store (file, KV, Vault).
 */
final class InMemoryCredentialStore implements CredentialStore
{
    /** @var array<string,string> */
    private array $entries = [];

    public function get(string $key): ?string
    {
        return $this->entries[$key] ?? null;
    }

    public function set(string $key, string $value): void
    {
        $this->entries[$key] = $value;
    }

    public function remove(string $key): void
    {
        unset($this->entries[$key]);
    }
}
