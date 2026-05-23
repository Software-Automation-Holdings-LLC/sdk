<?php

declare(strict_types=1);

namespace Sah\Sdk\Core;

/**
 * Output bundle of the embedded HMAC bootstrap signing flow.
 *
 * Returns every intermediate so conformance tests can assert each stage
 * independently — if a future regression flips serializedBody, the
 * failure points at exactly that stage instead of just "hex differs".
 *
 * @internal Pinned by tests/conformance/fixtures/auth-vector.json.
 */
final class BootstrapSignature
{
    public function __construct(
        /** JSON body exactly as sent on the wire. Bytes signed verbatim. */
        public readonly string $serializedBody,
        /** `<ts>.<METHOD> <path>.<body>` — the HMAC input. */
        public readonly string $canonical,
        /** Lowercase hex HMAC-SHA256 over canonical, keyed by licenseKey. */
        public readonly string $hex,
        /** `ISA-Signature: t=<ts>,v1=<hex>` — ready-to-set header value. */
        public readonly string $header,
    ) {
    }
}
