<?php

declare(strict_types=1);

namespace Isa\Sdk\Account;

/**
 * `$isa->account->branding` — whitelabel branding lookup + upsert.
 *
 * Wire shapes mirror `shared/schemas/api/account/v1/branding.proto`:
 *   - POST /v1/branding/lookup  (BrandingLookupRequest → BrandingResponse)
 *   - POST /v1/branding/set     (SetBrandingRequest    → BrandingResponse)
 *
 * Every response is wrapped in the standard BaseResponse envelope.
 *
 * @example
 *   $env = $isa->account->branding->lookup(['keycode' => 'ABC-123-XYZ']);
 *   echo $env->data->imoName;
 */
final readonly class BrandingClient
{
    public function __construct(private Http $http)
    {
    }

    /**
     * Read the branding row for a license.
     *
     * @param array{email?:string,keycode?:string,orderid?:string} $request
     * @return BaseResponse
     */
    public function lookup(array $request = []): BaseResponse
    {
        /** @var BaseResponse $env */
        $env = $this->http->postEnvelope('/v1/branding/lookup', $this->serializeLookup($request));
        return new BaseResponse(
            object: $env->object,
            livemode: $env->livemode,
            requestId: $env->requestId,
            idempotencyKey: $env->idempotencyKey,
            data: BrandingDetail::fromWire($env->data),
        );
    }

    /**
     * Upsert the branding row for a license. Omitted fields are stored
     * as empty.
     *
     * @param array{
     *   email?:string, keycode?:string, orderid?:string,
     *   imoName?:string, imoLogo?:string, productRestrictions?:mixed,
     *   navColor?:string, mainColor?:string, buttonColor?:string,
     *   activeButtonColor?:string, bgColor?:string, headerTextColor?:string,
     *   hideAffiliateLeads?:bool, preventProductSelection?:bool,
     *   defaultSettings?:string
     * } $request
     * @return BaseResponse
     */
    public function set(array $request): BaseResponse
    {
        /** @var BaseResponse $env */
        $env = $this->http->postEnvelope('/v1/branding/set', $this->serializeSet($request));
        return new BaseResponse(
            object: $env->object,
            livemode: $env->livemode,
            requestId: $env->requestId,
            idempotencyKey: $env->idempotencyKey,
            data: BrandingDetail::fromWire($env->data),
        );
    }

    /**
     * @param array<string,mixed> $r
     * @return array<string,mixed>
     */
    private function serializeLookup(array $r): array
    {
        $out = [];
        foreach (['email', 'keycode', 'orderid'] as $k) {
            if (isset($r[$k])) {
                $out[$k] = $r[$k];
            }
        }
        return $out;
    }

    /**
     * @param array<string,mixed> $r
     * @return array<string,mixed>
     */
    private function serializeSet(array $r): array
    {
        $out = $this->serializeLookup($r);
        $map = [
            'imoName' => 'imo_name',
            'imoLogo' => 'imo_logo',
            'productRestrictions' => 'product_restrictions',
            'navColor' => 'nav_color',
            'mainColor' => 'main_color',
            'buttonColor' => 'button_color',
            'activeButtonColor' => 'active_button_color',
            'bgColor' => 'bg_color',
            'headerTextColor' => 'header_text_color',
            'hideAffiliateLeads' => 'hide_affiliate_leads',
            'preventProductSelection' => 'prevent_product_selection',
            'defaultSettings' => 'default_settings',
        ];
        foreach ($map as $camel => $wire) {
            if (array_key_exists($camel, $r)) {
                $out[$wire] = $r[$camel];
            }
        }
        return $out;
    }
}
