<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Licenses;

use Sah\Sdk\Zyins\RequestOptions;
use Sah\Sdk\Zyins\Transport;

/**
 * Licenses sub-service. Exposes the public BPP license-lifecycle
 * surface (PublicCheck, PublicDeactivate) from
 * `shared/schemas/api/zyins/v1/licenses.proto`. The authenticated
 * self-* surface lands with the LicenseHMAC transport in a follow-up.
 */
final readonly class Service
{
    private const ACTIVATE_PATH = '/v1/licenses/activate';
    private const CHECK_PATH = '/v1/licenses/check';
    private const DEACTIVATE_PATH = '/v1/licenses/deactivate';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Activate a license on a new device. The server mints a license
     * key, decrements the order's remaining-activations counter, and
     * returns the pre-built credentials.
     *
     * @throws \Sah\Sdk\Zyins\Exception\IsaException on 4xx/5xx wire responses.
     */
    public function activate(ActivateInput $input, ?RequestOptions $options = null): ActivateResult
    {
        $response = $this->transport->post(self::ACTIVATE_PATH, $input->toWireBody(), $options);
        return ActivateResult::fromWire($response->data);
    }

    /**
     * Phone-home validation. Returns the current license validation
     * state without requiring authentication.
     *
     * @param CheckInput          $input   Email + keycode + optional device/license-key.
     * @param RequestOptions|null $options Optional per-call overrides.
     *
     * @throws \Sah\Sdk\Zyins\Exception\IsaException on 4xx/5xx wire responses.
     *
     * @example
     * $result = $isa->license->check(new CheckInput(
     *     email: 'john.doe@acme-agency.com',
     *     keycode: 'ABC-123-XYZ',
     * ));
     */
    public function check(CheckInput $input, ?RequestOptions $options = null): CheckResult
    {
        $response = $this->transport->post(self::CHECK_PATH, $input->toWireBody(), $options);
        return CheckResult::fromWire($response->data);
    }

    /**
     * Deactivate the license. Resets the anti-piracy device record and
     * marks the order inactive.
     */
    public function deactivate(DeactivateInput $input, ?RequestOptions $options = null): DeactivateResult
    {
        $response = $this->transport->post(self::DEACTIVATE_PATH, $input->toWireBody(), $options);
        return DeactivateResult::fromWire($response->data);
    }
}
