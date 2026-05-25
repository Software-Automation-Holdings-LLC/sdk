/**
 * Plan.pricing resolver — `ResolvedPricing` conformance.
 *
 * Locks the contract that `coercePlan` extracts the canonical price from the
 * server's nested `pricing[rate_class][mode]` table. Carrier-specific mode
 * and rate-class keys (`MONTHLY-EFT`, `super-preferred`, `graded`, etc.)
 * MUST pass through verbatim — never lowercased, aliased, or remapped.
 *
 * Each test feeds a server response through the public `prequalify` API and
 * asserts the resulting `Plan.pricing` shape, so the resolver is exercised
 * through the same path real consumers traverse.
 */

import { describe, expect, it } from 'vitest';
import { ZyInsClient } from '../../src/zyins/client';
import type { Transport } from '../../src/zyins/transport';
import { TEST_APPLICANT, TEST_AUTH, TEST_COVERAGE, TEST_PRODUCTS, FIXED_CLOCK } from './fixtures';

interface PrequalifyServerPlan {
    brand: string;
    name: string;
    plan: string;
    plan_group: string | null;
    death_benefit: number;
    default_pricing_key: string;
    pricing: Record<string, Record<string, unknown>>;
    pricing_ranks?: Record<string, number | null> | null;
    id: string;
    index: number;
    is_excluded: boolean;
    logo_url: string;
    plan_info: Record<string, unknown>;
}

interface PrequalifyServerEnvelope {
    data: {
        meta: {
            amounts: string[];
            processing_time_ms: number;
            quote_type: string;
            total_products: number;
        };
        results: Record<string, PrequalifyServerPlan[]>;
    };
    request_id: string;
    idempotency_key: string;
}

const TEST_AMOUNT = 100_000;

function buildEnvelope(plan: PrequalifyServerPlan): PrequalifyServerEnvelope {
    return {
        data: {
            meta: {
                amounts: [String(TEST_AMOUNT)],
                processing_time_ms: 25,
                quote_type: 'face_amounts',
                total_products: 1,
            },
            results: {
                [String(TEST_AMOUNT)]: [plan],
            },
        },
        request_id: 'req_pricing_test',
        idempotency_key: 'idem_pricing_test',
    };
}

async function runPrequalify(plan: PrequalifyServerPlan) {
    const transport: Transport = async () => ({
        status: 200,
        body: JSON.stringify(buildEnvelope(plan)),
        headers: {},
    });
    const client = new ZyInsClient({
        auth: TEST_AUTH,
        baseUrl: 'https://test.example',
        transport,
        clock: FIXED_CLOCK,
    });
    const result = await client.prequalify({
        applicant: TEST_APPLICANT,
        coverage: TEST_COVERAGE,
        products: TEST_PRODUCTS,
    });
    return result.plans[0]!;
}

const SENIOR_LIFE_TERM_LIFE: PrequalifyServerPlan = {
    brand: 'Senior Life',
    name: 'Senior Life Term Life',
    plan: 'IMMEDIATE',
    plan_group: '20-year',
    death_benefit: 15_000,
    default_pricing_key: 'MONTHLY',
    pricing: {
        default: {
            ANNUAL: '$753.50',
            MONTHLY: '$64.05',
            'SEMI-ANNUAL': '$391.82',
        },
    },
    pricing_ranks: { default: null },
    id: 'term-senior-life-term-life',
    index: 0,
    is_excluded: false,
    logo_url: '',
    plan_info: {},
};

describe('Plan.pricing — canonical Senior Life fixture', () => {
    it('resolves cents/display/mode/rate_class from default class, MONTHLY mode', async () => {
        const plan = await runPrequalify(SENIOR_LIFE_TERM_LIFE);
        expect(plan.pricing.cents).toBe(6405);
        expect(plan.pricing.display).toBe('$64.05');
        expect(plan.pricing.mode).toBe('MONTHLY');
        expect(plan.pricing.rate_class).toBe('default');
    });

    it('exposes the full classes table with cents parsed for every mode', async () => {
        const plan = await runPrequalify(SENIOR_LIFE_TERM_LIFE);
        expect(plan.pricing.classes).toEqual({
            default: {
                ANNUAL: { cents: 75350, display: '$753.50' },
                MONTHLY: { cents: 6405, display: '$64.05' },
                'SEMI-ANNUAL': { cents: 39182, display: '$391.82' },
            },
        });
    });

    it('aliases `modes` to `classes[rate_class]` by reference (not a copy)', async () => {
        const plan = await runPrequalify(SENIOR_LIFE_TERM_LIFE);
        // Same-reference aliasing is part of the documented contract: callers
        // can rely on `pricing.modes[k] === pricing.classes[pricing.rate_class][k]`
        // without worrying about deep-copy drift.
        expect(plan.pricing.modes).toBe(plan.pricing.classes.default);
    });

    it('echoes pricing_ranks verbatim (null preserved)', async () => {
        const plan = await runPrequalify(SENIOR_LIFE_TERM_LIFE);
        expect(plan.pricingRanks).toEqual({ default: null });
    });

    it('keeps defaultPricingKey aligned with pricing.mode', async () => {
        const plan = await runPrequalify(SENIOR_LIFE_TERM_LIFE);
        expect(plan.defaultPricingKey).toBe(plan.pricing.mode);
    });

    it('preserves the unmodified server object on plan.raw', async () => {
        const plan = await runPrequalify(SENIOR_LIFE_TERM_LIFE);
        expect(plan.raw['pricing']).toEqual(SENIOR_LIFE_TERM_LIFE.pricing);
        expect(plan.raw['pricing_ranks']).toEqual(SENIOR_LIFE_TERM_LIFE.pricing_ranks);
        expect(plan.raw['default_pricing_key']).toBe('MONTHLY');
    });
});

