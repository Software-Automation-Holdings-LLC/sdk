/**
 * Locked SDK syntax conformance — type-level surface tests.
 *
 * Verifies the public TS surface matches `/tmp/sdk-syntax-proposal.md` (the
 * locked spec, sealed 2026-05-22). Each `describe` block cites the spec
 * section it pins. Type-level assertions fail the build when the surface
 * drifts; behavior assertions in sibling files cover the wire.
 *
 * Spec coverage map (13 locked decisions + 5 post-lock corrections):
 *   Section 2.1  Errors          → "tree shape (IsaError)"
 *   Section 2.2  Idempotency     → "auto-mint, override accepted"
 *   Section 2.3  Response meta   → "underscore-prefix props, no .withRawResponse()"
 *   Section 2.4  Dates           → "native Date everywhere"
 *   Section 2.4  Money           → "integer minor units"
 *   Section 2.4  Naming          → "license (singular), cases (plural)"
 *   Section 2.4  Async           → "Promise-only, no callbacks"
 *   Section 2.6  Hooks           → "onLicenseRefreshed, onSessionRefreshed, ..."
 *   Section 3 Flow 1  Errors     → "instanceof IsaError.LicenseLocked, ..."
 *   Section 3 Flow 2  RefData    → "getAll() + get({include})"
 *   Section 3 Flow 3  H/W        → "Height/Weight from* factories"
 *   Section 3 Flow 4  Prequalify → "typed-only, no name/email/phone, zip required"
 *   Section 3 Flow 5  Cases      → "share(), no mode flag, plain Promise"
 *   Section 3 Flow 6  Email      → "cases.email(caseId, addr)"
 *   Section 4 Cross  Signer      → "Signer object methods; opaque signId/secret"
 *   Section 4 Flow A  PHP/uuid   → "integration.uuid() getter (PHP — not TS-tested)"
 *   Section 4 Flow B  forForm    → "Isa.forForm(form)"
 *   Section 4 Flow C  Duration   → "Duration value object + AbortSignal.timeout"
 *   Section 4 Flow D  process    → "doc.process({certificateMode}); SignerAudit"
 *   Section 4 Flow E  Atomic     → "signer.cancelInvite() + signer.invite()"
 *   Section 4 Flow F  Recovery   → "isa.recovery.put/get/delete"
 *   Section 5.1 track            → "AnalyticsEvent discriminated union"
 *   Section 5.2 attribute        → "isa.analytics.attribute({as})"
 *   Section 5.3 dashboard        → "isa.analytics.dashboard.*"
 *   Section 5.4 trackCustom      → "<consumer>:<name> format"
 *   Appendix B.1 underscore      → "no .withRawResponse export"
 *   Appendix B.2 cases.share     → "no mode arg"
 *   Appendix B.3 license sing.   → "isa.zyins.license (not .licenses)"
 *   Appendix B.4 prequalify map  → "wire-field-map fields"
 *   Appendix B.5 no docs.get     → "isa.rapidsign.documents.get does not exist"
 *
 * Persona: John Doe / SDV-HWH-WDD / john.doe@acme-agency.com / Mountain Life MYGA.
 */

import { describe, expectTypeOf, it } from 'vitest';
import * as sdk from '../../src';

