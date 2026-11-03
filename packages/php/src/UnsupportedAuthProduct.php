<?php

declare(strict_types=1);

namespace Isa\Sdk;

use Isa\Sdk\Zyins\Exception\IsaConfigException;

/**
 * Placeholder for product namespaces that require Bearer credentials.
 *
 * RapidSign and Proxy speak only `Authorization: Bearer isa_*` on the
 * SDK boundary. License and Session modes are valid for ZyINS only.
 */
final class UnsupportedAuthProduct
{
    /**
     * Create a guard for a product namespace unavailable to the credential.
     */
    public function __construct(
        private readonly string $product,
        private readonly string $scheme,
    ) {
    }

    /**
     * @param array<int, mixed> $args
     */
    public function __call(string $name, array $args): never
    {
        $this->fail($name);
    }

    /**
     * Reject property access with a configuration error.
     */
    public function __get(string $name): never
    {
        $this->fail($name);
    }

    /**
     * Reject presence checks with the same explicit configuration error.
     */
    public function __isset(string $name): bool
    {
        $this->fail($name);
    }

    /**
     * @internal Test and runtime guard entry point for nested property access.
     */
    public function access(string $member): never
    {
        $this->fail($member);
    }

    /**
     * Report the supported credential mode for the requested namespace.
     */
    private function fail(string $member): never
    {
        throw new IsaConfigException(
            sprintf(
                'Isa::%s->%s requires Isa::withBearer(). %s credentials apply to $isa->zyins only; '
                . 'RapidSign and Proxy accept Bearer isa_* tokens.',
                $this->product,
                $member,
                $this->scheme,
            ),
        );
    }
}