describe('Plan.pricing — multi-class graded fallback', () => {
    it('chooses default class when both default and graded exist; preserves graded mode entries', async () => {
        const plan = await runPrequalify({
            ...SENIOR_LIFE_TERM_LIFE,
            default_pricing_key: 'MONTHLY-EFT',
            pricing: {
                default: { 'MONTHLY-EFT': '$84.22' },
                graded: { 'MONTHLY-EFT': '$135.18' },
            },
            pricing_ranks: { default: null, graded: 8 },
        });
        expect(plan.pricing.rate_class).toBe('default');
        expect(plan.pricing.mode).toBe('MONTHLY-EFT');
        expect(plan.pricing.cents).toBe(8422);
        expect(plan.pricing.display).toBe('$84.22');
        expect(plan.pricing.modes).toBe(plan.pricing.classes.default);
        expect(plan.pricing.classes.graded?.['MONTHLY-EFT']).toEqual({
            cents: 13518,
            display: '$135.18',
        });
        // Carrier ranks pass through with their original numeric values.
        expect(plan.pricingRanks).toEqual({ default: null, graded: 8 });
    });
});

describe('Plan.pricing — missing default class', () => {
    it('falls back to the only class present and honors server default_pricing_key inside it', async () => {
        const plan = await runPrequalify({
            ...SENIOR_LIFE_TERM_LIFE,
            default_pricing_key: 'MONTHLY',
            pricing: {
                preferred: {
                    ANNUAL: '$1000.00',
                    MONTHLY: '$87.50',
                },
            },
            pricing_ranks: { preferred: 3 },
        });
        // Carrier-specific class names like "preferred" pass through verbatim.
        expect(plan.pricing.rate_class).toBe('preferred');
        expect(plan.pricing.mode).toBe('MONTHLY');
        expect(plan.pricing.cents).toBe(8750);
        expect(plan.pricing.display).toBe('$87.50');
        expect(plan.pricingRanks).toEqual({ preferred: 3 });
    });
});

describe('Plan.pricing — N/A prices', () => {
    it('treats "NA" as missing while still surfacing other modes correctly', async () => {
        const plan = await runPrequalify({
            ...SENIOR_LIFE_TERM_LIFE,
            default_pricing_key: 'MONTHLY',
            pricing: {
                default: {
                    MONTHLY: 'NA',
                    ANNUAL: '$120.00',
                },
            },
        });
        expect(plan.pricing.mode).toBe('MONTHLY');
        expect(plan.pricing.cents).toBe(0);
        expect(plan.pricing.display).toBe('N/A');
        expect(plan.pricing.modes.ANNUAL).toEqual({ cents: 12000, display: '$120.00' });
        expect(plan.pricing.modes.MONTHLY).toEqual({ cents: 0, display: 'N/A' });
    });
});

describe('Plan.pricing — empty pricing', () => {
    it('returns a sentinel ResolvedPricing without throwing', async () => {
        const plan = await runPrequalify({
            ...SENIOR_LIFE_TERM_LIFE,
            default_pricing_key: 'MONTHLY',
            pricing: {},
            pricing_ranks: {},
        });
        expect(plan.pricing.rate_class).toBe('default');
        expect(plan.pricing.mode).toBe('');
        expect(plan.pricing.cents).toBe(0);
        expect(plan.pricing.display).toBe('N/A');
        expect(plan.pricing.classes).toEqual({});
        expect(plan.pricing.modes).toEqual({});
    });
});

describe('Plan.pricing — commas and dollar signs', () => {
    it('parses "$1,234.56" to 123456 cents and preserves the display verbatim', async () => {
        const plan = await runPrequalify({
            ...SENIOR_LIFE_TERM_LIFE,
            default_pricing_key: 'ANNUAL',
            pricing: {
                default: {
                    ANNUAL: '$1,234.56',
                    MONTHLY: '$102.88',
                },
            },
        });
        expect(plan.pricing.modes.ANNUAL).toEqual({
            cents: 123456,
            display: '$1,234.56',
        });
        expect(plan.pricing.cents).toBe(123456);
        // The server's display string is preserved character-for-character —
        // the SDK never reformats it.
        expect(plan.pricing.display).toBe('$1,234.56');
    });
});
