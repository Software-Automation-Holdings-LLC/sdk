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
import { inject, provide } from 'vue';
import { ZyInsClient } from '../client';
/** Symbol-keyed injection slot. */
export const ZyInsKey = Symbol('zyins:client');
/**
 * Provide a `ZyInsClient` to descendants. Call from `setup()` of a root
 * component (typically `App.vue`) before any descendant calls `useZyIns()`.
 */
export function provideZyIns(config) {
    const client = new ZyInsClient(config);
    provide(ZyInsKey, client);
    return client;
}
/**
 * Composable returning the bound `ZyInsClient`. Throws if used outside a
 * `provideZyIns()` scope — the error message tells you where to fix it.
 */
export function useZyIns() {
    const client = inject(ZyInsKey, null);
    if (!client) {
        throw new Error('useZyIns: called outside provideZyIns(). Call provideZyIns({ auth }) from your root setup().');
    }
    return client;
}
//# sourceMappingURL=useZyIns.js.map