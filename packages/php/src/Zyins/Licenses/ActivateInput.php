<?php

declare(strict_types=1);

namespace Isa\Sdk\Zyins\Licenses;

use InvalidArgumentException;

/**
 * Typed request for {@see Service::activate()}. Mirrors the proto
 * `PublicActivateRequest` shape from
 * `shared/schemas/api/zyins/v1/licenses.proto`.
 */
final readonly class ActivateInput
{
    public string $email;
    public string $keycode;
    public string $deviceId;

    public function __construct(string $email, string $keycode, string $deviceId)
    {
        $this->email = trim($email);
        $this->keycode = trim($keycode);
        $this->deviceId = trim($deviceId);

        if ($this->email === '') {
            throw new InvalidArgumentException('Licenses\\ActivateInput: email is required');
        }
        if ($this->keycode === '') {
            throw new InvalidArgumentException('Licenses\\ActivateInput: keycode is required');
        }
        if ($this->deviceId === '') {
            throw new InvalidArgumentException('Licenses\\ActivateInput: deviceId is required');
        }
    }

    /** @return array<string,string> */
    public function toWireBody(): array
    {
        return [
            'email' => $this->email,
            'keycode' => $this->keycode,
            'deviceId' => $this->deviceId,
        ];
    }
}
