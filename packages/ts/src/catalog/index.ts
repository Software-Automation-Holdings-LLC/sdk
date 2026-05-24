/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - (barrel re-export of every catalog module in this directory)
 */

export { Product, Products, type ProductMetadata } from './products';
export {
  ProductType,
  Products as ProductsByType,
  type Product as TypedProduct,
  type ProductTypeValue,
} from './productsByType';
export { State, States, type StateMetadata } from './states';
export { ProductCarriers, type ProductCarrierMetadata } from './carriers';
export { ConditionCategories, type ConditionCategoryMetadata } from './conditions';
export { MedicationUses, type MedicationUseMetadata } from './medications';
export { Scope, ScopeDescriptions } from './scopes';
export { SignEvent, SignEventLabels } from './signEvents';
export { ErrorCode, ErrorAdviceCodes, ErrorDocUrls } from './errors';
