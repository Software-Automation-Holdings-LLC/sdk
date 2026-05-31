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

import { type AuthContext } from './auth.js';
import { type CredentialStore, CREDENTIAL_KEYS } from '../core/index.js';

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
export class IsaCredentialState {
  /**
   * The single `AuthContext` reference handed to every sub-client. Mutated
   * in place by {@link refreshLicenseKey}.
   */
  readonly auth: AuthContext;
  private readonly keycode: string;
  private readonly store: CredentialStore;
  private readonly listeners = new Set<LicenseRefreshedListener>();

  constructor(initial: LicenseCredentialSnapshot, store: CredentialStore) {
    this.keycode = initial.keycode;
    this.auth = {
      licenseKey: initial.licenseKey,
      orderId: initial.orderId,
      email: initial.email,
      deviceId: initial.deviceId,
    };
    this.store = store;
  }

  /** Current snapshot — useful for tests and instrumentation. */
  snapshot(): LicenseCredentialSnapshot {
    return {
      keycode: this.keycode,
      email: this.auth.email,
      deviceId: this.auth.deviceId,
      licenseKey: this.auth.licenseKey,
      orderId: this.auth.orderId,
    };
  }

  /**
   * Subscribe to `onLicenseRefreshed`. Returns an unsubscribe function so
   * callers can detach the listener without holding a reference to the
   * original closure.
   */
  onLicenseRefreshed(listener: LicenseRefreshedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update the live `AuthContext` with a fresh license key, persist it to
   * the credential store, and notify subscribers. Called by the
   * `LicenseFacade` after a successful `activate()`.
   */
  async refreshLicenseKey(licenseKey: string): Promise<void> {
    try {
      await this.store.set(CREDENTIAL_KEYS.licenseKey, licenseKey);
    } catch {
      // Persistence is best-effort; in-memory state remains authoritative
      // for the active process.
    }
    this.auth.licenseKey = licenseKey;
    const event: LicenseRefreshedEvent = {
      licenseKey,
      deviceId: this.auth.deviceId,
      email: this.auth.email,
      orderId: this.auth.orderId,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listeners are side-effect-only; their failures must not break
        // the activation flow. The SDK does not log here so consumers
        // can layer their own observability without double-emission.
      }
    }
  }

  /** Clear the stashed license key (post-deactivate). */
  async clearLicenseKey(): Promise<void> {
    try {
      await this.store.remove(CREDENTIAL_KEYS.licenseKey);
    } catch {
      // Persistence is best-effort; in-memory state remains authoritative
      // for the active process.
    }
    this.auth.licenseKey = '';
  }
}
