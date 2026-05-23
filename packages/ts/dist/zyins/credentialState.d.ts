/**
 * In-memory credential state shared between `Isa`, the underlying
 * `ZyInsClient`, and the `LicenseFacade`.
 *
 * The state object's identity is stable across the Isa lifetime; the
 * fields inside it are mutated in place when `license.activate()` returns
 * a fresh license key. Because every sub-client captures the same
 * `AuthContext` reference, the in-place mutation is observed by
 * subsequent calls without any caller re-bootstrap.
 *
 * Persistence is driven through {@link CredentialStore} (passed through
 * from {@link IsaOptions}). The store is the source of truth across
 * process boots; the in-memory state is the source of truth within a
 * single process so per-call AsyncStorage round-trips stay off the hot
 * path.
 */
import { type AuthContext } from './auth';
import { type CredentialStore } from '../core';
/** Snapshot of the credentials needed for one license-mode call. */
export interface LicenseCredentialSnapshot {
    /** BPP keycode (XXX-XXX-XXX). Required at bootstrap. */
    keycode: string;
    /** Login email. Required at bootstrap. */
    email: string;
    /** Per-device id; minted + persisted automatically. */
    deviceId: string;
    /** License key returned by `/v1/licenses/activate`. Empty until activated. */
    licenseKey: string;
    /** Order id; defaults to `keycode` when unspecified. */
    orderId: string;
}
/**
 * Event payload fired when the SDK observes a fresh license key (typically
 * the return value of `license.activate()`). Consumers wire this to
 * React-Query invalidation, analytics, or UI banners.
 */
export interface LicenseRefreshedEvent {
    /** Fresh license key the SDK stashed. */
    licenseKey: string;
    /** Device id signed under for this activation. */
    deviceId: string;
    /** Email the activation was bound to. */
    email: string;
    /** Order id paired with the license key. */
    orderId: string;
}
/** Listener signature for {@link LicenseRefreshedEvent}. */
export type LicenseRefreshedListener = (event: LicenseRefreshedEvent) => void;
/**
 * Holds the shared `AuthContext` reference plus a small event-emitter for
 * `onLicenseRefreshed`. One instance per `Isa`.
 */
export declare class IsaCredentialState {
    /**
     * The single `AuthContext` reference handed to every sub-client. Mutated
     * in place by {@link refreshLicenseKey}.
     */
    readonly auth: AuthContext;
    private readonly keycode;
    private readonly store;
    private readonly listeners;
    constructor(initial: LicenseCredentialSnapshot, store: CredentialStore);
    /** Current snapshot — useful for tests and instrumentation. */
    snapshot(): LicenseCredentialSnapshot;
    /**
     * Subscribe to `onLicenseRefreshed`. Returns an unsubscribe function so
     * callers can detach the listener without holding a reference to the
     * original closure.
     */
    onLicenseRefreshed(listener: LicenseRefreshedListener): () => void;
    /**
     * Update the live `AuthContext` with a fresh license key, persist it to
     * the credential store, and notify subscribers. Called by the
     * `LicenseFacade` after a successful `activate()`.
     */
    refreshLicenseKey(licenseKey: string): Promise<void>;
    /** Clear the stashed license key (post-deactivate). */
    clearLicenseKey(): Promise<void>;
}
//# sourceMappingURL=credentialState.d.ts.map