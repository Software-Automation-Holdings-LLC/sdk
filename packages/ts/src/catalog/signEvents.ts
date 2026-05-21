/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - isa-platform/shared/go/events/registry.go
 */

/**
 * RapidSign webhook event types. The wire string is the EventBridge
 * `detail-type` value the platform emits.
 */
export enum SignEvent {

}

export const SignEventLabels: Readonly<Record<SignEvent, string>> = Object.freeze({

}) as Readonly<Record<SignEvent, string>>;
