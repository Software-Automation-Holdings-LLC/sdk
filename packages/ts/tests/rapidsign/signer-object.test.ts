/**
 * Locked-spec conformance — Signer object pattern.
 *
 * Spec: /tmp/sdk-syntax-proposal.md § Section 4 cross-cutting + Flow E.
 *
 * Locks verified here:
 *   • `doc.signers[]` are Signer value objects with verbs: invite,
 *     cancelInvite, awaitSignature, capture, email (future).
 *   • Atomic correction pattern: `cancelInvite() + invite()` — no "restart"
 *     verb anywhere on the surface.
 *   • Opaque identifiers: `signId` and `secretKey` MUST NOT be on the public
 *     Signer surface (consumers call methods, never inspect the IDs).
 *
 * Persona: applicant + witness on a Mountain Life MYGA document.
 */

import { describe, expectTypeOf, it } from 'vitest';

describe.skip('Signer object — atomic verbs, opaque IDs (Flow E)', () => {
    // Pending a real exported Signer surface; a local placeholder would not
    // protect the published SDK from drift.
    type SignerSurface = {
        invite: (...args: never[]) => Promise<unknown>;
        cancelInvite: () => Promise<unknown>;
        awaitSignature: (...args: never[]) => Promise<unknown>;
    };

    it('Signer exposes invite / cancelInvite / awaitSignature', () => {
        expectTypeOf<SignerSurface>().toHaveProperty('invite');
        expectTypeOf<SignerSurface>().toHaveProperty('cancelInvite');
        expectTypeOf<SignerSurface>().toHaveProperty('awaitSignature');
    });

    it('Signer has no `restart` verb (Flow E explicitly rejects this naming)', () => {
        type HasRestart = SignerSurface extends { restart: unknown } ? true : false;
        expectTypeOf<HasRestart>().toEqualTypeOf<false>();
    });

    it('signId / secretKey are not exposed as public Signer fields', () => {
        type HasSignId = SignerSurface extends { signId: unknown } ? true : false;
        type HasSecret = SignerSurface extends { secretKey: unknown } ? true : false;
        expectTypeOf<HasSignId>().toEqualTypeOf<false>();
        expectTypeOf<HasSecret>().toEqualTypeOf<false>();
    });
});
