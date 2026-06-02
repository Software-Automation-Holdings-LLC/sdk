/**
 * Generated catalog module — do not hand-edit; rerun the generator.
 *
 * Produced by `packages/ts/scripts/gen-catalog.mjs`.
 * Regenerate with `npm run gen:catalog` (runs automatically before `build`).
 *
 * Source data:
 *   - insurance/v2_products.json
 */

/**
 * Product slug enum. Each member's value is the canonical product identifier
 * the platform uses in URLs and reference-data lookups.
 *
 * `ages`, `states`, and `faceAmount` ranges are placeholders today —
 * the upstream catalog does not expose per-product underwriting bounds in a
 * stable, public-facing form. Treat them as advisory zeros until the engine
 * publishes a normalized catalog dump (tracked separately).
 */
export enum Product {
  FexAetnaAccendo = 'fex-aetna-accendo',
  FexAetnaProtectionSeries = 'fex-aetna-protection-series',
  FexAflacFinalExpense = 'fex-aflac-final-expense',
  FexAmericanAmicableClearChoice = 'fex-american-amicable-clear-choice',
  FexAmericanAmicableDignitySolutions = 'fex-american-amicable-dignity-solutions',
  FexAmericanAmicableGoldenSolution = 'fex-american-amicable-golden-solution',
  FexAmericanAmicableInnovativeSolutions = 'fex-american-amicable-innovative-solutions',
  FexAmericanAmicablePlatinumSolutionLegacyPlan = 'fex-american-amicable-platinum-solution-legacy-plan',
  FexAmericanAmicableSeniorChoice = 'fex-american-amicable-senior-choice',
  FexAmericanAmicableTribute = 'fex-american-amicable-tribute',
  FexAmericanHomeLifeGuidestar = 'fex-american-home-life-guidestar',
  FexAmericanHomeLifePatriotSeries = 'fex-american-home-life-patriot-series',
  FexAmericoEaglePremier = 'fex-americo-eagle-premier',
  FexBaltimoreLifeIprovide = 'fex-baltimore-life-iprovide',
  FexBaltimoreLifeSilverGuard = 'fex-baltimore-life-silver-guard',
  FexBetterlifeFinalExpense = 'fex-betterlife-final-expense',
  FexCentrianLivingLegacy = 'fex-centrian-living-legacy',
  FexCicaLifeSuperiorChoice = 'fex-cica-life-superior-choice',
  FexCignaIndividualWholeLife = 'fex-cigna-individual-whole-life',
  FexCombinedGenerationalLife = 'fex-combined-generational-life',
  FexCorebridgeGiwl = 'fex-corebridge-giwl',
  FexCorebridgeSimplinowLegacy = 'fex-corebridge-simplinow-legacy',
  FexEmcEasylife = 'fex-emc-easylife',
  FexEverestIaAmericanAdvantage50Plus = 'fex-everest-ia-american-advantage-50-plus',
  FexFamilyBenefitLifeGoldenEagle = 'fex-family-benefit-life-golden-eagle',
  FexFidelityLifeRapidecision = 'fex-fidelity-life-rapidecision',
  FexFidelityLifeRapidecisionSeniorLife = 'fex-fidelity-life-rapidecision-senior-life',
  FexFirstGuarantyInsuranceSecurityCare = 'fex-first-guaranty-insurance-security-care',
  FexForestersPlanRight = 'fex-foresters-plan-right',
  FexGerberLife = 'fex-gerber-life',
  FexGpmLifeSecureMark = 'fex-gpm-life-secure-mark',
  FexGtlHeritagePlan = 'fex-gtl-heritage-plan',
  FexIllinoisMutualPathProtectorPlus = 'fex-illinois-mutual-path-protector-plus',
  FexKskjFinalExpense = 'fex-kskj-final-expense',
  FexLibertyBankersSimpl = 'fex-liberty-bankers-simpl',
  FexLifeShieldSurvivor = 'fex-life-shield-survivor',
  FexManhattanLifeSecureAdvantage = 'fex-manhattan-life-secure-advantage',
  FexMutualOfOmahaLivingPromise = 'fex-mutual-of-omaha-living-promise',
  FexNewbridgeFinalExpense = 'fex-newbridge-final-expense',
  FexOccidentalLifeClearChoice = 'fex-occidental-life-clear-choice',
  FexOccidentalLifeDignitySolutions = 'fex-occidental-life-dignity-solutions',
  FexOccidentalLifeGoldenSolution = 'fex-occidental-life-golden-solution',
  FexOccidentalLifeInnovativeSolutions = 'fex-occidental-life-innovative-solutions',
  FexOccidentalLifePlatinumSolutionLegacyPlan = 'fex-occidental-life-platinum-solution-legacy-plan',
  FexOccidentalLifeSeniorChoice = 'fex-occidental-life-senior-choice',
  FexOccidentalLifeTribute = 'fex-occidental-life-tribute',
  FexOxfordLifeSimplifiedIssue = 'fex-oxford-life-simplified-issue',
  FexPekinWholeLife = 'fex-pekin-whole-life',
  FexPioneerAmericanIndependentAmerican = 'fex-pioneer-american-independent-american',
  FexPioneerAmericanNorthstarLegacy = 'fex-pioneer-american-northstar-legacy',
  FexRoyalArcanumGraded = 'fex-royal-arcanum-graded',
  FexRoyalArcanumSimplifiedIssue = 'fex-royal-arcanum-simplified-issue',
  FexRoyalNeighborsEnsuredLegacy = 'fex-royal-neighbors-ensured-legacy',
  FexSUsaGoldenPromise = 'fex-s.usa-golden-promise',
  FexSbliLivingLegacy = 'fex-sbli-living-legacy',
  FexSecuricoLifeFinalExpense = 'fex-securico-life-final-expense',
  FexSecurityNationalSimpleSecurity = 'fex-security-national-simple-security',
  FexSeniorLifeWholeLife = 'fex-senior-life-whole-life',
  FexSentinelSecurityNewVantage = 'fex-sentinel-security-new-vantage',
  FexSonsOfNorwayLegacySure = 'fex-sons-of-norway-legacy-sure',
  FexSonsOfNorwayWholeLife = 'fex-sons-of-norway-whole-life',
  FexTransamericaFeExpressSolution = 'fex-transamerica-fe-express-solution',
  FexTransamericaSolution = 'fex-transamerica-solution',
  FexTrinityGoldenEagle = 'fex-trinity-golden-eagle',
  FexUnitedFarmAndFamilyWholeLife = 'fex-united-farm-and-family-whole-life',
  FexUnitedHomeLifeWholeLife = 'fex-united-home-life-whole-life',
  MedsupAetnaAccendoMedsup = 'medsup-aetna-accendo-medsup',
  MedsupAetnaMedsup = 'medsup-aetna-medsup',
  MedsupManhattanLifeMedsup = 'medsup-manhattan-life-medsup',
  MedsupMutualOfOmahaMedsup = 'medsup-mutual-of-omaha-medsup',
  PreneedBetterlifeSinglePremium = 'preneed-betterlife-single-premium',
  PreneedGlobalAtlanticSimpleProtectionPlan = 'preneed-global-atlantic-simple-protection-plan',
  TermAmericanAmicableEasyTerm = 'term-american-amicable-easy-term',
  TermAmericanAmicableHomeProtector = 'term-american-amicable-home-protector',
  TermAmericanAmicableTermMadeSimple = 'term-american-amicable-term-made-simple',
  TermAmericoHmsPlus = 'term-americo-hms-plus',
  TermAmeritasFlxLivingBenefitsTerm = 'term-ameritas-flx-living-benefits-term',
  TermAmeritasValuePlusTerm = 'term-ameritas-value-plus-term',
  TermBannerOpterm = 'term-banner-opterm',
  TermCorebridgeSelectATerm = 'term-corebridge-select-a-term',
  TermFidelityLifeInstabrainPureTerm = 'term-fidelity-life-instabrain-pure-term',
  TermFidelityLifeInstabrainTerm = 'term-fidelity-life-instabrain-term',
  TermFidelityLifeInstaterm = 'term-fidelity-life-instaterm',
  TermForestersStrongFoundation = 'term-foresters-strong-foundation',
  TermForestersYourTerm = 'term-foresters-your-term',
  TermForestersYourTermNonMedical = 'term-foresters-your-term-non-medical',
  TermGpmQMark = 'term-gpm-q-mark',
  TermGtlTurboTerm = 'term-gtl-turbo-term',
  TermHeroLifeTerm = 'term-hero-life-term',
  TermJohnHancockSimpleTermWithVitality = 'term-john-hancock-simple-term-with-vitality',
  TermKansasCityLifeSignatureTermExpress = 'term-kansas-city-life-signature-term-express',
  TermLincolnLifeelements = 'term-lincoln-lifeelements',
  TermLincolnTermaccel = 'term-lincoln-termaccel',
  TermMutualOfOmahaTermLifeAnswers = 'term-mutual-of-omaha-term-life-answers',
  TermMutualOfOmahaTermLifeExpress = 'term-mutual-of-omaha-term-life-express',
  TermNationwideYourlife = 'term-nationwide-yourlife',
  TermNorthAmericanAddvantage = 'term-north-american-addvantage',
  TermProsperityFamilyFreedomTerm = 'term-prosperity-family-freedom-term',
  TermProtectiveLifeClassicChoiceTerm = 'term-protective-life-classic-choice-term',
  TermProtectiveLifeCustomChoiceTerm = 'term-protective-life-custom-choice-term',
  TermPrudentialEssentialTermPlus = 'term-prudential-essential-term-plus',
  TermPrudentialEssentialTermValue = 'term-prudential-essential-term-value',
  TermSagicorSageTerm = 'term-sagicor-sage-term',
  TermSbliTTerm = 'term-sbli-t-term',
  TermSeniorLifeTermLife = 'term-senior-life-term-life',
  TermTransamericaTrendsetterLb = 'term-transamerica-trendsetter-lb',
  TermTransamericaTrendsetterSuper = 'term-transamerica-trendsetter-super',
  TermWilliamPennOpterm = 'term-william-penn-opterm',
}

