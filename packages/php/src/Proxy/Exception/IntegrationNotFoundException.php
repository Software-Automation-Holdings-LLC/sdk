<?php

declare(strict_types=1);

namespace Isa\Sdk\Proxy\Exception;

/**
 * 404 from `/v1/call`: the integration UUID is unknown to the proxy
 * or is not visible to the calling token's scope. Re-register the
 * integration or use a token with the correct scope.
 */
final class IntegrationNotFoundException extends ProxyException
{
}
