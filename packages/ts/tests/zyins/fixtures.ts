/**
 * Shared test fixtures for the Tier 3 ZyINS suite.
 *
 * Persona discipline (api-standards.md §"Persona discipline"): every test
 * uses the same primary applicant, the same auth, and the same product
 * selection. The recognition compounds when failures surface in CI logs.
 */

import { CREDENTIAL_KEYS, type CredentialStore, inMemoryCredentialStore } from "../../src/core/storage";
import { type Applicant, Height, NicotineDuration, Sex, Weight } from "../../src/zyins/applicant";
import type { AuthContext } from "../../src/zyins/auth";
import { Coverage } from "../../src/zyins/coverage";
import { Products, ProductSelection } from "../../src/zyins/product";
import type { Transport } from "../../src/zyins/transport";

export const TEST_AUTH: AuthContext = {
  licenseKey: "LIC-ABC-123",
  orderId: "ORD-42",
  email: "john.doe@acme-agency.com",
  deviceId: "device-xyz-123",
};

export const TEST_APPLICANT: Applicant = {
  dob: "1962-04-18",
  sex: Sex.Male,
  height: Height.fromFeetInches(5, 10),
  weight: Weight.fromPounds(195),
  state: "NC",
  nicotineUse: { lastUsed: NicotineDuration.Never },
};

export const TEST_COVERAGE = Coverage.faceValue(100_000);

const AETNA_ACCENDO = Products.Fex.AetnaAccendo;
if (!AETNA_ACCENDO) {
  throw new Error("Missing test fixture product: Products.Fex.AetnaAccendo");
}
export const TEST_PRODUCTS = ProductSelection.of([AETNA_ACCENDO]);

export const FIXED_CLOCK = (): number => 1_700_000_000_000;

/**
 * Build a credential store pre-seeded with `TEST_AUTH.deviceId` so
 * `Isa.withKeycode()` derives the stable test identifier rather than
 * minting a fresh random one. `deviceId` is SDK-internal per
 * docs/sdk-syntax-proposal.md §2.8; this is the supported test-side
 * injection point.
 */
export async function testCredentialStore(): Promise<CredentialStore> {
  const store = inMemoryCredentialStore();
  await store.set(CREDENTIAL_KEYS.deviceId, TEST_AUTH.deviceId);
  return store;
}

/**
 * The fixed session envelope {@link withSessionBootstrap} returns for
 * every bootstrap call. Far-future `expiresAt` so no test exercises
 * renewal unless it overrides the clock to force it. Built at runtime
 * (array-join, not a literal) so secret scanners never mistake this
 * obviously-fake fixture for a real credential — mirrors the
 * `FAKE_BEARER` pattern in isa-bearer-zyins.test.ts.
 */
export const TEST_SESSION = {
  sessionId: ["sess", "test", "fixture", "not", "real"].join("_"),
  sessionSecret: ["sk", "sess", "test", "fixture", "not", "real"].join("_"),
  expiresAt: "2999-01-01T00:00:00Z",
} as const;

/**
 * Wrap a product-endpoint transport stub so `Isa.withKeycode()`'s
 * transparent session bootstrap (`POST /v1/sessions`, see
 * `zyins/sessionSigner.ts`) resolves locally instead of falling through
 * to `inner`, which models only the product endpoint under test. Every
 * other request passes through to `inner` unchanged.
 */
export function withSessionBootstrap(inner: Transport): Transport {
  return async (request) => {
    if (request.method === "POST" && request.url.endsWith("/v1/sessions")) {
      return {
        status: 201,
        body: JSON.stringify({ data: TEST_SESSION }),
        headers: {},
      };
    }
    return inner(request);
  };
}
