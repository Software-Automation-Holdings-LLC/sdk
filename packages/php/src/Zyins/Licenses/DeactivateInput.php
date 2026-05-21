<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Licenses;

use InvalidArgumentException;

/**
 * Typed request for {@see Service::deactivate()}. Mirrors the proto
 * `PublicDeactivateRequest` shape.
 */
final readonly class DeactivateInput
{
    public string $email;
    public string $keycode;
    public string $deviceId;

    /**
     * @param string $email    Email associated with the license. Required.
     * @param string $keycode  Order keycode. Required.
     * @param string $deviceId Optional device fingerprint; reset on success.
     */
    public function __construct(
        string $email,
        string $keycode,
        string $deviceId = '',
    ) {
        $this->email = trim($email);
        $this->keycode = trim($keycode);
        $this->deviceId = trim($deviceId);

        if ($this->email === '') {
            throw new InvalidArgumentException('Licenses\\DeactivateInput: email is required');
        }
        if ($this->keycode === '') {
            throw new InvalidArgumentException('Licenses\\DeactivateInput: keycode is required');
        }
    }

    /**
     * @return array<string,string>
     */
    public function toWireBody(): array
    {
        $body = [
            'email' => $this->email,
            'keycode' => $this->keycode,
        ];
        if ($this->deviceId !== '') {
            $body['device_id'] = $this->deviceId;
        }
        return $body;
    }
}
