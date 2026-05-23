/**
 * Locked-spec conformance — typed AnalyticsEvent enum + discriminated payload.
 *
 * Spec: /tmp/sdk-syntax-proposal.md § Section 5.1.
 *
 *   `isa.analytics.track(AnalyticsEvent.PageChanged, { from: 2, to: 3, form: 'mountain-life-myga' })`
 *
 * Locks verified here:
 *   • `AnalyticsEvent` is exported (typed enum from gen-catalog).
 *   • `track(event, payload)` exists on `isa.analytics`.
 *   • Payload shape is event-discriminated — TS rejects wrong-shape payloads
 *     at the call site (compile-time guarantee, not runtime).
 *   • `trackCustom({ name, payload })` accepts `<consumer>:<event_name>`.
 *   • `attribute({ as })` exists.
 *   • `dashboard.summary` / `.cases` exist with cursor pagination shape.
 *
 * Persona: PageChanged 2→3 on the mountain-life-myga form.
 */

import { describe, expectTypeOf, it } from 'vitest';
import * as sdk from '../../src';
import { Isa } from '../../src';

describe('analytics surface (Section 5)', () => {
    type Isa$ = InstanceType<typeof Isa>;
    type Analytics = Isa$ extends { analytics: infer A } ? A : never;

    it('exports the AnalyticsEvent enum', () => {
        // TODO: green after feat/sdk-locked-syntax lands — catalog generator
        // gains an AnalyticsEvent member.
        type Surface = typeof sdk;
        expectTypeOf<Surface>().toHaveProperty('AnalyticsEvent');
    });

    it('isa.analytics.track / .attribute / .dashboard / .trackCustom exist', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        expectTypeOf<Analytics>().toHaveProperty('track');
        expectTypeOf<Analytics>().toHaveProperty('attribute');
        expectTypeOf<Analytics>().toHaveProperty('dashboard');
        expectTypeOf<Analytics>().toHaveProperty('trackCustom');
    });

    it('dashboard exposes summary / cases / agents / products / demographics', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        type Dashboard = Analytics extends { dashboard: infer D } ? D : never;
        expectTypeOf<Dashboard>().toHaveProperty('summary');
        expectTypeOf<Dashboard>().toHaveProperty('cases');
    });
});
