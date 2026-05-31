<?php

declare(strict_types=1);

/**
 * Codemod scaffold for the per-product → unified migration of the ISA
 * PHP SDK (sah/sdk-zyins, sah/sdk-rapidsign, sah/sdk-proxy,
 * isa-sdk/core-transport → sah/sdk v0.3.0).
 *
 * Usage from a consumer project:
 *
 *     composer require --dev rector/rector:^1.2
 *     vendor/bin/rector process --config vendor/sah/sdk/rector.php src tests
 *
 * Review every diff before committing — Rector renames are textual and
 * a stray comment containing an old namespace will also be rewritten.
 */

use Rector\Config\RectorConfig;
use Rector\Renaming\Rector\Name\RenameClassRector;

return static function (RectorConfig $rectorConfig): void {
    $rectorConfig->ruleWithConfiguration(RenameClassRector::class, [
        // Entry-point swap. Both old per-product clients still exist as
        // wired sub-clients on Isa, so callers that depend on the typed
        // class itself should keep importing them under the new namespace.
        'Sah\\IsaSdk\\ZyINS\\ZyInsClient'    => 'Isa\\Sdk\\Zyins\\ZyInsClient',
        'Sah\\IsaSdk\\Proxy\\ProxyClient'    => 'Isa\\Sdk\\Proxy\\ProxyClient',
        'Sah\\IsaSdk\\RapidSign\\RapidSignClient' => 'Isa\\Sdk\\RapidSign\\RapidSignClient',

        // ZyINS value objects and services (top-level + sub-namespaces).
        'Sah\\IsaSdk\\ZyINS\\Applicant'             => 'Isa\\Sdk\\Zyins\\Applicant',
        'Sah\\IsaSdk\\ZyINS\\Auth'                  => 'Isa\\Sdk\\Zyins\\Auth',
        'Sah\\IsaSdk\\ZyINS\\Condition'             => 'Isa\\Sdk\\Zyins\\Condition',
        'Sah\\IsaSdk\\ZyINS\\Coverage'              => 'Isa\\Sdk\\Zyins\\Coverage',
        'Sah\\IsaSdk\\ZyINS\\DecodedResponse'       => 'Isa\\Sdk\\Zyins\\DecodedResponse',
        'Sah\\IsaSdk\\ZyINS\\Height'                => 'Isa\\Sdk\\Zyins\\Height',
        'Sah\\IsaSdk\\ZyINS\\IdempotencyKeySource'  => 'Isa\\Sdk\\Zyins\\IdempotencyKeySource',
        'Sah\\IsaSdk\\ZyINS\\Medication'            => 'Isa\\Sdk\\Zyins\\Medication',
        'Sah\\IsaSdk\\ZyINS\\NicotineUsage'         => 'Isa\\Sdk\\Zyins\\NicotineUsage',
        'Sah\\IsaSdk\\ZyINS\\Product'               => 'Isa\\Sdk\\Zyins\\Product',
        'Sah\\IsaSdk\\ZyINS\\ProductType'           => 'Isa\\Sdk\\Zyins\\ProductType',
        'Sah\\IsaSdk\\ZyINS\\RawResponse'           => 'Isa\\Sdk\\Zyins\\RawResponse',
        'Sah\\IsaSdk\\ZyINS\\RequestOptions'        => 'Isa\\Sdk\\Zyins\\RequestOptions',
        'Sah\\IsaSdk\\ZyINS\\Sex'                   => 'Isa\\Sdk\\Zyins\\Sex',
        'Sah\\IsaSdk\\ZyINS\\Transport'             => 'Isa\\Sdk\\Zyins\\Transport',
        'Sah\\IsaSdk\\ZyINS\\Uuid4IdempotencyKeySource' => 'Isa\\Sdk\\Zyins\\Uuid4IdempotencyKeySource',
        'Sah\\IsaSdk\\ZyINS\\Weight'                => 'Isa\\Sdk\\Zyins\\Weight',

        // ZyINS sub-namespaces — exception funnel.
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaAuthException'                  => 'Isa\\Sdk\\Zyins\\Exception\\IsaAuthException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaConfigException'                => 'Isa\\Sdk\\Zyins\\Exception\\IsaConfigException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaException'                      => 'Isa\\Sdk\\Zyins\\Exception\\IsaException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaIdempotencyConflictException'   => 'Isa\\Sdk\\Zyins\\Exception\\IsaIdempotencyConflictException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaLicenseException'               => 'Isa\\Sdk\\Zyins\\Exception\\IsaLicenseException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaRateLimitException'             => 'Isa\\Sdk\\Zyins\\Exception\\IsaRateLimitException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaValidationException'            => 'Isa\\Sdk\\Zyins\\Exception\\IsaValidationException',

        // ZyINS Pagination / Prequalify / Quote / etc.
        'Sah\\IsaSdk\\ZyINS\\Pagination\\CursorIterator'  => 'Isa\\Sdk\\Zyins\\Pagination\\CursorIterator',
        'Sah\\IsaSdk\\ZyINS\\Pagination\\CursorPage'      => 'Isa\\Sdk\\Zyins\\Pagination\\CursorPage',
        'Sah\\IsaSdk\\ZyINS\\Pagination\\FirstPage'       => 'Isa\\Sdk\\Zyins\\Pagination\\FirstPage',
        'Sah\\IsaSdk\\ZyINS\\Pagination\\ListOptions'     => 'Isa\\Sdk\\Zyins\\Pagination\\ListOptions',
        'Sah\\IsaSdk\\ZyINS\\Prequalify\\Input'           => 'Isa\\Sdk\\Zyins\\Prequalify\\Input',
        'Sah\\IsaSdk\\ZyINS\\Prequalify\\Plan'            => 'Isa\\Sdk\\Zyins\\Prequalify\\Plan',
        'Sah\\IsaSdk\\ZyINS\\Prequalify\\Result'          => 'Isa\\Sdk\\Zyins\\Prequalify\\Result',
        'Sah\\IsaSdk\\ZyINS\\Prequalify\\Service'         => 'Isa\\Sdk\\Zyins\\Prequalify\\Service',
        'Sah\\IsaSdk\\ZyINS\\Quote\\Input'                => 'Isa\\Sdk\\Zyins\\Quote\\Input',
        'Sah\\IsaSdk\\ZyINS\\Quote\\Result'               => 'Isa\\Sdk\\Zyins\\Quote\\Result',
        'Sah\\IsaSdk\\ZyINS\\Quote\\Service'              => 'Isa\\Sdk\\Zyins\\Quote\\Service',
        'Sah\\IsaSdk\\ZyINS\\Datasets\\Service'           => 'Isa\\Sdk\\Zyins\\Datasets\\Service',
        'Sah\\IsaSdk\\ZyINS\\ReferenceData\\Service'      => 'Isa\\Sdk\\Zyins\\ReferenceData\\Service',
        'Sah\\IsaSdk\\ZyINS\\Usage\\Service'              => 'Isa\\Sdk\\Zyins\\Usage\\Service',
        'Sah\\IsaSdk\\ZyINS\\Logging\\DebugLogger'        => 'Isa\\Sdk\\Zyins\\Logging\\DebugLogger',

        // Proxy.
        'Sah\\IsaSdk\\Proxy\\Auth'                 => 'Isa\\Sdk\\Proxy\\Auth',
        'Sah\\IsaSdk\\Proxy\\Clock'                => 'Isa\\Sdk\\Proxy\\Clock',
        'Sah\\IsaSdk\\Proxy\\DecodedResponse'      => 'Isa\\Sdk\\Proxy\\DecodedResponse',
        'Sah\\IsaSdk\\Proxy\\IdempotencyKeySource' => 'Isa\\Sdk\\Proxy\\IdempotencyKeySource',
        'Sah\\IsaSdk\\Proxy\\RandomIdempotencyKeySource' => 'Isa\\Sdk\\Proxy\\RandomIdempotencyKeySource',
        'Sah\\IsaSdk\\Proxy\\RequestOptions'       => 'Isa\\Sdk\\Proxy\\RequestOptions',
        'Sah\\IsaSdk\\Proxy\\SystemClock'          => 'Isa\\Sdk\\Proxy\\SystemClock',
        'Sah\\IsaSdk\\Proxy\\Transport'            => 'Isa\\Sdk\\Proxy\\Transport',
        'Sah\\IsaSdk\\Proxy\\Algosure\\AlgosureInput'  => 'Isa\\Sdk\\Proxy\\Algosure\\AlgosureInput',
        'Sah\\IsaSdk\\Proxy\\Algosure\\AlgosureSigner' => 'Isa\\Sdk\\Proxy\\Algosure\\AlgosureSigner',
        'Sah\\IsaSdk\\Proxy\\Call\\InvokeInput'    => 'Isa\\Sdk\\Proxy\\Call\\InvokeInput',
        'Sah\\IsaSdk\\Proxy\\Call\\InvokeResult'   => 'Isa\\Sdk\\Proxy\\Call\\InvokeResult',
        'Sah\\IsaSdk\\Proxy\\Call\\Service'        => 'Isa\\Sdk\\Proxy\\Call\\Service',
        'Sah\\IsaSdk\\Proxy\\Exception\\AlgosureException'          => 'Isa\\Sdk\\Proxy\\Exception\\AlgosureException',
        'Sah\\IsaSdk\\Proxy\\Exception\\IntegrationNotFoundException' => 'Isa\\Sdk\\Proxy\\Exception\\IntegrationNotFoundException',
        'Sah\\IsaSdk\\Proxy\\Exception\\IsaException'               => 'Isa\\Sdk\\Proxy\\Exception\\IsaException',
        'Sah\\IsaSdk\\Proxy\\Exception\\ProxyAuthException'         => 'Isa\\Sdk\\Proxy\\Exception\\ProxyAuthException',
        'Sah\\IsaSdk\\Proxy\\Exception\\ProxyException'             => 'Isa\\Sdk\\Proxy\\Exception\\ProxyException',
        'Sah\\IsaSdk\\Proxy\\Exception\\ProxyRateLimitException'    => 'Isa\\Sdk\\Proxy\\Exception\\ProxyRateLimitException',
        'Sah\\IsaSdk\\Proxy\\Exception\\ProxyValidationException'   => 'Isa\\Sdk\\Proxy\\Exception\\ProxyValidationException',

        // RapidSign.
        'Sah\\IsaSdk\\RapidSign\\Auth'             => 'Isa\\Sdk\\RapidSign\\Auth',
        'Sah\\IsaSdk\\RapidSign\\Clock'            => 'Isa\\Sdk\\RapidSign\\Clock',
        'Sah\\IsaSdk\\RapidSign\\Idempotency'      => 'Isa\\Sdk\\RapidSign\\Idempotency',
        'Sah\\IsaSdk\\RapidSign\\Sleeper'          => 'Isa\\Sdk\\RapidSign\\Sleeper',
        'Sah\\IsaSdk\\RapidSign\\SystemClock'      => 'Isa\\Sdk\\RapidSign\\SystemClock',
        'Sah\\IsaSdk\\RapidSign\\SystemSleeper'    => 'Isa\\Sdk\\RapidSign\\SystemSleeper',
        'Sah\\IsaSdk\\RapidSign\\Uuid4Idempotency' => 'Isa\\Sdk\\RapidSign\\Uuid4Idempotency',
        'Sah\\IsaSdk\\RapidSign\\Documents\\AwaitOpts'      => 'Isa\\Sdk\\RapidSign\\Documents\\AwaitOpts',
        'Sah\\IsaSdk\\RapidSign\\Documents\\CancelRequest'  => 'Isa\\Sdk\\RapidSign\\Documents\\CancelRequest',
        'Sah\\IsaSdk\\RapidSign\\Documents\\Envelope'       => 'Isa\\Sdk\\RapidSign\\Documents\\Envelope',
        'Sah\\IsaSdk\\RapidSign\\Documents\\EnvelopeStatus' => 'Isa\\Sdk\\RapidSign\\Documents\\EnvelopeStatus',
        'Sah\\IsaSdk\\RapidSign\\Documents\\PdfSource'      => 'Isa\\Sdk\\RapidSign\\Documents\\PdfSource',
        'Sah\\IsaSdk\\RapidSign\\Documents\\Recipient'      => 'Isa\\Sdk\\RapidSign\\Documents\\Recipient',
        'Sah\\IsaSdk\\RapidSign\\Documents\\SendRequest'    => 'Isa\\Sdk\\RapidSign\\Documents\\SendRequest',
        'Sah\\IsaSdk\\RapidSign\\Documents\\Service'        => 'Isa\\Sdk\\RapidSign\\Documents\\Service',
        'Sah\\IsaSdk\\RapidSign\\Documents\\Signature'      => 'Isa\\Sdk\\RapidSign\\Documents\\Signature',
        'Sah\\IsaSdk\\RapidSign\\Webhooks\\Service'         => 'Isa\\Sdk\\RapidSign\\Webhooks\\Service',
        'Sah\\IsaSdk\\RapidSign\\Webhooks\\WebhookEvent'    => 'Isa\\Sdk\\RapidSign\\Webhooks\\WebhookEvent',
        // RapidSign exception funnel — every legacy class lands under the new tree.
        'Sah\\IsaSdk\\RapidSign\\Exception\\BadGatewayException'        => 'Isa\\Sdk\\RapidSign\\Exception\\BadGatewayException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\ConflictException'          => 'Isa\\Sdk\\RapidSign\\Exception\\ConflictException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\DeadlineExceededException'  => 'Isa\\Sdk\\RapidSign\\Exception\\DeadlineExceededException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\ErrorFactory'               => 'Isa\\Sdk\\RapidSign\\Exception\\ErrorFactory',
        'Sah\\IsaSdk\\RapidSign\\Exception\\ForbiddenException'         => 'Isa\\Sdk\\RapidSign\\Exception\\ForbiddenException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\GatewayTimeoutException'    => 'Isa\\Sdk\\RapidSign\\Exception\\GatewayTimeoutException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\InternalErrorException'     => 'Isa\\Sdk\\RapidSign\\Exception\\InternalErrorException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\InvalidTokenException'      => 'Isa\\Sdk\\RapidSign\\Exception\\InvalidTokenException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\LicenseLockedException'     => 'Isa\\Sdk\\RapidSign\\Exception\\LicenseLockedException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\MethodNotAllowedException'  => 'Isa\\Sdk\\RapidSign\\Exception\\MethodNotAllowedException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\NotFoundException'          => 'Isa\\Sdk\\RapidSign\\Exception\\NotFoundException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\NotImplementedException'    => 'Isa\\Sdk\\RapidSign\\Exception\\NotImplementedException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\RapidSignException'         => 'Isa\\Sdk\\RapidSign\\Exception\\RapidSignException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\RateLimitedException'       => 'Isa\\Sdk\\RapidSign\\Exception\\RateLimitedException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\ServiceUnavailableException' => 'Isa\\Sdk\\RapidSign\\Exception\\ServiceUnavailableException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\TokenExpiredException'      => 'Isa\\Sdk\\RapidSign\\Exception\\TokenExpiredException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\UnauthorizedException'      => 'Isa\\Sdk\\RapidSign\\Exception\\UnauthorizedException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\UnknownException'           => 'Isa\\Sdk\\RapidSign\\Exception\\UnknownException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\ValidationException'        => 'Isa\\Sdk\\RapidSign\\Exception\\ValidationException',
        'Sah\\IsaSdk\\RapidSign\\Internal\\Duration'                    => 'Isa\\Sdk\\RapidSign\\Internal\\Duration',
        'Sah\\IsaSdk\\RapidSign\\Internal\\HttpTransport'               => 'Isa\\Sdk\\RapidSign\\Internal\\HttpTransport',

        // Core transport (was `isa-sdk/core-transport`).
        'Isa\\Sdk\\Core\\Transport\\BearerClient'       => 'Isa\\Sdk\\Core\\BearerClient',
        'Isa\\Sdk\\Core\\Transport\\Clock'              => 'Isa\\Sdk\\Core\\Clock',
        'Isa\\Sdk\\Core\\Transport\\Envelope'           => 'Isa\\Sdk\\Core\\Envelope',
        'Isa\\Sdk\\Core\\Transport\\ResponseExtractor'  => 'Isa\\Sdk\\Core\\ResponseExtractor',
        'Isa\\Sdk\\Core\\Transport\\RetryClient'        => 'Isa\\Sdk\\Core\\RetryClient',
        'Isa\\Sdk\\Core\\Transport\\Sleeper'            => 'Isa\\Sdk\\Core\\Sleeper',
        'Isa\\Sdk\\Core\\Transport\\StaticToken'        => 'Isa\\Sdk\\Core\\StaticToken',
        'Isa\\Sdk\\Core\\Transport\\SystemClock'        => 'Isa\\Sdk\\Core\\SystemClock',
        'Isa\\Sdk\\Core\\Transport\\SystemSleeper'      => 'Isa\\Sdk\\Core\\SystemSleeper',
        'Isa\\Sdk\\Core\\Transport\\TokenSource'        => 'Isa\\Sdk\\Core\\TokenSource',
    ]);

    $rectorConfig->paths([
        // Default: consumer projects should target their own src/ and tests/.
        getcwd() . '/src',
        getcwd() . '/tests',
    ]);
};
