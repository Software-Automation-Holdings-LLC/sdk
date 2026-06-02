<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

use InvalidArgumentException;

/**
 * Zero-knowledge case share-link assembly + parsing, byte-compatible with the
 * TypeScript SDK's `account/caseWire.ts`. The link is the capability: it
 * carries the case code in the path and the decryption key in the `#k=`
 * fragment. These helpers never log it.
 */
final readonly class CaseLink
{
    /**
     * Default share-link viewer origin. The SDK appends `/<code>#k=<key>`; the
     * base omits any path segment so a deployment can point it at any host
     * without re-encoding the path shape.
     */
    public const string DEFAULT_VIEWER_BASE_URL = 'https://link.isaapi.com';

    /** Delimits the path from the fragment key in a share link. */
    private const string FRAGMENT_KEY_PREFIX = '#k=';

    /**
     * Build `{base}/<code>#k=<keyFragment>`, stripping a trailing slash on the
     * viewer base. The code is the only path segment added; any product prefix
     * rides inside the configured base URL.
     */
    public static function assemble(string $viewerBaseUrl, string $code, string $keyFragment): string
    {
        $base = rtrim($viewerBaseUrl, '/');
        return $base . '/' . rawurlencode($code) . self::FRAGMENT_KEY_PREFIX . $keyFragment;
    }

    /**
     * Parse a share link into its case code and fragment key. Accepts both the
     * current single-segment shape (`{base}/<code>#k=<key>`) and the legacy
     * `{base}/c/<id>#k=<key>` shape, so links shared before the format change
     * keep opening. The code is the last non-empty path segment.
     */
    public static function parse(string $link): ParsedLink
    {
        if ($link === '') {
            throw new InvalidArgumentException('account: cases.open requires a non-empty link');
        }
        $hashAt = strpos($link, self::FRAGMENT_KEY_PREFIX);
        if ($hashAt === false) {
            throw new InvalidArgumentException('account: cases.open link is missing its #k= fragment key');
        }
        $keyFragment = substr($link, $hashAt + strlen(self::FRAGMENT_KEY_PREFIX));
        if ($keyFragment === '') {
            throw new InvalidArgumentException('account: cases.open link has an empty #k= fragment key');
        }
        $code = self::lastPathSegment(substr($link, 0, $hashAt));
        if ($code === '') {
            throw new InvalidArgumentException('account: cases.open link must carry a case id before #k=<key>');
        }
        return new ParsedLink(code: rawurldecode($code), keyFragment: $keyFragment);
    }

    /** Return the final non-empty `/`-delimited segment of `$path`. */
    private static function lastPathSegment(string $path): string
    {
        $segments = explode('/', $path);
        for ($i = count($segments) - 1; $i >= 0; $i--) {
            if ($segments[$i] !== '') {
                return $segments[$i];
            }
        }
        return '';
    }
}
