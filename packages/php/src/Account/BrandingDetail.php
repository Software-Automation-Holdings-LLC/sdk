<?php

declare(strict_types=1);

namespace Sah\Sdk\Account;

/**
 * Canonical branding resource carried inside a BaseResponse `data`
 * field. Mirrors the proto `BrandingDetail` from
 * `shared/schemas/api/account/v1/branding.proto`.
 */
final readonly class BrandingDetail
{
    public function __construct(
        public string $imoName,
        public string $imoLogo,
        public mixed $productRestrictions,
        public string $navColor,
        public string $mainColor,
        public string $buttonColor,
        public string $activeButtonColor,
        public string $bgColor,
        public string $headerTextColor,
        public bool $hideAffiliateLeads,
        public bool $preventProductSelection,
        public string $defaultSettings,
    ) {
    }

    /**
     * @param mixed $raw
     */
    public static function fromWire(mixed $raw): self
    {
        $r = is_array($raw) ? $raw : [];
        /** @var array<string,mixed> $r */
        return new self(
            imoName: self::str($r, 'imo_name'),
            imoLogo: self::str($r, 'imo_logo'),
            productRestrictions: $r['product_restrictions'] ?? null,
            navColor: self::str($r, 'nav_color'),
            mainColor: self::str($r, 'main_color'),
            buttonColor: self::str($r, 'button_color'),
            activeButtonColor: self::str($r, 'active_button_color'),
            bgColor: self::str($r, 'bg_color'),
            headerTextColor: self::str($r, 'header_text_color'),
            hideAffiliateLeads: self::bool($r, 'hide_affiliate_leads'),
            preventProductSelection: self::bool($r, 'prevent_product_selection'),
            defaultSettings: self::str($r, 'default_settings'),
        );
    }

    /** @param array<string,mixed> $r */
    private static function str(array $r, string $key): string
    {
        $v = $r[$key] ?? null;
        return is_string($v) ? $v : '';
    }

    /** @param array<string,mixed> $r */
    private static function bool(array $r, string $key): bool
    {
        $v = $r[$key] ?? null;
        return is_bool($v) ? $v : false;
    }
}
