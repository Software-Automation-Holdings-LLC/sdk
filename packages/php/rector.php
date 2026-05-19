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
        'Sah\\IsaSdk\\ZyINS\\ZyInsClient'    => 'Sah\\Sdk\\Zyins\\ZyInsClient',
        'Sah\\IsaSdk\\Proxy\\ProxyClient'    => 'Sah\\Sdk\\Proxy\\ProxyClient',
        'Sah\\IsaSdk\\RapidSign\\RapidSignClient' => 'Sah\\Sdk\\RapidSign\\RapidSignClient',

        // ZyINS value objects and services (top-level + sub-namespaces).
        'Sah\\IsaSdk\\ZyINS\\Applicant'             => 'Sah\\Sdk\\Zyins\\Applicant',
        'Sah\\IsaSdk\\ZyINS\\Auth'                  => 'Sah\\Sdk\\Zyins\\Auth',
        'Sah\\IsaSdk\\ZyINS\\Condition'             => 'Sah\\Sdk\\Zyins\\Condition',
        'Sah\\IsaSdk\\ZyINS\\Coverage'              => 'Sah\\Sdk\\Zyins\\Coverage',
        'Sah\\IsaSdk\\ZyINS\\DecodedResponse'       => 'Sah\\Sdk\\Zyins\\DecodedResponse',
        'Sah\\IsaSdk\\ZyINS\\Height'                => 'Sah\\Sdk\\Zyins\\Height',
        'Sah\\IsaSdk\\ZyINS\\IdempotencyKeySource'  => 'Sah\\Sdk\\Zyins\\IdempotencyKeySource',
        'Sah\\IsaSdk\\ZyINS\\Medication'            => 'Sah\\Sdk\\Zyins\\Medication',
        'Sah\\IsaSdk\\ZyINS\\NicotineUsage'         => 'Sah\\Sdk\\Zyins\\NicotineUsage',
        'Sah\\IsaSdk\\ZyINS\\Product'               => 'Sah\\Sdk\\Zyins\\Product',
        'Sah\\IsaSdk\\ZyINS\\ProductType'           => 'Sah\\Sdk\\Zyins\\ProductType',
        'Sah\\IsaSdk\\ZyINS\\RawResponse'           => 'Sah\\Sdk\\Zyins\\RawResponse',
        'Sah\\IsaSdk\\ZyINS\\RequestOptions'        => 'Sah\\Sdk\\Zyins\\RequestOptions',
        'Sah\\IsaSdk\\ZyINS\\Sex'                   => 'Sah\\Sdk\\Zyins\\Sex',
        'Sah\\IsaSdk\\ZyINS\\Transport'             => 'Sah\\Sdk\\Zyins\\Transport',
        'Sah\\IsaSdk\\ZyINS\\Uuid4IdempotencyKeySource' => 'Sah\\Sdk\\Zyins\\Uuid4IdempotencyKeySource',
        'Sah\\IsaSdk\\ZyINS\\Weight'                => 'Sah\\Sdk\\Zyins\\Weight',

        // ZyINS sub-namespaces — exception funnel.
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaAuthException'                  => 'Sah\\Sdk\\Zyins\\Exception\\IsaAuthException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaConfigException'                => 'Sah\\Sdk\\Zyins\\Exception\\IsaConfigException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaException'                      => 'Sah\\Sdk\\Zyins\\Exception\\IsaException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaIdempotencyConflictException'   => 'Sah\\Sdk\\Zyins\\Exception\\IsaIdempotencyConflictException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaLicenseException'               => 'Sah\\Sdk\\Zyins\\Exception\\IsaLicenseException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaRateLimitException'             => 'Sah\\Sdk\\Zyins\\Exception\\IsaRateLimitException',
        'Sah\\IsaSdk\\ZyINS\\Exception\\IsaValidationException'            => 'Sah\\Sdk\\Zyins\\Exception\\IsaValidationException',

        // ZyINS Pagination / Prequalify / Quote / etc.
        'Sah\\IsaSdk\\ZyINS\\Pagination\\CursorIterator'  => 'Sah\\Sdk\\Zyins\\Pagination\\CursorIterator',
        'Sah\\IsaSdk\\ZyINS\\Pagination\\CursorPage'      => 'Sah\\Sdk\\Zyins\\Pagination\\CursorPage',
        'Sah\\IsaSdk\\ZyINS\\Pagination\\FirstPage'       => 'Sah\\Sdk\\Zyins\\Pagination\\FirstPage',
        'Sah\\IsaSdk\\ZyINS\\Pagination\\ListOptions'     => 'Sah\\Sdk\\Zyins\\Pagination\\ListOptions',
        'Sah\\IsaSdk\\ZyINS\\Prequalify\\Input'           => 'Sah\\Sdk\\Zyins\\Prequalify\\Input',
        'Sah\\IsaSdk\\ZyINS\\Prequalify\\Plan'            => 'Sah\\Sdk\\Zyins\\Prequalify\\Plan',
        'Sah\\IsaSdk\\ZyINS\\Prequalify\\Result'          => 'Sah\\Sdk\\Zyins\\Prequalify\\Result',
        'Sah\\IsaSdk\\ZyINS\\Prequalify\\Service'         => 'Sah\\Sdk\\Zyins\\Prequalify\\Service',
        'Sah\\IsaSdk\\ZyINS\\Quote\\Input'                => 'Sah\\Sdk\\Zyins\\Quote\\Input',
        'Sah\\IsaSdk\\ZyINS\\Quote\\Result'               => 'Sah\\Sdk\\Zyins\\Quote\\Result',
        'Sah\\IsaSdk\\ZyINS\\Quote\\Service'              => 'Sah\\Sdk\\Zyins\\Quote\\Service',
        'Sah\\IsaSdk\\ZyINS\\Datasets\\Service'           => 'Sah\\Sdk\\Zyins\\Datasets\\Service',
        'Sah\\IsaSdk\\ZyINS\\ReferenceData\\Service'      => 'Sah\\Sdk\\Zyins\\ReferenceData\\Service',
        'Sah\\IsaSdk\\ZyINS\\Usage\\Service'              => 'Sah\\Sdk\\Zyins\\Usage\\Service',
        'Sah\\IsaSdk\\ZyINS\\Logging\\DebugLogger'        => 'Sah\\Sdk\\Zyins\\Logging\\DebugLogger',

        // Proxy.
        'Sah\\IsaSdk\\Proxy\\Auth'                 => 'Sah\\Sdk\\Proxy\\Auth',
        'Sah\\IsaSdk\\Proxy\\Clock'                => 'Sah\\Sdk\\Proxy\\Clock',
        'Sah\\IsaSdk\\Proxy\\DecodedResponse'      => 'Sah\\Sdk\\Proxy\\DecodedResponse',
        'Sah\\IsaSdk\\Proxy\\IdempotencyKeySource' => 'Sah\\Sdk\\Proxy\\IdempotencyKeySource',
        'Sah\\IsaSdk\\Proxy\\RandomIdempotencyKeySource' => 'Sah\\Sdk\\Proxy\\RandomIdempotencyKeySource',
        'Sah\\IsaSdk\\Proxy\\RequestOptions'       => 'Sah\\Sdk\\Proxy\\RequestOptions',
        'Sah\\IsaSdk\\Proxy\\SystemClock'          => 'Sah\\Sdk\\Proxy\\SystemClock',
        'Sah\\IsaSdk\\Proxy\\Transport'            => 'Sah\\Sdk\\Proxy\\Transport',
        'Sah\\IsaSdk\\Proxy\\Algosure\\AlgosureInput'  => 'Sah\\Sdk\\Proxy\\Algosure\\AlgosureInput',
        'Sah\\IsaSdk\\Proxy\\Algosure\\AlgosureSigner' => 'Sah\\Sdk\\Proxy\\Algosure\\AlgosureSigner',
        'Sah\\IsaSdk\\Proxy\\Call\\InvokeInput'    => 'Sah\\Sdk\\Proxy\\Call\\InvokeInput',
        'Sah\\IsaSdk\\Proxy\\Call\\InvokeResult'   => 'Sah\\Sdk\\Proxy\\Call\\InvokeResult',
        'Sah\\IsaSdk\\Proxy\\Call\\Service'        => 'Sah\\Sdk\\Proxy\\Call\\Service',
        'Sah\\IsaSdk\\Proxy\\Exception\\AlgosureException'          => 'Sah\\Sdk\\Proxy\\Exception\\AlgosureException',
        'Sah\\IsaSdk\\Proxy\\Exception\\IntegrationNotFoundException' => 'Sah\\Sdk\\Proxy\\Exception\\IntegrationNotFoundException',
        'Sah\\IsaSdk\\Proxy\\Exception\\IsaException'               => 'Sah\\Sdk\\Proxy\\Exception\\IsaException',
        'Sah\\IsaSdk\\Proxy\\Exception\\ProxyAuthException'         => 'Sah\\Sdk\\Proxy\\Exception\\ProxyAuthException',
        'Sah\\IsaSdk\\Proxy\\Exception\\ProxyException'             => 'Sah\\Sdk\\Proxy\\Exception\\ProxyException',
        'Sah\\IsaSdk\\Proxy\\Exception\\ProxyRateLimitException'    => 'Sah\\Sdk\\Proxy\\Exception\\ProxyRateLimitException',
        'Sah\\IsaSdk\\Proxy\\Exception\\ProxyValidationException'   => 'Sah\\Sdk\\Proxy\\Exception\\ProxyValidationException',

        // RapidSign.
        'Sah\\IsaSdk\\RapidSign\\Auth'             => 'Sah\\Sdk\\RapidSign\\Auth',
        'Sah\\IsaSdk\\RapidSign\\Clock'            => 'Sah\\Sdk\\RapidSign\\Clock',
        'Sah\\IsaSdk\\RapidSign\\Idempotency'      => 'Sah\\Sdk\\RapidSign\\Idempotency',
        'Sah\\IsaSdk\\RapidSign\\Sleeper'          => 'Sah\\Sdk\\RapidSign\\Sleeper',
        'Sah\\IsaSdk\\RapidSign\\SystemClock'      => 'Sah\\Sdk\\RapidSign\\SystemClock',
        'Sah\\IsaSdk\\RapidSign\\SystemSleeper'    => 'Sah\\Sdk\\RapidSign\\SystemSleeper',
        'Sah\\IsaSdk\\RapidSign\\Uuid4Idempotency' => 'Sah\\Sdk\\RapidSign\\Uuid4Idempotency',
        'Sah\\IsaSdk\\RapidSign\\Documents\\AwaitOpts'      => 'Sah\\Sdk\\RapidSign\\Documents\\AwaitOpts',
        'Sah\\IsaSdk\\RapidSign\\Documents\\CancelRequest'  => 'Sah\\Sdk\\RapidSign\\Documents\\CancelRequest',
        'Sah\\IsaSdk\\RapidSign\\Documents\\Envelope'       => 'Sah\\Sdk\\RapidSign\\Documents\\Envelope',
        'Sah\\IsaSdk\\RapidSign\\Documents\\EnvelopeStatus' => 'Sah\\Sdk\\RapidSign\\Documents\\EnvelopeStatus',
        'Sah\\IsaSdk\\RapidSign\\Documents\\PdfSource'      => 'Sah\\Sdk\\RapidSign\\Documents\\PdfSource',
        'Sah\\IsaSdk\\RapidSign\\Documents\\Recipient'      => 'Sah\\Sdk\\RapidSign\\Documents\\Recipient',
        'Sah\\IsaSdk\\RapidSign\\Documents\\SendRequest'    => 'Sah\\Sdk\\RapidSign\\Documents\\SendRequest',
        'Sah\\IsaSdk\\RapidSign\\Documents\\Service'        => 'Sah\\Sdk\\RapidSign\\Documents\\Service',
        'Sah\\IsaSdk\\RapidSign\\Documents\\Signature'      => 'Sah\\Sdk\\RapidSign\\Documents\\Signature',
        'Sah\\IsaSdk\\RapidSign\\Webhooks\\Service'         => 'Sah\\Sdk\\RapidSign\\Webhooks\\Service',
        'Sah\\IsaSdk\\RapidSign\\Webhooks\\WebhookEvent'    => 'Sah\\Sdk\\RapidSign\\Webhooks\\WebhookEvent',
        // RapidSign exception funnel — every legacy class lands under the new tree.
        'Sah\\IsaSdk\\RapidSign\\Exception\\BadGatewayException'        => 'Sah\\Sdk\\RapidSign\\Exception\\BadGatewayException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\ConflictException'          => 'Sah\\Sdk\\RapidSign\\Exception\\ConflictException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\DeadlineExceededException'  => 'Sah\\Sdk\\RapidSign\\Exception\\DeadlineExceededException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\ErrorFactory'               => 'Sah\\Sdk\\RapidSign\\Exception\\ErrorFactory',
        'Sah\\IsaSdk\\RapidSign\\Exception\\ForbiddenException'         => 'Sah\\Sdk\\RapidSign\\Exception\\ForbiddenException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\GatewayTimeoutException'    => 'Sah\\Sdk\\RapidSign\\Exception\\GatewayTimeoutException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\InternalErrorException'     => 'Sah\\Sdk\\RapidSign\\Exception\\InternalErrorException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\InvalidTokenException'      => 'Sah\\Sdk\\RapidSign\\Exception\\InvalidTokenException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\LicenseLockedException'     => 'Sah\\Sdk\\RapidSign\\Exception\\LicenseLockedException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\MethodNotAllowedException'  => 'Sah\\Sdk\\RapidSign\\Exception\\MethodNotAllowedException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\NotFoundException'          => 'Sah\\Sdk\\RapidSign\\Exception\\NotFoundException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\NotImplementedException'    => 'Sah\\Sdk\\RapidSign\\Exception\\NotImplementedException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\RapidSignException'         => 'Sah\\Sdk\\RapidSign\\Exception\\RapidSignException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\RateLimitedException'       => 'Sah\\Sdk\\RapidSign\\Exception\\RateLimitedException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\ServiceUnavailableException' => 'Sah\\Sdk\\RapidSign\\Exception\\ServiceUnavailableException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\TokenExpiredException'      => 'Sah\\Sdk\\RapidSign\\Exception\\TokenExpiredException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\UnauthorizedException'      => 'Sah\\Sdk\\RapidSign\\Exception\\UnauthorizedException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\UnknownException'           => 'Sah\\Sdk\\RapidSign\\Exception\\UnknownException',
        'Sah\\IsaSdk\\RapidSign\\Exception\\ValidationException'        => 'Sah\\Sdk\\RapidSign\\Exception\\ValidationException',
        'Sah\\IsaSdk\\RapidSign\\Internal\\Duration'                    => 'Sah\\Sdk\\RapidSign\\Internal\\Duration',
        'Sah\\IsaSdk\\RapidSign\\Internal\\HttpTransport'               => 'Sah\\Sdk\\RapidSign\\Internal\\HttpTransport',

        // Core transport (was `isa-sdk/core-transport`).
        'Sah\\Sdk\\Core\\Transport\\BearerClient'       => 'Sah\\Sdk\\Core\\BearerClient',
        'Sah\\Sdk\\Core\\Transport\\Clock'              => 'Sah\\Sdk\\Core\\Clock',
        'Sah\\Sdk\\Core\\Transport\\Envelope'           => 'Sah\\Sdk\\Core\\Envelope',
        'Sah\\Sdk\\Core\\Transport\\ResponseExtractor'  => 'Sah\\Sdk\\Core\\ResponseExtractor',
        'Sah\\Sdk\\Core\\Transport\\RetryClient'        => 'Sah\\Sdk\\Core\\RetryClient',
        'Sah\\Sdk\\Core\\Transport\\Sleeper'            => 'Sah\\Sdk\\Core\\Sleeper',
        'Sah\\Sdk\\Core\\Transport\\StaticToken'        => 'Sah\\Sdk\\Core\\StaticToken',
        'Sah\\Sdk\\Core\\Transport\\SystemClock'        => 'Sah\\Sdk\\Core\\SystemClock',
        'Sah\\Sdk\\Core\\Transport\\SystemSleeper'      => 'Sah\\Sdk\\Core\\SystemSleeper',
        'Sah\\Sdk\\Core\\Transport\\TokenSource'        => 'Sah\\Sdk\\Core\\TokenSource',
    ]);

    $rectorConfig->paths([
        // Default: consumer projects should target their own src/ and tests/.
        getcwd() . '/src',
        getcwd() . '/tests',
    ]);
};
