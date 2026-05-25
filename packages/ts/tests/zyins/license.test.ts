import { describe, expect, it } from 'vitest';
import { ZyInsError } from '../../src/zyins';
import { client, recordingTransport } from './client-test-helpers';

// jsonObject parses a JSON object body for assertion. Defensive: returns
// an empty object when the body is not an object, so tests fail with
// readable expectation diffs instead of typecast errors.
function jsonObject(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
      out[k] = v;
    }
    return out;
  }
  return {};
}

describe('ZyInsClient.license.activate', () => {
  // v2 wire shape: licenseKey + remainingActivations live at the top level
  // of the data envelope; the SDK surfaces them as { auth: { licenseKey } }
  // for bpp2.0 backward compat.
  const ACTIVATE_OK = JSON.stringify({
    status: 'active',
    licenseKey: 'LIC-NEW-7890',
    remainingActivations: 2,
  });

  it('POSTs JSON to /v2/licenses/activate with email + keycode + deviceId', async () => {
    const { transport, requests } = recordingTransport(200, ACTIVATE_OK);
    const c = client(transport);
    const result = await c.license.activate({
      email: 'john.doe@acme-agency.com',
      keycode: 'ABC-123-XYZ',
      deviceId: 'device-xyz-123',
    });
    expect(result.status).toBe('active');
    expect(result.remainingActivations).toBe(2);
    expect(result.auth.licenseKey).toBe('LIC-NEW-7890');
    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v2/licenses/activate');
    expect(requests[0]!.headers['Content-Type']).toBe('application/json');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    expect(requests[0]!.headers['X-Device-ID']).toBe('device-xyz-123');
    expect(requests[0]!.headers['Authorization']).toBeUndefined();
    const payload = jsonObject(requests[0]!.body);
    expect(payload['email']).toBe('john.doe@acme-agency.com');
    expect(payload['keycode']).toBe('ABC-123-XYZ');
    expect(payload['deviceId']).toBe('device-xyz-123');
  });

  it('accepts the ADR-012 envelope shape', async () => {
    const { transport } = recordingTransport(
      200,
      JSON.stringify({
        data: { status: 'active', licenseKey: 'LK-1', remainingActivations: 0 },
      }),
    );
    const c = client(transport);
    const result = await c.license.activate({
      email: 'x@x',
      keycode: 'ABC-123-XYZ',
      deviceId: 'd',
    });
    expect(result.auth.licenseKey).toBe('LK-1');
    expect(result.remainingActivations).toBe(0);
  });

  it('rejects missing deviceId', async () => {
    const { transport } = recordingTransport(200, ACTIVATE_OK);
    const c = client(transport);
    await expect(
      c.license.activate({ email: 'x@x', keycode: 'ABC-123-XYZ', deviceId: '' }),
    ).rejects.toThrow(/deviceId/);
  });

  it('rejects responses missing the status field', async () => {
    const { transport } = recordingTransport(200, JSON.stringify({ licenseKey: 'lk' }));
    const c = client(transport);
    await expect(
      c.license.activate({ email: 'x@x', keycode: 'ABC-123-XYZ', deviceId: 'd' }),
    ).rejects.toThrow(/status/);
  });

  it('surfaces 4xx as a typed error', async () => {
    const { transport } = recordingTransport(
      400,
      JSON.stringify({ type: 'about:blank', title: 'bad request', status: 400, code: 'validation_error' }),
    );
    const c = client(transport);
    const promise = c.license.activate({ email: 'x@x', keycode: 'ABC-123-XYZ', deviceId: 'd' });
    await expect(promise).rejects.toBeInstanceOf(ZyInsError);
    await expect(promise).rejects.toMatchObject({ code: 'validation_error', httpStatus: 400 });
  });

  it('surfaces 500 as a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', title: 'server error', status: 500, code: 'server_error' }),
    );
    const c = client(transport);
    const promise = c.license.activate({ email: 'x@x', keycode: 'ABC-123-XYZ', deviceId: 'd' });
    await expect(promise).rejects.toBeInstanceOf(ZyInsError);
    await expect(promise).rejects.toMatchObject({ code: 'unknown', httpStatus: 500 });
  });
});

describe('ZyInsClient.license.check', () => {
  it('POSTs JSON to /v2/licenses/check with email + keycode', async () => {
    const { transport, requests } = recordingTransport(200, JSON.stringify({ status: 'valid' }));
    const c = client(transport);
    const result = await c.license.check({
      email: 'john.doe@acme-agency.com',
      keycode: 'ABC-123-XYZ',
      deviceId: 'device-1',
    });
    expect(result.status).toBe('valid');
    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v2/licenses/check');
    expect(requests[0]!.headers['Content-Type']).toBe('application/json');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const payload = jsonObject(requests[0]!.body);
    expect(payload['email']).toBe('john.doe@acme-agency.com');
    expect(payload['keycode']).toBe('ABC-123-XYZ');
    expect(payload['deviceId']).toBe('device-1');
  });

  it('accepts the ADR-012 envelope shape', async () => {
    const { transport } = recordingTransport(200, JSON.stringify({ data: { status: 'inactive' } }));
    const c = client(transport);
    const result = await c.license.check({ email: 'x@x', keycode: 'ABC-123-XYZ' });
    expect(result.status).toBe('inactive');
  });

  it('rejects missing email', async () => {
    const { transport } = recordingTransport(200, JSON.stringify({ status: 'valid' }));
    const c = client(transport);
    await expect(c.license.check({ email: '', keycode: 'ABC-123-XYZ' })).rejects.toThrow(/email/);
  });

  it('surfaces 500 as a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', title: 'server error', status: 500, code: 'server_error' }),
    );
    const c = client(transport);
    await expect(c.license.check({ email: 'x@x', keycode: 'ABC-123-XYZ' })).rejects.toBeInstanceOf(Error);
  });
});

describe('ZyInsClient.license.deactivate', () => {
  it('POSTs JSON to /v2/licenses/deactivate and returns the inactive status', async () => {
    const { transport, requests } = recordingTransport(
      200,
      JSON.stringify({ status: 'inactive' }),
    );
    const c = client(transport);
    const result = await c.license.deactivate({
      email: 'john.doe@acme-agency.com',
      keycode: 'ABC-123-XYZ',
    });
    expect(result.status).toBe('inactive');
    expect(requests[0]!.url).toBe('https://test.example/v2/licenses/deactivate');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
  });

  it('rejects missing keycode', async () => {
    const { transport } = recordingTransport(200, '{}');
    const c = client(transport);
    await expect(c.license.deactivate({ email: 'x@x', keycode: '' })).rejects.toThrow(/keycode/);
  });

  it('rejects malformed success responses', async () => {
    const { transport } = recordingTransport(200, '{}');
    const c = client(transport);
    await expect(c.license.deactivate({ email: 'x@x', keycode: 'ABC-123-XYZ' })).rejects.toThrow(/inactive/);
  });
});
