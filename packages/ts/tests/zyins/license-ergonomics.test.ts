/**
 * Tightened-ergonomics suite for `isa.zyins.license.*`.
 *
 * Covers:
 *   - No-args activate / check / deactivate fill from instance state.
 *   - Successful activate stashes the fresh license key into the shared
 *     AuthContext + persists it via CredentialStore.
 *   - `onLicenseRefreshed` event fires with the new credentials.
 *   - Explicit args still override instance state (backward compat).
 *   - Persistence round-trip via mock store + `withKeycode` (async).
 *   - `Isa.fromEnv` auto-picks license-mode when ISA_LICENSE_* is set.
 */
import { describe, it, expect } from 'vitest';
import {
  Isa,
  ENV_VAR_NAMES,
  IsaConfigError,
  IsaNotActivatedError,
  type EnvReader,
} from '../../src/zyins';
import { CREDENTIAL_KEYS, inMemoryCredentialStore } from '../../src/core';
import type { Transport, TransportRequest } from '../../src/zyins/transport';
import {
  TEST_APPLICANT,
  TEST_AUTH,
  TEST_COVERAGE,
  TEST_PRODUCTS,
  testCredentialStore,
} from './fixtures';

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

function licenseEnv(): EnvReader {
  return {
    get: (n) => {
      if (n === ENV_VAR_NAMES.license.keycode) return TEST_AUTH.licenseKey;
      if (n === ENV_VAR_NAMES.license.email) return TEST_AUTH.email;
      return undefined;
    },
  };
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

const ACTIVATE_BODY = JSON.stringify({
  status: 'active',
  licenseKey: 'LK-FRESH',
  remainingActivations: 1,
});

describe('isa.zyins.license ergonomics', () => {
  it('activate() with no args fills email/keycode/deviceId from instance', async () => {
    const { transport, requests } = recording(200, ACTIVATE_BODY);
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        credentialStore: await testCredentialStore(),
        transport,
      },
      licenseEnv(),
    );
    const result = await isa.zyins.license.activate();
    expect(result.auth.licenseKey).toBe('LK-FRESH');
    expect(requests).toHaveLength(1);
    const body = jsonObject(requests[0]!.body);
    expect(body['email']).toBe(TEST_AUTH.email);
    expect(body['keycode']).toBe(TEST_AUTH.licenseKey);
    expect(body['deviceId']).toBe(TEST_AUTH.deviceId);
  });

  it('activate() stashes the fresh license key into shared AuthContext', async () => {
    const { transport } = recording(200, ACTIVATE_BODY);
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        transport,
      },
      licenseEnv(),
    );
    expect(isa.credentialState?.auth.licenseKey).toBe('');
    await isa.zyins.license.activate();
    expect(isa.credentialState?.auth.licenseKey).toBe('LK-FRESH');
  });

  it('activate() preserves keycode when orderId differs', async () => {
    const { transport, requests } = recording(200, ACTIVATE_BODY);
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        orderId: TEST_AUTH.orderId,
        transport,
      },
      licenseEnv(),
    );
    await isa.zyins.license.activate();
    expect(jsonObject(requests[0]!.body)['keycode']).toBe(TEST_AUTH.licenseKey);
  });

  it('activate() with overrides does not mutate instance credentials', async () => {
    const { transport } = recording(200, ACTIVATE_BODY);
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        transport,
      },
      licenseEnv(),
    );
    await isa.zyins.license.activate({ email: 'override@example.com' });
    expect(isa.credentialState?.auth.licenseKey).toBe('');
  });

  it('activate() does not stash credentials for non-active responses', async () => {
    const { transport } = recording(
      200,
      JSON.stringify({ status: 'locked', licenseKey: 'LK-LOCKED', remainingActivations: 0 }),
    );
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        transport,
      },
      licenseEnv(),
    );
    await isa.zyins.license.activate();
    expect(isa.credentialState?.auth.licenseKey).toBe('');
  });

  it('activate() persists fresh license key into CredentialStore', async () => {
    const { transport } = recording(200, ACTIVATE_BODY);
    const store = inMemoryCredentialStore();
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        credentialStore: store,
        transport,
      },
      licenseEnv(),
    );
    await isa.zyins.license.activate();
    expect(await store.get(CREDENTIAL_KEYS.licenseKey)).toBe('LK-FRESH');
  });

  it('fires onLicenseRefreshed listener with fresh credentials', async () => {
    const { transport } = recording(200, ACTIVATE_BODY);
    const events: Array<{ licenseKey: string; deviceId: string }> = [];
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        credentialStore: await testCredentialStore(),
        transport,
        onLicenseRefreshed: (event) =>
          events.push({ licenseKey: event.licenseKey, deviceId: event.deviceId }),
      },
      licenseEnv(),
    );
    await isa.zyins.license.activate();
    expect(events).toEqual([
      { licenseKey: 'LK-FRESH', deviceId: TEST_AUTH.deviceId },
    ]);
  });

  it('check() defaults from instance but explicit args still win', async () => {
    const { transport, requests } = recording(200, JSON.stringify({ status: 'active' }));
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        transport,
      },
      licenseEnv(),
    );
    await isa.zyins.license.check();
    expect(jsonObject(requests[0]!.body)['email']).toBe(TEST_AUTH.email);

    await isa.zyins.license.check({ email: 'override@example.com' });
    const overrideBody = jsonObject(requests[1]!.body);
    expect(overrideBody['email']).toBe('override@example.com');
    expect(overrideBody['keycode']).toBe(TEST_AUTH.licenseKey);
  });

  it('deactivate() with no args clears the stashed license key', async () => {
    const { transport } = recording(200, JSON.stringify({ status: 'deactivated' }));
    const store = inMemoryCredentialStore();
    await store.set(CREDENTIAL_KEYS.licenseKey, 'STALE');
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        licenseKey: 'STALE',
        credentialStore: store,
        transport,
      },
      licenseEnv(),
    );
    await isa.zyins.license.deactivate();
    expect(isa.credentialState?.auth.licenseKey).toBe('');
    expect(await store.get(CREDENTIAL_KEYS.licenseKey)).toBeUndefined();
  });

  it('deactivate() with overrides does not clear instance credentials', async () => {
    const { transport } = recording(200, JSON.stringify({ status: 'deactivated' }));
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        licenseKey: 'LK-INSTANCE',
        transport,
      },
      licenseEnv(),
    );
    await isa.zyins.license.deactivate({ email: 'override@example.com' });
    expect(isa.credentialState?.auth.licenseKey).toBe('LK-INSTANCE');
  });

  it('product calls fail locally after deactivation clears the license key', async () => {
    const { transport, requests } = recording(200, JSON.stringify({ status: 'deactivated' }));
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        licenseKey: 'LK-INSTANCE',
        transport,
      },
      licenseEnv(),
    );
    await isa.zyins.license.deactivate();
    await expect(
      isa.zyins.prequalify({
        applicant: TEST_APPLICANT,
        coverage: TEST_COVERAGE,
        products: TEST_PRODUCTS,
      }),
    ).rejects.toBeInstanceOf(IsaNotActivatedError);
    expect(requests).toHaveLength(1);
  });

  it('product calls fail locally before activation or stored license restore', async () => {
    const { transport, requests } = recording(200, JSON.stringify({ plans: [], request_id: 'req_1' }));
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        transport,
      },
      licenseEnv(),
    );
    await expect(
      isa.zyins.prequalify({
        applicant: TEST_APPLICANT,
        coverage: TEST_COVERAGE,
        products: TEST_PRODUCTS,
      }),
    ).rejects.toBeInstanceOf(IsaNotActivatedError);
    expect(requests).toHaveLength(0);
  });

  it('persistence round-trip: stored deviceId + licenseKey are reused', async () => {
    const store = inMemoryCredentialStore();
    await store.set(CREDENTIAL_KEYS.deviceId, 'persistent-device-id');
    await store.set(CREDENTIAL_KEYS.licenseKey, 'LK-PERSISTED');
    const { transport, requests } = recording(200, JSON.stringify({ status: 'active' }));
    const isa = await Isa.withKeycode(
      {
        keycode: TEST_AUTH.licenseKey,
        email: TEST_AUTH.email,
        credentialStore: store,
        transport,
      },
      licenseEnv(),
    );
    expect(isa.credentialState?.auth.deviceId).toBe('persistent-device-id');
    expect(isa.credentialState?.auth.licenseKey).toBe('LK-PERSISTED');
    await isa.zyins.license.check();
    const body = jsonObject(requests[0]!.body);
    expect(body['deviceId']).toBe('persistent-device-id');
    expect(body['licenseKey']).toBe('LK-PERSISTED');
  });

  it('Isa.fromEnv selects license mode when ISA_LICENSE_* is set', async () => {
    const isa = await Isa.fromEnv(licenseEnv());
    expect(isa.identity.mode).toBe('license');
  });

  it('Isa.fromEnv selects bearer mode when ISA_TOKEN is set', async () => {
    const fakeBearer = ['isa', 'test', 'fixture'].join('_');
    const env: EnvReader = {
      get: (n) => (n === ENV_VAR_NAMES.bearer.token ? fakeBearer : undefined),
    };
    const isa = await Isa.fromEnv(env);
    expect(isa.identity.mode).toBe('bearer');
  });

  it('Isa.fromEnv rejects when only partial license env is set (sessions no longer auto-detected)', async () => {
    // Sessions are internal-only post-v0.6; ISA_SESSION_* in the env is
    // ignored by fromEnv even when fully populated. A partial license env
    // therefore surfaces as an IsaConfigError instead of silently falling
    // through to session mode.
    const env: EnvReader = {
      get: (n) => {
        if (n === ENV_VAR_NAMES.license.keycode) return TEST_AUTH.licenseKey;
        if (n === ENV_VAR_NAMES.session.sessionId) return 'sess_test';
        if (n === ENV_VAR_NAMES.session.sessionSecret) return 'secret_test';
        return undefined;
      },
    };
    await expect(Isa.fromEnv(env)).rejects.toBeInstanceOf(IsaConfigError);
  });

  it('mints a deviceId when none is supplied', async () => {
    const isa = await Isa.withKeycode(
      { keycode: TEST_AUTH.licenseKey, email: TEST_AUTH.email },
      licenseEnv(),
    );
    expect(isa.credentialState?.auth.deviceId).toMatch(/^[0-9a-f]{32}$/);
  });
});
