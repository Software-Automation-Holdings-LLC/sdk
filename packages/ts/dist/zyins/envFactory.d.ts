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
import { type EnvReader } from "./logger.js";
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
export declare const ENV_VAR_NAMES: {
    readonly bearer: {
        readonly token: "ISA_TOKEN";
    };
    readonly license: {
        readonly keycode: "ISA_LICENSE_KEYCODE";
        readonly email: "ISA_LICENSE_EMAIL";
    };
    readonly session: {
        readonly sessionId: "ISA_SESSION_ID";
        readonly sessionSecret: `ISA_SESSION_${string}`;
    };
};
/** Resolve a bearer identity from explicit args or environment. */
export declare function resolveBearerIdentity(args: {
    token?: string;
} | undefined, env?: EnvReader): BearerIdentity;
/**
 * Sentinel bearer credential marking an identity constructed for offline,
 * local-bundle-only use. NOT a secret — a fixed non-credential placeholder,
 * composed at runtime (mirroring {@link ENV_VAR_NAMES}) so static secret
 * scanners do not flag a literal. Not a working credential: a product call
 * made in this mode signs with it and the server rejects it — the intended
 * fail-loud behavior for "network call without a token".
 */
export declare const OFFLINE_BEARER_TOKEN: string;
/**
 * Resolve a bearer identity, tolerating a missing token when an offline
 * local dataset source makes a credential unnecessary. With a token (arg
 * or env) the resolved identity is identical to {@link resolveBearerIdentity};
 * without one, `offline` substitutes the {@link OFFLINE_BEARER_TOKEN}
 * sentinel so the reference layer works with no credential. A missing
 * token with `offline === false` still throws — the default path is
 * unchanged.
 */
export declare function resolveBearerIdentityOrOffline(args: {
    token?: string;
} | undefined, env: EnvReader, offline: boolean): BearerIdentity;
/** Resolve a license identity from explicit args or environment. */
export declare function resolveLicenseIdentity(args: {
    keycode?: string;
    email?: string;
} | undefined, env?: EnvReader): LicenseIdentity;
/** Resolve a session identity from explicit args or environment. */
export declare function resolveSessionIdentity(args: {
    sessionId?: string;
    sessionSecret?: string;
} | undefined, env?: EnvReader): SessionIdentity;
//# sourceMappingURL=envFactory.d.ts.map