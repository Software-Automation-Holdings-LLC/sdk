<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Licenses;

use Isa\Sdk\Zyins\RequestOptions;
use Isa\Sdk\Zyins\Transport;

/**
 * Licenses sub-service. Tier 3 license operations target the bootstrap
 * endpoints at `/v2/licenses/{activate,check,deactivate}`. These three
 * operations sit OUTSIDE AuthMiddleware on the server: activate is the
 * call that mints the license key, so we cannot sign requests with a
 * credential we do not yet have. The transport emits only the
 * bootstrap-safe headers — Content-Type, Accept, Idempotency-Key, and
 * X-Device-ID when supplied — with no Authorization header and no
 * request signature.
 */
final readonly class Service
{
    private const ACTIVATE_PATH = '/v2/licenses/activate';
    private const CHECK_PATH = '/v2/licenses/check';
    private const DEACTIVATE_PATH = '/v2/licenses/deactivate';

    public function __construct(private Transport $transport)
    {
    }

    /**
     * Activate a license on a new device. The server mints a license
     * key, decrements the order's remaining-activations counter, and
     * returns the pre-built credentials.
     *
     * @throws \Isa\Sdk\Zyins\Exception\IsaException on 4xx/5xx wire responses.
     */
    public function activate(ActivateInput $input, ?RequestOptions $options = null): ActivateResult
    {
        $response = $this->transport->postBootstrap(
            self::ACTIVATE_PATH,
            $input->toWireBody(),
            $input->deviceId,
            $options,
        );
        return ActivateResult::fromWire($response->data);
    }

    /**
     * Phone-home validation. Returns the current license validation
     * state without requiring authentication.
     *
     * @param CheckInput          $input   Email + keycode + optional device/license-key.
     * @param RequestOptions|null $options Optional per-call overrides.
     *
     * @throws \Isa\Sdk\Zyins\Exception\IsaException on 4xx/5xx wire responses.
     *
     * @example
     * $result = $isa->license->check(new CheckInput(
     *     email: 'john.doe@acme-agency.com',
     *     keycode: 'ABC-123-XYZ',
     * ));
     */
    public function check(CheckInput $input, ?RequestOptions $options = null): CheckResult
    {
        $response = $this->transport->postBootstrap(
            self::CHECK_PATH,
            $input->toWireBody(),
            $input->deviceId !== '' ? $input->deviceId : null,
            $options,
        );
        return CheckResult::fromWire($response->data);
    }

    /**
     * Deactivate the license. Resets the anti-piracy device record and
     * marks the order inactive.
     */
    public function deactivate(DeactivateInput $input, ?RequestOptions $options = null): DeactivateResult
    {
        $response = $this->transport->postBootstrap(
            self::DEACTIVATE_PATH,
            $input->toWireBody(),
            $input->deviceId !== '' ? $input->deviceId : null,
            $options,
        );
        return DeactivateResult::fromWire($response->data);
    }
}
