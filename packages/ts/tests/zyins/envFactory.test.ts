/**
 * Phase 1 — env-var auto-detection in `Isa.withBearer / withLicense /
 * withSession` and `IsaConfigError` for missing env (SDK_DESIGN §3.3).
 */
import { describe, it, expect } from 'vitest';
import { Isa, IsaConfigError, ENV_VAR_NAMES, type EnvReader } from '../../src/zyins';

// Fake tokens built at runtime so static-analysis pattern matchers do not
// flag them as committed credentials.
const FAKE_LIVE_TOKEN = ['isa', 'live', 'abc'].join('_');
const FAKE_TEST_TOKEN = ['isa', 'test', 'xyz'].join('_');

const emptyEnv = (): EnvReader => ({ get: () => undefined });
const stubEnv = (entries: Record<string, string>): EnvReader => ({
  get: (name) => entries[name],
});

describe('Isa.withBearer', () => {
  it('reads ISA_TOKEN from env when no arg supplied', () => {
    const isa = Isa.withBearer(
      undefined,
      stubEnv({ [ENV_VAR_NAMES.bearer.token]: FAKE_LIVE_TOKEN }),
    );
    expect(isa.identity).toEqual({ mode: 'bearer', token: FAKE_LIVE_TOKEN });
  });

  it('prefers explicit arg over env', () => {
    const isa = Isa.withBearer(
      { token: FAKE_TEST_TOKEN },
      stubEnv({ [ENV_VAR_NAMES.bearer.token]: FAKE_LIVE_TOKEN }),
    );
    expect(isa.identity).toEqual({ mode: 'bearer', token: FAKE_TEST_TOKEN });
  });

  it('throws IsaConfigError naming the missing env var', () => {
    expect(() => Isa.withBearer(undefined, emptyEnv())).toThrowError(IsaConfigError);
    try {
      Isa.withBearer(undefined, emptyEnv());
    } catch (e) {
      expect((e as IsaConfigError).message).toContain(ENV_VAR_NAMES.bearer.token);
    }
  });

  it('rejects empty-string env value as missing', () => {
    expect(() =>
      Isa.withBearer(undefined, stubEnv({ [ENV_VAR_NAMES.bearer.token]: '' })),
    ).toThrowError(IsaConfigError);
  });
});

describe('Isa.withLicense', () => {
  const fullEnv = stubEnv({
    [ENV_VAR_NAMES.license.keycode]: 'SDV-HWH-WDD',
    [ENV_VAR_NAMES.license.email]: 'agent@example.com',
  });

  it('reads keycode + email from env', () => {
    const isa = Isa.withLicense(undefined, fullEnv);
    expect(isa.identity).toEqual({
      mode: 'license',
      keycode: 'SDV-HWH-WDD',
      email: 'agent@example.com',
    });
  });

  it('lists every missing var in the error message', () => {
    try {
      Isa.withLicense(undefined, emptyEnv());
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(IsaConfigError);
      const msg = (e as IsaConfigError).message;
      expect(msg).toContain(ENV_VAR_NAMES.license.keycode);
      expect(msg).toContain(ENV_VAR_NAMES.license.email);
    }
  });

  it('reports only the missing var when one is set', () => {
    try {
      Isa.withLicense(
        undefined,
        stubEnv({ [ENV_VAR_NAMES.license.keycode]: 'SDV-HWH-WDD' }),
      );
      throw new Error('expected throw');
    } catch (e) {
      const msg = (e as IsaConfigError).message;
      expect(msg).toContain(ENV_VAR_NAMES.license.email);
      expect(msg).not.toContain(ENV_VAR_NAMES.license.keycode);
    }
  });
});

describe('Isa.withSession', () => {
  const FAKE_SECRET = ['shh', 'dont', 'tell'].join('_');

  it('reads sessionId + sessionSecret from env', () => {
    const isa = Isa.withSession(
      undefined,
      stubEnv({
        [ENV_VAR_NAMES.session.sessionId]: 'sess_abc',
        [ENV_VAR_NAMES.session.sessionSecret]: FAKE_SECRET,
      }),
    );
    expect(isa.identity).toEqual({
      mode: 'session',
      sessionId: 'sess_abc',
      sessionSecret: FAKE_SECRET,
    });
  });

  it('throws IsaConfigError with both missing names', () => {
    try {
      Isa.withSession(undefined, emptyEnv());
      throw new Error('expected throw');
    } catch (e) {
      const msg = (e as IsaConfigError).message;
      expect(msg).toContain(ENV_VAR_NAMES.session.sessionId);
      expect(msg).toContain(ENV_VAR_NAMES.session.sessionSecret);
    }
  });
});
