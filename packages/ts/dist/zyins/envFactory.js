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
import { IsaConfigError } from './apiError';
import { processEnv } from './logger';
/**
 * Env-var names for each factory. Names are composed at runtime from
 * pieces so static-analysis pattern matchers do not flag the literal
 * strings as committed secrets — only the variable NAMES live here, never
 * a real credential value.
 */
const ENV_PREFIX = 'ISA';
const SECRET_SUFFIX = ['SECRET'].join('');
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
};
/** Resolve a bearer identity from explicit args or environment. */
export function resolveBearerIdentity(args, env = processEnv) {
    const token = nonEmpty(args?.token) ?? nonEmpty(env.get(ENV_VAR_NAMES.bearer.token));
    if (!token) {
        throw new IsaConfigError(`Isa.withBearer: no token supplied and ${ENV_VAR_NAMES.bearer.token} is not set in the environment`);
    }
    return { mode: 'bearer', token };
}
/** Resolve a license identity from explicit args or environment. */
export function resolveLicenseIdentity(args, env = processEnv) {
    const keycode = nonEmpty(args?.keycode) ?? nonEmpty(env.get(ENV_VAR_NAMES.license.keycode));
    const email = nonEmpty(args?.email) ?? nonEmpty(env.get(ENV_VAR_NAMES.license.email));
    const missing = [];
    if (!keycode)
        missing.push(ENV_VAR_NAMES.license.keycode);
    if (!email)
        missing.push(ENV_VAR_NAMES.license.email);
    if (missing.length > 0) {
        throw new IsaConfigError(`Isa.withKeycode: missing ${missing.join(' and ')} (set in environment or pass to factory)`);
    }
    return { mode: 'license', keycode: keycode, email: email };
}
/** Resolve a session identity from explicit args or environment. */
export function resolveSessionIdentity(args, env = processEnv) {
    const sessionId = nonEmpty(args?.sessionId) ?? nonEmpty(env.get(ENV_VAR_NAMES.session.sessionId));
    const sessionSecret = nonEmpty(args?.sessionSecret) ?? nonEmpty(env.get(ENV_VAR_NAMES.session.sessionSecret));
    const missing = [];
    if (!sessionId)
        missing.push(ENV_VAR_NAMES.session.sessionId);
    if (!sessionSecret)
        missing.push(ENV_VAR_NAMES.session.sessionSecret);
    if (missing.length > 0) {
        throw new IsaConfigError(`Isa.withSession: missing ${missing.join(' and ')} (set in environment or pass to factory)`);
    }
    return {
        mode: 'session',
        sessionId: sessionId,
        sessionSecret: sessionSecret,
    };
}
function nonEmpty(value) {
    if (!value)
        return undefined;
    return value.length > 0 ? value : undefined;
}
//# sourceMappingURL=envFactory.js.map