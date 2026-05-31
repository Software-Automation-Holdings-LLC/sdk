<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Licenses;

use Isa\Sdk\Core\CredentialStore;

/**
 * In-memory credential snapshot shared between {@see \Isa\Sdk\Isa} and
 * the {@see LicensesFacade}.
 *
 * Fields are mutated in place when `licenses->activate()` returns a
 * fresh license key; because every sub-client that needs credentials
 * captures the same reference, the in-place mutation is observed by
 * subsequent calls without any caller re-bootstrap. Persistence flows
 * through {@see CredentialStore} so the value survives a process
 * restart.
 *
 * `email` and `keycode` are immutable for the lifetime of the state;
 * `licenseKey`, `deviceId`, and `orderId` mutate.
 */
final class CredentialState
{
    public const STORE_KEY_LICENSE = 'isa.licenseKey';
    public const STORE_KEY_DEVICE_ID = 'isa.deviceId';

    /** @var list<\Closure(LicenseRefreshedEvent):void> */
    private array $listeners = [];

    public function __construct(
        public readonly string $email,
        public readonly string $keycode,
        public string $deviceId,
        public string $licenseKey,
        public string $orderId,
        private readonly CredentialStore $store,
    ) {
    }

    /**
     * Subscribe to license-refresh events. Returns an unsubscribe
     * function so callers can detach without holding the original
     * closure.
     *
     * @param \Closure(LicenseRefreshedEvent):void $listener
     * @return \Closure():void
     */
    public function onLicenseRefreshed(\Closure $listener): \Closure
    {
        $this->listeners[] = $listener;
        $index = array_key_last($this->listeners);
        return function () use ($index): void {
            unset($this->listeners[$index]);
        };
    }

    /**
     * Update the live license key, persist it to the store, and notify
     * subscribers. Listener failures are swallowed — they MUST NOT
     * break the activation flow.
     */
    public function refreshLicenseKey(string $licenseKey): void
    {
        $this->licenseKey = $licenseKey;
        $this->store->set(self::STORE_KEY_LICENSE, $licenseKey);
        $event = new LicenseRefreshedEvent(
            licenseKey: $licenseKey,
            deviceId: $this->deviceId,
            email: $this->email,
            orderId: $this->orderId,
        );
        foreach ($this->listeners as $listener) {
            try {
                $listener($event);
            } catch (\Throwable) {
                // Side-effect-only listeners must not break activation.
            }
        }
    }

    /** Clear the stashed license key (post-deactivate). */
    public function clearLicenseKey(): void
    {
        $this->licenseKey = '';
        $this->store->remove(self::STORE_KEY_LICENSE);
    }
}
