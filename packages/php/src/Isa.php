<?php

declare(strict_types=1);

namespace Sah\Sdk;

use Psr\Log\LoggerInterface;
use Sah\Sdk\Account\AccountClient;
use Sah\Sdk\Core\CredentialStore;
use Sah\Sdk\Core\InMemoryCredentialStore;
use Sah\Sdk\Core\StaticToken;
use Sah\Sdk\Proxy\ProxyClient;
use Sah\Sdk\RapidSign\RapidSignClient;
use Sah\Sdk\Zyins\Auth as ZyinsAuth;
use Sah\Sdk\Zyins\Exception\IsaConfigException;
use Sah\Sdk\Zyins\Licenses\CredentialState;
use Sah\Sdk\Zyins\Licenses\Facade as LicensesFacade;
use Sah\Sdk\Zyins\Licenses\LicenseRefreshedEvent;
use Sah\Sdk\Zyins\ZyInsClient;

/**
 * Unified entry point for the ISA Platform SDK.
 *
 * One client per process. Three bootstrap factories cover the runtime
 * audiences described in the SDK Design (§3.2):
 *
 *  - {@see Isa::withBearer()}  — server-to-server, Stripe-issued `isa_*` token.
 *  - {@see Isa::withLicense()} — agent tools (BPP web, desktop, online).
 *  - {@see Isa::withSession()} — embedded forms (eApp signer, third-party hosts).
 *  - {@see Isa::fromEnv()}     — pick the right factory based on the environment.
 *
 * Each factory reads sensible defaults from the environment when invoked
 * with no arguments — see the factory docblock for the exact variable
 * names.
 *
 *     $isa = Isa::withBearer();                       // reads ISA_TOKEN
 *     $result = $isa->zyins->prequalify->run($input);
 *     $envelope = $isa->rapidsign->documents->send($req);
 *     $resp = $isa->proxy->call->invoke($uuid, $invokeInput);
 *     $branding = $isa->account->branding->lookup(['keycode' => 'ABC-123-XYZ']);
 *
 * Product namespaces are wired lazily at construction; all share the
 * same authentication credential and base URL.
 */
