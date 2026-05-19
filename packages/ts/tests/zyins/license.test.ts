import { describe, expect, it } from 'vitest';
import { ZyInsClient } from '../../src/zyins/client';
import { LicenseError } from '../../src/zyins/errors';
import type { Transport } from '../../src/zyins/transport';
import { TEST_AUTH, FIXED_CLOCK } from './fixtures';

function staticTransport(status: number, body: string): Transport {
  return async () => ({ status, body, headers: {} });
}

function client(transport: Transport): ZyInsClient {
  return new ZyInsClient({
    auth: TEST_AUTH,
    baseUrl: 'https://test.example',
    transport,
    clock: FIXED_CLOCK,
  });
}

describe('ZyInsClient.license absorption of ERR_* legacy responses', () => {
  it('maps ERR_MAX_ACTIVATIONS (200 body) to LicenseError(max_activations)', async () => {
    const c = client(staticTransport(200, 'ERR_MAX_ACTIVATIONS'));
    await expect(c.license.activate()).rejects.toMatchObject({
      name: 'LicenseError',
      code: 'max_activations',
    });
  });

  it('maps ERR_INACTIVE to LicenseError(inactive)', async () => {
    const c = client(staticTransport(200, 'ERR_INACTIVE'));
    await expect(c.license.activate()).rejects.toMatchObject({
      code: 'inactive',
    });
  });

  it('maps ERR_ACTIVE_ELSEWHERE to LicenseError(active_elsewhere)', async () => {
    const c = client(staticTransport(200, 'ERR_ACTIVE_ELSEWHERE'));
    await expect(c.license.activate()).rejects.toMatchObject({
      code: 'active_elsewhere',
    });
  });

  it('maps ERR_LOCKED to LicenseError(locked)', async () => {
    const c = client(staticTransport(200, 'ERR_LOCKED'));
    await expect(c.license.activate()).rejects.toMatchObject({
      code: 'locked',
    });
  });

  it('maps unknown ERR_* to LicenseError(unknown)', async () => {
    const c = client(staticTransport(200, 'ERR_SOMETHING_NEW'));
    await expect(c.license.activate()).rejects.toMatchObject({
      code: 'unknown',
    });
  });

  it('maps NO_EMAIL to LicenseError(no_email)', async () => {
    const c = client(staticTransport(200, 'NO_EMAIL'));
    await expect(c.license.activate()).rejects.toMatchObject({
      code: 'no_email',
    });
  });

  it('parses SUCCESS:<n> on activate and returns remaining activations', async () => {
    const c = client(staticTransport(200, 'SUCCESS:4'));
    const result = await c.license.activate();
    expect(result.remainingActivations).toBe(4);
  });

  it('parses ACTIVE:<n> on check', async () => {
    const c = client(staticTransport(200, 'ACTIVE:3'));
    const result = await c.license.check();
    expect(result.active).toBe(true);
    expect(result.remainingActivations).toBe(3);
  });

  it('parses INACTIVE on check', async () => {
    const c = client(staticTransport(200, 'INACTIVE'));
    const result = await c.license.check();
    expect(result.active).toBe(false);
  });

  it('throws LicenseError(unknown) on unrecognized check body', async () => {
    const c = client(staticTransport(200, 'who knows'));
    await expect(c.license.check()).rejects.toBeInstanceOf(LicenseError);
  });
});
