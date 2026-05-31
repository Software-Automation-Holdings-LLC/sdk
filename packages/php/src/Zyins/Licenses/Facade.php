<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Licenses;

use InvalidArgumentException;
use Isa\Sdk\Zyins\RequestOptions;

/**
 * Credential-aware facade over {@see Service}. Every method accepts
 * optional named overrides — when omitted, fields fall back to the
 * shared {@see CredentialState} the parent `Isa` was constructed with.
 *
 * The first successful `activate()` updates the shared credential
 * state in place so subsequent calls (`prequalify`, `cases->create`,
 * …) sign with the new license key automatically. No caller
 * re-bootstrap.
 *
 * Zero-arg call sites look like:
 *
 *     $isa = Isa::fromEnv();          // reads ISA_LICENSE_* env vars
 *     $result = $isa->zyins->license->activate();
 *     $result = $isa->zyins->license->check();
 *     $result = $isa->zyins->license->deactivate();
 */
final readonly class Facade
{
    public function __construct(
        private Service $service,
        private CredentialState $state,
    ) {
    }

    /**
     * Activate a license on this device. With no args, fills `email`,
     * `keycode`, and `deviceId` from the parent `Isa`'s credential
     * state. Refreshes the stashed license key on success.
     */
    public function activate(
        ?string $email = null,
        ?string $keycode = null,
        ?string $deviceId = null,
        ?RequestOptions $options = null,
    ): ActivateResult {
        $input = new ActivateInput(
            email: $email ?? $this->state->email,
            keycode: $keycode ?? $this->state->keycode,
            deviceId: $deviceId ?? $this->state->deviceId,
        );
        $result = $this->service->activate($input, $options);
        $this->state->refreshLicenseKey($result->auth->licenseKey);
        return $result;
    }

    /** Phone-home validation. Defaults fill from instance state. */
    public function check(
        ?string $email = null,
        ?string $keycode = null,
        ?string $deviceId = null,
        ?string $licenseKey = null,
        ?RequestOptions $options = null,
    ): CheckResult {
        $resolvedKeycode = $keycode ?? $this->state->keycode;
        $resolvedEmail = $email ?? $this->state->email;
        if (trim($resolvedKeycode) === '' || trim($resolvedEmail) === '') {
            throw new InvalidArgumentException(
                'license.check requires email + keycode (instance state was empty)'
            );
        }
        return $this->service->check(new CheckInput(
            email: $resolvedEmail,
            keycode: $resolvedKeycode,
            deviceId: $deviceId ?? $this->state->deviceId,
            licenseKey: $licenseKey ?? $this->state->licenseKey,
        ), $options);
    }

    /**
     * Deactivate this device. Clears the stashed license key on
     * success.
     */
    public function deactivate(
        ?string $email = null,
        ?string $keycode = null,
        ?string $deviceId = null,
        ?RequestOptions $options = null,
    ): DeactivateResult {
        $resolvedKeycode = $keycode ?? $this->state->keycode;
        $resolvedEmail = $email ?? $this->state->email;
        if (trim($resolvedKeycode) === '' || trim($resolvedEmail) === '') {
            throw new InvalidArgumentException(
                'license.deactivate requires email + keycode (instance state was empty)'
            );
        }
        $result = $this->service->deactivate(new DeactivateInput(
            email: $resolvedEmail,
            keycode: $resolvedKeycode,
            deviceId: $deviceId ?? $this->state->deviceId,
        ), $options);
        $this->state->clearLicenseKey();
        return $result;
    }
}
