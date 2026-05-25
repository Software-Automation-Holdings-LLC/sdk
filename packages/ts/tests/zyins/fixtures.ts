/**
 * Shared test fixtures for the Tier 3 ZyINS suite.
 *
 * Persona discipline (api-standards.md §"Persona discipline"): every test
 * uses the same primary applicant, the same auth, and the same product
 * selection. The recognition compounds when failures surface in CI logs.
 */

import type { AuthContext } from '../../src/zyins/auth';
import {
  type Applicant,
  Sex,
  NicotineDuration,
  Height,
  Weight,
} from '../../src/zyins/applicant';
import { Coverage } from '../../src/zyins/coverage';
import { Products, ProductSelection } from '../../src/zyins/product';

export const TEST_AUTH: AuthContext = {
  licenseKey: 'LIC-ABC-123',
  orderId: 'ORD-42',
  email: 'john.doe@acme-agency.com',
  deviceId: 'device-xyz-123',
};

export const TEST_APPLICANT: Applicant = {
  dob: '1962-04-18',
  sex: Sex.Male,
  height: Height.fromFeetInches(5, 10),
  weight: Weight.fromPounds(195),
  state: 'NC',
  nicotineUse: { lastUsed: NicotineDuration.Never },
};

export const TEST_COVERAGE = Coverage.faceValue(100_000);

const AETNA_ACCENDO = Products.Fex.AetnaAccendo;
if (!AETNA_ACCENDO) {
  throw new Error('Missing test fixture product: Products.Fex.AetnaAccendo');
}
export const TEST_PRODUCTS = ProductSelection.of([AETNA_ACCENDO]);

export const FIXED_CLOCK = (): number => 1_700_000_000_000;
