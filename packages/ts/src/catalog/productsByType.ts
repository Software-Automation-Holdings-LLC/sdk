/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */

/** Coarse product family. The `wireToken` is the server's class identifier. */
export const ProductType = {
  FinalExpense:       { wireToken: 'fex',     displayName: 'Final Expense',       namespaceKey: 'Fex'     },
  MedicareSupplement: { wireToken: 'medsup',  displayName: 'Medicare Supplement', namespaceKey: 'Medsup'  },
  Preneed:            { wireToken: 'preneed', displayName: 'Preneed',             namespaceKey: 'Preneed' },
  Term:               { wireToken: 'term',    displayName: 'Term',                namespaceKey: 'Term'    },
} as const;

export type ProductTypeValue = (typeof ProductType)[keyof typeof ProductType];

/** A typed product. Stable across SDK releases inside one wire major. */
export interface Product {
  /**
   * Opaque product id (`prod_<uuid>`). The only stable identity for a product.
   * This is the value the v3 prequalify `products[]` filter matches — pass this
   * product (or `ProductSelection.of([...])`) and the SDK serializes this id.
   * Slugs are mutable display data; the id is not.
   */
  readonly id: string;
  readonly displayName: string;
  readonly productType: ProductTypeValue;
  /** Carrier brand extracted from the display name (first 1–2 words). */
  readonly carrier: string;
}

