/**
 * Display-safe rendering for {@link OfferMoney}.
 *
 * `OfferMoney` is a plain data interface (integer minor units + a server-
 * formatted `display` string), so it cannot carry methods. Rendering the
 * raw object in JSX throws React error #31 ("objects are not valid as a
 * React child"), and reaching for `String(money)` yields `[object Object]`.
 *
 * {@link formatMoney} is the supported way to turn an `OfferMoney` into a
 * human string. It prefers the server-provided `display` (already localized
 * and currency-correct for the offer) and falls back to `Intl.NumberFormat`
 * over the integer `cents` when no display string is present or the caller
 * overrides locale/currency.
 *
 * Rendering the raw `OfferMoney` object is unsupported; always pass it
 * through `formatMoney`.
 */
import { type OfferMoney } from "./prequalify-v2-types.js";
/** Options controlling {@link formatMoney} rendering. */
export interface FormatMoneyOptions {
    /**
     * BCP 47 locale tag for number/currency formatting. Defaults to
     * `'en-US'`. Ignored when the server `display` string is used (pass
     * {@link FormatMoneyOptions.preferComputed} to force `Intl` formatting).
     */
    locale?: string;
    /**
     * ISO 4217 currency code. Defaults to `'USD'`. Drives the currency symbol
     * and minor-unit conversion under `Intl.NumberFormat`.
     */
    currency?: string;
    /**
     * How the currency is displayed: `'symbol'` (`$1,234.56`), `'code'`
     * (`USD 1,234.56`), `'name'` (`1,234.56 US dollars`), or `'narrowSymbol'`.
     * Defaults to `'symbol'`.
     */
    currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name";
    /**
     * When `true`, ignore the server-provided `display` string and always
     * compute the rendering from the integer `cents` via `Intl.NumberFormat`.
     * Use this when you need a locale/currency that differs from the server's.
     * Defaults to `false`.
     */
    preferComputed?: boolean;
}
/**
 * Render an {@link OfferMoney} as a human-readable currency string.
 *
 * Resolution order:
 * 1. Unless `preferComputed` is set, return the server `display` string when
 *    it is non-empty — it is already localized for the offer.
 * 2. Otherwise format the integer `cents` with `Intl.NumberFormat`.
 *
 * Never returns `[object Object]`; safe to drop directly into JSX.
 *
 * @example
 * ```tsx
 * // Server gave us a display string — used verbatim.
 * formatMoney({ cents: 123456, display: '$1,234.56' }); // "$1,234.56"
 *
 * // No display string — computed from cents (default en-US / USD).
 * formatMoney({ cents: 123456, display: '' });          // "$1,234.56"
 *
 * // Explicit locale + currency override.
 * formatMoney({ cents: 123456, display: '' }, { locale: 'de-DE', currency: 'EUR' });
 * // "1.234,56 €"
 *
 * // In JSX — no React #31 crash:
 * <span>{formatMoney(offer.premium)}</span>
 * ```
 */
export declare function formatMoney(money: OfferMoney, opts?: FormatMoneyOptions): string;
//# sourceMappingURL=money.d.ts.map