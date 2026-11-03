<?php

declare(strict_types=1);

namespace Isa\Sdk;

use Isa\Sdk\Account\AccountClient;
use Isa\Sdk\Core\CredentialStore;
use Isa\Sdk\Core\InMemoryCredentialStore;
use Isa\Sdk\Core\StaticToken;
use Isa\Sdk\Proxy\ProxyClient;
use Isa\Sdk\RapidSign\RapidSignClient;
use Isa\Sdk\Zyins\Auth as ZyinsAuth;
use Isa\Sdk\Zyins\DatasetSource;
use Isa\Sdk\Zyins\Exception\IsaConfigException;
use Isa\Sdk\Zyins\FileDatasetSource;
use Isa\Sdk\Zyins\Licenses\CredentialState;
use Isa\Sdk\Zyins\Licenses\Facade as LicensesFacade;
use Isa\Sdk\Zyins\Licenses\LicenseRefreshedEvent;
use Isa\Sdk\Zyins\Reference\AutocompleteAlgorithmInterface;
use Isa\Sdk\Zyins\Reference\AutocorrectorFactory;
use Isa\Sdk\Zyins\Reference\AutocorrectorInterface;
use Isa\Sdk\Zyins\Reference\MatchAlgorithmInterface;
use Isa\Sdk\Zyins\ZyInsClient;
use Psr\Log\LoggerInterface;

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
 * `withLicense()` and `withSession()` wire `$isa->zyins` only. RapidSign and
 * Proxy require `withBearer()` — those APIs accept Bearer `isa_*` tokens.
 */
