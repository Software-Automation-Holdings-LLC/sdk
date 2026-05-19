<?php

declare(strict_types=1);

namespace Sah\Sdk;

use Psr\Log\LoggerInterface;
use Sah\Sdk\Proxy\ProxyClient;
use Sah\Sdk\RapidSign\RapidSignClient;
use Sah\Sdk\Zyins\Auth as ZyinsAuth;
use Sah\Sdk\Zyins\Exception\IsaConfigException;
use Sah\Sdk\Zyins\ZyInsClient;

/**
 * Unified entry point for the ISA Platform SDK.
 *
 * One client per process. Three bootstrap factories cover the runtime
 * audiences described in the SDK Design (§3.2):
 *
 *  - {@see Isa::withBearer()}  — server-to-server, Stripe-issued `isa_*` token.
 *  - {@see Isa::withLicense()} — agent tools (BPP web, BPP desktop, BPP online).
 *  - {@see Isa::withSession()} — embedded forms (eApp signer page, third-party hosts).
 *
 * Each factory reads sensible defaults from the environment when invoked
 * with no arguments — see the factory docblock for the exact variable names.
 *
 *     $isa = Isa::withBearer();                       // reads ISA_TOKEN
 *     $result = $isa->zyins->prequalify->run($input);
 *     $envelope = $isa->rapidsign->documents->send($req);
 *     $resp = $isa->proxy->call->invoke($uuid, $invokeInput);
 *
 * Product namespaces are wired lazily at construction; all share the same
 * authentication credential and base URL.
 */
final readonly class Isa
{
    /**
     * Product namespace: ZyINS underwriting and quoting.
     *
     * Access services via the public properties on {@see ZyInsClient}
     * (`prequalify`, `quote`, `datasets`, `referenceData`, `usage`).
     */
    public ZyInsClient $zyins;

    /**
     * Product namespace: RapidSign envelope and document workflows.
     *
     * Access services via the public properties on {@see RapidSignClient}
     * (`documents`, `webhooks`).
     */
    public RapidSignClient $rapidsign;

    /**
     * Product namespace: ISA Platform `/v1/call` proxy (Algosure HMAC).
     *
     * Access services via the public properties on {@see ProxyClient}
     * (`call`, `algosure`).
     */
    public ProxyClient $proxy;

    /**
     * Private constructor — every public path is one of the three named
     * factories so callers cannot accidentally bypass credential resolution.
     */
    private function __construct(
        string|ZyinsAuth $token,
        ?LoggerInterface $logger,
    ) {
        // RapidSign and Proxy clients consume the raw bearer string for
        // their Authorization header; ZyINS owns the polymorphic Auth
        // value object so license/session schemes propagate through it.
        $bearer = $token instanceof ZyinsAuth ? $token->token : $token;
        $this->zyins = new ZyInsClient(token: $token, logger: $logger);
        $this->rapidsign = new RapidSignClient(token: $bearer);
        $this->proxy = new ProxyClient(token: $bearer);
    }

    /**
     * Construct a Bearer-mode SDK. When no token is provided, reads
     * `ISA_TOKEN` from the process environment.
     *
     * @param string|null          $token  Optional bearer token; env is consulted when null.
     * @param LoggerInterface|null $logger Optional PSR-3 logger. Defaults to stderr at `ISA_LOG=debug`.
     *
     * @throws IsaConfigException When neither argument nor env supplies a token.
     *
     * @example
     * // Reads ISA_TOKEN from the environment:
     * $isa = Isa::withBearer();
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
     * Construct a License-mode SDK (agent-tool credential). When invoked
     * with no arguments, reads `ISA_LICENSE_KEYCODE` and
     * `ISA_LICENSE_EMAIL` from the environment.
     *
     * @param string|null          $keycode License keycode; env is consulted when null.
     * @param string|null          $email   License email; env is consulted when null.
     * @param LoggerInterface|null $logger  Optional PSR-3 logger.
     *
     * @throws IsaConfigException When either credential is missing.
     *
     * @example
     * $isa = Isa::withLicense('ABC-123-XYZ', 'agent@example.com');
     */
    public static function withLicense(
        ?string $keycode = null,
        ?string $email = null,
        ?LoggerInterface $logger = null,
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
        return new self(token: ZyinsAuth::license($resolvedKey, $resolvedEmail), logger: $logger);
    }

    /**
     * Construct a Session-mode SDK (embedded-form credential). When
     * invoked with no arguments, reads `ISA_SESSION_ID` and
     * `ISA_SESSION_SECRET` from the environment.
     *
     * @param string|null          $sessionId     Session id; env is consulted when null.
     * @param string|null          $sessionSecret Session signing secret; env is consulted when null.
     * @param LoggerInterface|null $logger        Optional PSR-3 logger.
     *
     * @throws IsaConfigException When either credential is missing.
     *
     * @example
     * // Reads ISA_SESSION_ID and ISA_SESSION_SECRET from the environment:
     * $isa = Isa::withSession();
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

    private static function env(string $name): ?string
    {
        $value = getenv($name);
        if (! is_string($value) || $value === '') {
            return null;
        }
        return $value;
    }
}
