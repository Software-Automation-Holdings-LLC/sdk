import { describe, expect, it, vi } from 'vitest';
import { BearerTransport, StaticToken, type FetchImpl, type TokenSource } from '../../../src/core/transport/bearer';

function fakeFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response): FetchImpl {
    return async (input, init) => handler(input, init);
}

describe('StaticToken', () => {
    it('returns the constructed value', () => {
        expect(new StaticToken('abc').token()).toBe('abc');
    });

    it('rejects an empty value at construction', () => {
        expect(() => new StaticToken('')).toThrow();
    });
});

describe('BearerTransport', () => {
    it('throws when source is missing', () => {
        expect(() => new BearerTransport({ source: undefined as unknown as TokenSource, fetch: fakeFetch(() => new Response()) })).toThrow();
    });

    it('throws when fetch is missing', () => {
        expect(() => new BearerTransport({ source: new StaticToken('x'), fetch: undefined as unknown as FetchImpl })).toThrow();
    });

    it('attaches Authorization: Bearer <token>', async () => {
        let captured: Headers | undefined;
        const inner = fakeFetch((_input, init) => {
            captured = new Headers(init?.headers);
            return new Response('{}', { status: 200 });
        });
        const bt = new BearerTransport({ source: new StaticToken('secret'), fetch: inner });
        await bt.asFetch()('http://example/v1/x');
        expect(captured?.get('Authorization')).toBe('Bearer secret');
    });

    it('overwrites any pre-existing Authorization header', async () => {
        let captured: string | null = null;
        const inner = fakeFetch((_input, init) => {
            captured = new Headers(init?.headers).get('Authorization');
            return new Response('{}', { status: 200 });
        });
        const bt = new BearerTransport({ source: new StaticToken('new'), fetch: inner });
        await bt.asFetch()('http://example/v1/x', { headers: { Authorization: 'Bearer old' } });
        expect(captured).toBe('Bearer new');
    });

    it('propagates a TokenSource error without calling fetch', async () => {
        const innerSpy = vi.fn(async () => new Response('{}', { status: 200 }));
        const source: TokenSource = {
            token() {
                throw new Error('token oracle offline');
            },
        };
        const bt = new BearerTransport({ source, fetch: innerSpy as unknown as FetchImpl });
        await expect(bt.asFetch()('http://example/v1/x')).rejects.toThrow(/token oracle offline/);
        expect(innerSpy).not.toHaveBeenCalled();
    });

    it('awaits an async TokenSource', async () => {
        const source: TokenSource = {
            async token() {
                await new Promise((r) => setTimeout(r, 1));
                return 'async-token';
            },
        };
        let captured: string | null = null;
        const inner = fakeFetch((_input, init) => {
            captured = new Headers(init?.headers).get('Authorization');
            return new Response('{}', { status: 200 });
        });
        await new BearerTransport({ source, fetch: inner }).asFetch()('http://example/v1/x');
        expect(captured).toBe('Bearer async-token');
    });
});