const FEX_PRODUCTS = {
  AetnaAccendo: Object.freeze({ id: "prod_d7b57156-3e83-506b-8936-0692c1193dc7", displayName: "Aetna Accendo", productType: ProductType.FinalExpense, carrier: "Aetna" }) as Product,
  AetnaProtectionSeries: Object.freeze({ id: "prod_2ebf0de6-7151-59cb-8a3a-745be5255aa0", displayName: "Aetna Protection Series", productType: ProductType.FinalExpense, carrier: "Aetna" }) as Product,
  AflacFinalExpense: Object.freeze({ id: "prod_2eaabda5-ea10-5803-b9fd-f92c0261a9c9", displayName: "Aflac Final Expense", productType: ProductType.FinalExpense, carrier: "Aflac" }) as Product,
  AmericanAmicableClearChoice: Object.freeze({ id: "prod_76ea329c-3e29-539c-9cc4-fe8753bbf8c8", displayName: "American Amicable Clear Choice", productType: ProductType.FinalExpense, carrier: "American" }) as Product,
  AmericanAmicableDignitySolutions: Object.freeze({ id: "prod_444bd8e6-1253-5837-9f30-e3e4efe721b2", displayName: "American Amicable Dignity Solutions", productType: ProductType.FinalExpense, carrier: "American" }) as Product,
  AmericanAmicableGoldenSolution: Object.freeze({ id: "prod_b630f531-dd7b-48e2-8f2f-1b03b97ed2f9", displayName: "American Amicable Golden Solution", productType: ProductType.FinalExpense, carrier: "American" }) as Product,
  AmericanAmicableInnovativeSolutions: Object.freeze({ id: "prod_1a546f99-9e24-4aec-b80d-99f8a0641230", displayName: "American Amicable Innovative Solutions", productType: ProductType.FinalExpense, carrier: "American" }) as Product,
  AmericanAmicablePlatinumSolutionLegacyPlan: Object.freeze({ id: "prod_fbf0beb6-5933-5810-8973-675454c64e54", displayName: "American Amicable Platinum Solution Legacy Plan", productType: ProductType.FinalExpense, carrier: "American" }) as Product,
  AmericanAmicableSeniorChoice: Object.freeze({ id: "prod_6b8e3fdb-79da-4e0c-81f5-534aaca277dd", displayName: "American Amicable Senior Choice", productType: ProductType.FinalExpense, carrier: "American" }) as Product,
  AmericanAmicableTribute: Object.freeze({ id: "prod_a9725d37-f0c9-429b-94fb-c5c4d1fa1d53", displayName: "American Amicable Tribute", productType: ProductType.FinalExpense, carrier: "American" }) as Product,
  AmericanHomeLifeGuidestar: Object.freeze({ id: "prod_9e575f61-4618-53cf-b321-6038b98c4ea5", displayName: "American Home Life Guidestar", productType: ProductType.FinalExpense, carrier: "American" }) as Product,
  AmericanHomeLifePatriotSeries: Object.freeze({ id: "prod_18005d37-9bee-588a-81e6-9f3ba641da35", displayName: "American Home Life Patriot Series", productType: ProductType.FinalExpense, carrier: "American" }) as Product,
  AmericoEaglePremier: Object.freeze({ id: "prod_14bbd5ef-adb9-575a-ba14-45da192bc0a3", displayName: "Americo Eagle Premier", productType: ProductType.FinalExpense, carrier: "Americo" }) as Product,
  BaltimoreLifeIprovide: Object.freeze({ id: "prod_44937aff-cd7f-4484-b6d3-3dc84cd73491", displayName: "Baltimore Life iProvide", productType: ProductType.FinalExpense, carrier: "Baltimore" }) as Product,
  BaltimoreLifeSilverGuard: Object.freeze({ id: "prod_4cda675a-9760-51ac-bb70-1e33e83502be", displayName: "Baltimore Life Silver Guard", productType: ProductType.FinalExpense, carrier: "Baltimore" }) as Product,
  BetterlifeFinalExpense: Object.freeze({ id: "prod_e0cbd195-3967-5127-b9d7-9d763f9812b9", displayName: "BetterLife Final Expense", productType: ProductType.FinalExpense, carrier: "BetterLife" }) as Product,
  CentrianLivingLegacy: Object.freeze({ id: "prod_ad1bf475-7997-5d4b-9034-bf9d4f0a0494", displayName: "Centrian Living Legacy", productType: ProductType.FinalExpense, carrier: "Centrian" }) as Product,
  CicaLifeSuperiorChoice: Object.freeze({ id: "prod_0940211a-bc9b-509b-ae1a-6e279eed776b", displayName: "CICA Life Superior Choice", productType: ProductType.FinalExpense, carrier: "CICA" }) as Product,
  CignaIndividualWholeLife: Object.freeze({ id: "prod_b11f7348-2716-5dae-b588-ed2a54ac4c04", displayName: "Cigna Individual Whole Life", productType: ProductType.FinalExpense, carrier: "Cigna" }) as Product,
  CombinedGenerationalLife: Object.freeze({ id: "prod_50911138-79a1-4c20-911a-a37a3054e01a", displayName: "Combined Generational Life", productType: ProductType.FinalExpense, carrier: "Combined" }) as Product,
  CorebridgeGiwl: Object.freeze({ id: "prod_e49fed5b-0803-480f-9ac4-8774353681ab", displayName: "Corebridge GIWL", productType: ProductType.FinalExpense, carrier: "Corebridge" }) as Product,
  CorebridgeSimplinowLegacy: Object.freeze({ id: "prod_7eb671f1-781f-432d-b887-85195902c1cb", displayName: "Corebridge SimpliNow Legacy", productType: ProductType.FinalExpense, carrier: "Corebridge" }) as Product,
  EmcEasylife: Object.freeze({ id: "prod_e1bda62f-59ba-5770-b4a4-9a3df49243bf", displayName: "EMC EasyLife", productType: ProductType.FinalExpense, carrier: "EMC" }) as Product,
  EverestIaAmericanAdvantage50Plus: Object.freeze({ id: "prod_bb930420-5ed3-5d8a-94f5-a6d9d0571179", displayName: "Everest IA American Advantage 50 Plus", productType: ProductType.FinalExpense, carrier: "Everest" }) as Product,
  FamilyBenefitLifeGoldenEagle: Object.freeze({ id: "prod_8b224dea-1a89-55ed-8e76-b394d707da1b", displayName: "Family Benefit Life Golden Eagle", productType: ProductType.FinalExpense, carrier: "Family" }) as Product,
  FidelityLifeRapidecision: Object.freeze({ id: "prod_510ecb6e-5801-53b3-89aa-d578ead5b623", displayName: "Fidelity Life RAPIDecision", productType: ProductType.FinalExpense, carrier: "Fidelity" }) as Product,
  FidelityLifeRapidecisionSeniorLife: Object.freeze({ id: "prod_39f74284-c3a3-5ef4-a499-96c80246e57f", displayName: "Fidelity Life RAPIDecision Senior Life", productType: ProductType.FinalExpense, carrier: "Fidelity" }) as Product,
  FirstGuarantyInsuranceSecurityCare: Object.freeze({ id: "prod_f7143a73-aac8-55c7-9f7f-a69462cb5b7e", displayName: "First Guaranty Insurance Security Care", productType: ProductType.FinalExpense, carrier: "First" }) as Product,
  ForestersPlanRight: Object.freeze({ id: "prod_9577974b-a9f3-5da2-9855-1924074044dd", displayName: "Foresters Plan Right", productType: ProductType.FinalExpense, carrier: "Foresters" }) as Product,
  GerberLife: Object.freeze({ id: "prod_dc4e84b8-8099-51c9-ae31-37c78c0a8d39", displayName: "Gerber Life", productType: ProductType.FinalExpense, carrier: "Gerber" }) as Product,
  GpmLifeSecureMark: Object.freeze({ id: "prod_83b78dd8-a77b-558e-9b3b-c9cc5251c613", displayName: "GPM Life Secure Mark", productType: ProductType.FinalExpense, carrier: "GPM" }) as Product,
  GtlHeritagePlan: Object.freeze({ id: "prod_142e101a-749e-4e28-90ea-2f8fed3b6970", displayName: "GTL Heritage Plan", productType: ProductType.FinalExpense, carrier: "GTL" }) as Product,
  IllinoisMutualPathProtectorPlus: Object.freeze({ id: "prod_e2aea5b2-316d-5150-8504-2e3c2a4e3276", displayName: "Illinois Mutual Path Protector Plus", productType: ProductType.FinalExpense, carrier: "Illinois" }) as Product,
  KskjFinalExpense: Object.freeze({ id: "prod_d93892e6-0035-5f82-8427-1bd9e49b1959", displayName: "KSKJ Final Expense", productType: ProductType.FinalExpense, carrier: "KSKJ" }) as Product,
  LibertyBankersSimpl: Object.freeze({ id: "prod_fe3498ec-29a7-5dba-9da9-6a32cb3dc91e", displayName: "Liberty Bankers Simpl", productType: ProductType.FinalExpense, carrier: "Liberty" }) as Product,
  LifeShieldSurvivor: Object.freeze({ id: "prod_d155e90c-cba1-51cf-9d9c-e6518fa13d37", displayName: "Life Shield Survivor", productType: ProductType.FinalExpense, carrier: "Life" }) as Product,
  ManhattanLifeSecureAdvantage: Object.freeze({ id: "prod_afbfa67e-a41d-45be-bcbc-bf31e7de669f", displayName: "Manhattan Life Secure Advantage", productType: ProductType.FinalExpense, carrier: "Manhattan" }) as Product,
  MutualOfOmahaLivingPromise: Object.freeze({ id: "prod_cb26875d-f5b2-52f7-8f89-66cb3d779bf8", displayName: "Mutual of Omaha Living Promise", productType: ProductType.FinalExpense, carrier: "Mutual" }) as Product,
  NewbridgeFinalExpense: Object.freeze({ id: "prod_007e74bf-671c-41cc-be27-28cfd75fd5d2", displayName: "Newbridge Final Expense", productType: ProductType.FinalExpense, carrier: "Newbridge" }) as Product,
  OccidentalLifeClearChoice: Object.freeze({ id: "prod_b06445f5-5e02-5111-863b-5e1260b4524b", displayName: "Occidental Life Clear Choice", productType: ProductType.FinalExpense, carrier: "Occidental" }) as Product,
  OccidentalLifeDignitySolutions: Object.freeze({ id: "prod_07bdd66e-7e3c-5f7f-9c8e-b4bb414dd9e2", displayName: "Occidental Life Dignity Solutions", productType: ProductType.FinalExpense, carrier: "Occidental" }) as Product,
  OccidentalLifeGoldenSolution: Object.freeze({ id: "prod_d2eeac7e-6aad-5eee-83e1-fd2aee0da64c", displayName: "Occidental Life Golden Solution", productType: ProductType.FinalExpense, carrier: "Occidental" }) as Product,
  OccidentalLifeInnovativeSolutions: Object.freeze({ id: "prod_4b038ed0-2aa2-58e6-9c62-9aa736e4d9b5", displayName: "Occidental Life Innovative Solutions", productType: ProductType.FinalExpense, carrier: "Occidental" }) as Product,
  OccidentalLifePlatinumSolutionLegacyPlan: Object.freeze({ id: "prod_fbd566f8-72f6-5383-84e9-a84c517c8815", displayName: "Occidental Life Platinum Solution Legacy Plan", productType: ProductType.FinalExpense, carrier: "Occidental" }) as Product,
  OccidentalLifeSeniorChoice: Object.freeze({ id: "prod_97d8f31d-764a-549c-9834-6691e1db06a8", displayName: "Occidental Life Senior Choice", productType: ProductType.FinalExpense, carrier: "Occidental" }) as Product,
  OccidentalLifeTribute: Object.freeze({ id: "prod_0c5d1d8d-dd9e-59b8-a5c7-dddfd4b7da1a", displayName: "Occidental Life Tribute", productType: ProductType.FinalExpense, carrier: "Occidental" }) as Product,
  OxfordLifeSimplifiedIssue: Object.freeze({ id: "prod_a5a3a129-cf4d-57bf-a278-034b65348c11", displayName: "Oxford Life Simplified Issue", productType: ProductType.FinalExpense, carrier: "Oxford" }) as Product,
  PekinWholeLife: Object.freeze({ id: "prod_8e946869-fe0e-5f8c-a231-cc1671e4b2d4", displayName: "Pekin Whole Life", productType: ProductType.FinalExpense, carrier: "Pekin" }) as Product,
  PioneerAmericanIndependentAmerican: Object.freeze({ id: "prod_42cfd631-69ea-5711-858d-168503cb0680", displayName: "Pioneer American Independent American", productType: ProductType.FinalExpense, carrier: "Pioneer" }) as Product,
  PioneerAmericanNorthstarLegacy: Object.freeze({ id: "prod_ec518d73-777d-5976-b4fd-d2e0b6332c56", displayName: "Pioneer American NorthStar Legacy", productType: ProductType.FinalExpense, carrier: "Pioneer" }) as Product,
  RoyalArcanumGraded: Object.freeze({ id: "prod_4d67b7ca-cc86-5849-8e32-5e22bea6cdce", displayName: "Royal Arcanum Graded", productType: ProductType.FinalExpense, carrier: "Royal" }) as Product,
  RoyalArcanumSimplifiedIssue: Object.freeze({ id: "prod_bf77cdcd-078d-534c-a923-861ce722a0e8", displayName: "Royal Arcanum Simplified Issue", productType: ProductType.FinalExpense, carrier: "Royal" }) as Product,
  RoyalNeighborsEnsuredLegacy: Object.freeze({ id: "prod_b039d938-ced2-4496-ad4d-f28b795b8089", displayName: "Royal Neighbors Ensured Legacy", productType: ProductType.FinalExpense, carrier: "Royal" }) as Product,
  SbliLivingLegacy: Object.freeze({ id: "prod_09b94921-6ba1-5f17-92da-5750c2c0b12a", displayName: "SBLI Living Legacy", productType: ProductType.FinalExpense, carrier: "SBLI" }) as Product,
  SecuricoLifeFinalExpense: Object.freeze({ id: "prod_e2a56a6e-9d28-51d2-893f-b980998b7822", displayName: "Securico Life Final Expense", productType: ProductType.FinalExpense, carrier: "Securico" }) as Product,
  SecurityNationalSimpleSecurity: Object.freeze({ id: "prod_81f01f85-1d97-58b1-9892-f7fd66ac2152", displayName: "Security National Simple Security", productType: ProductType.FinalExpense, carrier: "Security" }) as Product,
  SeniorLifeWholeLife: Object.freeze({ id: "prod_ed4476ae-f668-4a64-96cc-d618c1f018b8", displayName: "Senior Life Whole Life", productType: ProductType.FinalExpense, carrier: "Senior" }) as Product,
  SentinelSecurityNewVantage: Object.freeze({ id: "prod_cac5f3fe-1d7a-5865-84cf-8000ff8bcfd7", displayName: "Sentinel Security New Vantage", productType: ProductType.FinalExpense, carrier: "Sentinel" }) as Product,
  SonsOfNorwayLegacySure: Object.freeze({ id: "prod_2dec8fd4-8ead-4862-a51e-e51f7aae8ee5", displayName: "Sons of Norway Legacy Sure", productType: ProductType.FinalExpense, carrier: "Sons" }) as Product,
  SonsOfNorwayWholeLife: Object.freeze({ id: "prod_9b00ed35-28a2-4ce6-a50e-914213419d6b", displayName: "Sons of Norway Whole Life", productType: ProductType.FinalExpense, carrier: "Sons" }) as Product,
  SUsaGoldenPromise: Object.freeze({ id: "prod_79a26030-6b45-416a-b97d-02e0200a4d39", displayName: "S.USA Golden Promise", productType: ProductType.FinalExpense, carrier: "S.USA" }) as Product,
  TransamericaFeExpressSolution: Object.freeze({ id: "prod_18477e53-831f-47bf-829c-0237c23b6fb6", displayName: "TransAmerica FE Express Solution", productType: ProductType.FinalExpense, carrier: "TransAmerica" }) as Product,
  TransamericaSolution: Object.freeze({ id: "prod_e64af080-608b-5c34-ba46-166d008fa249", displayName: "TransAmerica Solution", productType: ProductType.FinalExpense, carrier: "TransAmerica" }) as Product,
  TrinityGoldenEagle: Object.freeze({ id: "prod_19c56704-7c68-5320-9a8a-042c94ceba64", displayName: "Trinity Golden Eagle", productType: ProductType.FinalExpense, carrier: "Trinity" }) as Product,
  UnitedFarmAndFamilyWholeLife: Object.freeze({ id: "prod_a6f48502-08be-5a6b-9934-d3cb3f470972", displayName: "United Farm And Family Whole Life", productType: ProductType.FinalExpense, carrier: "United" }) as Product,
  UnitedHomeLifeWholeLife: Object.freeze({ id: "prod_d851aa99-47f9-5400-a966-97a0b5a71bb3", displayName: "United Home Life Whole Life", productType: ProductType.FinalExpense, carrier: "United" }) as Product,
} as const;