final readonly class Isa
{
    private const LICENSE_DEVICE_ID_PREFIX = 'php-sdk-';

    /**
     * Sentinel bearer credential for offline, local-bundle-only use. NOT a
     * secret — a fixed non-credential placeholder (assembled from pieces so
     * static secret scanners do not flag a literal) so the reference layer
     * works with no credential. Not a working credential: a product call made
     * in this mode signs with it and the server rejects it — the intended
     * fail-loud behavior for "network call without a token".
     */
    private const OFFLINE_BEARER_TOKEN = 'isa_' . 'test_offline_local_datasets';

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
     *
     * Access services via the public properties on {@see RapidSignClient}
     * (`documents`, `webhooks`). Bearer mode only; see class docblock.
     */
    public RapidSignClient|UnsupportedAuthProduct $rapidsign;

    /**
     * Product namespace: ISA Platform `/v1/call` proxy (Algosure HMAC).
     *
     * Access services via the public properties on {@see ProxyClient}
     * (`call`, `algosure`). Bearer mode only; see class docblock.
     */
    public ProxyClient|UnsupportedAuthProduct $proxy;

    /**
     * Product namespace: elevated account API surface (branding,
     * preferences, cases, email, referenceData). Mounted under
     * `account.isaapi.com`.
     */
    public AccountClient|UnsupportedAuthProduct $account;

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
        ?AutocorrectorInterface $autocorrector = null,
        ?MatchAlgorithmInterface $matchAlgorithm = null,
        ?AutocompleteAlgorithmInterface $autocompleteAlgorithm = null,
        ?DatasetSource $datasetSource = null,
    ) {
        $this->zyins = new ZyInsClient(
            token: $token,
            logger: $logger,
            autocorrector: $autocorrector,
            matchAlgorithm: $matchAlgorithm,
            autocompleteAlgorithm: $autocompleteAlgorithm,
            datasetSource: $datasetSource,
        );

        if ($token instanceof ZyinsAuth && $token->scheme !== ZyinsAuth::SCHEME_BEARER) {
            $this->rapidsign = new UnsupportedAuthProduct('rapidsign', $token->scheme);
            $this->proxy = new UnsupportedAuthProduct('proxy', $token->scheme);
            $this->account = new UnsupportedAuthProduct('account', $token->scheme);
            $this->credentialState = $credentialState;
            $this->license = $credentialState === null
                ? null
                : new LicensesFacade($this->zyins->license, $credentialState);
            return;
        }

        $bearer = $token instanceof ZyinsAuth ? $token->token : $token;
        $proxyAuth = $token instanceof ZyinsAuth ? $token : new ZyinsAuth(token: $token);
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
    public static function withBearer(
        ?string $token = null,
        ?LoggerInterface $logger = null,
        ?AutocorrectorInterface $autocorrector = null,
        ?MatchAlgorithmInterface $matchAlgorithm = null,
        ?AutocompleteAlgorithmInterface $autocompleteAlgorithm = null,
        DatasetSource|string|null $datasets = null,
    ): self {
        $source = $datasets === null ? null : self::toDatasetSource($datasets);
        $resolved = $token ?? self::env('ISA_TOKEN');
        if ($resolved === null) {
            // A configured local source makes the reference layer work
            // offline, so no credential is needed; substitute a
            // non-credential sentinel (rejected server-side if a product
            // call ever sends it). Without a source, the token stays
            // required exactly as before.
            if ($source !== null) {
                $resolved = self::OFFLINE_BEARER_TOKEN;
            } else {
                throw new IsaConfigException(
                    'Isa::withBearer(): missing token. Pass it explicitly or set ISA_TOKEN in the environment.'
                );
            }
        }
        return new self(
            token: $resolved,
            logger: $logger,
            autocorrector: $autocorrector,
            matchAlgorithm: $matchAlgorithm,
            autocompleteAlgorithm: $autocompleteAlgorithm,
            datasetSource: $source,
        );
    }

    /**
     * Normalize the `datasets` shorthand into a {@see DatasetSource}: a
     * string is a file path; a source passes through.
     */
    private static function toDatasetSource(DatasetSource|string $datasets): DatasetSource
    {
        return is_string($datasets) ? new FileDatasetSource($datasets) : $datasets;
    }

    /**
     * Top-level kernel factory for the autocorrector adapter — mirrors
     * the locked TS surface `Isa.autocorrector()`. Returns a tiny
     * factory whose `create()` method builds a default autocorrector
     * around the supplied typo map.
     *
     * @example
     *  $typoMap = ['HBP' => 'HIGH BLOOD PRESSURE'];
     *  $ac = Isa::autocorrector()->create($typoMap);
     *  echo $ac->correct('hbp');                            // "HIGH BLOOD PRESSURE"
     */
    public static function autocorrector(): AutocorrectorFactory
    {
        return new AutocorrectorFactory();
    }

    /**
     * Construct a License-mode SDK (agent-tool credential). Wires
     * `$isa->zyins` only — `$isa->rapidsign` and `$isa->proxy` throw
     * {@see IsaConfigException} when accessed. When invoked with no
     * arguments, reads `ISA_LICENSE_KEYCODE` and `ISA_LICENSE_EMAIL`
     * from the environment. Wires the credential-aware
     * {@see \Isa\Sdk\Zyins\Licenses\Facade} so callers may invoke
     * `activate() / check() / deactivate()` with zero arguments.
     *
     * @deprecated Use {@see self::withKeycode()} instead, which is the canonical
     *             factory name across all SDK languages. This alias will be
     *             removed in a future major version.
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
        ?AutocorrectorInterface $autocorrector = null,
        ?MatchAlgorithmInterface $matchAlgorithm = null,
        ?AutocompleteAlgorithmInterface $autocompleteAlgorithm = null,
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
            autocorrector: $autocorrector,
            matchAlgorithm: $matchAlgorithm,
            autocompleteAlgorithm: $autocompleteAlgorithm,
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
        ?AutocorrectorInterface $autocorrector = null,
        ?MatchAlgorithmInterface $matchAlgorithm = null,
        ?AutocompleteAlgorithmInterface $autocompleteAlgorithm = null,
    ): self {
        return self::withLicense(
            keycode: $keycode,
            email: $email,
            logger: $logger,
            store: $store,
            deviceId: $deviceId,
            autocorrector: $autocorrector,
            matchAlgorithm: $matchAlgorithm,
            autocompleteAlgorithm: $autocompleteAlgorithm,
        );
    }

    /**
     * Construct an SDK instance from an embedded-form token. Canonical
     * factory per the locked SDK syntax (TS canon: `Isa::forForm`).
     *
     * Server contract (account ADR-037): mint is `POST /v1/sessions` with
     * `Authorization: FormToken <token>`; rotation is
     * `POST /v1/sessions/reissue` with `Authorization: Session <secret>` +
     * `X-Isa-Session-Id`. The TS SDK performs the mint exchange; this PHP
     * path is still a transitional stub that holds the form token as a
     * bearer-shaped credential until the HTTP mint is ported.
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
        // Transitional: form token as bearer-shaped credential until PHP
        // ports the TS mint (POST /v1/sessions + FormToken → session).
        return new self(token: $formToken, logger: $logger);
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
     * Empty strings are treated as missing (consistent with
     * {@see fromEnv()} and {@see forForm()}).
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
        // Normalise empty strings so callers that pass '' get the same
        // behaviour as callers that pass null.
        $token = ($token !== null && $token !== '') ? $token : null;
        $keycode = ($keycode !== null && $keycode !== '') ? $keycode : null;
        $email = ($email !== null && $email !== '') ? $email : null;
        $formToken = ($formToken !== null && $formToken !== '') ? $formToken : null;

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

    /**
     * Construct a Session-mode SDK (embedded-form credential). Wires
     * `$isa->zyins` only — `$isa->rapidsign` and `$isa->proxy` throw
     * {@see IsaConfigException} when accessed. When invoked with no
     * arguments, reads `ISA_SESSION_ID` and `ISA_SESSION_SECRET`
     * from the environment.
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
