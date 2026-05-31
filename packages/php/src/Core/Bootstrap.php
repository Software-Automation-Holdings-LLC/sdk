<?php

declare(strict_types=1);

namespace Isa\Sdk\Core;

/**
 * Embedded HMAC bootstrap signature for POST /v1/sessions.
 *
 * This class pins the byte-exact wire format documented at
 * api/guides/authentication-advanced.md#test-vector and reproduced in
 * tests/conformance/fixtures/auth-vector.json. The reference TypeScript
 * implementation lives at packages/ts/src/core/internal/auth/bootstrap.ts;
 * this file MUST reproduce the identical hex against the same inputs.
 *
 * Two-stage flow:
 *   1. Serialize the request body as JSON, keys in source order
 *      (keycode, email, deviceId), no whitespace, no trailing newline.
 *   2. Build the canonical signing string and HMAC-SHA256 it with the
 *      licenseKey as the key.
 *
 * Why a dedicated module: the bootstrap signature predates any session
 * (no sessionSecret exists yet), uses the licenseKey as HMAC key, and is
 * the only call where deviceId appears in the body. The steady-state
 * session-signing helper handles all other calls.
 */
final class Bootstrap
{
    private function __construct()
    {
        // Static helpers only.
    }

    /**
     * Build the byte-exact bootstrap signature.
     *
     * @param string $keycode    Per-seat keycode (e.g. SDV-HWH-WDD).
     * @param string $email      License-owner email (lowercased server-side).
     * @param string $licenseKey Long-lived license key. HMAC key only.
     * @param string $deviceId   Stable per-install device id.
     * @param string $method     Uppercase HTTP method (typically POST).
     * @param string $path       Request path with leading /v1/.
     * @param int    $timestamp  Unix seconds.
     *
     * @return BootstrapSignature Bundle of every intermediate stage so
     *                            conformance tests can assert each
     *                            independently.
     *
     * @throws \InvalidArgumentException When any required field is empty
     *                                   or the timestamp is not positive.
     */
    public static function build(
        string $keycode,
        string $email,
        string $licenseKey,
        string $deviceId,
        string $method,
        string $path,
        int $timestamp,
    ): BootstrapSignature {
        if ($keycode === '') {
            throw new \InvalidArgumentException('bootstrap signature: keycode is required');
        }
        if ($email === '') {
            throw new \InvalidArgumentException('bootstrap signature: email is required');
        }
        if ($licenseKey === '') {
            throw new \InvalidArgumentException('bootstrap signature: licenseKey is required');
        }
        if ($deviceId === '') {
            throw new \InvalidArgumentException('bootstrap signature: deviceId is required');
        }
        if ($method === '') {
            throw new \InvalidArgumentException('bootstrap signature: method is required');
        }
        if ($path === '') {
            throw new \InvalidArgumentException('bootstrap signature: path is required');
        }
        if ($timestamp <= 0) {
            throw new \InvalidArgumentException('bootstrap signature: timestamp is required');
        }

        $serializedBody = self::serializeBody($keycode, $email, $deviceId);
        $canonical = $timestamp . '.' . strtoupper($method) . ' ' . $path . '.' . $serializedBody;
        $hex = hash_hmac('sha256', $canonical, $licenseKey);

        return new BootstrapSignature(
            serializedBody: $serializedBody,
            canonical: $canonical,
            hex: $hex,
            header: 'ISA-Signature: t=' . $timestamp . ',v1=' . $hex,
        );
    }

    /**
     * Serialize the bootstrap body with pinned key order, no whitespace.
     *
     * PHP arrays in PHP 8 preserve insertion order, so a literal array
     * with the keys in source order is sufficient. Flags
     * JSON_UNESCAPED_SLASHES + JSON_UNESCAPED_UNICODE match the
     * TypeScript JSON.stringify output byte-for-byte.
     */
    private static function serializeBody(string $keycode, string $email, string $deviceId): string
    {
        $encoded = json_encode(
            ['keycode' => $keycode, 'email' => $email, 'deviceId' => $deviceId],
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR,
        );

        // json_encode never returns false when JSON_THROW_ON_ERROR is set,
        // but the type-checker still asks. PHPStan-safe narrow:
        return $encoded;
    }
}