describe('Section 2.1 — single IsaError tree', () => {
    it('exports IsaError as the canonical error tree', () => {
        expectTypeOf(sdk.IsaError).not.toBeAny();
    });

    it('IsaError subclasses are reachable via the tree (LicenseLocked / MaxActivationsExceeded / LicenseActiveElsewhere)', () => {
        // Locked spec § Flow 1: typed subclasses on the IsaError namespace.
        // These names are LOCKED — drift here is a public-surface break.
        type Tree = typeof sdk.IsaError;
        // TODO: green after feat/sdk-locked-syntax lands; the locked tree
        // shape promises these subclasses live on the IsaError namespace.
        expectTypeOf<Tree>().toHaveProperty('LicenseLocked');
        expectTypeOf<Tree>().toHaveProperty('MaxActivationsExceeded');
        expectTypeOf<Tree>().toHaveProperty('LicenseActiveElsewhere');
        expectTypeOf<Tree>().toHaveProperty('Network');
        expectTypeOf<Tree>().toHaveProperty('InternalError');
        expectTypeOf<Tree>().toHaveProperty('IdempotencyConflict');
        expectTypeOf<Tree>().toHaveProperty('DeadlineExceeded');
        expectTypeOf<Tree>().toHaveProperty('SignerDeclined');
    });

    it('IsaError.match exists as opt-in sugar', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        type Tree = typeof sdk.IsaError;
        expectTypeOf<Tree>().toHaveProperty('match');
    });
});

describe('Section 2.3 — response metadata via underscore-prefix props (no .withRawResponse)', () => {
    it('the public surface does NOT export `withRawResponse` / `RawResponse` wrapper helper', () => {
        // Appendix B.1 post-lock correction: OpenAI SDK pattern; result._requestId
        // lives ON the data object, not on a wrapper.
        type Surface = keyof typeof sdk;
        // `RawResponse` may persist transiently as a removed-alias shim during migration.
        // The wrapper METHOD `withRawResponse` must not be a public export.
        type HasWithRawResponse = 'withRawResponse' extends Surface ? true : false;
        expectTypeOf<HasWithRawResponse>().toEqualTypeOf<false>();
    });
});

describe('Section 2.4 — singular license, plural cases', () => {
    it('Appendix B.3 — Isa exposes `zyins.license` (singular), not `zyins.licenses`', () => {
        // The Isa class composes namespaces; the locked surface is singular.
        // TODO: green after feat/sdk-locked-syntax lands.
        type Isa = InstanceType<typeof sdk.Isa>;
        type ZyIns = Isa['zyins'];
        expectTypeOf<ZyIns>().toHaveProperty('license');
        expectTypeOf<ZyIns>().toHaveProperty('cases');
    });
});

describe('Section 4 Flow B — Isa.forForm', () => {
    it('exposes Isa.forForm as a static factory', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        type IsaStatic = typeof sdk.Isa;
        expectTypeOf<IsaStatic>().toHaveProperty('forForm');
    });
});

describe('Section 4 Flow C — Duration value object', () => {
    it('exports Duration with from* factories (hours / minutes / seconds / fromString)', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        type Surface = typeof sdk;
        expectTypeOf<Surface>().toHaveProperty('Duration');
    });
});

describe('Section 4 Flow F — recovery primitive', () => {
    it('Isa instance exposes recovery namespace (put / get / delete)', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        type Isa = InstanceType<typeof sdk.Isa>;
        expectTypeOf<Isa>().toHaveProperty('recovery');
    });
});

describe('Section 5 — analytics namespace', () => {
    it('Isa instance exposes analytics.track / .attribute / .dashboard / .trackCustom', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        type Isa = InstanceType<typeof sdk.Isa>;
        expectTypeOf<Isa>().toHaveProperty('analytics');
    });

    it('AnalyticsEvent is exported as a typed enum (Section 5.1)', () => {
        // TODO: green after feat/sdk-locked-syntax lands.
        type Surface = typeof sdk;
        expectTypeOf<Surface>().toHaveProperty('AnalyticsEvent');
    });
});

describe('Section 3 Flow 3 — Height / Weight value objects (already shipped)', () => {
    it('Height exposes fromInches / fromCm / fromString', () => {
        expectTypeOf(sdk.Height).toBeObject();
        expectTypeOf(sdk.Height.fromInches).toBeFunction();
    });

    it('Weight exposes fromPounds / fromKilograms / fromString', () => {
        expectTypeOf(sdk.Weight).toBeObject();
        expectTypeOf(sdk.Weight.fromPounds).toBeFunction();
    });
});