/** Public metadata for a single `Product`. */
export interface ProductMetadata {
  readonly slug: string;
  readonly displayName: string;
  /** Carrier slug. Look up display name via `ProductCarriers.metadata`. */
  readonly carrier: string;
  /** Product class: `fex`, `term`, `medsup`, `preneed`, etc. */
  readonly productClass: string;
  readonly ages: { readonly min: number; readonly max: number };
  /** ISO 2-letter state codes the product is filed in. */
  readonly states: readonly string[];
  readonly faceAmount: { readonly min: number; readonly max: number };
  /** Display-name variants used for state-specific product filings. */
  readonly stateVariations: readonly string[];
}

const METADATA: Readonly<Record<string, ProductMetadata>> = Object.freeze({
  'fex-aetna-accendo': { slug: 'fex-aetna-accendo', displayName: "Aetna Accendo", carrier: 'aetna', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: ["Aetna Accendo Montana"] },
  'fex-aetna-protection-series': { slug: 'fex-aetna-protection-series', displayName: "Aetna Protection Series", carrier: 'aetna', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-aflac-final-expense': { slug: 'fex-aflac-final-expense', displayName: "Aflac Final Expense", carrier: 'aflac', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-american-amicable-clear-choice': { slug: 'fex-american-amicable-clear-choice', displayName: "American Amicable Clear Choice", carrier: 'american-amicable', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-american-amicable-dignity-solutions': { slug: 'fex-american-amicable-dignity-solutions', displayName: "American Amicable Dignity Solutions", carrier: 'american-amicable', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-american-amicable-golden-solution': { slug: 'fex-american-amicable-golden-solution', displayName: "American Amicable Golden Solution", carrier: 'american-amicable', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-american-amicable-innovative-solutions': { slug: 'fex-american-amicable-innovative-solutions', displayName: "American Amicable Innovative Solutions", carrier: 'american-amicable', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-american-amicable-platinum-solution-legacy-plan': { slug: 'fex-american-amicable-platinum-solution-legacy-plan', displayName: "American Amicable Platinum Solution Legacy Plan", carrier: 'american-amicable', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-american-amicable-senior-choice': { slug: 'fex-american-amicable-senior-choice', displayName: "American Amicable Senior Choice", carrier: 'american-amicable', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-american-amicable-tribute': { slug: 'fex-american-amicable-tribute', displayName: "American Amicable Tribute", carrier: 'american-amicable', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-american-home-life-guidestar': { slug: 'fex-american-home-life-guidestar', displayName: "American Home Life Guidestar", carrier: 'american-home-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-american-home-life-patriot-series': { slug: 'fex-american-home-life-patriot-series', displayName: "American Home Life Patriot Series", carrier: 'american-home-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-americo-eagle-premier': { slug: 'fex-americo-eagle-premier', displayName: "Americo Eagle Premier", carrier: 'americo', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-baltimore-life-iprovide': { slug: 'fex-baltimore-life-iprovide', displayName: "Baltimore Life iProvide", carrier: 'baltimore-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-baltimore-life-silver-guard': { slug: 'fex-baltimore-life-silver-guard', displayName: "Baltimore Life Silver Guard", carrier: 'baltimore-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-betterlife-final-expense': { slug: 'fex-betterlife-final-expense', displayName: "BetterLife Final Expense", carrier: 'betterlife', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-centrian-living-legacy': { slug: 'fex-centrian-living-legacy', displayName: "Centrian Living Legacy", carrier: 'centrian', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-cica-life-superior-choice': { slug: 'fex-cica-life-superior-choice', displayName: "CICA Life Superior Choice", carrier: 'cica-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-cigna-individual-whole-life': { slug: 'fex-cigna-individual-whole-life', displayName: "Cigna Individual Whole Life", carrier: 'cigna', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-combined-generational-life': { slug: 'fex-combined-generational-life', displayName: "Combined Generational Life", carrier: 'combined', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-corebridge-giwl': { slug: 'fex-corebridge-giwl', displayName: "Corebridge GIWL", carrier: 'corebridge', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-corebridge-simplinow-legacy': { slug: 'fex-corebridge-simplinow-legacy', displayName: "Corebridge SimpliNow Legacy", carrier: 'corebridge', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-emc-easylife': { slug: 'fex-emc-easylife', displayName: "EMC EasyLife", carrier: 'emc', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-everest-ia-american-advantage-50-plus': { slug: 'fex-everest-ia-american-advantage-50-plus', displayName: "Everest IA American Advantage 50 Plus", carrier: 'everest-ia-american', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-family-benefit-life-golden-eagle': { slug: 'fex-family-benefit-life-golden-eagle', displayName: "Family Benefit Life Golden Eagle", carrier: 'family-benefit-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-fidelity-life-rapidecision': { slug: 'fex-fidelity-life-rapidecision', displayName: "Fidelity Life RAPIDecision", carrier: 'fidelity-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-fidelity-life-rapidecision-senior-life': { slug: 'fex-fidelity-life-rapidecision-senior-life', displayName: "Fidelity Life RAPIDecision Senior Life", carrier: 'fidelity-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-first-guaranty-insurance-security-care': { slug: 'fex-first-guaranty-insurance-security-care', displayName: "First Guaranty Insurance Security Care", carrier: 'first-guaranty-insurance', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-foresters-plan-right': { slug: 'fex-foresters-plan-right', displayName: "Foresters Plan Right", carrier: 'foresters', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-gerber-life': { slug: 'fex-gerber-life', displayName: "Gerber Life", carrier: 'gerber', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-gpm-life-secure-mark': { slug: 'fex-gpm-life-secure-mark', displayName: "GPM Life Secure Mark", carrier: 'gpm-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-gtl-heritage-plan': { slug: 'fex-gtl-heritage-plan', displayName: "GTL Heritage Plan", carrier: 'gtl', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-illinois-mutual-path-protector-plus': { slug: 'fex-illinois-mutual-path-protector-plus', displayName: "Illinois Mutual Path Protector Plus", carrier: 'illinois-mutual', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-kskj-final-expense': { slug: 'fex-kskj-final-expense', displayName: "KSKJ Final Expense", carrier: 'kskj', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-liberty-bankers-simpl': { slug: 'fex-liberty-bankers-simpl', displayName: "Liberty Bankers Simpl", carrier: 'liberty-bankers', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-life-shield-survivor': { slug: 'fex-life-shield-survivor', displayName: "Life Shield Survivor", carrier: 'life-shield', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-manhattan-life-secure-advantage': { slug: 'fex-manhattan-life-secure-advantage', displayName: "Manhattan Life Secure Advantage", carrier: 'manhattan-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-mutual-of-omaha-living-promise': { slug: 'fex-mutual-of-omaha-living-promise', displayName: "Mutual of Omaha Living Promise", carrier: 'mutual-of-omaha', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-newbridge-final-expense': { slug: 'fex-newbridge-final-expense', displayName: "Newbridge Final Expense", carrier: 'newbridge', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-occidental-life-clear-choice': { slug: 'fex-occidental-life-clear-choice', displayName: "Occidental Life Clear Choice", carrier: 'occidental-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-occidental-life-dignity-solutions': { slug: 'fex-occidental-life-dignity-solutions', displayName: "Occidental Life Dignity Solutions", carrier: 'occidental-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-occidental-life-golden-solution': { slug: 'fex-occidental-life-golden-solution', displayName: "Occidental Life Golden Solution", carrier: 'occidental-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-occidental-life-innovative-solutions': { slug: 'fex-occidental-life-innovative-solutions', displayName: "Occidental Life Innovative Solutions", carrier: 'occidental-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-occidental-life-platinum-solution-legacy-plan': { slug: 'fex-occidental-life-platinum-solution-legacy-plan', displayName: "Occidental Life Platinum Solution Legacy Plan", carrier: 'occidental-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-occidental-life-senior-choice': { slug: 'fex-occidental-life-senior-choice', displayName: "Occidental Life Senior Choice", carrier: 'occidental-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-occidental-life-tribute': { slug: 'fex-occidental-life-tribute', displayName: "Occidental Life Tribute", carrier: 'occidental-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-oxford-life-simplified-issue': { slug: 'fex-oxford-life-simplified-issue', displayName: "Oxford Life Simplified Issue", carrier: 'oxford-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-pekin-whole-life': { slug: 'fex-pekin-whole-life', displayName: "Pekin Whole Life", carrier: 'pekin', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-pioneer-american-independent-american': { slug: 'fex-pioneer-american-independent-american', displayName: "Pioneer American Independent American", carrier: 'pioneer-american', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-pioneer-american-northstar-legacy': { slug: 'fex-pioneer-american-northstar-legacy', displayName: "Pioneer American NorthStar Legacy", carrier: 'pioneer-american', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-royal-arcanum-graded': { slug: 'fex-royal-arcanum-graded', displayName: "Royal Arcanum Graded", carrier: 'royal-arcanum', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-royal-arcanum-simplified-issue': { slug: 'fex-royal-arcanum-simplified-issue', displayName: "Royal Arcanum Simplified Issue", carrier: 'royal-arcanum', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-royal-neighbors-ensured-legacy': { slug: 'fex-royal-neighbors-ensured-legacy', displayName: "Royal Neighbors Ensured Legacy", carrier: 'royal-neighbors', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-s.usa-golden-promise': { slug: 'fex-s.usa-golden-promise', displayName: "S.USA Golden Promise", carrier: 's-usa', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-sbli-living-legacy': { slug: 'fex-sbli-living-legacy', displayName: "SBLI Living Legacy", carrier: 'sbli', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-securico-life-final-expense': { slug: 'fex-securico-life-final-expense', displayName: "Securico Life Final Expense", carrier: 'securico-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-security-national-simple-security': { slug: 'fex-security-national-simple-security', displayName: "Security National Simple Security", carrier: 'security-national', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-senior-life-whole-life': { slug: 'fex-senior-life-whole-life', displayName: "Senior Life Whole Life", carrier: 'senior-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-sentinel-security-new-vantage': { slug: 'fex-sentinel-security-new-vantage', displayName: "Sentinel Security New Vantage", carrier: 'sentinel-security', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-sons-of-norway-legacy-sure': { slug: 'fex-sons-of-norway-legacy-sure', displayName: "Sons of Norway Legacy Sure", carrier: 'sons-of-norway', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-sons-of-norway-whole-life': { slug: 'fex-sons-of-norway-whole-life', displayName: "Sons of Norway Whole Life", carrier: 'sons-of-norway', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-transamerica-fe-express-solution': { slug: 'fex-transamerica-fe-express-solution', displayName: "TransAmerica FE Express Solution", carrier: 'transamerica', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-transamerica-solution': { slug: 'fex-transamerica-solution', displayName: "TransAmerica Solution", carrier: 'transamerica', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-trinity-golden-eagle': { slug: 'fex-trinity-golden-eagle', displayName: "Trinity Golden Eagle", carrier: 'trinity', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-united-farm-and-family-whole-life': { slug: 'fex-united-farm-and-family-whole-life', displayName: "United Farm And Family Whole Life", carrier: 'united-farm-and-family', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'fex-united-home-life-whole-life': { slug: 'fex-united-home-life-whole-life', displayName: "United Home Life Whole Life", carrier: 'united-home-life', productClass: 'fex', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'medsup-aetna-accendo-medsup': { slug: 'medsup-aetna-accendo-medsup', displayName: "Aetna Accendo Medicare Supplement", carrier: 'aetna-accendo', productClass: 'medsup', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'medsup-aetna-medsup': { slug: 'medsup-aetna-medsup', displayName: "Aetna Medicare Supplement", carrier: 'aetna', productClass: 'medsup', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'medsup-manhattan-life-medsup': { slug: 'medsup-manhattan-life-medsup', displayName: "Manhattan Life Medicare Supplement", carrier: 'manhattan-life', productClass: 'medsup', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'medsup-mutual-of-omaha-medsup': { slug: 'medsup-mutual-of-omaha-medsup', displayName: "Mutual of Omaha Medicare Supplement", carrier: 'mutual-of-omaha', productClass: 'medsup', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'preneed-betterlife-single-premium': { slug: 'preneed-betterlife-single-premium', displayName: "BetterLife Single Premium", carrier: 'betterlife', productClass: 'preneed', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'preneed-global-atlantic-simple-protection-plan': { slug: 'preneed-global-atlantic-simple-protection-plan', displayName: "Global Atlantic Simple Protection Plan", carrier: 'global-atlantic', productClass: 'preneed', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-american-amicable-easy-term': { slug: 'term-american-amicable-easy-term', displayName: "American Amicable Easy Term", carrier: 'american-amicable', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-american-amicable-home-protector': { slug: 'term-american-amicable-home-protector', displayName: "American Amicable Home Protector", carrier: 'american-amicable', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-american-amicable-term-made-simple': { slug: 'term-american-amicable-term-made-simple', displayName: "American Amicable Term Made Simple", carrier: 'american-amicable', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-americo-hms-plus': { slug: 'term-americo-hms-plus', displayName: "Americo HMS PLUS", carrier: 'americo', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-ameritas-flx-living-benefits-term': { slug: 'term-ameritas-flx-living-benefits-term', displayName: "Ameritas FLX Living Benefits Term", carrier: 'ameritas', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-ameritas-value-plus-term': { slug: 'term-ameritas-value-plus-term', displayName: "Ameritas Value Plus Term", carrier: 'ameritas', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-banner-opterm': { slug: 'term-banner-opterm', displayName: "Banner OPTerm", carrier: 'banner', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-corebridge-select-a-term': { slug: 'term-corebridge-select-a-term', displayName: "Corebridge Select A Term", carrier: 'corebridge', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-fidelity-life-instabrain-pure-term': { slug: 'term-fidelity-life-instabrain-pure-term', displayName: "Fidelity Life InstaBrain Pure Term", carrier: 'fidelity-life', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-fidelity-life-instabrain-term': { slug: 'term-fidelity-life-instabrain-term', displayName: "Fidelity Life InstaBrain Term", carrier: 'fidelity-life', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-fidelity-life-instaterm': { slug: 'term-fidelity-life-instaterm', displayName: "Fidelity Life InstaTerm", carrier: 'fidelity-life', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-foresters-strong-foundation': { slug: 'term-foresters-strong-foundation', displayName: "Foresters Strong Foundation", carrier: 'foresters', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-foresters-your-term': { slug: 'term-foresters-your-term', displayName: "Foresters Your Term", carrier: 'foresters', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-foresters-your-term-non-medical': { slug: 'term-foresters-your-term-non-medical', displayName: "Foresters Your Term Non Medical", carrier: 'foresters', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-gpm-q-mark': { slug: 'term-gpm-q-mark', displayName: "GPM Q Mark", carrier: 'gpm', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-gtl-turbo-term': { slug: 'term-gtl-turbo-term', displayName: "GTL Turbo Term", carrier: 'gtl', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-hero-life-term': { slug: 'term-hero-life-term', displayName: "Hero Life Term", carrier: 'hero-life', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-john-hancock-simple-term-with-vitality': { slug: 'term-john-hancock-simple-term-with-vitality', displayName: "John Hancock Simple Term with Vitality", carrier: 'john-hancock', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-kansas-city-life-signature-term-express': { slug: 'term-kansas-city-life-signature-term-express', displayName: "Kansas City Life Signature Term Express", carrier: 'kansas-city-life', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-lincoln-lifeelements': { slug: 'term-lincoln-lifeelements', displayName: "Lincoln LifeElements", carrier: 'lincoln', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-lincoln-termaccel': { slug: 'term-lincoln-termaccel', displayName: "Lincoln TermAccel", carrier: 'lincoln', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-mutual-of-omaha-term-life-answers': { slug: 'term-mutual-of-omaha-term-life-answers', displayName: "Mutual of Omaha Term Life Answers", carrier: 'mutual-of-omaha', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-mutual-of-omaha-term-life-express': { slug: 'term-mutual-of-omaha-term-life-express', displayName: "Mutual of Omaha Term Life Express", carrier: 'mutual-of-omaha', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-nationwide-yourlife': { slug: 'term-nationwide-yourlife', displayName: "Nationwide YourLife", carrier: 'nationwide', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-north-american-addvantage': { slug: 'term-north-american-addvantage', displayName: "North American ADDvantage", carrier: 'north-american', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-prosperity-family-freedom-term': { slug: 'term-prosperity-family-freedom-term', displayName: "Prosperity Family Freedom Term", carrier: 'prosperity', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-protective-life-classic-choice-term': { slug: 'term-protective-life-classic-choice-term', displayName: "Protective Life Classic Choice Term", carrier: 'protective-life', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-protective-life-custom-choice-term': { slug: 'term-protective-life-custom-choice-term', displayName: "Protective Life Custom Choice Term", carrier: 'protective-life', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-prudential-essential-term-plus': { slug: 'term-prudential-essential-term-plus', displayName: "Prudential Essential Term Plus", carrier: 'prudential', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-prudential-essential-term-value': { slug: 'term-prudential-essential-term-value', displayName: "Prudential Essential Term Value", carrier: 'prudential', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-sagicor-sage-term': { slug: 'term-sagicor-sage-term', displayName: "Sagicor Sage Term", carrier: 'sagicor', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-sbli-t-term': { slug: 'term-sbli-t-term', displayName: "SBLI T Term", carrier: 'sbli', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-senior-life-term-life': { slug: 'term-senior-life-term-life', displayName: "Senior Life Term Life", carrier: 'senior-life', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-transamerica-trendsetter-lb': { slug: 'term-transamerica-trendsetter-lb', displayName: "TransAmerica Trendsetter LB", carrier: 'transamerica', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-transamerica-trendsetter-super': { slug: 'term-transamerica-trendsetter-super', displayName: "TransAmerica Trendsetter Super", carrier: 'transamerica', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
  'term-william-penn-opterm': { slug: 'term-william-penn-opterm', displayName: "William Penn OPTerm", carrier: 'william-penn', productClass: 'term', ages: { min: 0, max: 0 }, states: [], faceAmount: { min: 0, max: 0 }, stateVariations: [] },
});

const ALL_PRODUCTS: readonly Product[] = Object.freeze(
  Object.values(Product) as Product[],
);

function lc(s: string): string {
  return s.toLowerCase();
}

/** Catalog API for `Product`. All methods return frozen, sorted views. */
export const Products = Object.freeze({
  /** Every product slug. Sorted alphabetically. */
  values(): readonly Product[] {
    return ALL_PRODUCTS;
  },
  /** `[Product, ProductMetadata]` pairs in catalog order. */
  entries(): ReadonlyArray<readonly [Product, ProductMetadata]> {
    return ALL_PRODUCTS.map((p) => [p, METADATA[p]!] as const);
  },
  /** Products filed by a given carrier slug. Case-insensitive match. */
  byCarrier(carrier: string): readonly Product[] {
    const target = lc(carrier);
    return ALL_PRODUCTS.filter((p) => METADATA[p]!.carrier === target);
  },
  /**
   * Substring search across slug, display name, and state-specific names.
   * Returns matches sorted by relevance (prefix matches first, then
   * substring matches).
   */
  search(query: string): readonly Product[] {
    const q = lc(query.trim());
    if (q === '') return [];
    const prefix: Product[] = [];
    const substring: Product[] = [];
    for (const p of ALL_PRODUCTS) {
      const m = METADATA[p]!;
      const variations = m.stateVariations.map(lc).join(' ');
      const hay = (m.slug + ' ' + lc(m.displayName) + ' ' + variations);
      if (
        hay.startsWith(q) ||
        lc(m.displayName).startsWith(q) ||
        m.stateVariations.some((name) => lc(name).startsWith(q))
      ) {
        prefix.push(p);
      } else if (hay.includes(q)) {
        substring.push(p);
      }
    }
    return [...prefix, ...substring];
  },
  /** Metadata lookup; throws on unknown slug (the enum makes that impossible at compile time). */
  metadata(p: Product): ProductMetadata {
    const m = METADATA[p];
    if (!m) throw new Error(`Products.metadata: unknown product '${p}'`);
    return m;
  },
});
