<?php

declare(strict_types=1);

namespace Sah\Sdk\Account;

use InvalidArgumentException;

/**
 * `$isa->account->preferences` — per-(email, keycode, scope) preferences
 * blob.
 *
 * Wire shapes mirror `shared/schemas/api/account/v1/preferences.proto`:
 *   - POST /v1/preferences/lookup
 *   - POST /v1/preferences/set
 *
 * `scope` is REQUIRED on every call; the proto enum is
 * `bpp | eapp | online | csharp`, but the SDK accepts the wire string
 * directly so future scopes are forward-compatible without an SDK
 * release.
 */
final readonly class PreferencesClient
{
    public function __construct(private Http $http)
    {
    }

    /**
     * Read the preferences row for `(email, keycode, scope)`.
     *
     * @param string $scope Required scope (e.g. `bpp`, `eapp`, `online`, `csharp`).
     * @param array{email?:string,keycode?:string,orderid?:string} $request
     * @return BaseResponse
     */
    public function lookup(string $scope, array $request = []): BaseResponse
    {
        $this->validateScope($scope);
        $scope = trim($scope);
        $payload = $this->serializeLookup($scope, $request);
        /** @var BaseResponse $env */
        $env = $this->http->postEnvelope('/v1/preferences/lookup', $payload);
        return new BaseResponse(
            object: $env->object,
            livemode: $env->livemode,
            requestId: $env->requestId,
            idempotencyKey: $env->idempotencyKey,
            data: PreferencesDetail::fromWire($env->data),
        );
    }

    /**
     * Upsert the preferences blob for `(email, keycode, scope)`.
     *
     * @param string $scope
     * @param mixed $prefs Free-form preferences JSON; stored verbatim.
     * @param array{email?:string,keycode?:string,orderid?:string} $request
     * @return BaseResponse
     */
    public function set(string $scope, mixed $prefs, array $request = []): BaseResponse
    {
        $this->validateScope($scope);
        $scope = trim($scope);
        $payload = $this->serializeLookup($scope, $request);
        $payload['prefs'] = $prefs;
        /** @var BaseResponse $env */
        $env = $this->http->postEnvelope('/v1/preferences/set', $payload);
        return new BaseResponse(
            object: $env->object,
            livemode: $env->livemode,
            requestId: $env->requestId,
            idempotencyKey: $env->idempotencyKey,
            data: PreferencesDetail::fromWire($env->data),
        );
    }

    private function validateScope(string $scope): void
    {
        if (trim($scope) === '') {
            throw new InvalidArgumentException('account.preferences: scope is required');
        }
    }

    /**
     * @param array<string,mixed> $request
     * @return array<string,mixed>
     */
    private function serializeLookup(string $scope, array $request): array
    {
        $out = ['scope' => $scope];
        foreach (['email', 'keycode', 'orderid'] as $k) {
            if (isset($request[$k])) {
                $out[$k] = $request[$k];
            }
        }
        return $out;
    }
}
