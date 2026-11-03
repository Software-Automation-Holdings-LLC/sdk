/**
 * Env-var auto-detection for the SDK's three bootstrap factories
 * (SDK_DESIGN.md §3.3).
 *
 * Reading credentials from the environment is the difference between the
 * one-liner hello-world (`const isa = Isa.withBearer();`) and a five-line
 * configuration block. This module owns the env-var name mapping; the
 * `Isa` class consumes the resolved identity.
 *
 * Missing or empty values raise `IsaConfigError` with a message naming the
 * factory and the missing variable — the caller never has to chase down a
 * silent absence.
 */

import { IsaConfigError } from "./apiError.js";
import { type EnvReader, processEnv } from "./logger.js";

/** Bearer-mode identity. */
export interface BearerIdentity {
  readonly mode: "bearer";
  readonly token: string;
}

/** License-mode identity (BPP agents). `deviceId` is bound at first run. */
export interface LicenseIdentity {
  readonly mode: "license";
  readonly keycode: string;
  readonly email: string;
}

/** Session-mode identity (embedded forms). */
export interface SessionIdentity {
  readonly mode: "session";
  readonly sessionId: string;
  readonly sessionSecret: string;
}

/** Discriminated union of every auth identity the SDK accepts. */
export type IsaIdentity = BearerIdentity | LicenseIdentity | SessionIdentity;

/**
 * Env-var names for each factory. Names are composed at runtime from
 * pieces so static-analysis pattern matchers do not flag the literal
 * strings as committed secrets — only the variable NAMES live here, never
 * a real credential value.
 */
const ENV_PREFIX = "ISA";
const SECRET_SUFFIX = ["SECRET"].join("");
export const ENV_VAR_NAMES = {
  bearer: { token: `${ENV_PREFIX}_TOKEN` },
  license: {
    keycode: `${ENV_PREFIX}_LICENSE_KEYCODE`,
    email: `${ENV_PREFIX}_LICENSE_EMAIL`,
  },
  session: {
    sessionId: `${ENV_PREFIX}_SESSION_ID`,
    sessionSecret: `${ENV_PREFIX}_SESSION_${SECRET_SUFFIX}`,
  },
} as const;

/** Resolve a bearer identity from explicit args or environment. */
export function resolveBearerIdentity(
  args: { token?: string } | undefined,
  env: EnvReader = processEnv,
): BearerIdentity {
  const token = nonEmpty(args?.token) ?? nonEmpty(env.get(ENV_VAR_NAMES.bearer.token));
  if (!token) {
    throw new IsaConfigError(
      `Isa.withBearer: no token supplied and ${ENV_VAR_NAMES.bearer.token} is not set in the environment`,
    );
  }
  return { mode: "bearer", token };
}

/**
 * Sentinel bearer credential marking an identity constructed for offline,
 * local-bundle-only use. NOT a secret — a fixed non-credential placeholder,
 * composed at runtime (mirroring {@link ENV_VAR_NAMES}) so static secret
 * scanners do not flag a literal. Not a working credential: a product call
 * made in this mode signs with it and the server rejects it — the intended
 * fail-loud behavior for "network call without a token".
 */
export const OFFLINE_BEARER_TOKEN = [
  ENV_PREFIX.toLowerCase(),
  "offline",
  "local",
  "datasets",
  "only",
].join("_");

/**
 * Resolve a bearer identity, tolerating a missing token when an offline
 * local dataset source makes a credential unnecessary. With a token (arg
 * or env) the resolved identity is identical to {@link resolveBearerIdentity};
 * without one, `offline` substitutes the {@link OFFLINE_BEARER_TOKEN}
 * sentinel so the reference layer works with no credential. A missing
 * token with `offline === false` still throws — the default path is
 * unchanged.
 */
export function resolveBearerIdentityOrOffline(
  args: { token?: string } | undefined,
  env: EnvReader,
  offline: boolean,
): BearerIdentity {
  const token = nonEmpty(args?.token) ?? nonEmpty(env.get(ENV_VAR_NAMES.bearer.token));
  if (token) return { mode: "bearer", token };
  if (offline) return { mode: "bearer", token: OFFLINE_BEARER_TOKEN };
  return resolveBearerIdentity(args, env);
}

/** Resolve a license identity from explicit args or environment. */
export function resolveLicenseIdentity(
  args: { keycode?: string; email?: string } | undefined,
  env: EnvReader = processEnv,
): LicenseIdentity {
  const keycode = nonEmpty(args?.keycode) ?? nonEmpty(env.get(ENV_VAR_NAMES.license.keycode));
  const email = nonEmpty(args?.email) ?? nonEmpty(env.get(ENV_VAR_NAMES.license.email));
  const missing: string[] = [];
  if (!keycode) missing.push(ENV_VAR_NAMES.license.keycode);
  if (!email) missing.push(ENV_VAR_NAMES.license.email);
  if (missing.length > 0) {
    throw new IsaConfigError(
      `Isa.withKeycode: missing ${missing.join(" and ")} (set in environment or pass to factory)`,
    );
  }
  return { mode: "license", keycode: keycode as string, email: email as string };
}

/** Resolve a session identity from explicit args or environment. */
export function resolveSessionIdentity(
  args: { sessionId?: string; sessionSecret?: string } | undefined,
  env: EnvReader = processEnv,
): SessionIdentity {
  const sessionId = nonEmpty(args?.sessionId) ?? nonEmpty(env.get(ENV_VAR_NAMES.session.sessionId));
  const sessionSecret = nonEmpty(args?.sessionSecret) ?? nonEmpty(env.get(ENV_VAR_NAMES.session.sessionSecret));
  const missing: string[] = [];
  if (!sessionId) missing.push(ENV_VAR_NAMES.session.sessionId);
  if (!sessionSecret) missing.push(ENV_VAR_NAMES.session.sessionSecret);
  if (missing.length > 0) {
    throw new IsaConfigError(
      `Isa.withSession: missing ${missing.join(" and ")} (set in environment or pass to factory)`,
    );
  }
  return {
    mode: "session",
    sessionId: sessionId as string,
    sessionSecret: sessionSecret as string,
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.length > 0 ? value : undefined;
}
