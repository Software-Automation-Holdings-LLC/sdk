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

import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { type AuthContext } from '../auth.js';
import { ZyInsClient, type ZyInsClientOptions } from '../client.js';

/** Shape carried by the provider. Extends auth with optional client overrides. */
export interface ZyInsProviderConfig extends Omit<ZyInsClientOptions, 'auth'> {
  auth: AuthContext;
}

const ZyInsContext = createContext<ZyInsClient | null>(null);

/**
 * Provider component. Wrap the app (or a subtree) so descendants can call
 * `useZyIns()`. The provider re-constructs the client when `auth`,
 * `baseUrl`, `transport`, `clock`, or `logosFetch` change — referential
 * stability on those values is the caller's responsibility.
 */
export function ZyInsProvider(props: { config: ZyInsProviderConfig; children: ReactNode }): ReactNode {
  const { config, children } = props;
  const client = useMemo(
    () => new ZyInsClient(config),
    [config.auth, config.baseUrl, config.transport, config.clock, config.logosFetch],
  );
  return createElement(ZyInsContext.Provider, { value: client }, children);
}

/**
 * Hook returning the bound `ZyInsClient`. Throws if used outside a
 * `<ZyInsProvider>` — bind once at the app root and the error message
 * tells you where to fix it.
 */
export function useZyIns(): ZyInsClient {
  const client = useContext(ZyInsContext);
  if (!client) {
    throw new Error('useZyIns: called outside <ZyInsProvider>. Wrap your app root with <ZyInsProvider config={{ auth }} />.');
  }
  return client;
}
