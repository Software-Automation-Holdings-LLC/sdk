/**
 * React Tier 3 binding for the ZyINS client.
 *
 * Implements the context-bound idiom from ADR-035: a provider binds an
 * `AuthContext` once at app setup; component-level hooks call `useZyIns()`
 * and get a memoized client bound to that auth. Call sites never thread
 * `auth` through props.
 *
 * Peer dependency: React 18+. The import is type-only so consumers without
 * React installed (CLI, Node services) can still depend on the SDK without
 * pulling React into their bundle — they simply do not import this file.
 */
import { type ReactNode } from 'react';
import { type AuthContext } from '../auth';
import { ZyInsClient, type ZyInsClientOptions } from '../client';
/** Shape carried by the provider. Extends auth with optional client overrides. */
export interface ZyInsProviderConfig extends Omit<ZyInsClientOptions, 'auth'> {
    auth: AuthContext;
}
/**
 * Provider component. Wrap the app (or a subtree) so descendants can call
 * `useZyIns()`. The provider re-constructs the client when `auth`,
 * `baseUrl`, `transport`, or `clock` change — referential stability on
 * those values is the caller's responsibility.
 */
export declare function ZyInsProvider(props: {
    config: ZyInsProviderConfig;
    children: ReactNode;
}): ReactNode;
/**
 * Hook returning the bound `ZyInsClient`. Throws if used outside a
 * `<ZyInsProvider>` — bind once at the app root and the error message
 * tells you where to fix it.
 */
export declare function useZyIns(): ZyInsClient;
//# sourceMappingURL=useZyIns.d.ts.map