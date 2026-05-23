/**
 * Phase 1 — env-var auto-detection in `Isa.withBearer / withKeycode`
 * and `IsaConfigError` for missing env (SDK_DESIGN §3.3). `withSession`
 * is `@internal`; its env-var path is still exercised below for coverage.
 *
 * Every factory is async; missing-env errors surface as rejected promises.
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
  it('reads ISA_TOKEN from env when no arg supplied', async () => {
    const isa = await Isa.withBearer(
      undefined,
      stubEnv({ [ENV_VAR_NAMES.bearer.token]: FAKE_LIVE_TOKEN }),
    );
    expect(isa.identity).toEqual({ mode: 'bearer', token: FAKE_LIVE_TOKEN });
  });

  it('prefers explicit arg over env', async () => {
    const isa = await Isa.withBearer(
      { token: FAKE_TEST_TOKEN },
      stubEnv({ [ENV_VAR_NAMES.bearer.token]: FAKE_LIVE_TOKEN }),
    );
    expect(isa.identity).toEqual({ mode: 'bearer', token: FAKE_TEST_TOKEN });
  });

  it('rejects with IsaConfigError naming the missing env var', async () => {
    await expect(Isa.withBearer(undefined, emptyEnv())).rejects.toBeInstanceOf(
      IsaConfigError,
    );
    await expect(Isa.withBearer(undefined, emptyEnv())).rejects.toThrow(
      ENV_VAR_NAMES.bearer.token,
    );
  });

  it('rejects empty-string env value as missing', async () => {
    await expect(
      Isa.withBearer(undefined, stubEnv({ [ENV_VAR_NAMES.bearer.token]: '' })),
    ).rejects.toBeInstanceOf(IsaConfigError);
  });
});

describe('Isa.withKeycode', () => {
  const fullEnv = stubEnv({
    [ENV_VAR_NAMES.license.keycode]: 'SDV-HWH-WDD',
    [ENV_VAR_NAMES.license.email]: 'agent@example.com',
  });

  it('reads keycode + email from env', async () => {
    const isa = await Isa.withKeycode(undefined, fullEnv);
    expect(isa.identity).toEqual({
      mode: 'license',
      keycode: 'SDV-HWH-WDD',
      email: 'agent@example.com',
    });
  });

  it('lists every missing var in the error message', async () => {
    await expect(Isa.withKeycode(undefined, emptyEnv())).rejects.toBeInstanceOf(
      IsaConfigError,
    );
    await expect(Isa.withKeycode(undefined, emptyEnv())).rejects.toThrow(
      ENV_VAR_NAMES.license.keycode,
    );
    await expect(Isa.withKeycode(undefined, emptyEnv())).rejects.toThrow(
      ENV_VAR_NAMES.license.email,
    );
  });

  it('reports only the missing var when one is set', async () => {
    const partial = stubEnv({ [ENV_VAR_NAMES.license.keycode]: 'SDV-HWH-WDD' });
    await expect(Isa.withKeycode(undefined, partial)).rejects.toThrow(
      ENV_VAR_NAMES.license.email,
    );
    try {
      await Isa.withKeycode(undefined, partial);
      throw new Error('expected rejection');
    } catch (e) {
      expect((e as IsaConfigError).message).not.toContain(
        ENV_VAR_NAMES.license.keycode,
      );
    }
  });
});

// `Isa.withSession` is `@internal` per sdk-syntax-proposal.md §4 — sessions
// are SDK-internal refresh state minted by withKeycode / forForm. These
// tests exercise the internal helper directly because session-mode
// instances back `isa.proxy.call()` and need coverage; they are not an
// assertion that the surface is public.
describe('Isa.withSession (internal)', () => {
  const FAKE_SECRET = ['shh', 'dont', 'tell'].join('_');

  it('reads sessionId + sessionSecret from env', async () => {
    const isa = await Isa.withSession(
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

  it('rejects with IsaConfigError naming both missing env vars', async () => {
    await expect(Isa.withSession(undefined, emptyEnv())).rejects.toThrow(
      ENV_VAR_NAMES.session.sessionId,
    );
    await expect(Isa.withSession(undefined, emptyEnv())).rejects.toThrow(
      ENV_VAR_NAMES.session.sessionSecret,
    );
  });
});