const MEDSUP_PRODUCTS = {
  AetnaAccendoMedicareSupplement: Object.freeze({ id: "prod_c134cc26-08e2-5489-8e60-8bea89e89f49", displayName: "Aetna Accendo Medicare Supplement", productType: ProductType.MedicareSupplement, carrier: "Aetna" }) as Product,
  AetnaMedicareSupplement: Object.freeze({ id: "prod_8378b6bc-e99a-5f77-8f0d-cc978560c72f", displayName: "Aetna Medicare Supplement", productType: ProductType.MedicareSupplement, carrier: "Aetna" }) as Product,
  ManhattanLifeMedicareSupplement: Object.freeze({ id: "prod_5ba7fc1f-0bd8-5f49-827a-ca049312920f", displayName: "Manhattan Life Medicare Supplement", productType: ProductType.MedicareSupplement, carrier: "Manhattan" }) as Product,
  MutualOfOmahaMedicareSupplement: Object.freeze({ id: "prod_88e1ad8f-a3b3-52dd-89b7-8ae7e9d81eca", displayName: "Mutual of Omaha Medicare Supplement", productType: ProductType.MedicareSupplement, carrier: "Mutual" }) as Product,
} as const;

const PRENEED_PRODUCTS = {
  BetterlifeSinglePremium: Object.freeze({ id: "prod_558a0ca1-c2a3-5007-916d-28dde3eaeabb", displayName: "BetterLife Single Premium", productType: ProductType.Preneed, carrier: "BetterLife" }) as Product,
  GlobalAtlanticSimpleProtectionPlan: Object.freeze({ id: "prod_52d6ba39-47d6-5527-bd4a-49bca391ab19", displayName: "Global Atlantic Simple Protection Plan", productType: ProductType.Preneed, carrier: "Global" }) as Product,
} as const;