final readonly class Isa
{
    private const LICENSE_DEVICE_ID_PREFIX = 'php-sdk-';

    /**
     * Product namespace: ZyINS underwriting, quoting, licensing, logos.
     *
     * Access services via the public properties on {@see ZyInsClient}
     * (`prequalify`, `quote`, `datasets`, `referenceData`, `usage`,
     * `license`, `logos`, `health`).
     */
    public ZyInsClient $zyins;

    /**
     * Product namespace: RapidSign envelope and document workflows.
     */
    public RapidSignClient $rapidsign;

    /**
     * Product namespace: ISA Platform `/v1/call` proxy (Algosure HMAC).
     */
    public ProxyClient $proxy;

    /**
     * Product namespace: elevated account API surface (branding,
     * preferences, cases, email, referenceData). Mounted under
     * `account.isaapi.com`.
     */
    public AccountClient $account;

    /**
     * Credential-aware license facade per the locked SDK syntax (TS
     * canon: `isa.zyins.license`). Exposes
     * `$isa->license->{activate,check,deactivate}()` with zero-arg call
     * sites. `null` outside license mode — the {@see ZyInsClient}
     * `license` service is still available for explicit-input calls.
     */
    public ?LicensesFacade $license;

    /**
     * Shared credential state in license mode. `null` for bearer /
     * session modes. Subscribe via {@see onLicenseRefreshed()}.
     */
    private ?CredentialState $credentialState;

    /**
     * Private constructor — every public path is a named factory so
     * callers cannot accidentally bypass credential resolution.
     */
    private function __construct(
        string|ZyinsAuth $token,
        ?LoggerInterface $logger,
        ?CredentialState $credentialState = null,
    ) {
        $bearer = $token instanceof ZyinsAuth ? $token->token : $token;
        $proxyAuth = $token instanceof ZyinsAuth ? $token : new ZyinsAuth(token: $token);
        $this->zyins = new ZyInsClient(token: $token, logger: $logger);
        $this->rapidsign = new RapidSignClient(token: $bearer);
        $this->proxy = new ProxyClient(token: $bearer, identityAuth: $proxyAuth);

        $tokenSource = new StaticToken($bearer);
        $this->account = new AccountClient(
            tokenSource: $tokenSource,
            referenceData: $this->zyins->referenceData,
            authorizationScheme: $proxyAuth->scheme,
        );

        $this->credentialState = $credentialState;
        $this->license = $credentialState === null
            ? null
            : new LicensesFacade($this->zyins->license, $credentialState);
    }

    /**
     * Subscribe to license-refresh events. The listener fires whenever
     * the SDK observes a fresh license key — typically the return
     * value of `$isa->license->activate()`.
     *
     * Returns an unsubscribe closure so callers can detach without
     * holding the original listener.
     *
     * @param \Closure(LicenseRefreshedEvent):void $listener
     * @return \Closure():void
     *
     * @throws \LogicException When called on a non-license Isa instance.
     */
    public function onLicenseRefreshed(\Closure $listener): \Closure
    {
        if ($this->credentialState === null) {
            throw new \LogicException(
                'Isa::onLicenseRefreshed is available only on license-mode instances. ' .
                'Construct via Isa::withLicense() or Isa::fromEnv() with ISA_LICENSE_* set.'
            );
        }
        return $this->credentialState->onLicenseRefreshed($listener);
    }

    /**
     * Construct a Bearer-mode SDK. When no token is provided, reads
     * `ISA_TOKEN` from the process environment.
     *
     * @throws IsaConfigException When neither argument nor env supplies a token.
     */
    public static function withBearer(?string $token = null, ?LoggerInterface $logger = null): self
    {
        $resolved = $token ?? self::env('ISA_TOKEN');
        if ($resolved === null) {
            throw new IsaConfigException(
                'Isa::withBearer(): missing token. Pass it explicitly or set ISA_TOKEN in the environment.'
            );
        }
        return new self(token: $resolved, logger: $logger);
    }

    /**
     * Construct a License-mode SDK. When invoked with no arguments,
     * reads `ISA_LICENSE_KEYCODE` and `ISA_LICENSE_EMAIL` from the
     * environment. Wires the credential-aware
     * {@see \Sah\Sdk\Zyins\Licenses\Facade} so callers may invoke
     * `activate() / check() / deactivate()` with zero arguments.
     *
     * @param string|null              $keycode  License keycode; env is consulted when null.
     * @param string|null              $email    License email; env is consulted when null.
     * @param LoggerInterface|null     $logger   Optional PSR-3 logger.
     * @param CredentialStore|null     $store    Pluggable persistence; defaults to in-memory.
     * @param string|null              $deviceId Optional device fingerprint; reads `ISA_LICENSE_DEVICE_ID` when null.
     *
     * @throws IsaConfigException When either required credential is missing.
     */
    public static function withLicense(
        ?string $keycode = null,
        ?string $email = null,
        ?LoggerInterface $logger = null,
        ?CredentialStore $store = null,
        ?string $deviceId = null,
    ): self {
        $resolvedKey = $keycode ?? self::env('ISA_LICENSE_KEYCODE');
        $resolvedEmail = $email ?? self::env('ISA_LICENSE_EMAIL');
        if ($resolvedKey === null) {
            throw new IsaConfigException(
                'Isa::withLicense(): missing keycode. Pass it explicitly or set ISA_LICENSE_KEYCODE in the environment.'
            );
        }
        if ($resolvedEmail === null) {
            throw new IsaConfigException(
                'Isa::withLicense(): missing email. Pass it explicitly or set ISA_LICENSE_EMAIL in the environment.'
            );
        }

        $resolvedStore = $store ?? new InMemoryCredentialStore();
        $resolvedDevice = $deviceId
            ?? self::env('ISA_LICENSE_DEVICE_ID')
            ?? $resolvedStore->get(CredentialState::STORE_KEY_DEVICE_ID)
            ?? self::newLicenseDeviceId();
        $resolvedStore->set(CredentialState::STORE_KEY_DEVICE_ID, $resolvedDevice);
        $stashedKey = $resolvedStore->get(CredentialState::STORE_KEY_LICENSE) ?? '';

        $state = new CredentialState(
            email: $resolvedEmail,
            keycode: $resolvedKey,
            deviceId: $resolvedDevice,
            licenseKey: $stashedKey,
            orderId: $resolvedKey,
            store: $resolvedStore,
        );

        return new self(
            token: ZyinsAuth::license($resolvedKey, $resolvedEmail),
            logger: $logger,
            credentialState: $state,
        );
    }

    /**
     * Construct a License-mode SDK from a keycode + email. Canonical
     * factory name per the locked SDK syntax (TS canon:
     * `Isa::withKeycode`). Equivalent to {@see self::withLicense()},
     * which is retained as a deprecated alias.
     *
     * @throws IsaConfigException When either credential is missing.
     */
    public static function withKeycode(
        ?string $keycode = null,
        ?string $email = null,
        ?LoggerInterface $logger = null,
        ?CredentialStore $store = null,
        ?string $deviceId = null,
    ): self {
        return self::withLicense(
            keycode: $keycode,
            email: $email,
            logger: $logger,
            store: $store,
            deviceId: $deviceId,
        );
    }

    /**
     * Construct an SDK instance from an embedded-form token. Canonical
     * factory per the locked SDK syntax (TS canon: `Isa::forForm`). The
     * form token is exchanged via `POST /v1/sessions/reissue` on first
     * use; in the PHP SDK this is a thin bootstrap that wraps the token
     * as the bearer credential for subsequent requests until session
     * reissue is wired.
     *
     * @throws IsaConfigException When `formToken` is empty.
     */
    public static function forForm(string $formToken, ?LoggerInterface $logger = null): self
    {
        if ($formToken === '') {
            throw new IsaConfigException(
                'Isa::forForm(): missing form token. Pass a non-empty embedded-form token.'
            );
        }
        return new self(token: self::formBootstrapToken($formToken), logger: $logger);
    }

    /**
     * Dispatching factory — picks the right credential path by argument
     * shape. Canonical factory per the locked SDK syntax (TS canon:
     * `Isa::authenticate`). Resolution order:
     *
     *   1. `token`                 → {@see withBearer()}
     *   2. `keycode` + `email`     → {@see withKeycode()}
     *   3. `formToken`             → {@see forForm()}
     *
     * @throws IsaConfigException When no valid combination is supplied.
     */
    public static function authenticate(
        ?string $token = null,
        ?string $keycode = null,
        ?string $email = null,
        ?string $formToken = null,
        ?LoggerInterface $logger = null,
        ?CredentialStore $store = null,
    ): self {
        if ($token !== null) {
            return self::withBearer(token: $token, logger: $logger);
        }
        if ($keycode !== null && $email !== null) {
            return self::withKeycode(keycode: $keycode, email: $email, logger: $logger, store: $store);
        }
        if ($formToken !== null) {
            return self::forForm(formToken: $formToken, logger: $logger);
        }
        throw new IsaConfigException(
            'Isa::authenticate(): provide one of token, keycode+email, or formToken.'
        );
    }

    private static function formBootstrapToken(string $formToken): string
    {
        $digest = substr(hash('sha256', $formToken), 0, 20);
        return 'isa_test_form_' . $digest;
    }

    /**
     * Construct a Session-mode SDK. When invoked with no arguments,
     * reads `ISA_SESSION_ID` and `ISA_SESSION_SECRET` from the
     * environment.
     *
     * @throws IsaConfigException When either credential is missing.
     */
    public static function withSession(
        ?string $sessionId = null,
        ?string $sessionSecret = null,
        ?LoggerInterface $logger = null,
    ): self {
        $resolvedId = $sessionId ?? self::env('ISA_SESSION_ID');
        $resolvedSecret = $sessionSecret ?? self::env('ISA_SESSION_SECRET');
        if ($resolvedId === null) {
            throw new IsaConfigException(
                'Isa::withSession(): missing session id. Pass it explicitly or set ISA_SESSION_ID in the environment.'
            );
        }
        if ($resolvedSecret === null) {
            throw new IsaConfigException(
                'Isa::withSession(): missing session secret. Pass it explicitly or set ISA_SESSION_SECRET in the environment.'
            );
        }
        return new self(token: ZyinsAuth::session($resolvedId, $resolvedSecret), logger: $logger);
    }

    /**
     * Pick the right factory based on the environment, in priority
     * order:
     *
     *   1. `ISA_TOKEN`                         → {@see withBearer()}
     *   2. `ISA_LICENSE_KEYCODE` + `_EMAIL`    → {@see withLicense()}
     *   3. `ISA_SESSION_ID` + `_SECRET`        → {@see withSession()}
     *
     * Throws {@see IsaConfigException} when none of the recognized
     * credential bundles is present.
     */
    public static function fromEnv(?LoggerInterface $logger = null): self
    {
        if (self::env('ISA_TOKEN') !== null) {
            return self::withBearer(logger: $logger);
        }
        if (self::env('ISA_LICENSE_KEYCODE') !== null && self::env('ISA_LICENSE_EMAIL') !== null) {
            return self::withLicense(logger: $logger);
        }
        if (self::env('ISA_SESSION_ID') !== null && self::env('ISA_SESSION_SECRET') !== null) {
            return self::withSession(logger: $logger);
        }
        throw new IsaConfigException(
            'Isa::fromEnv(): no recognized credential bundle in environment. ' .
            'Set ISA_TOKEN, or ISA_LICENSE_KEYCODE + ISA_LICENSE_EMAIL, or ISA_SESSION_ID + ISA_SESSION_SECRET.'
        );
    }

    private static function env(string $name): ?string
    {
        $value = getenv($name);
        if (! is_string($value) || $value === '') {
            return null;
        }
        return $value;
    }

    private static function newLicenseDeviceId(): string
    {
        return self::LICENSE_DEVICE_ID_PREFIX . bin2hex(random_bytes(16));
    }
}
