/**
 * Verifies the `isa.zyins.licenses.*` facade delegates to the underlying
 * Tier-3 sub-client for activate / check / deactivate.
 */
import { describe, it, expect } from 'vitest';
import { Isa, ENV_VAR_NAMES, type EnvReader } from '../../src/zyins';
import type { Transport, TransportRequest } from '../../src/zyins/transport';
import { LicensesFacade } from '../../src/zyins/isaNamespaces';
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

function buildIsa(transport: Transport): Isa {
  const isa = Isa.withLicense(
    {
      keycode: TEST_AUTH.licenseKey,
      email: TEST_AUTH.email,
      deviceId: TEST_AUTH.deviceId,
      orderId: TEST_AUTH.orderId,
      transport,
    },
    licenseEnv(),
  );
  return isa;
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

describe('isa.zyins.licenses namespace', () => {
  it('exposes a LicensesFacade with activate/check/deactivate', () => {
    const { transport } = recording(200, '{}');
    const isa = buildIsa(transport);
    expect(isa.zyins.licenses).toBeInstanceOf(LicensesFacade);
    expect(typeof isa.zyins.licenses.activate).toBe('function');
    expect(typeof isa.zyins.licenses.check).toBe('function');
    expect(typeof isa.zyins.licenses.deactivate).toBe('function');
  });

  it('delegates activate() to POST /v1/licenses/activate', async () => {
    const { transport, requests } = recording(
      200,
      JSON.stringify({
        status: 'active',
        remainingActivations: 1,
        auth: { licenseKey: 'LK-1' },
      }),
    );
    const isa = buildIsa(transport);
    const result = await isa.zyins.licenses.activate({
      email: TEST_AUTH.email,
      keycode: TEST_AUTH.licenseKey,
      deviceId: TEST_AUTH.deviceId,
    });
    expect(result.auth.licenseKey).toBe('LK-1');
    expect(requests[0]!.url).toContain('/v1/licenses/activate');
  });

  it('delegates check() to POST /v1/licenses/check', async () => {
    const { transport, requests } = recording(200, JSON.stringify({ status: 'active' }));
    const isa = buildIsa(transport);
    const result = await isa.zyins.licenses.check({
      email: TEST_AUTH.email,
      keycode: TEST_AUTH.licenseKey,
    });
    expect(result.status).toBe('active');
    expect(requests[0]!.url).toContain('/v1/licenses/check');
  });

  it('delegates deactivate() to POST /v1/licenses/deactivate', async () => {
    const { transport, requests } = recording(200, JSON.stringify({ status: 'deactivated' }));
    const isa = buildIsa(transport);
    const result = await isa.zyins.licenses.deactivate({
      email: TEST_AUTH.email,
      keycode: TEST_AUTH.licenseKey,
    });
    expect(result.status).toBe('deactivated');
    expect(requests[0]!.url).toContain('/v1/licenses/deactivate');
  });
});