const TERM_PRODUCTS = {
  AmericanAmicableEasyTerm: Object.freeze({ id: "prod_8bf67d18-391b-51c2-9333-cf557e81d1ff", displayName: "American Amicable Easy Term", productType: ProductType.Term, carrier: "American" }) as Product,
  AmericanAmicableHomeProtector: Object.freeze({ id: "prod_7f5a7c56-8ef1-5874-a3c6-6433b4c6c3c4", displayName: "American Amicable Home Protector", productType: ProductType.Term, carrier: "American" }) as Product,
  AmericanAmicableTermMadeSimple: Object.freeze({ id: "prod_d6147bbb-b210-5422-9ec4-41de0379e552", displayName: "American Amicable Term Made Simple", productType: ProductType.Term, carrier: "American" }) as Product,
  AmericoHmsPlus: Object.freeze({ id: "prod_9b379a0d-320e-50ac-bd2e-8519ea503286", displayName: "Americo HMS PLUS", productType: ProductType.Term, carrier: "Americo" }) as Product,
  AmeritasFlxLivingBenefitsTerm: Object.freeze({ id: "prod_e832f26e-f6e6-5009-8c13-d17e5bc6a02f", displayName: "Ameritas FLX Living Benefits Term", productType: ProductType.Term, carrier: "Ameritas" }) as Product,
  AmeritasValuePlusTerm: Object.freeze({ id: "prod_6b476015-eeca-5f02-a259-36820bd47b98", displayName: "Ameritas Value Plus Term", productType: ProductType.Term, carrier: "Ameritas" }) as Product,
  BannerOpterm: Object.freeze({ id: "prod_58edb7da-536d-51d3-8a23-ecb500d37de3", displayName: "Banner OPTerm", productType: ProductType.Term, carrier: "Banner" }) as Product,
  CorebridgeSelectATerm: Object.freeze({ id: "prod_72169acb-1a87-5848-9df0-96454c709b81", displayName: "Corebridge Select A Term", productType: ProductType.Term, carrier: "Corebridge" }) as Product,
  FidelityLifeInstabrainPureTerm: Object.freeze({ id: "prod_ddcffff2-12d0-4549-a6af-1eee7d73d646", displayName: "Fidelity Life InstaBrain Pure Term", productType: ProductType.Term, carrier: "Fidelity" }) as Product,
  FidelityLifeInstabrainTerm: Object.freeze({ id: "prod_10f36326-2bd4-5ae1-8463-e04ad594db6c", displayName: "Fidelity Life InstaBrain Term", productType: ProductType.Term, carrier: "Fidelity" }) as Product,
  FidelityLifeInstaterm: Object.freeze({ id: "prod_e1c66430-dec1-571a-b96b-17231fe55c12", displayName: "Fidelity Life InstaTerm", productType: ProductType.Term, carrier: "Fidelity" }) as Product,
  ForestersStrongFoundation: Object.freeze({ id: "prod_797c9cc3-325f-5058-b092-ca811dfd89cf", displayName: "Foresters Strong Foundation", productType: ProductType.Term, carrier: "Foresters" }) as Product,
  ForestersYourTerm: Object.freeze({ id: "prod_82b87fc0-e3dc-5fb6-bf18-85035e6cb8cf", displayName: "Foresters Your Term", productType: ProductType.Term, carrier: "Foresters" }) as Product,
  ForestersYourTermNonMedical: Object.freeze({ id: "prod_f5c30718-4681-599f-8110-b5aaacd778c7", displayName: "Foresters Your Term Non Medical", productType: ProductType.Term, carrier: "Foresters" }) as Product,
  GpmQMark: Object.freeze({ id: "prod_bb80c30b-eba4-5319-8ba6-13d807bfba9a", displayName: "GPM Q Mark", productType: ProductType.Term, carrier: "GPM" }) as Product,
  GtlTurboTerm: Object.freeze({ id: "prod_a8249c2b-5277-5113-8ecc-4d8b0f507662", displayName: "GTL Turbo Term", productType: ProductType.Term, carrier: "GTL" }) as Product,
  HeroLifeTerm: Object.freeze({ id: "prod_7f6016d9-9f12-5f75-a57a-cd16ddffe99c", displayName: "Hero Life Term", productType: ProductType.Term, carrier: "Hero" }) as Product,
  JohnHancockSimpleTermWithVitality: Object.freeze({ id: "prod_0d293690-3896-530f-a94b-aa2cb72d30bd", displayName: "John Hancock Simple Term with Vitality", productType: ProductType.Term, carrier: "John" }) as Product,
  KansasCityLifeSignatureTermExpress: Object.freeze({ id: "prod_65015b8a-d64d-55f1-9ca1-06588d8b073e", displayName: "Kansas City Life Signature Term Express", productType: ProductType.Term, carrier: "Kansas" }) as Product,
  LincolnLifeelements: Object.freeze({ id: "prod_9071ccab-2830-59ed-8715-f2330215bf0d", displayName: "Lincoln LifeElements", productType: ProductType.Term, carrier: "Lincoln" }) as Product,
  LincolnTermaccel: Object.freeze({ id: "prod_45751b44-a561-54c2-9e1d-4120fdc09e7f", displayName: "Lincoln TermAccel", productType: ProductType.Term, carrier: "Lincoln" }) as Product,
  MutualOfOmahaTermLifeAnswers: Object.freeze({ id: "prod_ab68ec62-2afe-561c-acd7-dab8eaf56846", displayName: "Mutual of Omaha Term Life Answers", productType: ProductType.Term, carrier: "Mutual" }) as Product,
  MutualOfOmahaTermLifeExpress: Object.freeze({ id: "prod_1452309d-291d-54dc-aca7-cc313811a239", displayName: "Mutual of Omaha Term Life Express", productType: ProductType.Term, carrier: "Mutual" }) as Product,
  NationwideYourlife: Object.freeze({ id: "prod_f8d141bf-d0b5-5a97-9226-4b1ab5380d47", displayName: "Nationwide YourLife", productType: ProductType.Term, carrier: "Nationwide" }) as Product,
  NorthAmericanAddvantage: Object.freeze({ id: "prod_29cffca2-ddfc-54de-a94b-65595b68adf3", displayName: "North American ADDvantage", productType: ProductType.Term, carrier: "North" }) as Product,
  ProsperityFamilyFreedomTerm: Object.freeze({ id: "prod_090de60e-d322-55d9-8ef5-a010e5275cc5", displayName: "Prosperity Family Freedom Term", productType: ProductType.Term, carrier: "Prosperity" }) as Product,
  ProtectiveLifeClassicChoiceTerm: Object.freeze({ id: "prod_b11965d0-4866-5e50-b348-d93e09832867", displayName: "Protective Life Classic Choice Term", productType: ProductType.Term, carrier: "Protective" }) as Product,
  ProtectiveLifeCustomChoiceTerm: Object.freeze({ id: "prod_6a8bfb0c-15da-51f4-a267-6d237e125d97", displayName: "Protective Life Custom Choice Term", productType: ProductType.Term, carrier: "Protective" }) as Product,
  PrudentialEssentialTermPlus: Object.freeze({ id: "prod_80952375-cbed-5817-910c-07475af33604", displayName: "Prudential Essential Term Plus", productType: ProductType.Term, carrier: "Prudential" }) as Product,
  PrudentialEssentialTermValue: Object.freeze({ id: "prod_3d619542-5829-5d2a-9450-6e2673e7cb94", displayName: "Prudential Essential Term Value", productType: ProductType.Term, carrier: "Prudential" }) as Product,
  SagicorSageTerm: Object.freeze({ id: "prod_3a9f8911-2d94-5f27-88b8-62dcc7d5727a", displayName: "Sagicor Sage Term", productType: ProductType.Term, carrier: "Sagicor" }) as Product,
  SbliTTerm: Object.freeze({ id: "prod_360fe967-f7e1-5ab4-8f1a-e56e9ef543ab", displayName: "SBLI T Term", productType: ProductType.Term, carrier: "SBLI" }) as Product,
  SeniorLifeTermLife: Object.freeze({ id: "prod_ccebb3f4-2be4-5a64-8365-6e72faf5185d", displayName: "Senior Life Term Life", productType: ProductType.Term, carrier: "Senior" }) as Product,
  TransamericaTrendsetterLb: Object.freeze({ id: "prod_bcfc35ae-30d7-5466-9267-06d09faa3319", displayName: "TransAmerica Trendsetter LB", productType: ProductType.Term, carrier: "TransAmerica" }) as Product,
  TransamericaTrendsetterSuper: Object.freeze({ id: "prod_90d1b5da-5063-56e7-b737-d44b77126da2", displayName: "TransAmerica Trendsetter Super", productType: ProductType.Term, carrier: "TransAmerica" }) as Product,
  WilliamPennOpterm: Object.freeze({ id: "prod_482585d7-6c1c-5042-b42b-09ef12933d1d", displayName: "William Penn OPTerm", productType: ProductType.Term, carrier: "William" }) as Product,
} as const;

