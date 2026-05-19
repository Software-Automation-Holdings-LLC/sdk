import { describe, expect, it } from 'vitest';
import { extractData, extractEnvelope, ERR_ENVELOPE_MISSING_DATA, type DataValidator } from '../../../src/core/transport/response_extractor';

interface Customer {
    id: string;
    email: string;
}

function makeResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

const customerValidator: DataValidator<Customer> = (raw) => {
    if (typeof raw !== 'object' || raw === null) throw new Error('customer: expected object');
    const obj = raw as Record<string, unknown>;
    if (typeof obj.id !== 'string') throw new Error('customer: id missing');
    if (typeof obj.email !== 'string') throw new Error('customer: email missing');
    return { id: obj.id, email: obj.email };
};

describe('extractData', () => {
    it('unwraps the envelope and validates the inner data', async () => {
        const resp = makeResponse({
            object: 'customer',
            livemode: true,
            request_id: 'req_abc',
            data: { id: 'cus_1', email: 'a@b.com' },
        });
        const customer = await extractData(resp, customerValidator);
        expect(customer).toEqual({ id: 'cus_1', email: 'a@b.com' });
    });

    it('throws when the envelope omits data', async () => {
        const resp = makeResponse({ object: 'customer', livemode: false, request_id: 'r' });
        await expect(extractData(resp, customerValidator)).rejects.toThrow(ERR_ENVELOPE_MISSING_DATA);
    });

    it('throws when the envelope data is null', async () => {
        const resp = makeResponse({ object: 'customer', livemode: false, request_id: 'r', data: null });
        await expect(extractData(resp, customerValidator)).rejects.toThrow(ERR_ENVELOPE_MISSING_DATA);
    });

    it('throws when the validator rejects the payload', async () => {
        const resp = makeResponse({ object: 'customer', livemode: false, request_id: 'r', data: { id: 1 } });
        await expect(extractData(resp, customerValidator)).rejects.toThrow(/customer/);
    });

    it('rejects a non-object envelope', async () => {
        const resp = new Response('"just a string"', { status: 200, headers: { 'content-type': 'application/json' } });
        await expect(extractData(resp, customerValidator)).rejects.toThrow();
    });

    it('requires a validator', async () => {
        const resp = makeResponse({ data: {} });
        await expect(extractData(resp, undefined as unknown as DataValidator<unknown>)).rejects.toThrow(/DataValidator/);
    });
});

describe('extractEnvelope', () => {
    it('returns request_id and raw data without parsing data', async () => {
        const resp = makeResponse({
            object: 'list',
            livemode: false,
            request_id: 'req_42',
            data: [1, 2, 3],
        });
        const env = await extractEnvelope(resp);
        expect(env.request_id).toBe('req_42');
        expect(env.object).toBe('list');
        expect(env.data).toEqual([1, 2, 3]);
    });

    it('defaults missing scalar fields to safe zero values', async () => {
        const resp = makeResponse({ data: 42 });
        const env = await extractEnvelope(resp);
        expect(env.object).toBe('');
        expect(env.livemode).toBe(false);
        expect(env.request_id).toBe('');
        expect(env.data).toBe(42);
    });
});
