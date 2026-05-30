/**
 * Verifies the `isa.zyins.license.*` facade delegates to the underlying
 * Tier-3 sub-client for activate / check / deactivate.
 */
import { describe, it, expect } from 'vitest';
import { Isa, ENV_VAR_NAMES, type EnvReader } from '../../src/zyins';
import type { Transport, TransportRequest } from '../../src/zyins/transport';
import { LicenseFacade } from '../../src/zyins/isaNamespaces';
import { TEST_AUTH } from './fixtures';

function licenseEnv(): EnvReader {
  return {
    get: (n) =>
      n === ENV_VAR_NAMES.license.keycode
        ? TEST_AUTH.licenseKey
        : n === ENV_VAR_NAMES.license.email
          ? TEST_AUTH.email
          : undefined,
  };
}

async function buildIsa(transport: Transport): Promise<Isa> {
  return Isa.withKeycode(
    {
      keycode: TEST_AUTH.licenseKey,
      email: TEST_AUTH.email,
      orderId: TEST_AUTH.orderId,
      transport,
    },
    licenseEnv(),
  );
}

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

describe('isa.zyins.license namespace', () => {
  it('exposes a LicenseFacade with activate/check/deactivate', async () => {
    const { transport } = recording(200, '{}');
    const isa = await buildIsa(transport);
    expect(isa.zyins.license).toBeInstanceOf(LicenseFacade);
    expect(typeof isa.zyins.license.activate).toBe('function');
    expect(typeof isa.zyins.license.check).toBe('function');
    expect(typeof isa.zyins.license.deactivate).toBe('function');
  });

  it('delegates activate() to POST /v2/licenses/activate', async () => {
    const { transport, requests } = recording(
      200,
      JSON.stringify({
        status: 'active',
        licenseKey: 'LK-1',
        remainingActivations: 1,
      }),
    );
    const isa = await buildIsa(transport);
    const result = await isa.zyins.license.activate({
      email: TEST_AUTH.email,
      keycode: TEST_AUTH.licenseKey,
    });
    expect(result.auth.licenseKey).toBe('LK-1');
    expect(requests[0]!.url).toContain('/v2/licenses/activate');
  });

  it('delegates check() to POST /v2/licenses/check', async () => {
    const { transport, requests } = recording(200, JSON.stringify({ status: 'active' }));
    const isa = await buildIsa(transport);
    const result = await isa.zyins.license.check({
      email: TEST_AUTH.email,
      keycode: TEST_AUTH.licenseKey,
    });
    expect(result.status).toBe('active');
    expect(requests[0]!.url).toContain('/v2/licenses/check');
  });

  it('delegates deactivate() to POST /v2/licenses/deactivate', async () => {
    const { transport, requests } = recording(200, JSON.stringify({ status: 'deactivated' }));
    const isa = await buildIsa(transport);
    const result = await isa.zyins.license.deactivate({
      email: TEST_AUTH.email,
      keycode: TEST_AUTH.licenseKey,
    });
    expect(result.status).toBe('deactivated');
    expect(requests[0]!.url).toContain('/v2/licenses/deactivate');
  });
});