type ProductBag = Readonly<Record<string, Product>>;

const ALL_PRODUCTS: readonly Product[] = Object.freeze([
  ...Object.values(FEX_PRODUCTS),
  ...Object.values(MEDSUP_PRODUCTS),
  ...Object.values(PRENEED_PRODUCTS),
  ...Object.values(TERM_PRODUCTS),
]);

const BY_ID: Readonly<Record<string, Product>> = Object.freeze(
  Object.fromEntries(ALL_PRODUCTS.map((p) => [p.id, p])),
);

export const Products = Object.freeze({
  Fex: FEX_PRODUCTS as ProductBag,
  Medsup: MEDSUP_PRODUCTS as ProductBag,
  Preneed: PRENEED_PRODUCTS as ProductBag,
  Term: TERM_PRODUCTS as ProductBag,
  all(): readonly Product[] { return ALL_PRODUCTS; },
  /**
   * Resolve a product by its opaque `prod_<uuid>` id.
   * Returns `undefined` for unknown ids — never throws.
   */
  byId(id: string): Product | undefined { return BY_ID[id]; },
  byLegacy(productType: ProductTypeValue, displayName: string): Product | undefined {
    const ns = (Products as unknown as Record<string, ProductBag>)[productType.namespaceKey];
    if (!ns) return undefined;
    const needle = displayName.toLowerCase();
    for (const p of Object.values(ns)) {
      if (p.displayName.toLowerCase() === needle) return p;
    }
    return undefined;
  },
}) as Readonly<{
  Fex: ProductBag;
  Medsup: ProductBag;
  Preneed: ProductBag;
  Term: ProductBag;
  all: () => readonly Product[];
  byId: (id: string) => Product | undefined;
  byLegacy: (productType: ProductTypeValue, displayName: string) => Product | undefined;
}>;
