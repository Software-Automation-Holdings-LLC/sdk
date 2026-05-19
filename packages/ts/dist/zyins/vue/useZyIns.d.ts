/**
 * Vue 3 Tier 3 binding for the ZyINS client.
 *
 * Implements the context-bound idiom from ADR-035 using Vue's
 * `provide`/`inject`. App setup calls `provideZyIns(config)` once;
 * component setup calls `useZyIns()` and gets the bound client.
 *
 * Peer dependency: vue ^3.0. The import is type-only so consumers without
 * Vue installed do not pull it into their bundle.
 */
import { type InjectionKey } from 'vue';
import { type AuthContext } from '../auth';
import { ZyInsClient, type ZyInsClientOptions } from '../client';
/** Provider config shape mirrors the React provider's. */
export interface ZyInsProviderConfig extends Omit<ZyInsClientOptions, 'auth'> {
    auth: AuthContext;
}
/** Symbol-keyed injection slot. */
export declare const ZyInsKey: InjectionKey<ZyInsClient>;
/**
 * Provide a `ZyInsClient` to descendants. Call from `setup()` of a root
 * component (typically `App.vue`) before any descendant calls `useZyIns()`.
 */
export declare function provideZyIns(config: ZyInsProviderConfig): ZyInsClient;
/**
 * Composable returning the bound `ZyInsClient`. Throws if used outside a
 * `provideZyIns()` scope — the error message tells you where to fix it.
 */
export declare function useZyIns(): ZyInsClient;
//# sourceMappingURL=useZyIns.d.ts.map