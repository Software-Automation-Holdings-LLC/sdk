<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Licenses;

use InvalidArgumentException;

/**
 * Typed request for {@see Service::check()}. Mirrors the proto
 * `PublicCheckRequest` shape from
 * `shared/schemas/api/zyins/v1/licenses.proto`.
 */
final readonly class CheckInput
{
    public string $email;
    public string $keycode;
    public string $deviceId;
    public string $licenseKey;

    /**
     * @param string $email      Email associated with the license. Required.
     * @param string $keycode    Order keycode (XXX-XXX-XXX). Required.
     * @param string $deviceId   Optional device fingerprint.
     * @param string $licenseKey Optional license key to verify.
     */
    public function __construct(
        string $email,
        string $keycode,
        string $deviceId = '',
        string $licenseKey = '',
    ) {
        $this->email = trim($email);
        $this->keycode = trim($keycode);
        $this->deviceId = trim($deviceId);
        $this->licenseKey = trim($licenseKey);

        if ($this->email === '') {
            throw new InvalidArgumentException('Licenses\\CheckInput: email is required');
        }
        if ($this->keycode === '') {
            throw new InvalidArgumentException('Licenses\\CheckInput: keycode is required');
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
        if ($this->licenseKey !== '') {
            $body['license_key'] = $this->licenseKey;
        }
        return $body;
    }
}
