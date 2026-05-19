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
import { type EnvReader } from './logger';
/** Bearer-mode identity. */
export interface BearerIdentity {
    readonly mode: 'bearer';
    readonly token: string;
}
/** License-mode identity (BPP agents). `deviceId` is bound at first run. */
export interface LicenseIdentity {
    readonly mode: 'license';
    readonly keycode: string;
    readonly email: string;
}
/** Session-mode identity (embedded forms). */
export interface SessionIdentity {
    readonly mode: 'session';
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