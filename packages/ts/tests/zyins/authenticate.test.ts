/**
 * `Isa.authenticate` — unified-factory dispatch tests.
 *
 * The tagless union routes by argument shape to {@link Isa.withKeycode},
 * {@link Isa.withBearer}, or {@link Isa.forForm}. Each shape lands the
 * caller on the identity the named factory would produce; invalid shapes
 * surface as IsaConfigError.
 */
import { describe, it, expect } from 'vitest';
import { Isa, IsaConfigError, type IsaAuthArgs } from '../../src';
import type { Transport, TransportRequest } from '../../src/zyins/transport';

const FAKE_KEYCODE = ['SDV', 'HWH', 'WDD'].join('-');
const FAKE_EMAIL = 'agent@example.com';
const FAKE_BEARER = ['isa', 'test', 'fixture0123456789'].join('_');
const FAKE_FORM_TOKEN = ['fixture', 'form', 'tok'].join('-');

function recording(
  status: number,
  body: string,
): { transport: Transport; requests: TransportRequest[] } {
  const requests: TransportRequest[] = [];
  const transport: Transport = async (req) => {
    requests.push(req);
    return { status, body, headers: {} };
  };
  return { transport, requests };
}

describe('Isa.authenticate', () => {
  it('dispatches {keycode, email} → withKeycode (license-mode identity)', async () => {
    const isa = await Isa.authenticate({
      keycode: FAKE_KEYCODE,
      email: FAKE_EMAIL,
    });
    expect(isa.identity).toEqual({
      mode: 'license',
      keycode: FAKE_KEYCODE,
      email: FAKE_EMAIL,
    });
  });

  it('dispatches {token} → withBearer (bearer-mode identity)', async () => {
    const isa = await Isa.authenticate({ token: FAKE_BEARER });
    expect(isa.identity).toEqual({ mode: 'bearer', token: FAKE_BEARER });
  });

  it('dispatches {formToken} → forForm (session-mode identity)', async () => {
    const body = JSON.stringify({
      data: {
        session_id: 'sess_auth',
        session_secret: ['fixture', 'val', 'auth'].join('_'),
      },
    });
    const { transport, requests } = recording(200, body);
    const isa = await Isa.authenticate(
      { formToken: FAKE_FORM_TOKEN },
      { transport },
    );
    expect(requests).toHaveLength(1);
    expect(isa.identity.mode).toBe('session');
  });

  it('throws IsaConfigError when no shape matches', async () => {
    // Cast through unknown — the union deliberately excludes shapes like
    // these at compile time; the runtime guard exists for callers that
    // assemble args dynamically (e.g. from a JSON config).
    const bogus = { unrelated: 'field' } as unknown as IsaAuthArgs;
    await expect(Isa.authenticate(bogus)).rejects.toBeInstanceOf(
      IsaConfigError,
    );
  });

  it('throws IsaConfigError when keycode is present without email', async () => {
    const partial = { keycode: FAKE_KEYCODE } as unknown as IsaAuthArgs;
    await expect(Isa.authenticate(partial)).rejects.toBeInstanceOf(
      IsaConfigError,
    );
  });
});
