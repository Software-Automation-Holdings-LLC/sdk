<?php

declare(strict_types=1);

namespace Sah\Sdk\Zyins\Branding;

/**
 * Whitelabel branding detail returned by {@see Service::lookup()}.
 *
 * Zero values are returned when no row exists for the caller's license
 * (server intentionally does not 404). The boolean flags accept both
 * native JSON booleans and the legacy "true"/"1" string encodings the
 * handler has shipped over time; the SDK normalizes to native booleans.
 */
final readonly class BrandingDetail
{
    public function __construct(
        public string $imoName = '',
        public string $imoLogo = '',
        public string $navColor = '',
        public string $mainColor = '',
        public string $buttonColor = '',
        public string $activeButtonColor = '',
        public string $bgColor = '',
        public string $headerTextColor = '',
        public bool $hideAffiliateLeads = false,
        public bool $preventProductSelection = false,
        public string $defaultSettings = '',
    ) {
    }

    /**
     * @param array<string,mixed> $data
     */
    public static function fromWire(array $data): self
    {
        return new self(
            imoName: self::asString($data, 'imo_name'),
            imoLogo: self::asString($data, 'imo_logo'),
            navColor: self::asString($data, 'nav_color'),
            mainColor: self::asString($data, 'main_color'),
            buttonColor: self::asString($data, 'button_color'),
            activeButtonColor: self::asString($data, 'active_button_color'),
            bgColor: self::asString($data, 'bg_color'),
            headerTextColor: self::asString($data, 'header_text_color'),
            hideAffiliateLeads: self::asBool($data, 'hide_affiliate_leads'),
            preventProductSelection: self::asBool($data, 'prevent_product_selection'),
            defaultSettings: self::asString($data, 'default_settings'),
        );
    }

    /**
     * @param array<string,mixed> $data
     */
    private static function asString(array $data, string $key): string
    {
        $v = $data[$key] ?? '';
        return is_string($v) ? $v : '';
    }

    /**
     * @param array<string,mixed> $data
     */
    private static function asBool(array $data, string $key): bool
    {
        $v = $data[$key] ?? false;
        if (is_bool($v)) {
            return $v;
        }
        if (is_string($v)) {
            return $v === 'true' || $v === '1';
        }
        return false;
    }
}
