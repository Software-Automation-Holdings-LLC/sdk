<?php

declare(strict_types=1);

namespace Isa\Sdk\Core;

/**
 * Pluggable persistence for SDK-managed credentials.
 *
 * The license-mode flow lets the SDK auto-stash a fresh license key
 * the first time `licenses->activate()` returns one. Subsequent calls
 * read it back without forcing the caller to thread the key through
 * every constructor. The store is the source of truth across process
 * boots; an in-memory `IsaCredentialState` is the source of truth
 * within a single process so per-call store round-trips stay off the
 * hot path.
 *
 * The default {@see InMemoryCredentialStore} is process-local and not
 * shared across workers; production hosts inject AsyncStorage, ~/.cache
 * files, Vault, or any keyed KV store appropriate for their runtime.
 */
interface CredentialStore
{
    /** Read a previously persisted value; `null` when absent. */
    public function get(string $key): ?string;

    /** Persist `$value` under `$key`. */
    public function set(string $key, string $value): void;

    /** Remove the value under `$key`; no-op when absent. */
    public function remove(string $key): void;
}
