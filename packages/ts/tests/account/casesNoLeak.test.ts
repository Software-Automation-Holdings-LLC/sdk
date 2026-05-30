import { describe, expect, it } from 'vitest';
import { accountWithViewer, scriptedTransport, TEST_CASE_VIEWER_BASE_URL } from './helpers';

const CASE_ID = '9f1c2d3e-4b5a-6c7d-8e9f-0a1b2c3d4e5f';

/** Extract the `#k=` fragment value from an assembled share link. */
function fragmentOf(link: string): string {
  return link.slice(link.indexOf('#k=') + '#k='.length);
}

describe('isa.account.cases — no key / fragment leakage (HARD RULE)', () => {
  it('the POST body keys are exactly {ciphertext,iv,product,tag} — never the key', async () => {
    const bodies: string[] = [];
    const { transport } = scriptedTransport((req) => {
      if (req.method === 'POST') bodies.push(req.body);
      return { status: 201, body: JSON.stringify({ object: 'case', id: CASE_ID }) };
    });
    const result = await accountWithViewer(transport, TEST_CASE_VIEWER_BASE_URL).cases.create({
      product: 'zyins',
      payload: { secret: 'do-not-leak' },
    });
    const fragment = fragmentOf(result.link);
    const parsed: unknown = JSON.parse(bodies[0]!);
    const keys = Object.keys(parsed as Record<string, unknown>).sort();
    expect(keys).toEqual(['ciphertext', 'iv', 'product', 'tag']);
    // The fragment key appears nowhere in the wire payload.
    expect(bodies[0]).not.toContain(fragment);
  });

  it('a thrown error never carries the link or fragment in message or JSON', async () => {
    let capturedFragment = '';
    // POST succeeds; the GET fails with a 500 whose body deliberately tries to
    // smuggle a key-like value — the SDK must not surface any of it, nor the
    // real fragment, on the thrown error.
    const { transport } = scriptedTransport((req) => {
      if (req.method === 'POST') {
        return { status: 201, body: JSON.stringify({ object: 'case', id: CASE_ID }) };
      }
      return {
        status: 500,
        body: JSON.stringify({ type: 'about:blank', status: 500, code: 'server_error' }),
      };
    });
    const ns = accountWithViewer(transport, TEST_CASE_VIEWER_BASE_URL);
    const { link } = await ns.cases.create({ product: 'zyins', payload: { secret: 1 } });
    capturedFragment = fragmentOf(link);
    expect(capturedFragment.length).toBeGreaterThan(0);

    let thrown: unknown;
    try {
      await ns.cases.open(link);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    const serialized = JSON.stringify(thrown, Object.getOwnPropertyNames(thrown));
    expect(message).not.toContain(capturedFragment);
    expect(message).not.toContain(link);
    expect(serialized).not.toContain(capturedFragment);
    expect(serialized).not.toContain(link);
  });

  it('IsaCaseExpiredError on 404 never carries the link or fragment', async () => {
    const { transport } = scriptedTransport((req) => {
      if (req.method === 'POST') {
        return { status: 201, body: JSON.stringify({ object: 'case', id: CASE_ID }) };
      }
      return { status: 404, body: '' };
    });
    const ns = accountWithViewer(transport, TEST_CASE_VIEWER_BASE_URL);
    const { link } = await ns.cases.create({ product: 'zyins', payload: { secret: 1 } });
    const fragment = fragmentOf(link);

    let thrown: unknown;
    try {
      await ns.cases.open(link);
    } catch (err) {
      thrown = err;
    }
    const message = (thrown as Error).message;
    const serialized = JSON.stringify(thrown, Object.getOwnPropertyNames(thrown));
    expect(message).toContain(CASE_ID); // id is fine to surface
    expect(message).not.toContain(fragment);
    expect(serialized).not.toContain(fragment);
  });
});
