/**
 * v3 datasets product-slices passthrough — A3 ship-blocker regression.
 *
 * The server's `data.products_by_family`, `data.discontinued_products`,
 * and `data.state_derivatives` slices must surface as typed fields on
 * the parsed bundle. Before this guard, the parser dropped them and
 * consumers (bpp2.0 productListAtom / discontinuedProductsAtom) cast the
 * bundle through `unknown` to read the raw wire fields.
 */

import { describe, expect, it } from 'vitest';
import { client, recordingTransport } from './client-test-helpers';
import { isNotModified } from '../../src/zyins/datasets-v3';

const PERSONA_FAMILY = 'final_expense';
const PERSONA_PRODUCT_SLUG = 'mountain-life-myga';
const DISCONTINUED_AT_EPOCH = 1746979200; // 2025-05-11T16:00:00Z

function bundleWithSlices(): string {
    return JSON.stringify({
        object: 'datasets_catalog',
        request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
        idempotency_key: null,
        livemode: true,
        data: {
            catalog_version: '3.0',
            datasets: {
                products: {
                    version: '3.0',
                    item_count: 1,
                    items: [{ id: 'prod_001', name: 'Mountain Life MYGA' }],
                },
            },
            products_by_family: {
                [PERSONA_FAMILY]: [
                    { id: 'prod_001', name: 'Mountain Life MYGA' },
                    { id: 'prod_002', name: 'Mountain Life Whole Life' },
                ],
            },
            discontinued_products: {
                [PERSONA_PRODUCT_SLUG]: DISCONTINUED_AT_EPOCH,
            },
            state_derivatives: ['ND', 'SD'],
        },
    });
}

describe('ZyInsClient.datasetsV3.get — product slices (A3)', () => {
    it('surfaces products_by_family / discontinued_products / state_derivatives as typed fields', async () => {
        const { transport } = recordingTransport(200, bundleWithSlices(), {
            etag: 'W/"catalog-v3"',
        });
        const result = await client(transport).datasetsV3.get();

        expect(isNotModified(result)).toBe(false);
        if (isNotModified(result)) return;

        expect(result.productsByFamily[PERSONA_FAMILY]).toEqual([
            { id: 'prod_001', name: 'Mountain Life MYGA' },
            { id: 'prod_002', name: 'Mountain Life Whole Life' },
        ]);
        expect(result.discontinuedProducts[PERSONA_PRODUCT_SLUG]).toBe(DISCONTINUED_AT_EPOCH);
        expect(result.stateDerivatives).toEqual(['ND', 'SD']);
    });

    it('defaults the slices to empty (never undefined) when the server omits them', async () => {
        const body = JSON.stringify({
            object: 'datasets_catalog',
            request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            idempotency_key: null,
            livemode: true,
            data: { catalog_version: '3.0', datasets: {} },
        });
        const { transport } = recordingTransport(200, body);
        const result = await client(transport).datasetsV3.get();

        expect(isNotModified(result)).toBe(false);
        if (isNotModified(result)) return;

        expect(result.productsByFamily).toEqual({});
        expect(result.discontinuedProducts).toEqual({});
        expect(result.stateDerivatives).toEqual([]);
    });

    it('skips malformed slice rows without throwing', async () => {
        const body = JSON.stringify({
            object: 'datasets_catalog',
            request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            idempotency_key: null,
            livemode: true,
            data: {
                catalog_version: '3.0',
                datasets: {},
                products_by_family: {
                    [PERSONA_FAMILY]: [
                        { id: 'prod_001', name: 'Mountain Life MYGA' },
                        { id: '', name: 'Empty Id' }, // empty id: dropped
                        { id: 42 }, // malformed: dropped
                        'not-an-object', // malformed: dropped
                    ],
                },
                discontinued_products: {
                    [PERSONA_PRODUCT_SLUG]: DISCONTINUED_AT_EPOCH,
                    'float-epoch-ok': 1746979200.0, // integer-valued: kept
                    'fractional-dropped': 1746979200.5, // fractional epoch: dropped
                    bad: 'not-a-number', // dropped
                },
                state_derivatives: ['ND', 7], // 7 dropped
            },
        });
        const { transport } = recordingTransport(200, body);
        const result = await client(transport).datasetsV3.get();

        expect(isNotModified(result)).toBe(false);
        if (isNotModified(result)) return;

        expect(result.productsByFamily[PERSONA_FAMILY]).toEqual([{ id: 'prod_001', name: 'Mountain Life MYGA' }]);
        expect(result.discontinuedProducts).toEqual({
            [PERSONA_PRODUCT_SLUG]: DISCONTINUED_AT_EPOCH,
            'float-epoch-ok': 1746979200,
        });
        expect(result.stateDerivatives).toEqual(['ND']);
    });

    it('keeps an id-only row (name defaults to "") and drops a row with no id', async () => {
        // Cross-language keep/drop parity guard. The canonical predicate: a
        // product row is valid iff it has a non-empty id (the opaque contract
        // key); a missing/blank name defaults to '' and the row is KEPT, while
        // a row with no id is DROPPED. Go/Python/PHP/C# all behave identically.
        const body = JSON.stringify({
            object: 'datasets_catalog',
            request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            idempotency_key: null,
            livemode: true,
            data: {
                catalog_version: '3.0',
                datasets: {},
                products_by_family: {
                    [PERSONA_FAMILY]: [
                        { id: 'prod_id_present' }, // name absent -> kept, name=''
                        { name: 'orphan' }, // id absent -> dropped
                    ],
                },
            },
        });
        const { transport } = recordingTransport(200, body);
        const result = await client(transport).datasetsV3.get();

        expect(isNotModified(result)).toBe(false);
        if (isNotModified(result)) return;

        expect(result.productsByFamily[PERSONA_FAMILY]).toEqual([{ id: 'prod_id_present', name: '' }]);
    });

    it('drops an out-of-range integer epoch (keeps the in-range entry)', async () => {
        // Cross-language int64 epoch-bound parity guard. An epoch outside the
        // representable range is dropped, never kept as a wrapped/imprecise
        // value. In JS the bound is the safe-integer range (the analog of the
        // int64 bound the Go/C#/PHP/Python parsers enforce). 9e18 > 2**53.
        const body = JSON.stringify({
            object: 'datasets_catalog',
            request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
            idempotency_key: null,
            livemode: true,
            data: {
                catalog_version: '3.0',
                datasets: {},
                discontinued_products: {
                    'in-range': DISCONTINUED_AT_EPOCH,
                    'overflow-skipped': 9e18, // > Number.MAX_SAFE_INTEGER
                },
            },
        });
        const { transport } = recordingTransport(200, body);
        const result = await client(transport).datasetsV3.get();

        expect(isNotModified(result)).toBe(false);
        if (isNotModified(result)) return;

        expect(result.discontinuedProducts).toEqual({ 'in-range': DISCONTINUED_AT_EPOCH });
    });
});
